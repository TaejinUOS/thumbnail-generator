import { TIERS, isApex, rankLabel, localDate, coverRect } from './model.js';
import { createChampionPicker } from './champion-picker.js';
import { loadCaptionFont, drawCaption } from './caption.js';

const $ = id => document.getElementById(id);
const canvas = $('thumbnail');
const ctx = canvas.getContext('2d');
const font = '"Segoe UI", "Malgun Gothic", sans-serif';
const state = { background: '', tier: 'diamond', division: 'I', lp: '0', me: ['', '', ''], enemy: ['', '', ''], dim: 20, x: 50, y: 50, caption: '', captionSize: 72, captionColor: '#ffffff', captionShadow: true, captionBackground: true };
try {
  const saved = JSON.parse(localStorage.getItem('lol-thumbnail-settings') || 'null');
  if (saved) {
    if (TIERS.some(([id]) => id === saved.tier)) state.tier = saved.tier;
    if (['I', 'II', 'III', 'IV'].includes(saved.division)) state.division = saved.division;
    if (/^\d+$/.test(saved.lp) && Number(saved.lp) % 100 === 0 && Number(saved.lp) <= 9900) state.lp = saved.lp;
    for (const key of ['me', 'enemy']) if (Array.isArray(saved[key])) state[key] = [...saved[key].slice(0, 3), '', '', ''].slice(0, 3).map(id => typeof id === 'string' ? id : '');
    if (typeof saved.background === 'string') state.background = saved.background;
    if (typeof saved.caption === 'string') state.caption = saved.caption.slice(0, 100);
    if (Number.isFinite(saved.captionSize)) state.captionSize = Math.round(Math.max(24, Math.min(160, saved.captionSize)));
    if (['#ffffff', '#000000'].includes(saved.captionColor)) state.captionColor = saved.captionColor;
    for (const key of ['captionShadow', 'captionBackground']) if (typeof saved[key] === 'boolean') state[key] = saved[key];
    for (const key of ['dim', 'x', 'y']) if (Number.isFinite(saved[key])) state[key] = Math.max(0, Math.min(key === 'dim' ? 70 : 100, saved[key]));
  }
} catch { /* Settings are optional when browser storage is unavailable. */ }
let champions = [];
let backgrounds = [];
let renderVersion = 0;
let lastReadyVersion = -1;
let lastDate = localDate();
let exporting = false;
let loadingBackgrounds = false;
const imageCache = new Map();
function persist() { try { localStorage.setItem('lol-thumbnail-settings', JSON.stringify(state)); } catch {} }
function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
function loadImage(url) {
  if (!imageCache.has(url)) {
    imageCache.set(url, new Promise((resolve, reject) => {
      const image = new Image();
      const timeout = setTimeout(() => { image.src = ''; reject(new Error('이미지를 불러오는 데 시간이 너무 오래 걸립니다.')); }, 15000);
      image.onload = () => { clearTimeout(timeout); resolve(image); };
      image.onerror = () => { clearTimeout(timeout); reject(new Error('이미지를 불러오지 못했습니다. 파일을 확인하고 새로고침해주세요.')); };
      image.src = url;
    }).catch(error => { imageCache.delete(url); throw error; }));
  }
  return imageCache.get(url);
}
function roundedRect(x, y, w, h, radius, fill, stroke) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, radius);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}
function text(value, x, y, size, color = '#fff', weight = 700, align = 'left') {
  ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(value, x, y);
}
function drawTeam(ids, images, side) {
  if (!ids.length) return;
  const size = 136, gap = 14, width = ids.length * size + (ids.length - 1) * gap;
  const left = side === 'me' ? 36 : 1280 - 36 - width;
  const accent = side === 'me' ? '#c7f36b' : '#ffab95';
  const label = side === 'me' ? 'ME' : '상대';
  roundedRect(side === 'me' ? left : left + width - 90, 504, 90, 32, 6, '#101612e8');
  text(label, side === 'me' ? left + 45 : left + width - 45, 520, 20, accent, 800, 'center');
  ids.forEach((id, i) => {
    const x = left + i * (size + gap), y = 548;
    ctx.save();
    ctx.shadowColor = '#000a'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 4;
    roundedRect(x - 3, y - 3, size + 6, size + 6, 10, accent);
    ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, size, size, 7); ctx.clip();
    ctx.drawImage(images[i], 0, 0, images[i].naturalWidth, images[i].naturalHeight, x, y, size, size);
    ctx.restore();
  });
}
async function render({ date = localDate(), quiet = false } = {}) {
  const version = ++renderVersion;
  lastReadyVersion = -1;
  $('download').disabled = true;
  $('date-label').textContent = `생성 날짜 · ${date}`;
  const background = backgrounds.find(item => item.url === state.background);
  $('empty-state').hidden = Boolean(background);
  if (!background) {
    ctx.fillStyle = '#18221b'; ctx.fillRect(0, 0, 1280, 720);
    if (!quiet) status('background-images 폴더에 배경 사진을 넣어주세요.');
    return false;
  }
  const snapshot = structuredClone(state);
  const me = snapshot.me.filter(Boolean), enemy = snapshot.enemy.filter(Boolean);
  if (!quiet) status('미리보기를 만드는 중…');
  try {
    const selected = [...me, ...enemy].map(id => champions.find(c => c.id === id));
    if (selected.some(c => !c)) throw new Error('챔피언 정보를 불러오지 못했습니다. 페이지를 새로고침해주세요.');
    const [, bg, emblem, ...icons] = await Promise.all([
      snapshot.caption.trim() ? loadCaptionFont() : Promise.resolve(),
      loadImage(background.url), loadImage(`/assets/ranks/${snapshot.tier}.png`), ...selected.map(c => loadImage(c.icon)),
    ]);
    if (version !== renderVersion) return false;
    ctx.clearRect(0, 0, 1280, 720);
    ctx.drawImage(bg, ...coverRect(bg.naturalWidth, bg.naturalHeight, 1280, 720, snapshot.x, snapshot.y), 0, 0, 1280, 720);
    ctx.fillStyle = `rgba(0,0,0,${snapshot.dim / 100})`; ctx.fillRect(0, 0, 1280, 720);
    const gradient = ctx.createLinearGradient(0, 0, 0, 720);
    gradient.addColorStop(0, '#0007'); gradient.addColorStop(.28, '#0000'); gradient.addColorStop(.62, '#0000'); gradient.addColorStop(1, '#0009');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1280, 720);
    const label = rankLabel(snapshot.tier, snapshot.division, snapshot.lp);
    const labelSize = isApex(snapshot.tier) ? 29 : 36;
    ctx.font = `800 ${labelSize}px ${font}`;
    const rankWidth = 148 + ctx.measureText(label).width;
    roundedRect(28, 28, rankWidth, 114, 14, '#0b1010db', '#ffffff24');
    const emblemScale = Math.min(120 / emblem.naturalWidth, 112 / emblem.naturalHeight);
    const ew = emblem.naturalWidth * emblemScale, eh = emblem.naturalHeight * emblemScale;
    ctx.drawImage(emblem, 32 + (120 - ew) / 2, 29 + (112 - eh) / 2, ew, eh);
    text('RANKED SOLO / DUO', 157, 59, 12, '#d2d7ce', 600);
    text(label, 157, 98, labelSize, '#fff', 800);
    roundedRect(996, 28, 256, 72, 12, '#0b1010db', '#ffffff24');
    text(date, 1124, 65, 32, '#fff', 750, 'center');
    drawTeam(me, icons.slice(0, me.length), 'me');
    drawTeam(enemy, icons.slice(me.length), 'enemy');
    const captionLayout = drawCaption(ctx, snapshot);
    $('caption-fit').textContent = captionLayout && captionLayout.size < snapshot.captionSize
      ? `중앙 영역에 맞춰 ${captionLayout.size} px로 표시됩니다. (설정: ${snapshot.captionSize} px)`
      : '긴 문구는 중앙 영역에 맞춰 자동으로 줄바꿈·축소됩니다.';
    lastReadyVersion = version;
    $('download').disabled = exporting || loadingBackgrounds;
    if (!quiet) status('준비 완료. PNG로 저장할 수 있습니다.');
    return true;
  } catch (error) {
    if (version === renderVersion) {
      ctx.fillStyle = '#18221b'; ctx.fillRect(0, 0, 1280, 720);
      text('이미지를 확인해주세요', 640, 340, 32, '#ffab95', 600, 'center');
      status(error.message, true);
    }
    return false;
  }
}
function syncRank() {
  const apex = isApex(state.tier);
  $('division').hidden = apex; $('lp').hidden = !apex;
  $('division-label').textContent = apex ? '점수 구간' : '단계';
  $('division-label').htmlFor = apex ? 'lp' : 'division';
}
const championPickers = new Map();
function updateChampionOptions(side) {
  state[side].forEach((id, index) => {
    championPickers.get(`${side}-${index}`)?.refresh();
    const thumb = $(`${side}-thumb-${index}`);
    thumb.replaceChildren();
    const champion = champions.find(item => item.id === id);
    if (champion) { const img = document.createElement('img'); img.src = champion.icon; img.alt = ''; thumb.append(img); }
    else thumb.textContent = String(index + 1).padStart(2, '0');
  });
}
function buildChampionSelects() {
  for (const side of ['me', 'enemy']) {
    state[side] = state[side].map((id, index, ids) => champions.some(c => c.id === id) && ids.indexOf(id) === index ? id : '');
    for (let index = 0; index < 3; index++) {
      const row = document.createElement('div'); row.className = 'champion-row';
      const thumb = document.createElement('span'); thumb.className = 'champion-thumb'; thumb.id = `${side}-thumb-${index}`; thumb.setAttribute('aria-hidden', 'true');
      const id = `${side}-${index}`;
      const picker = createChampionPicker({
        id, label: `${side === 'me' ? 'Me' : '상대'} 챔피언 ${index + 1}`, champions,
        getSelected: () => state[side][index],
        isDisabled: value => state[side].some((selected, slot) => slot !== index && selected === value),
        onChange: value => { state[side][index] = value; updateChampionOptions(side); persist(); void render(); },
      });
      championPickers.set(id, picker);
      row.append(thumb, picker.element); $(`${side}-selects`).append(row);
    }
    updateChampionOptions(side);
  }
}
async function refreshBackgrounds() {
  loadingBackgrounds = true; $('refresh').disabled = true; $('random-background').disabled = true; $('download').disabled = true;
  ++renderVersion; lastReadyVersion = -1;
  try {
    const response = await fetch('/api/backgrounds', { cache: 'no-store' });
    if (!response.ok) throw new Error('배경 폴더를 읽을 수 없습니다. background-images 폴더를 확인해주세요.');
    backgrounds = await response.json();
    imageCache.clear();
    $('background').replaceChildren();
    if (!backgrounds.length) $('background').add(new Option('배경 이미지 없음', ''));
    for (const item of backgrounds) $('background').add(new Option(item.name, item.url));
    if (!backgrounds.some(item => item.url === state.background)) state.background = backgrounds[0]?.url || '';
    $('background').value = state.background; $('background').disabled = !backgrounds.length;
    $('background-hint').textContent = backgrounds.length ? `background-images · ${backgrounds.length}개의 이미지` : 'background-images 폴더에 사진을 넣어주세요.';
    persist(); await render();
  } catch (error) { status(error.message, true); }
  finally { loadingBackgrounds = false; $('refresh').disabled = false; $('random-background').disabled = backgrounds.length < 2; $('download').disabled = exporting || lastReadyVersion !== renderVersion; }
}
for (const [id, name] of TIERS) $('tier').add(new Option(name, id));
for (let lp = 0; lp <= 9900; lp += 100) $('lp').add(new Option(`${lp.toLocaleString()}–${(lp + 99).toLocaleString()} LP`, String(lp)));
for (const key of ['tier', 'division', 'lp']) {
  $(key).value = state[key];
  $(key).addEventListener('change', () => { state[key] = $(key).value; syncRank(); persist(); void render(); });
}
syncRank();
for (const [id, key] of [['dim', 'dim'], ['position-x', 'x'], ['position-y', 'y']]) {
  $(id).value = state[key]; $(`${id}-value`).value = `${state[key]}%`;
  $(id).addEventListener('input', () => { state[key] = Number($(id).value); $(`${id}-value`).value = `${state[key]}%`; persist(); void render(); });
}
$('background').addEventListener('change', () => { state.background = $('background').value; persist(); void render(); });
$('random-background').addEventListener('click', () => {
  if (loadingBackgrounds || backgrounds.length < 2) return;
  const currentIndex = backgrounds.findIndex(item => item.url === state.background);
  const choice = Math.floor(Math.random() * (backgrounds.length - (currentIndex < 0 ? 0 : 1)));
  const nextIndex = currentIndex >= 0 && choice >= currentIndex ? choice + 1 : choice;
  state.background = backgrounds[nextIndex].url;
  $('background').value = state.background;
  persist();
  void render();
});
$('refresh').addEventListener('click', () => void refreshBackgrounds());
$('caption').value = state.caption;
$('caption').addEventListener('input', () => { state.caption = $('caption').value; persist(); void render(); });
$('caption-size').value = state.captionSize;
$('caption-size-value').value = `${state.captionSize} px`;
$('caption-size').addEventListener('input', () => {
  state.captionSize = Number($('caption-size').value); $('caption-size-value').value = `${state.captionSize} px`; persist(); void render();
});
for (const radio of document.querySelectorAll('input[name="caption-color"]')) {
  radio.checked = radio.value === state.captionColor;
  radio.addEventListener('change', () => { if (radio.checked) { state.captionColor = radio.value; persist(); void render(); } });
}
for (const [id, key] of [['caption-shadow', 'captionShadow'], ['caption-background', 'captionBackground']]) {
  $(id).checked = state[key];
  $(id).addEventListener('change', () => { state[key] = $(id).checked; persist(); void render(); });
}
$('download').addEventListener('click', async () => {
  if (exporting) return;
  exporting = true; $('download').disabled = true;
  try {
    const date = localDate();
    if (!(await render({ date, quiet: true }))) return;
    const version = renderVersion;
    const filename = `LOL_${date}_${state.tier}_${isApex(state.tier) ? state.lp + 'LP' : state.division}.png`;
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('PNG를 생성하지 못했습니다. 다시 시도해주세요.');
    if (version !== renderVersion) throw new Error('설정이 변경되었습니다. 다운로드를 다시 눌러주세요.');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = filename;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    status('PNG 다운로드를 시작했습니다. 브라우저의 다운로드 폴더를 확인해주세요.');
  } catch (error) { status(error.message, true); }
  finally { exporting = false; $('download').disabled = loadingBackgrounds || lastReadyVersion !== renderVersion; }
});
setInterval(() => { const today = localDate(); if (today !== lastDate) { lastDate = today; void render(); } }, 30000);
async function init() {
  try {
    const response = await fetch('/assets/champions.json');
    if (!response.ok) throw new Error('챔피언 데이터가 없습니다. 터미널에서 npm run assets를 실행한 뒤 새로고침해주세요.');
    const data = await response.json();
    champions = data.champions.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    buildChampionSelects();
    await refreshBackgrounds();
  } catch (error) { status(error.message, true); }
}
void init();
