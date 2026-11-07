import test from 'node:test'
import assert from 'node:assert/strict'
import { noteTime, renderNote } from '../lib/note.js'

test('noteTime renders a local YYYY-MM-DD HH:mm stamp', () => {
  assert.equal(noteTime(new Date(2026, 0, 5, 8, 4)), '2026-01-05 08:04')
})

test('renderNote includes the folder, label, path and scaffolds', () => {
  const note = renderNote({
    dirName: '26-11-07_1930',
    time: new Date(2026, 10, 7, 19, 30),
    label: '整理工作区',
    path: 'D:/AI/DSHwenjian/26-11-07_1930',
  })
  assert.match(note, /^# 会话说明 · 26-11-07_1930/m)
  assert.match(note, /建立时间：2026-11-07 19:30/)
  assert.match(note, /会话：整理工作区/)
  assert.match(note, /工作目录：D:\/AI\/DSHwenjian\/26-11-07_1930/)
  assert.match(note, /## 目标/)
  assert.match(note, /## 产出清单/)
  assert.ok(note.endsWith('\n'))
})

test('renderNote falls back to 未命名 for an empty label', () => {
  const note = renderNote({ dirName: 'd', time: new Date(), label: '   ', path: '/tmp/d' })
  assert.match(note, /会话：未命名/)
})
