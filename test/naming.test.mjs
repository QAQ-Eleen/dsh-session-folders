import test from 'node:test'
import assert from 'node:assert/strict'
import { dateParts, firstIndex, formatStamp, suffixFor, uniqueName } from '../lib/naming.js'

test('dateParts uses the host local zone when no zone is configured', () => {
  const parts = dateParts(new Date(2026, 10, 7, 19, 30, 5), '')
  assert.deepEqual(parts, { yy: '26', yyyy: '2026', MM: '11', dd: '07', HH: '19', mm: '30', ss: '05' })
})

test('dateParts honours an explicit IANA zone', () => {
  const parts = dateParts(new Date('2026-11-07T19:30:00Z'), 'Asia/Tokyo')
  assert.equal(parts.dd, '08')
  assert.equal(parts.HH, '04')
})

test('formatStamp renders the default template', () => {
  const stamp = formatStamp('yy-MM-dd_HHmm', new Date(2026, 10, 7, 19, 30, 5), '')
  assert.equal(stamp, '26-11-07_1930')
})

test('formatStamp replaces characters Windows forbids', () => {
  const stamp = formatStamp('yyyy/MM/dd HH:mm:ss', new Date(2026, 10, 7, 19, 30, 5), '')
  assert.equal(stamp, '2026-11-07 19-30-05')
})

test('formatStamp falls back to the default template for an empty format', () => {
  const stamp = formatStamp('', new Date(2026, 10, 7, 19, 30, 5), '')
  assert.equal(stamp, '26-11-07_1930')
})

test('formatStamp never returns an empty segment', () => {
  assert.notEqual(formatStamp('///', new Date(2026, 10, 7), ''), '')
})

test('suffixFor increments trailing digits and appends when there are none', () => {
  assert.equal(suffixFor('-2', 2), '-2')
  assert.equal(suffixFor('-2', 3), '-3')
  assert.equal(suffixFor('dup', 2), 'dup2')
})

test('firstIndex reads the configured starting number', () => {
  assert.equal(firstIndex('-2'), 2)
  assert.equal(firstIndex('-9'), 9)
  assert.equal(firstIndex('x'), 2)
})

test('uniqueName returns the base when it is free', async () => {
  const name = await uniqueName('a', '-2', async () => false)
  assert.equal(name, 'a')
})

test('uniqueName walks the collision suffixes', async () => {
  const taken = new Set(['a', 'a-2', 'a-3'])
  const name = await uniqueName('a', '-2', async (candidate) => taken.has(candidate))
  assert.equal(name, 'a-4')
})
