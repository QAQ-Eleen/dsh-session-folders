import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../lib/index.js'

/**
 * Minimal stand-in for the Cordis context surface this plugin touches.
 * Records every registration so the tests can assert the wiring, not the host.
 */
function fakeCtx() {
  const calls = { sections: [], tools: [], commands: [] }
  const ctx = {
    logger: { info() {}, warn() {} },
    systemPrompt: {
      getSectionOrder: () => -100,
      section: (section) => calls.sections.push(section),
    },
    tools: { register: (definition) => calls.tools.push(definition) },
    commands: { register: (definition) => calls.commands.push(definition) },
    workingDirectory: { set: async (agent, path) => { agent.cwd = path } },
  }
  return { ctx, calls }
}

/** Build the owning agent the tool receives as `exec.agent`. */
function fakeAgent(cwd) {
  return { session: { header: { cwd } } }
}

test('disabled configuration registers nothing', () => {
  const { ctx, calls } = fakeCtx()
  apply(ctx, { enabled: false })
  assert.equal(calls.sections.length + calls.tools.length + calls.commands.length, 0)
})

test('apply wires the prompt section, one tool and two commands', () => {
  const { ctx, calls } = fakeCtx()
  apply(ctx, {})
  assert.equal(calls.sections.length, 1)
  assert.match(calls.sections[0].text, /session_folder/)
  assert.equal(calls.tools.length, 1)
  assert.equal(calls.tools[0].name, 'session_folder')
  assert.deepEqual(calls.commands.map((command) => command.name), ['folder', 'sf'])
})

test('session_folder creates the folder, writes the note and switches cwd', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsf-'))
  try {
    const { ctx, calls } = fakeCtx()
    apply(ctx, { root, format: 'yy-MM-dd_HHmm', writeSessionNote: true })
    const tool = calls.tools[0]
    const agent = fakeAgent(root)
    const result = await tool.execute({ label: '整理工作区' }, { agent })
    assert.ok(result.path.startsWith(root))
    assert.equal(agent.cwd, result.path)
    const note = await readFile(join(result.path, '_会话说明.md'), 'utf8')
    assert.match(note, /整理工作区/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a second call in the same minute gets a collision suffix', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsf-'))
  try {
    const { ctx, calls } = fakeCtx()
    apply(ctx, { root })
    const tool = calls.tools[0]
    const first = await tool.execute({}, { agent: fakeAgent(root) })
    const second = await tool.execute({}, { agent: fakeAgent(root) })
    assert.notEqual(first.path, second.path)
    assert.match(second.path, /-2$/u)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('writeSessionNote=false skips the note file', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsf-'))
  try {
    const { ctx, calls } = fakeCtx()
    apply(ctx, { root, writeSessionNote: false })
    const result = await calls.tools[0].execute({}, { agent: fakeAgent(root) })
    let missing = false
    try {
      await readFile(join(result.path, '_会话说明.md'), 'utf8')
    } catch {
      missing = true
    }
    assert.equal(missing, true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('the /folder command returns a success result with the path', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsf-'))
  try {
    const { ctx, calls } = fakeCtx()
    apply(ctx, { root })
    const folder = calls.commands.find((command) => command.name === 'folder')
    const result = await folder.handler({ agent: fakeAgent(root), rawInput: '标签' })
    assert.equal(result.kind, 'success')
    assert.match(result.text, /会话文件夹/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
