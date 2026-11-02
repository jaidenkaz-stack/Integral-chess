/* ============================================================
   Интегральные шахматы — интерфейс, доска, битвы
   ============================================================ */
(function () {
  'use strict';

  const C = window.CONFIG;
  const Game = window.Game;
  const Integrals = window.Integrals;
  const Sound = window.Sound;
  const sq = Game.sq;
  const other = Game.other;

  const SAVE_KEY = 'integral-chess-save-v1';
  const PREF_KEY = 'integral-chess-prefs-v1';
  const I18N = window.I18N;
  const T = I18N.t;
  const sideName = (s) => T('side_' + s);
  const rowName = (r) => T('row_' + r);
  const logText = (e) => (e.key ? T(e.key, e.p) + (e.sub ? ' ' + T(e.sub.key, e.sub.p) : '') : e.text || '');

  /* ---------- утилиты ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Number(n).toLocaleString('ru-RU');
  const fmtSec = (s) => (s == null ? '—' : s.toFixed(1).replace('.', ',') + ' с');
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  function restartAnim(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

  /* ---------- настройки ---------- */
  const prefs = Object.assign(
    { roundTime: C.roundTime, difficulty: 'mix', diagonal: true, sound: true, nameW: T('def_p1'), nameB: T('def_p2') },
    store.get(PREF_KEY) || {}
  );
  const savePrefs = () => store.set(PREF_KEY, prefs);
  Sound.enabled = prefs.sound;

  /* ---------- состояние ---------- */
  let game = null;
  let selected = null;
  let targets = [];
  let hoverId = null;
  let busy = false;
  const pieceEls = new Map();
  const cellEls = [];

  /* ============================================================
     ФОН
     ============================================================ */
  (function buildBg() {
    const bg = $('#bg');
    const sym = ['∫', '∑', '∂', 'π', '∞', '√', 'dx', 'eˣ', '∮', 'Δ', 'λ', '∇', 'lim', 'ln x', 'sin', '∬', 'dy', 'f′(x)', 'θ', '∫₀¹'];
    let html = '';
    for (let i = 0; i < 28; i++) {
      const s = sym[i % sym.length];
      const size = 14 + Math.random() * 46;
      html += `<span style="left:${Math.random() * 100}%;top:${Math.random() * 100}%;font-size:${size}px;animation-duration:${18 + Math.random() * 26}s;animation-delay:-${Math.random() * 30}s;opacity:${0.03 + Math.random() * 0.06}">${s}</span>`;
    }
    bg.innerHTML = html;
  })();

  /* ============================================================
     ФИШКА (вид сверху)
     ============================================================ */
  function tokenSVG(side, row) {
    const guard = row === 'back';
    const inner = guard
      ? `<circle cx="50" cy="50" r="37.5" fill="none" stroke="url(#${side}Rim)" stroke-width="5.5" stroke-dasharray="5.2 4.62" opacity=".9"/>`
      : `<circle cx="50" cy="50" r="38" fill="none" stroke="${side === 'w' ? 'rgba(120,90,40,.25)' : 'rgba(0,0,0,.35)'}" stroke-width="1.5"/>`;
    return `<svg viewBox="0 0 100 100" class="tok" aria-hidden="true">
      <circle cx="50" cy="50" r="45" fill="url(#${side}Base)" stroke="url(#${side}Rim)" stroke-width="${guard ? 4.5 : 3.5}"/>
      ${inner}
      <circle cx="50" cy="50" r="29" fill="url(#${side}Base)" stroke="${side === 'w' ? 'rgba(120,90,40,.35)' : 'rgba(0,0,0,.55)'}" stroke-width="2"/>
      <circle cx="50" cy="50" r="20.5" fill="url(#${side}Head)"/>
      <ellipse cx="43" cy="41.5" rx="7.5" ry="4.5" fill="#fff" opacity="${side === 'w' ? 0.75 : 0.22}"/>
      <text x="50" y="62" text-anchor="middle" class="tok-glyph">∫</text>
    </svg>`;
  }

  /* ============================================================
     МЕНЮ
     ============================================================ */
  function initMenu() {
    $('#name-w').value = prefs.nameW;
    $('#name-b').value = prefs.nameB;
    $('#name-w').addEventListener('input', (e) => { prefs.nameW = e.target.value; savePrefs(); });
    $('#name-b').addEventListener('input', (e) => { prefs.nameB = e.target.value; savePrefs(); });

    const seg = (id, key, cast) => {
      const root = $(id);
      const sync = () => $$('button', root).forEach((b) => {
        const on = String(prefs[key]) === b.dataset.v;
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', on);
      });
      root.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        prefs[key] = cast(b.dataset.v);
        savePrefs(); sync(); Sound.play('click');
      });
      sync();
    };
    seg('#set-time', 'roundTime', Number);

    const langRoot = $('#set-lang');
    const syncLang = () => $$('button', langRoot).forEach((b) => b.classList.toggle('on', b.dataset.v === I18N.lang));
    langRoot.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      setLang(b.dataset.v); syncLang(); Sound.play('click');
    });
    syncLang();
    seg('#set-diff', 'difficulty', String);

    const sw = (id, key, after) => {
      const b = $(id);
      const sync = () => b.setAttribute('aria-checked', !!prefs[key]);
      b.addEventListener('click', () => { prefs[key] = !prefs[key]; savePrefs(); sync(); after && after(); Sound.play('click'); });
      sync();
    };
    sw('#set-diag', 'diagonal');
    sw('#set-sound', 'sound', () => { Sound.enabled = prefs.sound; syncSoundBtn(); });

    $('#btn-new').addEventListener('click', () => { Sound.unlock(); newGame(); });
    $('#btn-continue').addEventListener('click', () => { Sound.unlock(); continueGame(); });
    $('#btn-rules').addEventListener('click', () => openModal('#modal-rules'));
    refreshContinue();
  }

  function setLang(l) {
    const old = [T('def_p1'), T('def_p2')];
    I18N.set(l);
    if (prefs.nameW === old[0]) { prefs.nameW = T('def_p1'); $('#name-w').value = prefs.nameW; }
    if (prefs.nameB === old[1]) { prefs.nameB = T('def_p2'); $('#name-b').value = prefs.nameB; }
    savePrefs();
    refreshContinue();
    if (game) render();
  }

  function refreshContinue() {
    const s = store.get(SAVE_KEY);
    const ok = s && s.version === 3 && !s.winner;
    $('#btn-continue').classList.toggle('hidden', !ok);
    if (ok) $('#btn-continue').textContent = T('continue_fmt', { w: s.names.w, b: s.names.b, n: s.moveNo });
  }

  function showScreen(name) {
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + name));
    if (name === 'menu') refreshContinue();
  }

  /* ============================================================
     СТАРТ ПАРТИИ
     ============================================================ */
  function newGame() {
    game = Game.create({
      names: { w: (prefs.nameW || '').trim() || T('def_p1'), b: (prefs.nameB || '').trim() || T('def_p2') },
      settings: { roundTime: prefs.roundTime, difficulty: prefs.difficulty, diagonal: prefs.diagonal }
    });
    startSession();
  }

  function continueGame() {
    const s = store.get(SAVE_KEY);
    if (!s) return newGame();
    game = Game.load(s);
    startSession();
  }

  function startSession() {
    selected = null; targets = []; hoverId = null; busy = false;
    pieceEls.forEach((el) => el.remove());
    pieceEls.clear();
    $('#fx').innerHTML = '';
    showScreen('game');
    save();
    render();
    turnBanner();
  }

  function save() { if (game && !game.winner) store.set(SAVE_KEY, game.serialize()); }
  function clearSave() { store.del(SAVE_KEY); }

  /* ============================================================
     ДОСКА
     ============================================================ */
  function buildBoard() {
    const cells = $('#cells');
    let html = '';
    for (let row = 0; row < 8; row++) {
      for (let f = 0; f < 8; f++) {
        const r = 7 - row;
        const dark = (f + r) % 2 === 0;
        const goal = r === 7 ? ' goal-w' : r === 0 ? ' goal-b' : '';
        html += `<div class="cell ${dark ? 'dark' : 'light'}${goal}" data-f="${f}" data-r="${r}"><i class="mark"></i></div>`;
      }
    }
    cells.innerHTML = html;
    $$('.cell', cells).forEach((el) => { cellEls[+el.dataset.r * 8 + +el.dataset.f] = el; });

    const files = 'abcdefgh'.split('').map((c) => `<span>${c}</span>`).join('');
    $('#files-top').innerHTML = files;
    $('#files-bottom').innerHTML = files;
    const ranks = [8, 7, 6, 5, 4, 3, 2, 1].map((n) => `<span>${n}</span>`).join('');
    $('#ranks-left').innerHTML = ranks;
    $('#ranks-right').innerHTML = ranks;

    cells.addEventListener('click', (e) => {
      const c = e.target.closest('.cell');
      if (c) onCell(+c.dataset.f, +c.dataset.r);
    });
    cells.addEventListener('mousemove', (e) => {
      const c = e.target.closest('.cell');
      const p = c && game ? game.at(+c.dataset.f, +c.dataset.r) : null;
      const id = p ? p.id : null;
      if (id !== hoverId) { hoverId = id; renderInfo(); renderCells(); }
    });
    cells.addEventListener('mouseleave', () => { hoverId = null; renderInfo(); renderCells(); });
  }

  function renderPieces() {
    const layer = $('#pieces');
    for (const p of Object.values(game.pawns)) {
      let el = pieceEls.get(p.id);
      if (!p.alive) {
        if (el) {
          pieceEls.delete(p.id);
          if (p.finished) {
            // сначала доезжает до последнего ряда, потом уходит на финиш
            el.style.left = p.file * 12.5 + '%';
            el.style.top = (7 - p.rank) * 12.5 + '%';
            setTimeout(() => el.classList.add('finishing'), 430);
            setTimeout(() => el.remove(), 1400);
          } else {
            el.classList.add('dying');
            setTimeout(() => el.remove(), 900);
          }
        }
        continue;
      }
      if (!el) {
        el = document.createElement('div');
        el.className = `piece ${p.side} ${p.row}`;
        el.dataset.id = p.id;
        el.innerHTML = `<div class="pc-hp"><i></i></div><div class="pc-tok">${tokenSVG(p.side, p.row)}</div><div class="pc-name">${esc(p.name)}</div>`;
        layer.appendChild(el);
        pieceEls.set(p.id, el);
      }
      el.style.left = p.file * 12.5 + '%';
      el.style.top = (7 - p.rank) * 12.5 + '%';
      const ratio = p.hp / p.maxHp;
      const bar = el.firstElementChild.firstElementChild;
      bar.style.width = Math.max(0, ratio * 100) + '%';
      el.classList.toggle('wounded', ratio < 1);
      el.classList.toggle('hp-mid', ratio <= 0.6 && ratio > 0.3);
      el.classList.toggle('hp-low', ratio <= 0.3);
      el.classList.toggle('selected', selected === p.id);
      el.classList.toggle('turn', !game.winner && p.side === game.turn);
    }
  }

  function renderCells() {
    if (!game) return;
    const lm = game.lastMove;
    const toIdx = (s) => (s ? (+s.slice(1) - 1) * 8 + 'abcdefgh'.indexOf(s[0]) : -1);
    const lmFrom = lm ? toIdx(lm.from) : -1;
    const lmTo = lm ? toIdx(lm.to) : -1;
    const tmap = new Map(targets.map((t) => [t.rank * 8 + t.file, t]));
    const selP = selected ? game.pawns[selected] : null;
    $('#board').dataset.turn = game.turn;
    for (let i = 0; i < 64; i++) {
      const el = cellEls[i];
      const t = tmap.get(i);
      el.classList.toggle('last', i === lmFrom || i === lmTo);
      el.classList.toggle('sel', !!selP && selP.rank * 8 + selP.file === i);
      el.classList.toggle('mv', !!t && t.type === 'move');
      el.classList.toggle('atk', !!t && t.type === 'attack');
      const p = game.grid[i] ? game.pawns[game.grid[i]] : null;
      el.classList.toggle('own', !busy && !game.winner && !!p && p.side === game.turn);
      el.classList.toggle('hov', !!p && p.id === hoverId);
    }
  }

  function playerCard(side) {
    const el = $('#card-' + side);
    const st = game.stats[side];
    const alive = game.alivePawns(side);
    const hp = game.totalHp(side);
    const max = game.maxTotalHp();
    const turn = !game.winner && game.turn === side;
    const front = alive.filter((p) => p.row === 'front').length;
    const back = alive.length - front;
    el.classList.toggle('is-turn', turn);
    el.innerHTML = `
      <div class="pcard-top">
        <span class="pcard-chip"></span>
        <div class="pcard-id"><div class="pcard-name">${esc(game.names[side])}</div><div class="pcard-side">${sideName(side)}</div></div>
        <span class="pcard-turn">${turn ? T('pc_turn') : ''}</span>
      </div>
      <div class="pcard-main">
        <div class="pcard-score"><b>${game.score(side)}</b><span>${T('pc_finish')}</span></div>
        <div><b>${alive.length}</b><span>${T('pc_pawns', { f: front, b: back })}</span></div>
        <div><b>${fmt(hp)}</b><span>${T('pc_hp')}</span></div>
      </div>
      <div class="pcard-bar"><i style="width:${(hp / max) * 100}%"></i></div>
      <div class="pcard-mini">
        <div><b>${st.correct}</b><span>${T('pc_correct')}</span></div>
        <div><b>${st.wrong}</b><span>${T('pc_wrong')}</span></div>
        <div><b>${fmt(st.damage)}</b><span>${T('pc_dmg')}</span></div>
        <div><b>${fmtSec(st.fastest)}</b><span>${T('pc_best')}</span></div>
      </div>`;
  }

  function renderInfo() {
    const el = $('#pawn-info');
    const p = (hoverId && game.pawns[hoverId]) || (selected && game.pawns[selected]);
    if (!p) {
      el.innerHTML = `
        <div class="card-head"><h3>${T('hint_title')}</h3></div>
        <div class="legend">
          <div class="lg-row"><span class="lg-ic dot"></span>${T('hint_1')}</div>
          <div class="lg-row"><span class="lg-ic ring"></span>${T('hint_2')}</div>
          <div class="lg-row"><span class="lg-ic mini">${tokenSVG('w', 'front')}</span>${T('hint_3', { hp: C.frontHp })}</div>
          <div class="lg-row"><span class="lg-ic mini">${tokenSVG('w', 'back')}</span>${T('hint_4', { hp: C.backHp })}</div>
          <div class="lg-row goal"><span class="lg-ic flag"></span>${T('hint_5')}</div>
        </div>`;
      return;
    }
    const moves = game.legalMoves(p.id);
    const ratio = p.hp / p.maxHp;
    const mvTxt = p.side !== game.turn ? T('opp_turn') :
      moves.length ? T('moves_fmt', { m: moves.filter((m) => m.type === 'move').length, a: moves.filter((m) => m.type === 'attack').length }) : T('no_moves');
    el.innerHTML = `
      <div class="card-head"><h3>${T('pawn_title')}</h3><span class="tag ${p.side}">${sideName(p.side)}</span></div>
      <div class="pi-body">
        <div class="pi-tok">${tokenSVG(p.side, p.row)}</div>
        <div class="pi-txt">
          <div class="pi-name">${esc(p.name)}</div>
          <div class="pi-cls">${rowName(p.row)} · ${T('cell_fmt', { sq: sq(p.file, p.rank) })}</div>
        </div>
      </div>
      <div class="pi-hp"><div class="pi-hpnum"><b>${fmt(p.hp)}</b> / ${fmt(p.maxHp)} HP</div>
        <div class="hpbar ${ratio <= 0.3 ? 'low' : ratio <= 0.6 ? 'mid' : ''}"><i style="width:${ratio * 100}%"></i></div></div>
      <div class="pi-grid">
        <div><span>${T('killed')}</span><b>${p.kills}</b></div>
        <div><span>${T('avail')}</span><b>${mvTxt}</b></div>
      </div>`;
  }

  function renderLog() {
    const list = $('#log');
    const items = game.log.slice(-120).reverse();
    list.innerHTML = items.map((e) =>
      `<li class="lg-${e.kind}"><span class="lg-n">${e.n}</span><span class="lg-side ${e.side || ''}"></span><span class="lg-t">${esc(logText(e))}</span></li>`
    ).join('');
    $('#log-count').textContent = T('log_count', { n: game.log.length });
  }

  function renderTop() {
    const t = $('#turn-ind');
    t.className = 'turn-ind ' + (game.winner ? game.winner : game.turn);
    $('#turn-text').textContent = game.winner ? T('win_of_' + game.winner) : `${T('turn_of_' + game.turn)} · ${game.names[game.turn]}`;
    $('#turn-no').textContent = T('turn_no', { n: game.moveNo });
    $('#score-w').textContent = game.score('w');
    $('#score-b').textContent = game.score('b');
  }

  function render() {
    if (!game) return;
    renderPieces();
    renderCells();
    playerCard('w');
    playerCard('b');
    renderInfo();
    renderLog();
    renderTop();
  }

  /* ============================================================
     ХОДЫ
     ============================================================ */
  async function onCell(f, r) {
    if (busy || !game || game.winner) return;
    const p = game.at(f, r);
    const tgt = targets.find((t) => t.file === f && t.rank === r);
    if (selected && tgt) { await act(selected, tgt); return; }
    if (p && p.side === game.turn) {
      if (selected === p.id) { selected = null; targets = []; }
      else {
        selected = p.id;
        targets = game.legalMoves(p.id);
        Sound.play('select');
        if (!targets.length) toast(T('toast_stuck', { name: p.name }), 'muted');
      }
      render();
      return;
    }
    if (p && p.side !== game.turn) {
      toast(T('now_turn_' + game.turn), 'muted');
    }
    selected = null; targets = [];
    render();
  }

  async function act(id, t) {
    busy = true;
    const p = game.pawns[id];
    selected = null; targets = [];
    if (t.type === 'move') {
      const res = game.move(id, t.file, t.rank);
      Sound.play('move');
      render();
      await wait(420);
      if (res.finished) await onFinished(p);
    } else {
      const d = game.pawns[t.target];
      game.addLog('attack', p.side, t.head ? 'log_attack_head' : 'log_attack_diag', { a: p.name, d: d.name, sq: sq(d.file, d.rank) });
      render();
      clashFx(p, d);
      Sound.play('clash');
      await wait(900);
      const outcome = await Battle.run(p, d, t);
      const res = game.applyBattle(p.id, d.id, outcome);
      render();
      if (outcome !== 'repelled') burstAt(outcome === 'attacker' ? d : p);
      await wait(700);
      if (res.finished) await onFinished(p);
    }
    if (game.winner) return finish();
    const info = game.nextTurn();
    if (game.winner) return finish();
    save();
    render();
    if (info.skipped && !info.quiet && !info.deadlock) toast(T('no_moves_' + info.side), 'warn');
    turnBanner();
    busy = false;
  }

  async function finish() {
    clearSave();
    render();
    await wait(500);
    showVictory();
    busy = false;
  }

  /* ---------- пешка на финише ---------- */
  async function onFinished(p) {
    const fx = $('#fx');
    const c = cellCenter(p);
    const el = document.createElement('div');
    el.className = 'finish-fx ' + p.side;
    el.style.left = c.x + '%'; el.style.top = c.y + '%';
    el.innerHTML = '<span>+1</span>';
    fx.appendChild(el);
    burstAt(p);
    setTimeout(() => el.remove(), 1600);
    Sound.play('correct');
    toast(T('toast_finish', { p: p.name, n: game.score(p.side) }), 'finish ' + p.side);
    const sc = $('#score-' + p.side);
    if (sc) restartAnim(sc, 'bump');
    await wait(700);
  }

  /* ---------- эффекты на доске ---------- */
  function cellCenter(p) { return { x: (p.file + 0.5) * 12.5, y: (7 - p.rank + 0.5) * 12.5 }; }

  function clashFx(a, d) {
    const fx = $('#fx');
    const A = cellCenter(a), D = cellCenter(d);
    const x = (A.x + D.x) / 2, y = (A.y + D.y) / 2;
    const el = document.createElement('div');
    el.className = 'clash';
    el.style.left = x + '%'; el.style.top = y + '%';
    let sparks = '';
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2;
      sparks += `<i style="--dx:${Math.cos(ang) * 60}px;--dy:${Math.sin(ang) * 60}px;animation-delay:${Math.random() * 0.08}s"></i>`;
    }
    el.innerHTML = `<span class="clash-x">⚔</span>${sparks}`;
    fx.appendChild(el);
    [a, d].forEach((p) => { const pe = pieceEls.get(p.id); if (pe) restartAnim(pe, 'clashing'); });
    setTimeout(() => el.remove(), 1400);
  }

  function burstAt(p) {
    const fx = $('#fx');
    const c = cellCenter(p);
    const el = document.createElement('div');
    el.className = 'burst ' + p.side;
    el.style.left = c.x + '%'; el.style.top = c.y + '%';
    let parts = '';
    for (let i = 0; i < 18; i++) {
      const ang = Math.random() * Math.PI * 2, dist = 30 + Math.random() * 50;
      parts += `<i style="--dx:${Math.cos(ang) * dist}px;--dy:${Math.sin(ang) * dist}px"></i>`;
    }
    el.innerHTML = parts;
    fx.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }

  /* ============================================================
     БИТВА
     ============================================================ */
  const Battle = (function () {
    const ov = $('#battle');
    const P = {};
    let ctx = null;
    let R = null;
    let raf = 0;
    const recent = [];
    const recentSet = new Set();
    const RING = 2 * Math.PI * 44;

    function build(side) {
      const root = $('#panel-' + side);
      const keys = [1, 2, 3, 4, 5, 'del', 6, 7, 8, 9, 0, 'ok'];
      root.innerHTML = `
        <div class="dp-head">
          <div class="dp-tok"></div>
          <div class="dp-id">
            <div class="dp-name"></div>
            <div class="dp-role"></div>
          </div>
          <div class="dp-hpbox">
            <div class="dp-hpnum"><b class="hpv"></b><span class="hpm"></span></div>
            <div class="hpbar big"><i class="hpghost"></i><i class="hpfill"></i></div>
          </div>
        </div>
        <div class="dp-q">
          <div class="q-meta"><span class="q-tag"></span><span class="q-player"></span></div>
          <div class="q-tex"></div>
        </div>
        <div class="dp-ans">
          <span class="ans-label" data-i18n="ans_label">${T('ans_label')}</span>
          <span class="ans-val"></span>
          <span class="ans-fb"></span>
        </div>
        <div class="keypad">${keys.map((k) => `<button type="button" data-k="${k}" class="${k === 'ok' ? 'k-ok' : k === 'del' ? 'k-del' : ''}">${k === 'del' ? '⌫' : k === 'ok' ? '✓' : k}</button>`).join('')}</div>
        <div class="dp-hint" data-i18n-html="hint_${side}_html">${T('hint_' + side + '_html')}</div>`;
      P[side] = {
        root,
        tok: $('.dp-tok', root), name: $('.dp-name', root), role: $('.dp-role', root),
        hpv: $('.hpv', root), hpm: $('.hpm', root), fill: $('.hpfill', root), ghost: $('.hpghost', root),
        tag: $('.q-tag', root), player: $('.q-player', root), tex: $('.q-tex', root),
        ans: $('.ans-val', root), fb: $('.ans-fb', root), keypad: $('.keypad', root)
      };
      P[side].keypad.addEventListener('pointerdown', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        e.preventDefault();
        restartAnim(b, 'pressed');
        press(side, b.dataset.k);
      });
    }
    build('w');
    build('b');

    function setHp(side, animate) {
      const p = ctx.pawn[side];
      const ratio = Math.max(0, p.hp / p.maxHp);
      const S = P[side];
      S.hpv.textContent = fmt(p.hp);
      S.hpm.textContent = ' / ' + fmt(p.maxHp) + ' HP';
      S.fill.style.width = ratio * 100 + '%';
      if (animate) setTimeout(() => { S.ghost.style.width = ratio * 100 + '%'; }, 450);
      else S.ghost.style.width = ratio * 100 + '%';
      const bar = S.fill.parentElement;
      bar.classList.toggle('mid', ratio <= 0.6 && ratio > 0.3);
      bar.classList.toggle('low', ratio <= 0.3);
    }

    function setAnswer(side) {
      const v = R ? R.input[side] : '';
      P[side].ans.textContent = v || '';
      P[side].ans.classList.toggle('empty', !v);
    }

    function feedback(side, text, kind) {
      const fb = P[side].fb;
      fb.textContent = text || '';
      fb.className = 'ans-fb' + (kind ? ' ' + kind : '');
    }

    function renderTex(el, tex) {
      try {
        window.katex.render('\\displaystyle ' + tex, el, { throwOnError: false, displayMode: true });
      } catch (e) {
        el.textContent = tex;
      }
    }

    function remember(tex) {
      recent.push(tex); recentSet.add(tex);
      while (recent.length > 60) recentSet.delete(recent.shift());
    }

    async function run(att, def, move) {
      ctx = { att, def, pawn: { [att.side]: att, [def.side]: def }, round: 0 };
      for (const side of ['w', 'b']) {
        const p = ctx.pawn[side];
        const S = P[side];
        S.root.className = 'duel-panel ' + side;
        S.tok.innerHTML = tokenSVG(p.side, p.row);
        S.name.textContent = p.name;
        S.role.innerHTML = `<span class="role ${p === att ? 'atk' : 'def'}">${p === att ? T('role_atk') : T('role_def')}</span><span class="cls">${rowName(p.row)}</span>`;
        S.player.textContent = game.names[side];
        S.tag.textContent = T('tag_default');
        S.tex.innerHTML = '<span class="q-wait">∫ ? dx</span>';
        S.ans.textContent = '';
        feedback(side, '');
        setHp(side, false);
      }
      $('#b-sub').innerHTML = T('b_sub', { a: `<b class="${att.side}">${esc(att.name)}</b>`, b: `<b class="${def.side}">${esc(def.name)}</b>`, sq: sq(def.file, def.rank), how: move.head ? T('head_on') : T('diag') });
      $('#b-round').textContent = T('round_n', { n: 1 });
      $('#b-level').textContent = '';
      setTimer(1, Math.min(99, game.settings.roundTime));
      ov.classList.remove('hidden');
      requestAnimationFrame(() => ov.classList.add('show'));

      await countdown();

      for (;;) {
        ctx.round++;
        const res = await round();
        if (res.type === 'timeout') {
          Sound.play('timeout');
          for (const s of ['w', 'b']) P[s].root.classList.add('dim');
          await banner(T('bn_timeout'), T('bn_timeout_sub', { d: def.name }), 'neutral', 2400);
          return close('repelled');
        }
        const dealer = ctx.pawn[res.side];
        const tside = other(res.side);
        const target = ctx.pawn[tside];
        const dmg = res.ans * C.damagePercent;
        const st = game.stats[res.side];
        st.damage += dmg;
        target.hp = Math.max(0, target.hp - dmg);
        game.addLog('hit', res.side, 'log_hit', { p: dealer.name, ans: res.ans, pct: C.damagePercent, dmg: fmt(dmg), t: target.name, time: fmtSec(res.time) });

        await wait(500);
        Sound.play('hit');
        restartAnim(P[tside].root, 'hit');
        restartAnim(P[res.side].root, 'strike');
        floatDamage(tside, dmg);
        setHp(tside, true);
        await wait(1100);

        if (target.hp <= 0) {
          Sound.play('kill');
          P[tside].root.classList.add('dead');
          await banner(T('bn_killed', { t: target.name }), T('bn_killed_sub', { d: dealer.name }), res.side, 2400);
          return close(target === def ? 'attacker' : 'defender');
        }
        await banner(T('bn_round', { n: ctx.round, d: dealer.name }), T('bn_round_sub', { t: target.name, hp: fmt(target.hp) }), res.side, 2100);
      }
    }

    async function close(outcome) {
      ov.classList.remove('show');
      await wait(350);
      ov.classList.add('hidden');
      ctx = null; R = null;
      return outcome;
    }

    async function countdown() {
      const el = $('#b-count');
      el.classList.remove('hidden', 'word');
      for (const t of ['3', '2', '1']) {
        el.textContent = t;
        restartAnim(el, 'pop');
        Sound.play('count');
        await wait(700);
      }
      el.textContent = T('go');
      el.classList.add('word');
      restartAnim(el, 'pop');
      Sound.play('go');
      await wait(650);
      el.classList.add('hidden');
    }

    async function banner(title, sub, side, ms) {
      const el = $('#b-banner');
      el.className = 'battle-banner ' + side;
      el.innerHTML = `<div class="bb-title">${esc(title)}</div><div class="bb-sub">${esc(sub)}</div>`;
      restartAnim(el, 'in');
      await wait(ms);
      el.classList.add('hidden');
    }

    function floatDamage(side, dmg) {
      const el = document.createElement('div');
      el.className = 'dmg-float';
      el.textContent = '−' + fmt(dmg);
      P[side].root.appendChild(el);
      setTimeout(() => el.remove(), 1500);
    }

    function setTimer(frac, sec) {
      $('#b-ring').style.strokeDasharray = RING;
      $('#b-ring').style.strokeDashoffset = RING * (1 - frac);
      $('#b-time').textContent = sec;
    }

    function round() {
      return new Promise((resolve) => {
        const pair = Integrals.generatePair(game.settings.difficulty, recentSet, C.mixWeights);
        remember(pair.w.tex); remember(pair.b.tex);
        $('#b-round').textContent = T('round_n', { n: ctx.round });
        $('#b-level').textContent = T('level_fmt', { l: T('level_' + pair.level) });
        $('#b-level').className = 'bc-level lv-' + pair.level;
        R = {
          q: { w: pair.w, b: pair.b },
          input: { w: '', b: '' },
          lock: { w: 0, b: 0 },
          done: false,
          t0: performance.now(),
          T: game.settings.roundTime * 1000,
          lastSec: null,
          resolve
        };
        for (const s of ['w', 'b']) {
          const S = P[s];
          S.root.classList.remove('locked', 'correct', 'wrong', 'dim', 'lost');
          S.tag.textContent = T(pair[s].tag);
          renderTex(S.tex, pair[s].tex);
          restartAnim(S.tex, 'reveal');
          setAnswer(s);
          feedback(s, '');
        }
        $('#b-timer').classList.remove('urgent');
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(loop);
      });
    }

    function loop() {
      if (!R || R.done) return;
      const now = performance.now();
      const left = Math.max(0, R.T - (now - R.t0));
      const sec = Math.ceil(left / 1000);
      setTimer(left / R.T, sec);
      if (sec !== R.lastSec) {
        R.lastSec = sec;
        if (sec <= 5 && sec > 0) { Sound.play('tickUrgent'); $('#b-timer').classList.add('urgent'); }
      }
      for (const s of ['w', 'b']) {
        if (R.lock[s] && now >= R.lock[s]) {
          R.lock[s] = 0;
          P[s].root.classList.remove('locked', 'wrong');
          feedback(s, '');
        }
      }
      if (left <= 0) { end({ type: 'timeout' }); return; }
      raf = requestAnimationFrame(loop);
    }

    function end(res) {
      if (!R || R.done) return;
      R.done = true;
      cancelAnimationFrame(raf);
      $('#b-timer').classList.remove('urgent');
      for (const s of ['w', 'b']) {
        P[s].root.classList.remove('locked', 'wrong');
        if (res.type === 'correct' && res.side === s) continue;
        feedback(s, T('fb_reveal', { n: R.q[s].ans }), 'reveal');
        if (res.type === 'correct') P[s].root.classList.add('lost');
      }
      const resolve = R.resolve;
      resolve(res);
    }

    function press(side, k) {
      if (!R || R.done) return;
      if (R.lock[side]) { restartAnim(P[side].ans, 'nudge'); return; }
      let v = R.input[side];
      if (k === 'del') v = v.slice(0, -1);
      else if (k === 'ok') { submit(side); return; }
      else {
        if (v.length >= 4) return;
        v = v === '0' ? String(k) : v + k;
        if (+v > C.answerMax) { feedback(side, T('fb_max', { n: C.answerMax }), 'warn'); return; }
      }
      R.input[side] = v;
      feedback(side, '');
      setAnswer(side);
      Sound.play('key');
    }

    function submit(side) {
      const v = R.input[side];
      if (v === '') { feedback(side, T('fb_enter'), 'warn'); restartAnim(P[side].ans, 'nudge'); return; }
      const n = parseInt(v, 10);
      const time = (performance.now() - R.t0) / 1000;
      const st = game.stats[side];
      if (n === R.q[side].ans) {
        st.correct++;
        if (st.fastest == null || time < st.fastest) st.fastest = time;
        Sound.play('correct');
        P[side].root.classList.add('correct');
        feedback(side, T('fb_ok', { n, pct: C.damagePercent, dmg: fmt(n * C.damagePercent), t: fmtSec(time) }), 'ok');
        end({ type: 'correct', side, ans: n, time });
      } else {
        st.wrong++;
        Sound.play('wrong');
        R.lock[side] = performance.now() + C.wrongLockMs;
        R.input[side] = '';
        setAnswer(side);
        P[side].root.classList.add('locked');
        restartAnim(P[side].root, 'wrong');
        feedback(side, T('fb_bad', { n, s: (C.wrongLockMs / 1000).toString().replace('.', ',') }), 'bad');
      }
    }

    document.addEventListener('keydown', (e) => {
      if (!R || R.done) return;
      const c = e.code;
      let side = null, key = null;
      if (/^Digit\d$/.test(c)) { side = 'w'; key = c.slice(5); }
      else if (/^Numpad\d$/.test(c)) { side = 'b'; key = c.slice(6); }
      else if (c === 'Backspace') { side = 'w'; key = 'del'; }
      else if (c === 'Enter') { side = 'w'; key = 'ok'; }
      else if (c === 'NumpadEnter') { side = 'b'; key = 'ok'; }
      else if (c === 'NumpadDecimal' || c === 'Delete' || c === 'NumpadSubtract' || c === 'NumpadComma') { side = 'b'; key = 'del'; }
      if (!side) return;
      e.preventDefault();
      if (e.repeat && key === 'ok') return;
      const btn = $(`button[data-k="${key}"]`, P[side].keypad);
      if (btn) restartAnim(btn, 'pressed');
      press(side, key);
    });

    return {
      run,
      get active() { return !!ctx; },
      // для автотестов
      _debug() { return R ? { w: R.q.w.ans, b: R.q.b.ans, done: R.done } : null; },
      _press: (s, k) => press(s, k)
    };
  })();

  /* ============================================================
     ПОБЕДА
     ============================================================ */
  function showVictory() {
    const w = game.winner;
    const draw = w === 'draw';
    Sound.play('win');
    const row = (label, a, b, better) => {
      const cls = better === 'w' ? ['best', ''] : better === 'b' ? ['', 'best'] : ['', ''];
      return `<tr><th>${label}</th><td class="w ${cls[0]}">${a}</td><td class="b ${cls[1]}">${b}</td></tr>`;
    };
    const cmp = (a, b, lowBetter) => (a === b ? null : (lowBetter ? a < b : a > b) ? 'w' : 'b');
    const S = game.stats;
    const aw = game.alivePawns('w').length, ab = game.alivePawns('b').length;
    const hw = game.totalHp('w'), hb = game.totalHp('b');
    const fw = S.w.fastest, fb = S.b.fastest;
    $('#victory-card').innerHTML = `
      <div class="vc-crown ${w}">
        <svg viewBox="0 0 64 48"><path d="M4 40 L8 12 L22 26 L32 6 L42 26 L56 12 L60 40 Z" /><rect x="4" y="40" width="56" height="6" rx="2"/></svg>
      </div>
      <div class="vc-eyebrow">${T('win_of_' + w)}</div>
      <h2 class="vc-name ${w}">${draw ? esc(game.names.w) + ' · ' + esc(game.names.b) : esc(game.names[w])}</h2>
      <div class="vc-score"><b class="w">${game.score('w')}</b><span>:</span><b class="b">${game.score('b')}</b></div>
      <p class="vc-reason">${esc(game.winReason && game.winReason.key ? T(game.winReason.key, game.winReason.p) : game.winReason || '')}</p>
      <table class="vc-table">
        <thead><tr><th></th><th class="w">${esc(game.names.w)}<small>${T('side_lower_w')}</small></th><th class="b">${esc(game.names.b)}<small>${T('side_lower_b')}</small></th></tr></thead>
        <tbody>
          ${row(T('v_finished'), game.score('w'), game.score('b'), cmp(game.score('w'), game.score('b')))}
          ${row(T('v_pawns'), aw, ab, cmp(aw, ab))}
          ${row(T('v_hp'), fmt(hw), fmt(hb), cmp(hw, hb))}
          ${row(T('v_correct'), S.w.correct, S.b.correct, cmp(S.w.correct, S.b.correct))}
          ${row(T('v_wrong'), S.w.wrong, S.b.wrong, cmp(S.w.wrong, S.b.wrong, true))}
          ${row(T('v_dmg'), fmt(S.w.damage), fmt(S.b.damage), cmp(S.w.damage, S.b.damage))}
          ${row(T('v_kills'), S.w.kills, S.b.kills, cmp(S.w.kills, S.b.kills))}
          ${row(T('v_fast'), fmtSec(fw), fmtSec(fb), fw == null && fb == null ? null : fw == null ? 'b' : fb == null ? 'w' : cmp(fw, fb, true))}
          ${row(T('v_moves'), S.w.moves, S.b.moves, null)}
        </tbody>
      </table>
      <div class="vc-actions">
        <button class="btn primary big" id="vc-rematch">${T('rematch')}</button>
        <button class="btn ghost big" id="vc-menu">${T('to_menu')}</button>
      </div>`;
    const ov = $('#victory');
    ov.classList.remove('hidden');
    requestAnimationFrame(() => ov.classList.add('show'));
    confetti(draw ? 'mix' : w);
    $('#vc-rematch').onclick = () => {
      hideVictory();
      const names = game.names, settings = game.settings;
      game = Game.create({ names, settings });
      startSession();
    };
    $('#vc-menu').onclick = () => { hideVictory(); game = null; showScreen('menu'); };
  }

  function hideVictory() {
    const ov = $('#victory');
    ov.classList.remove('show');
    ov.classList.add('hidden');
    confettiStop = true;
  }

  let confettiStop = false;
  function confetti(side) {
    const cv = $('#confetti');
    const ctx = cv.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; };
    resize();
    const colors = side === 'w' ? ['#f3c969', '#fff3d1', '#e0a53c', '#ffffff', '#ffd98a'] : side === 'b' ? ['#6cc6ff', '#bfeaff', '#2f8fd0', '#ffffff', '#93a8ff'] : ['#f3c969', '#6cc6ff', '#ffffff', '#ffd98a', '#bfeaff'];
    const parts = Array.from({ length: 180 }, () => ({
      x: Math.random() * cv.width, y: -Math.random() * cv.height * 0.8,
      vx: (Math.random() - 0.5) * 2 * dpr, vy: (1.5 + Math.random() * 3) * dpr,
      s: (4 + Math.random() * 7) * dpr, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.25,
      c: colors[(Math.random() * colors.length) | 0], glyph: Math.random() < 0.12
    }));
    confettiStop = false;
    const t0 = performance.now();
    (function frame(t) {
      if (confettiStop) { ctx.clearRect(0, 0, cv.width, cv.height); return; }
      ctx.clearRect(0, 0, cv.width, cv.height);
      const fade = Math.max(0, 1 - (t - t0 - 4500) / 1500);
      ctx.globalAlpha = Math.min(1, fade);
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.r += p.vr; p.vx += Math.sin(p.y / 60) * 0.02;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
        if (p.glyph) { ctx.font = `italic ${p.s * 2.4}px serif`; ctx.fillText('∫', 0, 0); }
        else ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      }
      if (fade > 0) requestAnimationFrame(frame); else ctx.clearRect(0, 0, cv.width, cv.height);
    })(t0);
  }

  /* ============================================================
     ИНТЕРФЕЙС: баннер хода, тосты, модальные окна
     ============================================================ */
  async function turnBanner() {
    if (!game || game.winner) return;
    const el = $('#turn-banner');
    el.className = 'turn-banner ' + game.turn;
    el.innerHTML = `<span>${T('turn_of_' + game.turn)}</span><b>${esc(game.names[game.turn])}</b>`;
    restartAnim(el, 'show');
    Sound.play('turn');
  }

  function toast(text, kind) {
    const box = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = text;
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 2200);
  }

  function openModal(id) {
    const m = $(id);
    m.classList.remove('hidden');
    requestAnimationFrame(() => m.classList.add('show'));
  }
  function closeModal(m) {
    m.classList.remove('show');
    setTimeout(() => m.classList.add('hidden'), 200);
  }

  function syncSoundBtn() {
    $('#btn-sound').innerHTML = prefs.sound
      ? '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5m0-5l-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    $('#btn-sound').classList.toggle('off', !prefs.sound);
  }

  function initChrome() {
    syncSoundBtn();
    $('#btn-sound').addEventListener('click', () => {
      prefs.sound = !prefs.sound; Sound.enabled = prefs.sound; savePrefs(); syncSoundBtn();
      $('#set-sound').setAttribute('aria-checked', prefs.sound);
      Sound.play('click');
    });
    $('#btn-help').addEventListener('click', () => openModal('#modal-rules'));
    $('#btn-menu').addEventListener('click', () => { if (!Battle.active) openModal('#modal-menu'); });
    $$('.modal').forEach((m) => {
      m.addEventListener('click', (e) => {
        if (e.target === m || e.target.closest('[data-close]')) closeModal(m);
      });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') $$('.modal.show').forEach(closeModal);
    });
    $('#btn-to-menu').addEventListener('click', () => { closeModal($('#modal-menu')); save(); game = null; showScreen('menu'); });
    $('#btn-restart').addEventListener('click', () => {
      closeModal($('#modal-menu'));
      game = Game.create({ names: game.names, settings: game.settings });
      startSession();
    });
    $('#btn-end').addEventListener('click', () => {
      if (!game || game.winner || busy) return;
      closeModal($('#modal-menu'));
      game.endByScore();
      finish();
    });
    $('#btn-resign').addEventListener('click', () => {
      if (!game || game.winner || busy) return;
      closeModal($('#modal-menu'));
      const loser = game.turn;
      game.setWinner(other(loser), 'r_resign_' + loser, { name: game.names[loser] });
      finish();
    });
  }

  /* ---------- запуск ---------- */
  I18N.apply();
  buildBoard();
  initMenu();
  initChrome();

  // хук для автотестов
  window.__IC = { get game() { return game; }, Battle, onCell, get busy() { return busy; } };
})();
