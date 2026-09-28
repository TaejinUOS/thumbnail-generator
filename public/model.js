export const TIERS = [
  ['iron', '아이언'], ['bronze', '브론즈'], ['silver', '실버'], ['gold', '골드'],
  ['platinum', '플래티넘'], ['emerald', '에메랄드'], ['diamond', '다이아몬드'],
  ['master', '마스터'], ['grandmaster', '그랜드마스터'], ['challenger', '챌린저'],
];
export const isApex = tier => ['master', 'grandmaster', 'challenger'].includes(tier);
export function rankLabel(tier, division, lp) {
  const name = TIERS.find(item => item[0] === tier)?.[1] || '다이아몬드';
  return `${name} ${isApex(tier) ? `${Number(lp).toLocaleString('en-US')}–${(Number(lp) + 99).toLocaleString('en-US')} LP` : division}`;
}
export function localDate(date = new Date()) {
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}
export function coverRect(width, height, targetWidth, targetHeight, positionX = 50, positionY = 50) {
  const scale = Math.max(targetWidth / width, targetHeight / height);
  const sw = targetWidth / scale;
  const sh = targetHeight / scale;
  return [(width - sw) * positionX / 100, (height - sh) * positionY / 100, sw, sh];
}
