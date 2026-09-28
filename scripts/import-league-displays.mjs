import { createWriteStream } from 'node:fs';
import { copyFile, mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const libraryRoot = path.join(process.env.LOCALAPPDATA, 'LolScreenSaver', 'filesystem', 'LeagueScreensaver');
const catalog = JSON.parse(await readFile(path.join(libraryRoot, 'content.json'), 'utf8'));
const destination = path.join(projectRoot, 'background-images');
const baseUrl = 'https://screensavers.riotgames.com/v2/latest/content/';
const categories = [
  { tag: 'champions', label: '챔피언' },
  { tag: 'esports', label: 'e스포츠' },
];
const assets = new Map(catalog.assets.map(asset => [asset.id, asset]));
const jobs = new Map();
const missingIds = new Set();

for (const category of categories) {
  for (const group of catalog.assetGroups.filter(group => group.tags.includes(category.tag))) {
    for (const id of group.assets) {
      const asset = assets.get(id);
      if (!asset) {
        missingIds.add(id);
        continue;
      }
      if (asset.type !== 'image/jpeg') continue;
      if (!asset.url.startsWith('original/') || asset.url.includes('..')) throw new Error(`Invalid source path: ${id}`);
      const job = jobs.get(id) ?? { asset, categories: new Set() };
      job.categories.add(category.label);
      jobs.set(id, job);
    }
  }
}

await mkdir(destination, { recursive: true });
let completed = 0;
let downloaded = 0;
let reused = 0;
const entries = [];
const queue = [...jobs.values()];

async function validFile(filename, expectedSize) {
  try {
    if ((await stat(filename)).size !== expectedSize) return false;
    const file = await open(filename, 'r');
    try {
      const header = Buffer.alloc(3);
      await file.read(header, 0, 3, 0);
      return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    } finally {
      await file.close();
    }
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function fetchOriginal(asset, target) {
  const source = new URL(asset.url.split('/').map(encodeURIComponent).join('/'), baseUrl).href;
  const temporary = `${target}.part`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(source, { signal: AbortSignal.timeout(120_000) });
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
      await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary));
      if (!await validFile(temporary, asset.size)) throw new Error('Downloaded JPEG size or signature differs from catalog');
      await rename(temporary, target);
      return;
    } catch (error) {
      await rm(temporary, { force: true });
      if (attempt === 4) throw new Error(`Could not download ${asset.id}: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

async function worker() {
  while (queue.length) {
    const job = queue.pop();
    if (!job) return;
    const { asset } = job;
    const labels = [...job.categories];
    const primary = path.join(destination, `${labels[0]}_${asset.id}.jpg`);
    if (await validFile(primary, asset.size)) reused++;
    else {
      await fetchOriginal(asset, primary);
      downloaded++;
    }
    for (const label of labels.slice(1)) {
      const secondary = path.join(destination, `${label}_${asset.id}.jpg`);
      if (!await validFile(secondary, asset.size)) await copyFile(primary, secondary);
    }
    entries.push({ id: asset.id, categories: labels, filenames: labels.map(label => `${label}_${asset.id}.jpg`), bytes: asset.size, originalPath: asset.url });
    completed++;
    if (completed % 50 === 0 || completed === jobs.size) console.log(`Verified ${completed}/${jobs.size} original images`);
  }
}

await Promise.all(Array.from({ length: 8 }, worker));
entries.sort((a, b) => a.id.localeCompare(b.id));
const report = {
  importedAt: new Date().toISOString(),
  source: 'Installed League Displays catalog and official Riot Games image URLs',
  catalogVersion: catalog.versionDate,
  uniqueImageCount: entries.length,
  fileCount: entries.reduce((count, entry) => count + entry.filenames.length, 0),
  totalBytes: entries.reduce((total, entry) => total + entry.bytes * entry.filenames.length, 0),
  missingCatalogIds: [...missingIds].sort(),
  files: entries,
};
await mkdir(path.join(projectRoot, 'docs'), { recursive: true });
await writeFile(path.join(projectRoot, 'docs', 'league-displays-import.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ downloaded, reused, uniqueImages: report.uniqueImageCount, files: report.fileCount, bytes: report.totalBytes, missingCatalogIds: report.missingCatalogIds }));
