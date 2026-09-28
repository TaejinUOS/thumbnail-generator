import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server.mjs';
import { rankLabel, localDate, coverRect } from '../public/model.js';

test('rank divisions and 100 LP ranges are represented correctly', () => {
  assert.equal(rankLabel('diamond', 'IV', 0), '다이아몬드 IV');
  assert.equal(rankLabel('master', 'I', 0), '마스터 0–99 LP');
  assert.equal(rankLabel('grandmaster', 'I', 900), '그랜드마스터 900–999 LP');
  assert.equal(rankLabel('challenger', 'I', 9900), '챌린저 9,900–9,999 LP');
});
test('date uses local calendar and zero-padded month and day', () => {
  assert.equal(localDate(new Date(2026, 0, 9, 23, 59)), '2026.01.09');
});
test('cover preserves ratio and permits positioning the cropped dimension', () => {
  assert.deepEqual(coverRect(1920, 1080, 1280, 720), [0, 0, 1920, 1080]);
  assert.deepEqual(coverRect(1000, 1000, 1280, 720, 50, 0), [0, 0, 1000, 562.5]);
  assert.deepEqual(coverRect(1000, 1000, 1280, 720, 50, 100), [0, 437.5, 1000, 562.5]);
  assert.deepEqual(coverRect(2560, 720, 1280, 720, 100, 50), [1280, 0, 1280, 720]);
});
test('server lists backgrounds and confines static access', async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const page = await fetch(base);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /썸네일 스튜디오/);
    const list = await fetch(`${base}/api/backgrounds`);
    assert.equal(list.status, 200);
    assert.ok(Array.isArray(await list.json()));
    for (const route of ['/server.mjs', '/package.json', '/.git/config']) assert.equal((await fetch(base + route)).status, 404);
    assert.equal((await fetch(`${base}/background-images/..%5Cserver.mjs`)).status, 403);
    assert.equal((await fetch(`${base}/%ZZ`)).status, 400);
    assert.equal((await fetch(base, { method: 'POST' })).status, 405);
    const asset = await fetch(`${base}/assets/champions.json`);
    assert.equal(asset.status, 200);
    const data = await asset.json();
    assert.ok(data.champions.length > 150);
    const icon = await fetch(base + data.champions[0].icon);
    assert.equal(icon.headers.get('content-type'), 'image/png');
    for (const tier of ['iron', 'bronze', 'silver', 'gold', 'platinum', 'emerald', 'diamond', 'master', 'grandmaster', 'challenger']) {
      assert.equal((await fetch(`${base}/assets/ranks/${tier}.png`)).status, 200);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});
