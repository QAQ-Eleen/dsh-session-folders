// dsh-session-folders — 会话归位
//
// Every session gets its own time-stamped folder instead of piling artifacts in
// the workspace root. The plugin is intentionally small and dependency-free
// besides `schemastery` (present in every DSH profile):
//
//   * `session_folder` — model-facing tool: creates the folder, optionally
//     switches the session working directory into it, and writes the note.
//   * `/folder` and `/sf` — the same action as a human command.
//   * a system-prompt section telling the model to open with that tool.
//
// No session-creation hook is used: DSH has no official seam for rewriting a
// session's `header.cwd` at creation, so the folder is created (and entered)
// through the public `workingDirectory` service the first time the model or a
// human asks for one.

import { access, mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import z from '@deepseek-ai/schemastery'
import { formatStamp, uniqueName } from './naming.js'
import { noteTime, renderNote } from './note.js'

/** Loader-visible plugin name. */
export const name = 'session-folders'

/** Services this plugin needs before it can mount. */
export const inject = ['tools', 'commands', 'systemPrompt', 'workingDirectory']

/** The note file written into every session folder. */
const NOTE_FILE = '_会话说明.md'

/** Loader schema; every field has a default so an empty row works. */
export const Config = z.object({
  enabled: z.boolean().default(true),
  root: z.string().default(''),
  format: z.string().default('yy-MM-dd_HHmm'),
  timezone: z.string().default(''),
  writeSessionNote: z.boolean().default(true),
  collisionSuffix: z.string().default('-2'),
})

/** Bilingual policy injected into the system prompt. */
const POLICY = [
  '## Session folders / 会话文件夹',
  '',
  'At the very start of a session, before creating any deliverable, call `session_folder`',
  '(no arguments) and work inside the returned `path`. Do not invent a folder name yourself.',
  'If the session already runs inside its own dated folder, do not create another one.',
  '',
  '每个会话开工前先调用 `session_folder` 工具，之后所有文件都写在它返回的目录里；',
  '不要自己拼目录名。若已经有本会话的时间文件夹，不要重复创建。',
].join('\n')

/** Resolve the configured root, falling back to the session workspace directory. */
function resolveRoot(config, agent) {
  const configured = typeof config.root === 'string' ? config.root.trim() : ''
  if (configured !== '') {
    const expanded = configured.startsWith('~')
      ? join(homedir(), configured.slice(1).replace(/^[\\/]+/u, ''))
      : configured
    return isAbsolute(expanded) ? expanded : resolve(process.cwd(), expanded)
  }
  const headerCwd = agent?.session?.header?.cwd
  if (typeof headerCwd === 'string' && headerCwd !== '') return headerCwd
  return process.cwd()
}

/** Probe whether one candidate name is already taken inside `base`. */
async function taken(base, candidate) {
  try {
    await access(join(base, candidate))
    return true
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'ENOENT') return false
    throw error
  }
}

/**
 * Create the session folder, write its note, and enter it.
 *
 * @param {object} ctx - Cordis context carrying the working-directory service.
 * @param {object} config - resolved plugin configuration.
 * @param {object} agent - invoking agent, whose session owns the folder.
 * @param {string} [label] - optional label for the note.
 * @param {string} [overrideRoot] - per-call root override.
 * @returns {Promise<string>} the absolute folder path.
 */
async function createSessionFolder(ctx, config, agent, label, overrideRoot) {
  if (agent === undefined || agent === null) throw new Error('session_folder requires an owning agent session')
  const root = typeof overrideRoot === 'string' && overrideRoot.trim() !== ''
    ? resolveRoot({ ...config, root: overrideRoot }, agent)
    : resolveRoot(config, agent)
  const now = new Date()
  const stamp = formatStamp(config.format, now, config.timezone)
  const folderName = await uniqueName(stamp, config.collisionSuffix, (candidate) => taken(root, candidate))
  const target = join(root, folderName)
  await mkdir(target, { recursive: true })
  if (config.writeSessionNote === true) {
    try {
      await writeFile(join(target, NOTE_FILE), renderNote({ dirName: folderName, time: now, label, path: target }), 'utf8')
    } catch (error) {
      ctx.logger?.warn?.(`session-folders: could not write ${NOTE_FILE}: ${String(error)}`)
    }
  }
  try {
    await ctx.workingDirectory.set(agent, target)
  } catch (error) {
    ctx.logger?.warn?.(`session-folders: created ${target} but could not switch the working directory: ${String(error)}`)
  }
  return target
}

/**
 * Mount the tool, the commands, and the prompt section.
 *
 * @param {object} ctx - plugin context with tools, commands, systemPrompt and workingDirectory.
 * @param {object} [rawConfig] - loader configuration.
 */
export function apply(ctx, rawConfig) {
  const config = { ...Config(rawConfig ?? {}) }
  if (config.enabled !== true) return

  const order = (() => {
    try {
      const base = ctx.systemPrompt.getSectionOrder?.('DEPLOYMENT_PERSONA_SUFFIX')
      return (Number.isFinite(base) ? base : 0) + 10
    } catch {
      return 10
    }
  })()
  ctx.systemPrompt.section({ name: 'session-folders:policy', order, text: POLICY, interpolate: false })

  ctx.tools.register({
    name: 'session_folder',
    description: [
      'Create (or reuse) this session’s own dated folder and work inside it.',
      'Call it once at the start of a session, before writing any deliverable, and put every',
      'artifact the user asked for inside the returned `path`. Returns the absolute folder path.',
      '创建本会话专属的时间文件夹并进入，之后所有产物写在该目录内。',
    ].join(' '),
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        root: {
          type: 'string',
          description: 'Optional directory that should contain the session folder; defaults to the session workspace directory.',
        },
        label: {
          type: 'string',
          description: 'Optional short label recorded in the folder’s _会话说明.md.',
        },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string' },
        },
        required: ['path'],
      },
      render: (_args, value) => [{ type: 'text', text: `会话文件夹：${value.path}\n工作目录已切换。` }],
    },
    isConcurrencySafe: false,
    async execute(args, exec) {
      const path = await createSessionFolder(ctx, config, exec?.agent, args?.label, args?.root)
      return { path }
    },
  })

  const runCommand = async ({ agent, rawInput }) => {
    try {
      const path = await createSessionFolder(
        ctx,
        config,
        agent,
        typeof rawInput === 'string' ? rawInput.trim() : '',
        undefined,
      )
      return { kind: 'success', text: `会话文件夹：${path}\n（已切换工作目录）` }
    } catch (error) {
      return { kind: 'error', text: `创建会话文件夹失败：${String(error)}` }
    }
  }

  ctx.commands.register({
    name: 'folder',
    description: '创建并进入本会话的时间文件夹 / create and enter this session’s dated folder',
    input: { hint: '[可选标签]' },
    handler: runCommand,
  })
  ctx.commands.register({
    name: 'sf',
    description: '同 /folder：创建并进入本会话的时间文件夹',
    input: { hint: '[可选标签]' },
    handler: runCommand,
  })

  ctx.logger?.info?.(`session-folders: 就绪（format=${config.format}，note=${config.writeSessionNote === true}，时间=${noteTime(new Date())}）`)
}
