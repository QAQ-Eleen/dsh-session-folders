// The `_会话说明.md` scaffold written into every session folder.
// No DSH imports: pure string building, unit-testable on its own.

/** Zero-pad a number to two digits. */
function two(value) {
  return String(value).padStart(2, '0')
}

/**
 * Render a local timestamp for the note header.
 *
 * @param {Date} date - instant to render.
 * @returns {string} `YYYY-MM-DD HH:mm` in the host local zone.
 */
export function noteTime(date) {
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}`
}

/**
 * Build the note body.
 *
 * @param {object} input - note facts.
 * @param {string} input.dirName - folder name this note belongs to.
 * @param {Date} input.time - creation instant.
 * @param {string} [input.label] - user- or model-supplied session label.
 * @param {string} input.path - absolute folder path.
 * @returns {string} markdown with a trailing newline.
 */
export function renderNote({ dirName, time, label, path }) {
  const title = typeof label === 'string' && label.trim() !== '' ? label.trim() : '未命名'
  return [
    `# 会话说明 · ${dirName}`,
    '',
    `- 建立时间：${noteTime(time)}`,
    `- 会话：${title}`,
    `- 工作目录：${path}`,
    '',
    '## 目标',
    '（待补）',
    '',
    '## 产出清单',
    '（待补）',
    '',
  ].join('\n')
}
