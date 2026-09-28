import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutCaption } from '../public/caption.js';

const measure = (text, size) => [...text].length * size;
test('caption keeps explicit line breaks and selected size when it fits', () => {
  const result = layoutCaption('오늘의 한타\n완벽한 승리', 72, measure);
  assert.deepEqual(result.lines, ['오늘의 한타', '완벽한 승리']);
  assert.equal(result.size, 72);
  assert.deepEqual(layoutCaption('   ', 72, measure).lines, []);
});
test('long captions fit between corner information without losing characters', () => {
  const value = '가'.repeat(100);
  const result = layoutCaption(value, 160, measure);
  assert.ok(result.size < 160);
  assert.ok(result.lines.length * result.lineHeight <= 240);
  assert.ok(result.lines.every(line => measure(line, result.size) <= 1100));
  assert.equal(result.lines.join(''), value);
});
test('automatic wrapping keeps words together when each word fits', () => {
  const result = layoutCaption('오늘 한타로 게임 끝냈습니다', 72, measure, 800);
  assert.deepEqual(result.lines, ['오늘 한타로 게임', '끝냈습니다']);
});
