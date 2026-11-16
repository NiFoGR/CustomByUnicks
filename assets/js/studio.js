/* ==========================================================================
   UNICKS custom design studio: the options panel, price, link and sending.
   Works without the 3D view too (old phones, WebGL off): every choice,
   the price and the send form still work, the room just isn't drawn.
   Options and prices live in studio-data.js.
   ========================================================================== */
const D = window.UNICKS_STUDIO;
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, c) => (c || document).querySelector(s);
const $$ = (s, c) => Array.prototype.slice.call((c || document).querySelectorAll(s));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = (n) => D.currency + Math.round(n).toLocaleString('en-GB');
const byId = (list, id) => list.filter((o) => o.id === id)[0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TICK = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.5l2.5 2.5L10 3.5"/></svg>';
const ARROW = '<svg viewBox="0 0 15 10" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M1 5h12M9.5 1.5L13 5 9.5 8.5"/></svg>';
const METAL_CSS = {
  brass: 'linear-gradient(135deg,#7d5f2f,#e2c58c 42%,#a8844a 68%,#d8b878)',
  black: 'linear-gradient(135deg,#121212,#3b3b3b 45%,#191919 70%,#2e2e2e)',
  gun: 'linear-gradient(135deg,#34363a,#8a8d92 45%,#4a4c50 70%,#73767b)',
  nickel: 'linear-gradient(135deg,#8f8e89,#f0efeb 42%,#a9a8a3 68%,#dddcd8)'
};

const studioEl = $('#studio');
if (D && studioEl) init();

function init() {
  /* ---------- state: defaults from the first look, then whatever the link says ---------- */
  const state = { w: D.size.w.value, l: D.size.l.value, layout: 'shower', lights: {}, extras: {} };
  let touched = false;
  // single-choice groups: [state key, link key, options, default]
  const SINGLES = [
    ['wall', 'wall', D.stones], ['floor', 'floor', D.stones], ['pattern', 'pat', D.floorPatterns],
    ['metal', 'metal', D.metals], ['vanity', 'van', D.vanities], ['front', 'front', D.vanityFronts],
    ['basin', 'basin', D.basins], ['mirror', 'mir', D.mirrors], ['screen', 'scr', D.screens], ['led', 'led', D.ledTemps]
  ];
  applyLook(D.looks[0]);
  readURL();

  function applyLook(lk) {
    SINGLES.forEach(([k, , list]) => { state[k] = lk[k] || list[0].id; });
    state.feature = lk.feature || 'same';
    state.lights = {}; lk.lights.forEach((id) => { state.lights[id] = true; });
    state.extras = {}; lk.extras.forEach((id) => { state.extras[id] = true; });
  }
  function readURL() {
    const q = new URLSearchParams(location.search);
    if (!q.has('wall')) return;
    touched = true;
    const num = (k, r) => { const v = parseFloat(q.get(k)); return isFinite(v) ? Math.round(clamp(v, r.min, r.max) * 10) / 10 : r.value; };
    state.w = num('w', D.size.w); state.l = num('l', D.size.l);
    if (byId(D.layouts, q.get('lay'))) state.layout = q.get('lay');
    // a link made before an option existed gets the plain version of it
    SINGLES.forEach(([k, qk, list]) => { state[k] = byId(list, q.get(qk)) ? q.get(qk) : list[0].id; });
    state.feature = byId(D.stones, q.get('feat')) ? q.get('feat') : 'same';
    const list = (k, src) => { const o = {}; (q.get(k) || '').split(',').forEach((id) => { if (byId(src, id)) o[id] = true; }); return o; };
    state.lights = list('li', D.lights);
    state.extras = list('ex', D.extras);
  }
  function link() {
    const p = new URLSearchParams();
    p.set('w', state.w.toFixed(1)); p.set('l', state.l.toFixed(1)); p.set('lay', state.layout);
    SINGLES.forEach(([k, qk]) => p.set(qk, state[k]));
    p.set('feat', state.feature);
    p.set('li', D.lights.filter((o) => state.lights[o.id]).map((o) => o.id).join(','));
    p.set('ex', D.extras.filter((o) => state.extras[o.id]).map((o) => o.id).join(','));
    return location.pathname + '?' + p.toString().replace(/%2C/g, ',');
  }
  const bathOK = () => { const b = byId(D.layouts, 'bath'); return state.w >= (b.minW || 0) && state.l >= (b.minL || 0); };
  const doubleOK = () => state.w >= (byId(D.basins, 'double').minW || 0);

  /* ---------- build the panel: every choice is a picture card ---------- */
  const OPT = 'assets/img/opt/';
  // a picture for each option, photographed from the 3D room (stones use the stone itself)
  const pic = (group, id) => {
    if (group === 'wall' || group === 'floor' || group === 'feature') return OPT + 'stone-' + id + '.webp';
    const pre = { layout: 'lay-', pattern: 'pat-', metal: 'metal-', vanity: 'van-', front: 'front-', basin: 'basin-', mirror: 'mir-', screen: 'scr-', led: 'led-', lights: 'li-', extras: 'ex-' }[group];
    return OPT + pre + id + '.webp';
  };
  const priceTag = (p) => p ? '+' + money(p) : 'Included';
  const card = (group, name, type, o, price, note) =>
    '<label class="choice" data-opt="' + o.id + '" data-group-of="' + group + '">' +
    '<input type="' + type + '" name="' + name + '" value="' + o.id + '">' +
    '<span class="choice__img"><img src="' + pic(group, o.id) + '" alt="" width="640" height="480" loading="lazy" decoding="async"' + (group === 'feature' && o.id === 'same' ? ' data-same-stone' : '') + '></span>' +
    '<span class="choice__mark' + (type === 'radio' ? ' is-round' : '') + '" aria-hidden="true">' + TICK + '</span>' +
    '<span class="choice__body"><span class="choice__name">' + esc(o.name) + '</span>' +
    (note !== undefined ? '<span class="choice__note"' + (o.id === 'bath' || o.id === 'double' ? ' data-note-of="' + o.id + '"' : '') + '>' + esc(note || '') + '</span>' : '') +
    '<span class="choice__price' + (price ? '' : ' is-zero') + '">' + priceTag(price) + '</span></span></label>';
  const group = (id, title, help, body) =>
    '<fieldset class="ogroup" data-group="' + id + '"><legend>' + esc(title) + '</legend>' +
    (help ? '<p class="ogroup__help">' + esc(help) + '</p>' : '') + '<div class="choices">' + body + '</div></fieldset>';
  const radios = (gid, list, priceOf, notes) => list.map((o) => card(gid, gid, 'radio', o, priceOf(o), notes ? (o.note || '') : undefined)).join('');
  const checks = (gid, list) => list.map((o) => card(gid, o.id, 'checkbox', o, o.price, o.note)).join('');

  $('[data-looks]').innerHTML = D.looks.map((lk) =>
    '<button type="button" class="look" data-look="' + lk.id + '" aria-pressed="false">' +
    '<span class="look__img"><img src="' + OPT + 'look-' + lk.id + '.webp" alt="" width="640" height="480" decoding="async"></span>' +
    '<span class="look__name">' + esc(lk.name) + '</span></button>').join('');

  const TABS = [['room', 'Room'], ['stone', 'Stone'], ['fit', 'Vanity'], ['shower', 'Shower'], ['light', 'Lighting'], ['extra', 'Extras']];
  const sizer = (k, label, less, more) =>
    '<div class="sizer__row"><span class="sizer__label" id="lab-' + k + '">' + label + '</span><div class="sizer__ctl" role="group" aria-labelledby="lab-' + k + '">' +
    '<button type="button" data-size="' + k + '" data-d="-1" aria-label="' + less + '">&minus;</button>' +
    '<output data-out="' + k + '" aria-live="polite"></output>' +
    '<button type="button" data-size="' + k + '" data-d="1" aria-label="' + more + '">+</button></div></div>';
  const showerExtras = D.extras.filter((o) => o.tab === 'shower'), otherExtras = D.extras.filter((o) => o.tab !== 'shower');
  const same = { id: 'same', name: D.feature.same };
  const panels = {
    room: '<fieldset class="ogroup" data-group="size"><legend>Room size</legend><p class="ogroup__help">Roughly is fine. We measure properly at the survey.</p>' +
        '<div class="sizer">' + sizer('w', 'Width', 'Narrower', 'Wider') + sizer('l', 'Length', 'Shorter', 'Longer') +
        '<p class="sizer__area">Floor area <b data-area></b></p></div></fieldset>' +
      group('layout', 'Layout', '', D.layouts.map((o) => card('layout', 'layout', 'radio', o, o.price, '')).join('')),
    stone: group('wall', 'Walls', 'Real stone, book-matched slab to slab.', radios('wall', D.stones, (o) => o.wall)) +
      group('feature', 'Inside the shower', 'Use the same stone, or set the shower apart.', card('feature', 'feature', 'radio', same, 0) + D.stones.map((o) => card('feature', 'feature', 'radio', o, D.feature.price)).join('')) +
      group('floor', 'Floor', '', radios('floor', D.stones, (o) => o.floor)) +
      group('pattern', 'How the floor is laid', '', radios('pattern', D.floorPatterns, (o) => o.price, true)),
    fit: group('metal', 'Metal finish', 'Used for every tap, rail and frame.', radios('metal', D.metals, (o) => o.price)) +
      group('vanity', 'Vanity', '', radios('vanity', D.vanities, (o) => o.price)) +
      group('front', 'Vanity front', '', radios('front', D.vanityFronts, (o) => o.price)) +
      group('basin', 'Basin', '', radios('basin', D.basins, (o) => o.price, true)) +
      group('mirror', 'Mirror', '', radios('mirror', D.mirrors, (o) => o.price)),
    shower: group('screen', 'Glass screen', '', radios('screen', D.screens, (o) => o.price, true)) +
      group('showerx', 'In the shower', 'Tick any you want.', checks('extras', showerExtras)),
    light: group('lights', 'Lighting', 'Tick any you want. Evening light is on so you can see them.', checks('lights', D.lights)) +
      group('led', 'Light colour', '', radios('led', D.ledTemps, (o) => o.price, true)),
    extra: group('extras', 'Extras', 'Tick any you want.', checks('extras', otherExtras))
  };
  $('[data-tabs]').innerHTML = TABS.map((t, i) =>
    '<button type="button" role="tab" id="tab-' + t[0] + '" aria-controls="panel-' + t[0] + '" aria-selected="' + !i + '" tabindex="' + (i ? -1 : 0) + '">' +
    '<b>' + (i + 1) + '</b><span>' + t[1] + '</span></button>').join('');
  $('[data-panels]').innerHTML = TABS.map((t, i) =>
    '<div class="studio__pane" role="tabpanel" id="panel-' + t[0] + '" aria-labelledby="tab-' + t[0] + '"' + (i ? ' hidden' : '') + '>' + panels[t[0]] +
    '<div class="studio__stepnav">' +
    (i ? '<button type="button" class="studio__prev" data-next="' + TABS[i - 1][0] + '">Back</button>' : '<span></span>') +
    (i < TABS.length - 1
      ? '<button type="button" class="btn studio__next" data-next="' + TABS[i + 1][0] + '">Next: ' + TABS[i + 1][1] + ' ' + ARROW + '</button>'
      : '<a class="btn btn--solid studio__next" href="#send">Send my design ' + ARROW + '</a>') +
    '</div></div>').join('');
  $$('[data-note]').forEach((el) => { el.textContent = D.note; });

  /* ---------- tabs ---------- */
  const tabs = $$('[role="tab"]');
  let eveningShown = false;
  function openTab(id, focus, quiet) {
    tabs.forEach((t) => {
      const on = t.id === 'tab-' + id;
      t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1;
      $('#' + t.getAttribute('aria-controls')).hidden = !on;
      if (on && focus) t.focus();
    });
    if (id === 'light' && !eveningShown) { eveningShown = true; setMood(true); }
    if (!quiet) look({ room: 'overview', stone: 'overview', fit: 'vanity', shower: 'shower', light: 'vanity', extra: 'overview' }[id]);
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => openTab(t.id.slice(4)));
    t.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (d) { e.preventDefault(); openTab(tabs[(i + d + tabs.length) % tabs.length].id.slice(4), true); }
    });
  });
  const showTabs = () => {
    const top = $('[data-tabs]').getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.6) $('[data-tabs]').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
  };
  $$('[data-next]').forEach((b) => b.addEventListener('click', () => {
    openTab(b.dataset.next, true);
    const panel = $('.studio__panel');
    if (panel.scrollHeight > panel.clientHeight + 4) panel.scrollTo({ top: $('[data-tabs]').offsetTop, behavior: REDUCED ? 'auto' : 'smooth' });
    else showTabs();
  }));

  /* ---------- the 3D view ---------- */
  const stage = $('[data-stage]');
  let studio = null;
  const look = (v) => { if (studio && v && studio.hasView(v)) { studio.view(v); markView(v); } };
  const markView = (v) => $$('[data-view]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === v));
  $$('[data-view]').forEach((b) => b.addEventListener('click', () => look(b.dataset.view)));
  const moodBtn = $('[data-mood]');
  function setMood(on) {
    moodBtn.setAttribute('aria-pressed', on);
    if (studio) studio.mood(on);
  }
  moodBtn.addEventListener('click', () => setMood(moodBtn.getAttribute('aria-pressed') !== 'true'));

  // click a thing in the room to jump to its options; hover names it
  const PICK = {
    wall: ['stone', 'wall', 'Wall stone'], feature: ['stone', 'feature', 'Shower walls'], floor: ['stone', 'floor', 'Floor'],
    vanity: ['fit', 'vanity', 'Vanity'], mirror: ['fit', 'mirror', 'Mirror'], sconce: ['light', 'lights', 'Wall lights'],
    screen: ['shower', 'screen', 'Glass screen'], bench: ['shower', 'showerx', 'Shower bench'], rain: ['shower', 'showerx', 'Rain shower'],
    niche: ['light', 'lights', 'Lit niche'], cove: ['light', 'lights', 'Ceiling cove'],
    star: ['extra', 'extras', 'Star inlay'], border: ['extra', 'extras', 'Floor border'], rail: ['extra', 'extras', 'Towel rail'],
    bath: ['room', 'layout', 'Bath'], toilet: ['fit', 'metal', 'Toilet']
  };
  const tagEl = $('[data-tag]');
  function onPick(tag) {
    const t = PICK[tag];
    if (!t) return;
    openTab(t[0], false, true);
    const g = $('#panel-' + t[0] + ' [data-group="' + t[1] + '"]');
    if (!g) return;
    const panel = $('.studio__panel');
    if (panel.scrollHeight > panel.clientHeight + 4) panel.scrollTo({ top: Math.max(0, g.offsetTop - 80), behavior: REDUCED ? 'auto' : 'smooth' });
    else g.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' });
    g.classList.remove('is-flash'); void g.offsetWidth; g.classList.add('is-flash');
  }
  function onHover(tag, x, y) {
    if (!tagEl) return;
    const t = tag && PICK[tag];
    tagEl.hidden = !t;
    if (t) { tagEl.textContent = t[2]; tagEl.style.transform = 'translate(' + Math.round(x + 14) + 'px,' + Math.round(y + 14) + 'px)'; }
  }

  function fail() {
    stage.classList.add('is-failed');
    $('[data-fail]').hidden = false;
  }
  let webgl = false;
  try { const c = document.createElement('canvas'); webgl = !!c.getContext('webgl2'); } catch (e) { webgl = false; }
  if (!webgl) fail();
  else {
    stage.classList.add('is-loading');
    import('./studio-scene.js').then((m) => {
      studio = m.createStudio($('[data-canvas]'), {
        reduced: REDUCED,
        labels: { w: $('[data-dim="w"]'), l: $('[data-dim="l"]') },
        onMove: () => markView(''),
        onPick, onHover,
        debug: /debug/.test(location.hash),
        fixedQuality: /hq/.test(location.hash)       // design.html#hq: never lower quality (used to shoot the still images)
      });
      studio.set(state);
      if (moodBtn.getAttribute('aria-pressed') === 'true') studio.mood(true);
      studio.view('overview', 0);
      return studio.ready();
    }).then(() => new Promise((r) => setTimeout(r, 250))).then(() => {
      stage.classList.add('is-live');
      if (studio) studio.intro();
      markView('overview');
    }).catch((e) => { console.error(e); stage.classList.remove('is-loading'); fail(); });
  }

  /* ---------- changes ---------- */
  const where = {
    wall: 'overview', floor: 'overview', pattern: 'overview', feature: 'shower', metal: 'vanity', vanity: 'vanity',
    front: 'vanity', basin: 'vanity', mirror: 'vanity', screen: 'shower',
    plinth: 'vanity', mirrorLight: 'vanity', sconce: 'vanity', niche: 'shower', cove: 'overview',
    star: 'overview', border: 'overview', bench: 'shower', rain: 'shower', rail: 'overview'
  };
  $('[data-panels]').addEventListener('change', (e) => {
    const i = e.target;
    touched = true;
    if (i.type === 'radio') {
      state[i.name] = i.value;
      look(i.name === 'layout' ? (i.value === 'bath' ? 'bath' : 'overview') : where[i.name]);
    } else {
      const bucket = byId(D.lights, i.value) ? state.lights : state.extras;
      bucket[i.value] = i.checked;
      if (i.checked) look(i.value === 'mirror' ? 'vanity' : where[i.value]);
    }
    render();
  });
  $('[data-panels]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-size]');
    if (!b) return;
    const k = b.dataset.size, r = D.size[k];
    touched = true;
    state[k] = Math.round(clamp(state[k] + Number(b.dataset.d) * r.step, r.min, r.max) * 10) / 10;
    render();
    if (studio) { const v = studio.viewName; if (v === 'overview' || v === 'plan') { studio.view(v, 380); markView(v); } }
  });
  $('[data-looks]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-look]');
    if (!b) return;
    applyLook(byId(D.looks, b.dataset.look));
    touched = true;
    render();
    look('overview');
  });

  /* ---------- price and summary ---------- */
  const featOn = () => state.feature !== 'same' && state.feature !== state.wall;
  function total() {
    let t = D.base + (state.w * state.l - D.baseArea) * D.perM2;
    t += byId(D.layouts, state.layout).price;
    t += byId(D.stones, state.wall).wall + byId(D.stones, state.floor).floor;
    if (featOn()) t += D.feature.price;
    const ped = state.basin === 'pedestal';
    SINGLES.forEach(([k, , list]) => { if (k !== 'wall' && k !== 'floor' && !(ped && (k === 'vanity' || k === 'front'))) t += byId(list, state[k]).price || 0; });
    D.lights.forEach((o) => { if (state.lights[o.id]) t += o.price; });
    D.extras.forEach((o) => { if (state.extras[o.id]) t += o.price; });
    return Math.round(t / 50) * 50;
  }
  function specText() {
    const names = (src, on) => src.filter((o) => on[o.id]).map((o) => o.name).join(', ') || 'None';
    const n = (list, id) => byId(list, id).name;
    const area = state.w * state.l;
    return [
      'Custom design',
      'Room: ' + state.w.toFixed(1) + ' m x ' + state.l.toFixed(1) + ' m (' + area.toFixed(1) + ' m²), ' + n(D.layouts, state.layout).toLowerCase(),
      'Walls: ' + n(D.stones, state.wall),
      'Shower walls: ' + (featOn() ? n(D.stones, state.feature) : 'Same as the walls'),
      'Floor: ' + n(D.stones, state.floor) + ', ' + n(D.floorPatterns, state.pattern).toLowerCase(),
      'Metal finish: ' + n(D.metals, state.metal),
      'Vanity: ' + (state.basin === 'pedestal' ? 'none (round pedestal basin)' : n(D.vanities, state.vanity) + ', ' + n(D.vanityFronts, state.front).toLowerCase()),
      'Basin: ' + n(D.basins, state.basin),
      'Mirror: ' + n(D.mirrors, state.mirror),
      'Glass screen: ' + n(D.screens, state.screen),
      'Lighting: ' + names(D.lights, state.lights) + (Object.keys(state.lights).some((k) => state.lights[k]) ? ' (' + n(D.ledTemps, state.led).toLowerCase() + ')' : ''),
      'Extras: ' + names(D.extras, state.extras),
      'Guide price: ' + money(total())
    ].join('\n');
  }
  window.UNICKS_BUILD = () => ({ text: specText(), link: location.origin + link() });
  if (/debug/.test(location.hash)) window.__ui = { set(o) { Object.assign(state, o); render(); }, state, mood: setMood };

  let shown = 0, tw = 0;
  function showTotal(to) {
    const els = $$('[data-total]');
    if (REDUCED || !shown) { shown = to; els.forEach((el) => { el.textContent = money(to); }); return; }
    const from = shown, t0 = performance.now();
    cancelAnimationFrame(tw);
    (function step(t) {
      const k = Math.min(1, (t - t0) / 500), e = 1 - Math.pow(1 - k, 4);
      shown = from + (to - from) * e;
      els.forEach((el) => { el.textContent = money(shown); });
      if (k < 1) tw = requestAnimationFrame(step);
    })(t0);
  }

  function render() {
    const ok = bathOK(), dOK = doubleOK();
    if (state.layout === 'bath' && !ok) state.layout = 'shower';
    if (state.basin === 'double' && !dOK) state.basin = 'trough';
    ['w', 'l'].forEach((k) => {
      $('[data-out="' + k + '"]').textContent = state[k].toFixed(1) + ' m';
      $$('[data-size="' + k + '"]').forEach((b) => { b.disabled = Number(b.dataset.d) < 0 ? state[k] <= D.size[k].min : state[k] >= D.size[k].max; });
    });
    $$('[data-panels] input').forEach((i) => {
      if (i.type === 'radio') i.checked = state[i.name] === i.value;
      else i.checked = !!(byId(D.lights, i.value) ? state.lights : state.extras)[i.value];
    });
    const bathIn = $('input[name="layout"][value="bath"]'), b = byId(D.layouts, 'bath');
    bathIn.disabled = !ok;
    bathIn.closest('.choice').classList.toggle('is-off', !ok);
    $('[data-note-of="bath"]').textContent = ok ? 'Freestanding bath beside the shower' : 'Needs a room ' + b.minW.toFixed(1) + ' m wide and ' + b.minL.toFixed(1) + ' m long';
    $('.choice[data-opt="shower"] .choice__note').textContent = 'Glass screen, level floor';
    const dblIn = $('input[name="basin"][value="double"]'), dbl = byId(D.basins, 'double');
    dblIn.disabled = !dOK;
    dblIn.closest('.choice').classList.toggle('is-off', !dOK);
    $('[data-note-of="double"]').textContent = dOK ? dbl.note : 'Needs a room ' + dbl.minW.toFixed(1) + ' m wide';
    $('[data-area]').textContent = (state.w * state.l).toFixed(1) + ' m²';
    const ped = state.basin === 'pedestal';
    ['vanity', 'front'].forEach((gid) => {
      const g = $('[data-group="' + gid + '"]');
      g.classList.toggle('is-unused', ped);
      $$('input', g).forEach((i) => { i.disabled = ped; });
      let n = $('.ogroup__unused', g);
      if (!n) { n = document.createElement('p'); n.className = 'ogroup__unused'; n.textContent = 'Not needed with a round pedestal basin.'; g.querySelector('legend').after(n); }
      n.hidden = !ped;
    });
    $$('[data-same-stone]').forEach((img) => { img.src = OPT + 'stone-' + state.wall + '.webp'; });
    $$('[data-look]').forEach((btn) => {
      const lk = byId(D.looks, btn.dataset.look);
      const same = SINGLES.every(([k, , list]) => (lk[k] || list[0].id) === state[k]) && (lk.feature || 'same') === state.feature &&
        D.lights.every((o) => !!state.lights[o.id] === lk.lights.indexOf(o.id) > -1) &&
        D.extras.every((o) => !!state.extras[o.id] === lk.extras.indexOf(o.id) > -1);
      btn.setAttribute('aria-pressed', same);
    });
    const bathBtn = $('[data-view="bath"]');
    if (bathBtn) bathBtn.hidden = state.layout !== 'bath';
    showTotal(total());
    $('[data-sum]').textContent = specText().split('\n').slice(1, -1).join('. ') + '.';
    // keep a fresh visit's address clean; once something changes, the address holds the design
    if (touched) history.replaceState(null, '', link() + location.hash);
    if (studio) studio.set(state);
  }

  /* ---------- copy link, save picture ---------- */
  const copyBtn = $('[data-copy]');
  copyBtn.addEventListener('click', () => {
    const url = location.origin + link();
    const done = () => { copyBtn.textContent = 'Link copied'; setTimeout(() => { copyBtn.textContent = 'Copy link'; }, 2200); };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => window.prompt('Copy this link', url));
    else window.prompt('Copy this link', url);
  });
  const saveBtn = $('[data-save]');
  saveBtn.addEventListener('click', () => {
    if (!studio) return;
    const src = studio.snapshot(), w = src.width, h = src.height;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.drawImage(src, 0, 0);
    const band = Math.round(h * 0.2), pad = Math.round(Math.max(18, w * 0.03)), s = Math.max(14, Math.round(w / 55));
    const g = x.createLinearGradient(0, h - band, 0, h);
    g.addColorStop(0, 'rgba(11,10,9,0)'); g.addColorStop(1, 'rgba(11,10,9,.85)');
    x.fillStyle = g; x.fillRect(0, h - band, w, band);
    x.textBaseline = 'alphabetic';
    x.fillStyle = '#c6a15b'; x.font = '400 ' + Math.round(s * 1.5) + 'px "Cormorant Garamond", Georgia, serif';
    x.fillText('U N I C K S', pad, h - pad);
    x.fillStyle = '#c9c2b6'; x.font = '300 ' + Math.round(s * 0.75) + 'px Jost, sans-serif'; x.textAlign = 'right';
    x.fillText('Designed at unicks.co.uk', w - pad, h - pad);
    c.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'my-unicks-bathroom.jpg';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      saveBtn.textContent = 'Saved'; setTimeout(() => { saveBtn.textContent = 'Save image'; }, 2200);
    }, 'image/jpeg', 0.92);
  });

  /* ---------- phone price bar: on while the designer is on screen ---------- */
  const bar = $('[data-pbar]');
  if (bar && 'IntersectionObserver' in window) {
    let inStudio = false, inSend = false;
    const upd = () => bar.classList.toggle('is-on', inStudio && !inSend);
    // only once the options themselves are on screen, so it never covers the introduction
    new IntersectionObserver((es) => { inStudio = es[0].isIntersecting; upd(); }, { rootMargin: '0px 0px -25% 0px' }).observe($('.studio__body'));
    new IntersectionObserver((es) => { inSend = es[0].isIntersecting; upd(); }).observe($('#send'));
  }

  render();
}
