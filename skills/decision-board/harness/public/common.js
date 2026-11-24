// decision-board 하네스: 이동 줄(탭별 진행·확인), 모드·보기 전환, 선택 자동 저장·복원, 메모 칸, 결정 목차, 짧은 태그(<d-opt>), 스크린샷 자르기, 일괄 선택.
// 페이지는 <link rel="stylesheet" href="/common.css"> + <script defer src="/common.js"> 만 넣으면 된다.
// 설정은 /pages.json: { "title", "pages": [{ "href", "title" }], "toggles": [{ "attr", "values", "labels" }], "rootAttrs": {} }
(() => {
  const root = document.documentElement;
  const STORE = 'decision-board:';
  const listeners = [];
  let saveTimer;
  let saveState;
  let answers = {};
  let status = null;
  let here = null;
  let loadedHash = null;
  const POLL_MS = 3000;

  // 모드는 설정을 받기 전에 먼저 달아 깜빡임을 줄인다
  root.dataset.mode = localStorage.getItem(`${STORE}mode`) ?? 'light';

  const notify = () => listeners.forEach((fn) => fn());

  async function loadConfig() {
    try {
      const res = await fetch('/pages.json', { cache: 'no-store' });
      return res.ok ? await res.json() : {};
    } catch {
      return {};
    }
  }

  function applyToggles(config) {
    for (const [name, value] of Object.entries(config.rootAttrs ?? {})) root.setAttribute(name, value);
    const toggles = config.toggles?.length ? [...config.toggles] : [];
    if (!toggles.some((t) => t.attr === 'mode')) toggles.unshift({ attr: 'mode', values: ['light', 'dark'], labels: ['라이트', '다크'] });
    for (const t of toggles) {
      const saved = localStorage.getItem(`${STORE}${t.attr}`);
      root.dataset[t.attr] = t.values.includes(saved) ? saved : t.values[0];
    }
    return toggles;
  }

  function buildNav(config, toggles) {
    const nav = document.createElement('nav');
    nav.className = 'discuss-nav';
    here = location.pathname === '/' ? config.pages?.[0]?.href : location.pathname;
    for (const page of config.pages ?? []) {
      const a = document.createElement('a');
      a.href = page.href;
      a.textContent = page.title;
      if (page.href === here) a.setAttribute('aria-current', 'page');
      nav.append(a);
    }
    const spacer = document.createElement('span');
    spacer.className = 'spacer';
    nav.append(spacer);
    // 전환은 값마다 버튼을 둔 스위치로, 지금 값이 칠해져 보인다
    for (const t of toggles) {
      const group = document.createElement('span');
      group.className = 'seg';
      const labels = t.labels ?? t.values;
      const buttons = t.values.map((value, i) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = labels[i];
        button.onclick = () => {
          root.dataset[t.attr] = value;
          localStorage.setItem(`${STORE}${t.attr}`, value);
          sync();
          notify();
        };
        return button;
      });
      const sync = () => buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(t.values[i] === root.dataset[t.attr])));
      sync();
      group.append(...buttons);
      nav.append(group);
    }
    saveState = document.createElement('span');
    saveState.className = 'save-state';
    saveState.textContent = '선택은 자동 저장';
    nav.append(saveState);
    document.body.prepend(nav);
    if (config.title) document.title = `${document.title} — ${config.title}`;
  }

  // 이름에 점이 있는 컨트롤만 저장한다(라디오 = 값, 체크박스 묶음 = 켜진 값 배열, 글 칸 = 글).
  // 바뀐 컨트롤(묶음)만 보낸다: 같은 페이지를 두 탭에서 열어도 서로의 답을 이전 값으로 덮지 않게.
  // 아직 저장된 적 없는 체크 목록의 기본값은 "없을 때만 쓰기"(defaults)로 함께 보낸다.
  const dirty = new Set();

  function valueOf(name) {
    const controls = [...document.querySelectorAll(`[name="${CSS.escape(name)}"]`)];
    const first = controls[0];
    if (!first) return undefined;
    if (first.type === 'radio') return controls.find((c) => c.checked)?.value;
    if (first.type === 'checkbox') return controls.filter((c) => c.checked).map((c) => c.value);
    return first.value;
  }

  async function save() {
    clearTimeout(saveTimer);
    const names = [...dirty];
    if (!names.length) return;
    saveState.textContent = '저장 중…';
    saveState.classList.remove('error');
    try {
      const patch = {};
      for (const name of names) {
        const value = valueOf(name);
        if (value !== undefined) patch[name] = value;
      }
      const defaults = {};
      for (const box of document.querySelectorAll('input[type="checkbox"][name*="."]')) {
        if (!(box.name in answers) && !(box.name in patch)) defaults[box.name] = valueOf(box.name);
      }
      const res = await fetch(`/api/answers?defaults=${encodeURIComponent(Object.keys(defaults).join(','))}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...defaults, ...patch }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      Object.assign(answers, defaults, patch);
      for (const name of names) dirty.delete(name);
      saveState.textContent = `저장됨 ${new Date(data.savedAt).toLocaleTimeString('ko-KR', { hour12: false })}`;
      markAnswered();
      loadStatus();
    } catch {
      saveState.textContent = '저장 실패 — 서버를 확인하세요';
      saveState.classList.add('error');
    }
  }

  function scheduleSave(name) {
    dirty.add(name);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 400);
  }

  async function restore() {
    try {
      answers = await (await fetch('/api/answers', { cache: 'no-store' })).json();
    } catch {
      answers = {};
    }
    for (const el of document.querySelectorAll('input[name], textarea[name], select[name]')) {
      if (!(el.name in answers)) continue;
      const value = answers[el.name];
      if (el.type === 'radio') el.checked = el.value === value;
      else if (el.type === 'checkbox') el.checked = Array.isArray(value) && value.includes(el.value);
      else el.value = value;
    }
  }

  // 메모 칸: 레이블("메모·다른 안")을 두고 placeholder는 예시로만 쓴다. 메모만 받는 결정이 아니면 접어 두고, 내용이 있으면 펼친다
  function addMemos() {
    for (const block of document.querySelectorAll('.decision[data-key]')) {
      if (block.dataset.memo === 'off') continue;
      const name = `${block.dataset.key}.note`;
      if (block.querySelector(`[name="${CSS.escape(name)}"]`)) continue;
      const box = document.createElement('div');
      box.className = block.dataset.memo === 'only' ? 'memo open' : 'memo';
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'memo-add';
      add.textContent = '+ 메모 추가';
      const body = document.createElement('div');
      body.className = 'memo-body';
      const label = document.createElement('label');
      label.textContent = '메모·다른 안';
      const memo = document.createElement('textarea');
      memo.id = `memo-${block.dataset.key}`;
      label.htmlFor = memo.id;
      memo.name = name;
      memo.placeholder = block.dataset.memoPlaceholder ?? '예: A에 B의 배치를 합치고 싶다';
      add.onclick = () => {
        box.classList.add('open');
        memo.focus();
      };
      body.append(label, memo);
      box.append(add, body);
      block.append(box);
    }
  }

  function openFilledMemos() {
    for (const memo of document.querySelectorAll('.memo textarea')) {
      if (memo.value) memo.closest('.memo').classList.add('open');
    }
  }

  // <d-opt v="A" title="제목" rec tag="표시" name="p1.x.sub">설명<d-mock>목업</d-mock></d-opt> → label.option
  // name은 가장 가까운 [data-name](하위 질문) 또는 결정의 data-key에서 따온다
  function expandShortTags() {
    const chip = (cls, text) => {
      const span = document.createElement('span');
      span.className = cls;
      span.textContent = text;
      return span;
    };
    for (const opt of document.querySelectorAll('d-opt')) {
      const owner = opt.closest('[data-name], .decision[data-key]');
      const value = opt.getAttribute('v');
      const label = document.createElement('label');
      label.className = 'option';
      const head = document.createElement('span');
      head.className = 'head';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = opt.getAttribute('name') ?? owner?.dataset.name ?? owner?.dataset.key ?? '';
      input.value = value;
      head.append(input, ` ${value}. ${opt.getAttribute('title') ?? ''} `);
      if (opt.hasAttribute('rec')) head.append(chip('rec', '추천'));
      if (opt.hasAttribute('tag')) head.append(chip('tag', opt.getAttribute('tag')));
      label.append(head);
      const mock = opt.querySelector(':scope > d-mock');
      const desc = document.createElement('span');
      desc.className = 'desc';
      for (const node of [...opt.childNodes]) if (node !== mock) desc.append(node);
      if (desc.textContent.trim()) label.append(desc);
      if (mock) {
        const box = document.createElement('div');
        box.className = 'mock';
        box.append(...mock.childNodes);
        label.append(box);
      }
      opt.replaceWith(label);
    }
  }

  // 스크롤 위치에 맞춰 목차에서 지금 보는 결정을 강조한다(.here). 결정 사이 틈에서는 직전 강조를 유지한다
  function spyToc(blocks, toc) {
    const scroller = document.querySelector('.discuss-scroll');
    if (!scroller) return;
    const inBand = new Set();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) (entry.isIntersecting ? inBand.add(entry.target) : inBand.delete(entry.target));
        const current = blocks.find((b) => inBand.has(b));
        if (!current) return;
        for (const a of toc.children) a.classList.toggle('here', a.dataset.key === current.dataset.key);
      },
      { root: scroller, rootMargin: '-10% 0px -80% 0px' },
    );
    for (const block of blocks) observer.observe(block);
  }

  // 화면 틀: 상단바 아래 영역만 스크롤한다. 목차와 본문 스크롤이 서로 독립이다
  function buildShell() {
    const main = document.querySelector('main.discuss');
    if (!main) return;
    const body = document.createElement('div');
    body.className = 'discuss-body';
    const scroll = document.createElement('div');
    scroll.className = 'discuss-scroll';
    main.replaceWith(body);
    scroll.append(main);
    body.append(scroll);
  }

  // 왼쪽 결정 목차: 평소엔 "-"만, 마우스를 올리면 항목명. 상태는 왼쪽 아이콘(답함 ✓, 메모만 ✎)으로 markAnswered가 표시한다
  function buildToc() {
    const blocks = [...document.querySelectorAll('.decision[data-key]')].filter((b) => b.dataset.memo !== 'only');
    if (blocks.length < 2) return;
    const toc = document.createElement('aside');
    toc.className = 'discuss-toc';
    for (const block of blocks) {
      block.id = block.dataset.key;
      const a = document.createElement('a');
      a.href = `#${block.id}`;
      a.dataset.key = block.dataset.key;
      const title = block.querySelector('h2')?.textContent ?? block.dataset.key;
      a.title = title;
      const state = document.createElement('span');
      state.className = 'state';
      const dash = document.createElement('span');
      dash.className = 'dash';
      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = title;
      a.append(state, dash, label);
      toc.append(a);
    }
    document.body.classList.add('has-toc');
    (document.querySelector('.discuss-body') ?? document.body).append(toc);
    spyToc(blocks, toc);
  }

  // 결정이 답을 가졌는지 표시한다(결정 테두리, 목차 아이콘)
  function markAnswered() {
    for (const block of document.querySelectorAll('.decision[data-key]')) {
      if (block.dataset.memo === 'only') continue;
      const value = answers[block.dataset.key];
      const answered = value !== undefined && value !== '';
      block.classList.toggle('answered', answered);
      const toc = document.querySelector(`.discuss-toc a[data-key="${CSS.escape(block.dataset.key)}"]`);
      toc?.classList.toggle('answered', answered);
      toc?.classList.toggle('noted', Boolean(answers[`${block.dataset.key}.note`]));
    }
  }

  async function loadStatus() {
    try {
      status = await (await fetch('/api/status', { cache: 'no-store' })).json();
    } catch {
      status = null;
    }
    renderStatus();
  }

  // 페이지 파일이 바뀌면 자동으로 새로고침하지 않는다(입력 중인 글·스크롤을 잃지 않게). 알림만 띄우고 사용자가 누른다
  function showPageUpdated() {
    if (document.querySelector('.page-updated')) return;
    const notice = document.createElement('div');
    notice.className = 'page-updated';
    notice.append('이 페이지가 업데이트됐습니다 ');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '새로고침';
    button.onclick = async () => {
      await save();
      location.reload();
    };
    notice.append(button);
    document.body.append(notice);
  }

  const REVIEW_TEXT = {
    answers: '답이 수정됨',
    page: '페이지가 수정됨',
    both: '페이지와 답이 수정됨',
  };

  // 탭마다 답한 만큼 채우고(다 답하면 초록), 이 탭의 에이전트 확인 상태를 제목 아래에 보인다
  function renderStatus() {
    if (!status) return;
    for (const a of document.querySelectorAll('.discuss-nav a')) {
      const page = status.pages.find((p) => p.href === a.getAttribute('href'));
      if (!page?.total) continue;
      a.style.setProperty('--p', `${(page.answered / page.total) * 100}%`);
      a.classList.toggle('done', page.answered === page.total);
      let count = a.querySelector('.count');
      if (!count) {
        count = document.createElement('span');
        count.className = 'count';
        a.append(count);
      }
      count.textContent = `${page.answered}/${page.total}`;
    }
    const page = status.pages.find((p) => p.href === here);
    if (page) {
      if (loadedHash === null) loadedHash = page.pageHash;
      else if (page.pageHash !== loadedHash) showPageUpdated();
    }
    const anchor = document.querySelector('main.discuss > .lead') ?? document.querySelector('main.discuss > h1');
    if (!page || !anchor) return;
    let banner = document.querySelector('.review-state');
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'review-state';
      anchor.after(banner);
    }
    const { state, at } = page.review;
    const time = at ? new Date(at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '';
    banner.className = `review-state ${state === 'ok' ? 'ok' : state === 'none' ? '' : 'stale'}`.trim();
    banner.textContent =
      state === 'none' ? 'Claude 확인 전' : state === 'ok' ? `✓ Claude 확인함 · ${time}` : `! Claude 확인(${time}) 후 ${REVIEW_TEXT[state]}`;
  }

  // <div class="crop" data-src="/shots/a.png" data-src-dark="/shots/a-dark.png" data-crop="x,y,w,h" data-scale="1" data-alt="…">
  function renderCrops() {
    for (const el of document.querySelectorAll('.crop[data-src]')) {
      const [x, y, w, h] = (el.dataset.crop ?? '0,0,400,300').split(',').map(Number);
      const scale = Number(el.dataset.scale ?? 1);
      const src = root.dataset.mode === 'dark' && el.dataset.srcDark ? el.dataset.srcDark : el.dataset.src;
      el.classList.add('crop-box');
      el.classList.remove('broken');
      el.style.width = `${w * scale}px`;
      el.style.height = `${h * scale}px`;
      el.replaceChildren();
      const img = new Image();
      img.alt = el.dataset.alt ?? '';
      img.style.left = `${-x * scale}px`;
      img.style.top = `${-y * scale}px`;
      img.onload = () => {
        img.style.width = `${img.naturalWidth * scale}px`;
      };
      img.onerror = () => {
        el.classList.add('broken');
        el.textContent = `이미지 없음: ${src}`;
      };
      img.src = src;
      el.append(img);
      el.title = '누르면 전체 이미지';
      el.onclick = () => window.open(src, '_blank');
    }
  }

  // <button data-check-all="p8.restore">모두 선택</button> <button data-check-none="p8.restore">모두 해제</button>
  function wireBulk() {
    document.addEventListener('click', (e) => {
      const button = e.target.closest('[data-check-all], [data-check-none]');
      if (!button) return;
      e.preventDefault();
      const name = button.dataset.checkAll ?? button.dataset.checkNone;
      const on = button.hasAttribute('data-check-all');
      const boxes = document.querySelectorAll(`input[type="checkbox"][name="${CSS.escape(name)}"]`);
      boxes.forEach((box) => {
        box.checked = on;
      });
      boxes[0]?.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  window.discuss = {
    /** CSS 변수 값(목업이 캔버스·차트에 실제 색을 넘길 때) */
    cssVar: (name, el = document.body) => getComputedStyle(el).getPropertyValue(name).trim(),
    /** 모드·보기 전환 때 다시 그릴 함수. 등록할 때 한 번 바로 부른다 */
    onTheme(fn) {
      listeners.push(fn);
      fn();
    },
    /** 지금까지 저장된 답(복원 뒤 값) */
    answers: () => ({ ...answers }),
    save,
  };

  document.addEventListener('DOMContentLoaded', async () => {
    const config = await loadConfig();
    const toggles = applyToggles(config);
    buildNav(config, toggles);
    expandShortTags();
    addMemos();
    buildShell();
    buildToc();
    wireBulk();
    listeners.push(renderCrops);
    await restore();
    openFilledMemos();
    markAnswered();
    await loadStatus();
    notify();
    document.addEventListener('change', (e) => {
      if (e.target.name?.includes('.')) scheduleSave(e.target.name);
    });
    document.addEventListener('input', (e) => {
      if ((e.target.tagName === 'TEXTAREA' || e.target.type === 'text') && e.target.name?.includes('.')) scheduleSave(e.target.name);
    });
    // 다른 탭·에이전트의 변화는 상단 진행과 확인 배너에만 반영한다(입력칸은 건드리지 않는다)
    setInterval(() => {
      if (!document.hidden) loadStatus();
    }, POLL_MS);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) loadStatus();
    });
  });
})();
