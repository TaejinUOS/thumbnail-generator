const initials = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const normalize = value => value.normalize('NFKC').toLowerCase().replace(/[\s.'’_-]/g, '');
const initialName = name => [...name].map(char => {
  const code = char.charCodeAt(0) - 0xac00;
  return code >= 0 && code <= 11171 ? initials[Math.floor(code / 588)] : char;
}).join('');

export function matchesChampion(champion, query) {
  const search = normalize(query);
  return !search || normalize(champion.name).includes(search) || normalize(champion.id).includes(search)
    || normalize(initialName(champion.name)).includes(search);
}

export function createChampionPicker({ id, label, champions, getSelected, isDisabled, onChange }) {
  const root = document.createElement('div'); root.className = 'champion-picker';
  const field = document.createElement('div'); field.className = 'champion-search-field';
  const input = document.createElement('input'); input.id = id; input.type = 'text';
  input.className = 'champion-search'; input.placeholder = '챔피언 검색'; input.autocomplete = 'off'; input.spellcheck = false;
  input.setAttribute('role', 'combobox'); input.setAttribute('aria-label', label);
  input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', `${id}-list`);
  const clear = document.createElement('button'); clear.type = 'button'; clear.className = 'champion-clear';
  clear.textContent = '×'; clear.setAttribute('aria-label', `${label} 선택 해제`);
  const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'champion-toggle';
  toggle.textContent = '⌄'; toggle.setAttribute('aria-label', `${label} 목록 열기`);
  toggle.setAttribute('aria-controls', `${id}-list`); toggle.setAttribute('aria-expanded', 'false');
  const menu = document.createElement('div'); menu.className = 'champion-menu'; menu.hidden = true;
  const list = document.createElement('div'); list.id = `${id}-list`; list.className = 'champion-results';
  list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', `${label} 검색 결과`);
  const summary = document.createElement('p'); summary.className = 'champion-result-summary';
  summary.setAttribute('role', 'status'); summary.setAttribute('aria-live', 'polite');
  menu.append(list, summary); field.append(input, clear, toggle); root.append(field, menu);
  let results = [], active = -1, open = false;
  const selectedName = () => champions.find(champion => champion.id === getSelected())?.name || '';

  function highlight(index) {
    active = index;
    [...list.children].forEach((option, i) => option.classList.toggle('active', i === index));
    const option = list.children[index];
    if (option) { input.setAttribute('aria-activedescendant', option.id); option.scrollIntoView({ block: 'nearest' }); }
    else input.removeAttribute('aria-activedescendant');
  }
  function close() {
    open = false; menu.hidden = true;
    input.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant'); input.value = selectedName();
    clear.hidden = !getSelected();
  }
  function choose(championId) { onChange(championId); close(); }
  function show(query = '') {
    open = true; menu.hidden = false;
    input.setAttribute('aria-expanded', 'true'); toggle.setAttribute('aria-expanded', 'true');
    results = champions.filter(champion => matchesChampion(champion, query));
    list.replaceChildren();
    results.forEach((champion, index) => {
      const option = document.createElement('div'); option.id = `${id}-option-${champion.id}`;
      option.className = 'champion-option'; option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(getSelected() === champion.id));
      option.setAttribute('aria-disabled', String(isDisabled(champion.id)));
      const image = document.createElement('img'); image.src = champion.icon; image.alt = ''; image.loading = 'lazy';
      const name = document.createElement('span'); name.textContent = champion.name;
      option.append(image, name);
      if (isDisabled(champion.id)) { const note = document.createElement('small'); note.textContent = '선택됨'; option.append(note); }
      option.addEventListener('pointerdown', event => event.preventDefault());
      option.addEventListener('click', () => { if (!isDisabled(champion.id)) choose(champion.id); });
      list.append(option);
    });
    summary.textContent = results.length ? `${results.length}명 · ↑↓ 이동 · Enter 선택` : '검색 결과가 없습니다.';
    highlight(-1); list.scrollTop = 0;
    const rect = field.getBoundingClientRect();
    root.classList.toggle('opens-up', window.innerHeight - rect.bottom < 280 && rect.top > 280);
  }
  input.addEventListener('focus', () => { show(); input.select(); });
  input.addEventListener('click', () => { if (!open) { show(); input.select(); } });
  input.addEventListener('input', () => show(input.value));
  input.addEventListener('keydown', event => {
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    else if (event.key === 'Tab') close();
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) show();
      const available = results.map((champion, i) => isDisabled(champion.id) ? -1 : i).filter(i => i >= 0);
      if (!available.length) return;
      const current = available.indexOf(active), step = event.key === 'ArrowDown' ? 1 : -1;
      const next = current < 0 ? (step > 0 ? 0 : available.length - 1) : (current + step + available.length) % available.length;
      highlight(available[next]);
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      const champion = active >= 0 ? results[active] : results.find(champion => !isDisabled(champion.id));
      if (champion && !isDisabled(champion.id)) choose(champion.id);
    }
  });
  input.addEventListener('blur', close);
  for (const button of [clear, toggle]) button.addEventListener('pointerdown', event => event.preventDefault());
  clear.addEventListener('click', () => { input.focus(); choose(''); });
  toggle.addEventListener('click', () => { const wasOpen = open; input.focus(); if (wasOpen) close(); else show(); });
  document.addEventListener('pointerdown', event => { if (open && !root.contains(event.target)) close(); });
  function refresh() { if (!open) input.value = selectedName(); clear.hidden = !getSelected(); }
  refresh();
  return { element: root, refresh };
}
