import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesChampion } from '../public/champion-picker.js';

test('champion search supports Korean names, English IDs and consonant initials', () => {
  const leeSin = { id: 'LeeSin', name: '리 신' };
  const twistedFate = { id: 'TwistedFate', name: '트위스티드 페이트' };
  assert.ok(matchesChampion(leeSin, '리신'));
  assert.ok(matchesChampion(leeSin, ' LEE sin '));
  assert.ok(matchesChampion(leeSin, 'ㄹㅅ'));
  assert.ok(matchesChampion(twistedFate, 'ㅌㅇㅅㅌㄷ'));
  assert.ok(matchesChampion(twistedFate, '페이트'));
  assert.ok(matchesChampion(leeSin, ''));
  assert.equal(matchesChampion(leeSin, '아리'), false);
  assert.equal(matchesChampion(twistedFate, '없는챔피언'), false);
});
