// Pure helpers for building a folder name from a timestamp.
// No DSH imports: this module is unit-testable with plain `node --test`.

/** Zero-pad a number to two digits. */
function two(value) {
  return String(value).padStart(2, '0')
}

/**
 * Split one instant into the tokens a format string can use.
 *
 * @param {Date} now - instant to render.
 * @param {string} [timeZone] - IANA zone; empty means the host local zone.
 * @returns {{ yy: string, yyyy: string, MM: string, dd: string, HH: string, mm: string, ss: string }}
 *   token values, all zero-padded except `yyyy`.
 */
export function dateParts(now = new Date(), timeZone = '') {
  if (timeZone === undefined || timeZone === null || timeZone === '') {
    return {
      yy: two(now.getFullYear() % 100),
      yyyy: String(now.getFullYear()),
      MM: two(now.getMonth() + 1),
      dd: two(now.getDate()),
      HH: two(now.getHours()),
      mm: two(now.getMinutes()),
      ss: two(now.getSeconds()),
    }
  }
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const parts = {}
  for (const part of formatter.formatToParts(now)) {
    if (part.type !== 'literal') parts[part.type] = part.value
  }
  const year = parts.year ?? '0000'
  return {
    yy: year.slice(-2),
    yyyy: year,
    MM: parts.month ?? '00',
    dd: parts.day ?? '00',
    HH: parts.hour ?? '00',
    mm: parts.minute ?? '00',
    ss: parts.second ?? '00',
  }
}

/** Characters Windows forbids in a file name, plus control characters. */
const UNSAFE = /[\\/:*?"<>|\u0000-\u001f]/gu

/**
 * Render one format string into a safe single path segment.
 *
 * Supported tokens: `yyyy`, `yy`, `MM`, `dd`, `HH`, `mm`, `ss`. Unknown text is
 * kept verbatim, then every unsafe character is replaced with `-` and the
 * result is trimmed of surrounding spaces and dots (Windows rejects both).
 *
 * @param {string} format - format string, e.g. `yy-MM-dd_HHmm`.
 * @param {Date} [now] - instant to render.
 * @param {string} [timeZone] - IANA zone; empty means the host local zone.
 * @returns {string} a non-empty, filesystem-safe folder name.
 */
export function formatStamp(format, now = new Date(), timeZone = '') {
  const parts = dateParts(now, timeZone)
  const text = String(format === undefined || format === null || format === '' ? 'yy-MM-dd_HHmm' : format)
    .replace(/yyyy/gu, parts.yyyy)
    .replace(/yy/gu, parts.yy)
    .replace(/MM/gu, parts.MM)
    .replace(/dd/gu, parts.dd)
    .replace(/HH/gu, parts.HH)
    .replace(/mm/gu, parts.mm)
    .replace(/ss/gu, parts.ss)
    .replace(UNSAFE, '-')
    .replace(/^[ .]+|[ .]+$/gu, '')
  return text === '' ? parts.yyyy + parts.MM + parts.dd : text
}

/**
 * Replace the trailing digits of a suffix, or append the number when it has none.
 *
 * @param {string} suffix - configured collision suffix, e.g. `-2`.
 * @param {number} index - the collision attempt number (starts at 2).
 * @returns {string} the suffix for that attempt.
 */
export function suffixFor(suffix, index) {
  const text = suffix === undefined || suffix === null || suffix === '' ? '-2' : String(suffix)
  return /\d+$/u.test(text) ? text.replace(/\d+$/u, String(index)) : text + String(index)
}

/** First number a collision suffix implies, so `-2` starts the search at 2. */
export function firstIndex(suffix) {
  const text = suffix === undefined || suffix === null || suffix === '' ? '-2' : String(suffix)
  const match = /\d+$/u.exec(text)
  const value = match === null ? NaN : Number(match[0])
  return Number.isInteger(value) && value >= 1 ? value : 2
}

/**
 * Pick the first free name, appending a collision suffix when the base is taken.
 *
 * @param {string} base - preferred folder name.
 * @param {string} suffix - collision suffix template, e.g. `-2`.
 * @param {(name: string) => Promise<boolean>} exists - probes one candidate name.
 * @returns {Promise<string>} a name that `exists` reported free.
 */
export async function uniqueName(base, suffix, exists) {
  if (!(await exists(base))) return base
  for (let index = firstIndex(suffix); index < firstIndex(suffix) + 1000; index += 1) {
    const candidate = base + suffixFor(suffix, index)
    if (!(await exists(candidate))) return candidate
  }
  throw new Error(`no free folder name near "${base}"; clean up the root directory first`)
}
