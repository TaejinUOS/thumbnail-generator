import { mkdir, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';

const root = fileURLToPath(new URL('../', import.meta.url));
async function download(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`${response.status}: ${url}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
}
async function save(relative, data) {
  const target = path.join(root, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(`${target}.tmp`, data);
  await rename(`${target}.tmp`, target);
}
function unzip(buffer) {
  let end = buffer.length - 22;
  while (end >= 0 && buffer.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error('Invalid emblem ZIP');
  let cursor = buffer.readUInt32LE(end + 16);
  const entries = [];
  for (let i = 0; i < buffer.readUInt16LE(end + 10); i++) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Invalid ZIP directory');
    const method = buffer.readUInt16LE(cursor + 10);
    const length = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString();
    const offset = buffer.readUInt32LE(cursor + 42);
    const start = offset + 30 + buffer.readUInt16LE(offset + 26) + buffer.readUInt16LE(offset + 28);
    if (/\.png$/i.test(name) && !name.startsWith('__MACOSX/')) {
      const compressed = buffer.subarray(start, start + length);
      if (method !== 0 && method !== 8) throw new Error('Unsupported ZIP compression');
      entries.push({ name, data: method === 8 ? inflateRawSync(compressed) : compressed });
    }
    cursor += 46 + nameLength + buffer.readUInt16LE(cursor + 30) + buffer.readUInt16LE(cursor + 32);
  }
  return entries;
}

const versions = JSON.parse(await download('https://ddragon.leagueoflegends.com/api/versions.json'));
const version = versions[0];
const source = JSON.parse(await download(`https://ddragon.leagueoflegends.com/cdn/${version}/data/ko_KR/champion.json`));
const champions = Object.values(source.data).map(({ id, name, image }) => ({ id, name, file: image.full }));
console.log(`Downloading ${champions.length} champion icons (patch ${version})…`);
let next = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (next < champions.length) {
    const champion = champions[next++];
    await save(`public/assets/champions/${champion.file}`, await download(`https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champion.file}`));
  }
}));
const entries = unzip(await download('https://static.developer.riotgames.com/docs/lol/ranked-emblems-latest.zip'));
const tiers = ['iron', 'bronze', 'silver', 'gold', 'platinum', 'emerald', 'diamond', 'master', 'grandmaster', 'challenger'];
for (const tier of tiers) {
  const entry = entries.find(({ name }) => path.posix.basename(name).toLowerCase() === `rank=${tier}.png`);
  if (!entry) throw new Error(`Missing ${tier} emblem. ZIP contains: ${entries.map(e => e.name).join(', ')}`);
  await save(`public/assets/ranks/${tier}.png`, entry.data);
}
await save('public/assets/champions.json', JSON.stringify({ version, champions: champions.map(({ id, name, file }) => ({ id, name, icon: `/assets/champions/${file}` })) }, null, 2));
console.log('Champion icons and all 10 rank emblems are ready.');
