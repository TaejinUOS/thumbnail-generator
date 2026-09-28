export const CAPTION_FONT = '"SB Aggro"';
let fontPromise;
export function loadCaptionFont() {
  if (!fontPromise) {
    fontPromise = document.fonts.load(`700 72px ${CAPTION_FONT}`, '한글').then(faces => {
      if (!faces.length) throw new Error('SB 어그로체를 불러오지 못했습니다. 페이지를 새로고침해주세요.');
    }).catch(error => { fontPromise = undefined; throw error; });
  }
  return fontPromise;
}

export function layoutCaption(value, requestedSize, measure, maxWidth = 1100, maxHeight = 240) {
  const paragraphs = value.replace(/\r/g, '').trim().split('\n');
  if (!value.trim()) return { lines: [], size: requestedSize, lineHeight: 0 };
  for (let size = requestedSize; size >= 12; size--) {
    const lines = [];
    for (const paragraph of paragraphs) {
      let line = '';
      for (const word of paragraph.trim().split(/\s+/)) {
        const candidate = line ? `${line} ${word}` : word;
        if (measure(candidate, size) <= maxWidth) { line = candidate; continue; }
        if (line) { lines.push(line); line = ''; }
        for (const character of [...word]) {
          if (line && measure(line + character, size) > maxWidth) { lines.push(line); line = ''; }
          line += character;
        }
      }
      lines.push(line.trimEnd());
    }
    const lineHeight = size * 1.2;
    if (lines.length * lineHeight <= maxHeight) return { lines, size, lineHeight };
  }
  throw new Error('문구의 줄 수가 너무 많습니다. 줄바꿈을 줄여주세요.');
}

export function drawCaption(ctx, settings) {
  if (!settings.caption.trim()) return null;
  ctx.save();
  try {
    const layout = layoutCaption(settings.caption, settings.captionSize, (value, size) => {
      ctx.font = `700 ${size}px ${CAPTION_FONT}`;
      return ctx.measureText(value).width;
    });
    const { lines, size, lineHeight } = layout;
    ctx.font = `700 ${size}px ${CAPTION_FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const metrics = ctx.measureText('한글Ag');
    const ascent = metrics.actualBoundingBoxAscent;
    const descent = metrics.actualBoundingBoxDescent;
    const height = ascent + descent + (lines.length - 1) * lineHeight;
    const width = Math.max(...lines.map(line => ctx.measureText(line).width));
    if (settings.captionBackground) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.beginPath(); ctx.roundRect(640 - width / 2 - 24, 360 - height / 2 - 20, width + 48, height + 40, 10); ctx.fill();
    }
    ctx.fillStyle = settings.captionColor;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    if (settings.captionShadow) { ctx.shadowColor = 'rgba(0, 0, 0, 0.85)'; ctx.shadowBlur = size * 0.12; ctx.shadowOffsetX = size * 0.04; ctx.shadowOffsetY = size * 0.07; }
    lines.forEach((line, index) => {
      const y = 360 - height / 2 + ascent + index * lineHeight;
      // Keep black lettering readable when the black backing is also enabled.
      if (settings.captionColor === '#000000' && settings.captionBackground) {
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(2, size * 0.035); ctx.strokeText(line, 640, y);
      }
      ctx.fillText(line, 640, y);
    });
    return layout;
  } finally { ctx.restore(); }
}
