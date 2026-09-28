import { readFile, mkdir, copyFile, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const filesystemRoot = path.join(process.env.LOCALAPPDATA, 'LolScreenSaver', 'filesystem');
const libraryRoot = path.join(filesystemRoot, 'LeagueScreensaver');
const content = JSON.parse(await readFile(path.join(libraryRoot, 'content.json'), 'utf8'));
const cache = JSON.parse(await readFile(path.join(libraryRoot, 'content-cache', 'cache.json'), 'utf8'));
const cachedByUrl = new Map(Object.values(cache.assets).map(asset => [asset.url, asset]));
const groups = content.assetGroups.filter(group => group.tags.includes('runeterra'));
const ids = new Set(groups.flatMap(group => group.assets));
const images = content.assets.filter(asset => ids.has(asset.id) && asset.type.startsWith('image/'));
const translations = content.locale.translations.ko_KR;
const destination = path.join(projectRoot, 'background-images');
const digest = buffer => createHash('sha256').update(buffer).digest('hex');
const safeName = value => value.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
const entries = [];
let copied = 0;
let existing = 0;

await mkdir(destination, { recursive: true });
for (const asset of images) {
  const cached = cachedByUrl.get(`content/${asset.url}`);
  if (!cached) throw new Error(`Original is not cached: ${asset.id}`);
  const source = path.resolve(filesystemRoot, cached.name);
  const relative = path.relative(filesystemRoot, source);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Invalid cache path');
  const data = await readFile(source);
  if (data.length !== asset.size) throw new Error(`Original size mismatch: ${asset.id}`);
  if (data[0] !== 0xff || data[1] !== 0xd8 || data[2] !== 0xff) throw new Error(`Invalid JPEG: ${asset.id}`);
  const regions = groups.filter(group => group.assets.includes(asset.id))
    .map(group => translations[group.nameTranslateId] || group.id.replace('runeterra-', ''));
  const filename = safeName(`룬테라_${regions[0]}_${asset.id}.jpg`);
  const target = path.join(destination, filename);
  const sha256 = digest(data);
  try {
    await copyFile(source, target, constants.COPYFILE_EXCL);
    copied++;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    if (digest(await readFile(target)) !== sha256) throw new Error(`Existing file differs; preserved: ${filename}`);
    existing++;
  }
  const output = await readFile(target);
  if ((await stat(target)).size !== asset.size || digest(output) !== sha256) throw new Error(`Copy verification failed: ${filename}`);
  entries.push({ id: asset.id, filename, regions, bytes: data.length, sha256, originalPath: asset.url });
  if (entries.length % 50 === 0 || entries.length === images.length) console.log(`Verified ${entries.length}/${images.length} originals`);
}
await mkdir(path.join(projectRoot, 'docs'), { recursive: true });
const manifest = {
  importedAt: new Date().toISOString(),
  source: 'Installed League Displays original image cache',
  catalogVersion: content.versionDate,
  imageCount: entries.length,
  totalBytes: entries.reduce((total, entry) => total + entry.bytes, 0),
  excludedVideos: content.assets.filter(asset => ids.has(asset.id) && !asset.type.startsWith('image/')).map(asset => asset.id),
  files: entries,
};
await writeFile(path.join(projectRoot, 'docs', 'runeterra-import.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ copied, existing, imageCount: manifest.imageCount, totalBytes: manifest.totalBytes, videosExcluded: manifest.excludedVideos.length }));
