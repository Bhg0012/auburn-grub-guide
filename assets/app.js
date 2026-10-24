/* Auburn Grub Guide */
(() => {
  'use strict';

  const DATA_URL = 'data/places.json';
  const AUBURN = [-85.4808, 32.6099]; // [lng, lat]
  const MAPLIBRE_JS = 'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.min.js';
  const MAPLIBRE_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.min.css';
  const MAP_STYLES = {
    light: 'https://tiles.openfreemap.org/styles/liberty',
    dark: 'https://tiles.openfreemap.org/styles/dark',
  };

  /* ---------- Helpers ---------- */

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const isApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);

  const ICONS = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    xfill: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm3.7 12.3a1 1 0 0 1-1.4 1.4L12 13.4l-2.3 2.3a1 1 0 0 1-1.4-1.4l2.3-2.3-2.3-2.3a1 1 0 0 1 1.4-1.4l2.3 2.3 2.3-2.3a1 1 0 0 1 1.4 1.4L13.4 12l2.3 2.3Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    dice: '<rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><circle cx="8.6" cy="8.6" r="1.25" fill="currentColor" stroke="none"/><circle cx="15.4" cy="8.6" r="1.25" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none"/><circle cx="8.6" cy="15.4" r="1.25" fill="currentColor" stroke="none"/><circle cx="15.4" cy="15.4" r="1.25" fill="currentColor" stroke="none"/>',
    fork: '<path d="M6 3v5.5a3 3 0 0 0 6 0V3M9 3v18"/><path d="M18 21V3c-2.4 1.3-3.4 4-3.4 7.2V14H18"/>',
    map: '<path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z"/><path d="M9 4v14M15 6v14"/>',
    chart: '<path d="M5 20v-8M12 20V5M19 20v-5"/>',
    pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/>',
    phone: '<path d="M5.2 3.5h3l1.6 4.2-2.1 1.4a11.5 11.5 0 0 0 7.2 7.2l1.4-2.1 4.2 1.6v3a2 2 0 0 1-2.1 2A16.5 16.5 0 0 1 3.2 5.6a2 2 0 0 1 2-2.1Z"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z"/>',
    share: '<path d="M12 3.5v11M8 7.2l4-3.7 4 3.7"/><path d="M8.5 10H7a1.8 1.8 0 0 0-1.8 1.8v6.4A1.8 1.8 0 0 0 7 20h10a1.8 1.8 0 0 0 1.8-1.8v-6.4A1.8 1.8 0 0 0 17 10h-1.5"/>',
    go: '<path d="M20.5 3.5 3.5 11l7.4 2.1 2.1 7.4 7.5-17Z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
    chev: '<path d="m9 5.5 6.5 6.5L9 18.5"/>',
    copy: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.6"/><path d="M15.5 8.5V6.6A2.6 2.6 0 0 0 12.9 4H6.6A2.6 2.6 0 0 0 4 6.6v6.3a2.6 2.6 0 0 0 2.6 2.6h1.9"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    sparkle: '<path d="M12 3.5c.6 3.9 2.6 5.9 6.5 6.5-3.9.6-5.9 2.6-6.5 6.5-.6-3.9-2.6-5.9-6.5-6.5 3.9-.6 5.9-2.6 6.5-6.5Z"/><path d="M18.5 15.5c.3 1.6 1 2.3 2.5 2.5-1.5.3-2.2 1-2.5 2.5-.3-1.5-1-2.2-2.5-2.5 1.5-.2 2.2-.9 2.5-2.5Z"/>',
    scope: '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
    bubble: '<path d="M20 11.5c0 4.1-3.6 7.5-8 7.5-1.2 0-2.3-.2-3.3-.6L4 20l1.3-3.7A7.2 7.2 0 0 1 4 11.5C4 7.4 7.6 4 12 4s8 3.4 8 7.5Z"/>',
    flame: '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.9 3.2-6.3 4.4-10.3 2.6 1.7 3.7 4.3 3.4 6.6 1-.6 1.8-1.7 2.1-3 1.9 1.7 3.1 4.2 3.1 6.7 0 3.6-2.6 6.2-6.5 6.2Z"/>',
  };
  const STAR = 'M12 2.9l2.75 5.6 6.15.9-4.45 4.35 1.05 6.1L12 16.95 6.5 19.85l1.05-6.1L3.1 9.4l6.15-.9L12 2.9Z';

  const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  const starSolid = () => `<svg class="star-solid" viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR}" stroke-linejoin="round" stroke-width="1.5" stroke="currentColor"/></svg>`;

  function hydrateIcons(root = document) {
    $$('svg[data-icon]', root).forEach((svg) => {
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('aria-hidden', 'true');
      svg.innerHTML = ICONS[svg.dataset.icon] || '';
      svg.removeAttribute('data-icon');
    });
  }

  // Ratings are out of 10; stars show half of that out of 5.
  function stars(rating, cls = '') {
    let out = '';
    for (let i = 0; i < 5; i++) {
      const f = clamp(rating / 2 - i, 0, 1) * 100;
      out += `<span class="star" style="--f:${f}%;--n:${i}"><svg viewBox="0 0 24 24"><path d="${STAR}"/></svg><svg class="on" viewBox="0 0 24 24"><path d="${STAR}"/></svg></span>`;
    }
    return `<span class="stars ${cls}" role="img" aria-label="${rating} out of 10">${out}</span>`;
  }

  const fmtRating = (r) => (Math.round(r * 10) / 10).toFixed(1);

  // A place can override the rating-based label with its own "verdict".
  const verdictOf = (p) => p.verdict || verdict(p.rating);
  const isMustGo = (p) => ['Must-go', 'Perfect'].includes(verdictOf(p));

  function verdict(r) {
    if (r >= 10) return 'Perfect';
    if (r >= 9) return 'Must-go';
    if (r >= 8) return 'Great';
    if (r >= 7) return 'Good';
    if (r >= 6) return 'Solid';
    if (r >= 4) return 'Meh';
    return 'Skip it';
  }

  function parseDate(s) {
    if (!s) return null;
    const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(s);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, m[3] ? +m[3] : 1);
  }
  const fmtDate = (d, opts) => (d ? d.toLocaleDateString('en-US', opts) : '');
  const shortDate = (s) => fmtDate(parseDate(s), { month: 'short', day: 'numeric' });
  const longDate = (s) => fmtDate(parseDate(s), { month: 'long', day: 'numeric', year: 'numeric' });

  function hue(str) {
    let h = 0;
    for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return 8 + (h % 40); /* warm range: oranges to golds */
  }

  function photo(p, i = 0, eager = false) {
    const src = p.photos && p.photos[i];
    const img = src ? `<img src="${esc(src)}" alt="${esc(p.name)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">` : '';
    return `<div class="ph" style="--h:${hue(p.id || p.name)}"><div class="ph-glyph">${icon('fork')}</div>${img}</div>`;
  }

  function metaLine(p, parts = ['category', 'price', 'area']) {
    return parts.map((k) => p[k]).filter(Boolean).map(esc).join(' &middot; ');
  }

  /* Haptics: vibrate where supported, iOS 18+ switch-toggle trick elsewhere. */
  const haptic = (() => {
    let label;
    return (ms = 8) => {
      try {
        if (navigator.vibrate) { navigator.vibrate(ms); return; }
        if (!isApple) return;
        if (!label) {
          label = document.createElement('label');
          label.style.display = 'none';
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.setAttribute('switch', '');
          label.appendChild(input);
          document.body.appendChild(label);
        }
        label.click();
      } catch (_) { /* no-op */ }
    };
  })();

  let toastTimer;
  function toast(msg, ic = 'check') {
    const t = $('#toast');
    t.innerHTML = `${icon(ic)}<span>${esc(msg)}</span>`;
    t.classList.add('is-shown');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-shown'), 2000);
  }

  /* ---------- State ---------- */

  const state = {
    places: [],
    byId: new Map(),
    query: '',
    category: 'All',
    sort: 'top',
    tab: 'guide',
    loaded: false,
  };

  function normalize(raw) {
    const list = Array.isArray(raw) ? raw : (raw && raw.places) || [];
    return list
      .filter((p) => p && p.name)
      .map((p) => ({
        ...p,
        id: p.id || p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        rating: clamp(Number(p.rating) || 0, 0, 10),
        comments: Array.isArray(p.comments) ? p.comments : p.comments ? [p.comments] : [],
        photos: Array.isArray(p.photos) ? p.photos : [],
        mustTry: Array.isArray(p.mustTry) ? p.mustTry : [],
        tags: Array.isArray(p.tags) ? p.tags : [],
      }));
  }

  const byTop = (a, b) => b.rating - a.rating || (b.visited || '').localeCompare(a.visited || '') || a.name.localeCompare(b.name);
  const byNew = (a, b) => (b.visited || b.added || '').localeCompare(a.visited || a.added || '') || byTop(a, b);
  const byAZ = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });

  function ranked() {
    return [...state.places].sort(byTop);
  }

  // Ties share a rank (two 8.1s are both #2, the next spot is #4).
  function rankMap() {
    const list = ranked();
    return new Map(list.map((p) => [p.id, 1 + list.filter((q) => q.rating > p.rating).length]));
  }

  const rankBadge = (rank) => `<span class="medal ${rank <= 3 ? 'm' + rank : 'mn'}">${rank}</span>`;

  const lrow = (p, lead, extra = '') => `
    <a class="lrow" href="#/p/${esc(p.id)}">
      ${lead}
      <div class="lrow-text">
        <div class="lrow-title">${esc(p.name)}</div>
        <div class="lrow-sub">${metaLine(p, ['category', 'area'])}</div>
      </div>
      <span class="lrow-score"><span class="lrow-num">${starSolid()}${fmtRating(p.rating)}</span>${extra}</span>
      ${icon('chev', 'chev')}
    </a>`;

  function categories() {
    const counts = new Map();
    state.places.forEach((p) => p.category && counts.set(p.category, (counts.get(p.category) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }

  function matches(p, q) {
    if (!q) return true;
    const hay = [p.name, p.category, p.area, p.price, p.blurb, p.address, ...p.tags, ...p.comments, ...p.mustTry].join(' ').toLowerCase();
    return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
  }

  /* ---------- Guide ---------- */

  function renderGuide(animate = true) {
    const cards = $('#cards');
    const total = state.places.length;
    const avg = total ? state.places.reduce((s, p) => s + p.rating, 0) / total : 0;
    $('#guideEyebrow').textContent = total ? `${total} ${total === 1 ? 'spot' : 'spots'} · ${fmtRating(avg)} average` : 'Auburn, Alabama';

    if (!total) {
      $('#hero').innerHTML = '';
      $('#listHead').hidden = true;
      $('#chips').innerHTML = '';
      $('.search').hidden = true;
      cards.innerHTML = `
        <div class="empty">
          <div class="empty-art">${icon('fork')}</div>
          <h3>No spots yet</h3>
          <p>Tell Claude about the first place you tried. Photos, address and all the details show up here.</p>
          <button class="btn btn-primary" data-open="add">${icon('plus')}How to add a spot</button>
        </div>`;
      return;
    }

    $('#listHead').hidden = false;
    $('.search').hidden = false;

    const filtering = state.query || state.category !== 'All';

    // Hero: the most recent spot.
    const latest = [...state.places].sort(byNew)[0];
    $('#hero').innerHTML = filtering || total < 3 ? '' : `
      <a class="hero" href="#/p/${esc(latest.id)}">
        ${photo(latest, 0, true)}
        <div class="hero-scrim"></div>
        <div class="hero-top">
          <span class="hero-eyebrow">${latest.visited ? `Latest &middot; ${esc(shortDate(latest.visited))}` : 'Latest'}</span>
          <span class="pill">${starSolid()}${fmtRating(latest.rating)}<small>/10</small></span>
        </div>
        <div class="hero-text">
          <p class="hero-meta">${metaLine(latest)}</p>
          <h2>${esc(latest.name)}</h2>
          ${latest.comments[0] ? `<p class="hero-quote">“${esc(latest.comments[0])}”</p>` : ''}
        </div>
      </a>`;

    // Chips
    const cats = categories();
    $('#chips').innerHTML = cats.length > 1
      ? [['All', total], ...cats].map(([c, n]) => `<button class="chip ${state.category === c ? 'is-active' : ''}" data-cat="${esc(c)}">${esc(c)}<span class="n">${n}</span></button>`).join('')
      : '';

    // List
    const ranks = rankMap();
    const sorter = state.sort === 'new' ? byNew : state.sort === 'az' ? byAZ : byTop;
    const list = state.places.filter((p) => (state.category === 'All' || p.category === state.category) && matches(p, state.query)).sort(sorter);

    $('#listTitle').textContent = state.query ? `${list.length} ${list.length === 1 ? 'Result' : 'Results'}` : state.category !== 'All' ? state.category : 'All Spots';

    if (!list.length) {
      cards.innerHTML = `
        <div class="empty">
          <h3>No matches</h3>
          <p>Nothing for “${esc(state.query)}”${state.category !== 'All' ? ` in ${esc(state.category)}` : ''}. Try another word.</p>
        </div>`;
      return;
    }

    cards.innerHTML = list.map((p, i) => {
      const rank = ranks.get(p.id);
      const showRank = state.sort === 'top';
      return `
        <a class="card" href="#/p/${esc(p.id)}" style="--i:${animate ? Math.min(i, 8) : 0};${animate ? '' : 'animation:none'}">
          <div class="ph-wrap" style="position:relative">
            ${photo(p, 0, i < 2 && filtering)}
            <div class="card-badges">
              ${showRank ? `<span class="rank ${rank <= 3 ? 'r' + rank : ''}">${rank}</span>` : '<span></span>'}
              <span class="pill">${starSolid()}${fmtRating(p.rating)}<small>/10</small></span>
            </div>
          </div>
          <div class="card-body">
            <div class="card-title-row">
              <h3 class="card-title">${esc(p.name)}</h3>
              <span class="verdict ${isMustGo(p) ? 'hot' : ''}">${verdictOf(p)}</span>
            </div>
            <p class="card-meta">${metaLine(p)}</p>
            ${p.comments[0] ? `<p class="card-quote">${esc(p.comments[0])}</p>` : ''}
          </div>
        </a>`;
    }).join('');
  }

  function skeleton() {
    $('#cards').innerHTML = [0, 1].map(() => `
      <div class="card skeleton" style="animation:none">
        <div class="ph" style="aspect-ratio:16/10"></div>
        <div class="card-body"><div class="bar" style="width:55%;height:18px"></div><div class="bar" style="width:35%"></div></div>
      </div>`).join('');
  }

  function setSort(sort) {
    state.sort = sort;
    const seg = $('#sort');
    const btns = $$('button', seg);
    const idx = btns.findIndex((b) => b.dataset.sort === sort);
    seg.style.setProperty('--i', idx);
    btns.forEach((b, i) => b.setAttribute('aria-selected', String(i === idx)));
    renderGuide();
  }

  /* ---------- Stats ---------- */

  function renderStats() {
    const el = $('#stats');
    const ps = state.places;
    if (!ps.length) {
      el.innerHTML = `
        <div class="empty">
          <div class="empty-art">${icon('chart')}</div>
          <h3>Nothing to count yet</h3>
          <p>Once you add a few spots, your averages, favorites and streaks live here.</p>
        </div>`;
      return;
    }
    const avg = ps.reduce((s, p) => s + p.rating, 0) / ps.length;
    const fives = ps.filter(isMustGo).length;
    const top = ranked();

    const buckets = [['9+', 9, 11], ['8', 8, 9], ['7', 7, 8], ['6', 6, 7], ['<6', -1, 6]]
      .map(([b, lo, hi]) => ({ b, n: ps.filter((p) => p.rating >= lo && p.rating < hi).length }));
    const maxB = Math.max(1, ...buckets.map((x) => x.n));

    const cats = categories().map(([c, n]) => {
      const inCat = ps.filter((p) => p.category === c);
      return { c, n, avg: inCat.reduce((s, p) => s + p.rating, 0) / n };
    }).sort((a, b) => b.avg - a.avg || b.n - a.n);

    const recent = [...ps].sort(byNew).slice(0, 3);
    let n = 0;

    const ranks = rankMap();

    el.innerHTML = `
      <div class="tiles">
        <div class="tile" style="--n:${n++}"><div class="tile-num" data-count="${ps.length}">0</div><div class="tile-label">Spots tried</div></div>
        <div class="tile" style="--n:${n++}"><div class="tile-num accent" data-count="${avg.toFixed(2)}" data-dec="1">0</div><div class="tile-label">Avg rating</div></div>
        <div class="tile" style="--n:${n++}"><div class="tile-num" data-count="${fives}">0</div><div class="tile-label">Must-gos</div></div>
      </div>

      ${ps.length > 1 ? `
      <button class="decide" data-open="pick" style="--n:${n++}">
        ${icon('dice')}
        <div><h3>Can't decide?</h3><p>Spin for tonight's pick</p></div>
        ${icon('chev', 'chev')}
      </button>` : ''}

      <div class="panel" style="--n:${n++}">
        <div class="panel-title">Hall of Fame</div>
        <div class="list-rows">
          ${top.slice(0, 3).map((p) => lrow(p, rankBadge(ranks.get(p.id)))).join('')}
        </div>
        ${ps.length > 3 ? `<a class="see-all" href="#/ranks">See all ${ps.length} rankings${icon('chev')}</a>` : ''}
      </div>

      <div class="panel" style="--n:${n++}">
        <div class="panel-title">Rating spread</div>
        <div class="dist">
          ${buckets.map((x, i) => `
            <div class="dist-row">
              <span class="dist-label">${x.b}</span>
              <div class="dist-track"><div class="dist-fill" style="--w:${x.n / maxB};--n:${i}"></div></div>
              <span class="dist-count">${x.n}</span>
            </div>`).join('')}
        </div>
      </div>

      ${cats.length ? `
      <div class="panel" style="--n:${n++}">
        <div class="panel-title">Best by type</div>
        ${cats.map((c, i) => `
          <div class="cat-row">
            <span class="cat-name">${esc(c.c)}</span>
            <span class="cat-meta">${c.n} ${c.n === 1 ? 'spot' : 'spots'} &middot; <b>${fmtRating(c.avg)}</b></span>
            <div class="dist-track"><div class="dist-fill" style="--w:${c.avg / 10};--n:${i}"></div></div>
          </div>`).join('')}
      </div>` : ''}

      <div class="panel" style="--n:${n++}">
        <div class="panel-title">Recently tried</div>
        <div class="list-rows">
          ${recent.map((p) => lrow(p, photo(p))).join('')}
        </div>
      </div>`;
  }

  function playStats() {
    const el = $('#stats');
    el.classList.remove('is-shown');
    $$('.tile, .panel, .decide', el).forEach((x) => { x.style.animation = 'none'; void x.offsetWidth; x.style.animation = ''; });
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-shown')));
    $$('[data-count]', el).forEach((node) => countUp(node, parseFloat(node.dataset.count), node.dataset.dec ? 1 : 0));
  }

  function countUp(node, to, dec) {
    if (reduceMotion.matches) { node.textContent = to.toFixed(dec); return; }
    const start = performance.now();
    const dur = 900;
    const step = (now) => {
      const t = clamp((now - start) / dur, 0, 1);
      const e = 1 - Math.pow(1 - t, 3);
      node.textContent = (to * e).toFixed(dec);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------- MapLibre ---------- */

  let mapLibPromise;
  function loadMapLib() {
    if (window.maplibregl) return Promise.resolve(window.maplibregl);
    if (!mapLibPromise) {
      mapLibPromise = new Promise((resolve, reject) => {
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = MAPLIBRE_CSS;
        document.head.insertBefore(css, $('link[href="assets/styles.css"]'));
        const s = document.createElement('script');
        s.src = MAPLIBRE_JS;
        s.onload = () => resolve(window.maplibregl);
        s.onerror = () => { mapLibPromise = null; reject(new Error('Map failed to load')); };
        document.head.appendChild(s);
      });
    }
    return mapLibPromise;
  }

  const mapStyle = () => (darkQuery.matches ? MAP_STYLES.dark : MAP_STYLES.light);
  const hasCoords = (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng);

  function pinEl(p, i, compact = false) {
    const el = document.createElement('div');
    el.className = 'pin';
    el.innerHTML = compact
      ? `<div class="pin-w" style="--n:${i}"><div class="pin-b">${starSolid()}${fmtRating(p.rating)}</div></div>`
      : `<div class="pin-w" style="--n:${i}"><div class="pin-card">${photo(p)}<div class="pin-text"><div class="pin-name">${esc(p.name)}</div><div class="pin-score">${starSolid()}${fmtRating(p.rating)}</div></div><span class="pin-more"></span></div></div>`;
    return el;
  }

  /* ---------- Map tab ---------- */

  const mapState = { map: null, markers: new Map(), selected: null };

  async function initMap() {
    const gl = await loadMapLib().catch(() => null);
    const host = $('#map');
    if (!gl) {
      if (!$('.map-empty', $('#screen-map'))) $('#screen-map').insertAdjacentHTML('beforeend', '<div class="map-empty glass">Map couldn’t load. Check your connection.</div>');
      return;
    }
    if (!mapState.map) {
      const map = new gl.Map({
        container: host,
        style: mapStyle(),
        center: AUBURN,
        zoom: 12.5,
        attributionControl: false,
        pitchWithRotate: false,
        dragRotate: false,
        fadeDuration: 150,
      });
      map.touchZoomRotate.disableRotation();
      map.addControl(new gl.AttributionControl({ compact: true }), 'bottom-left');
      map.on('click', () => selectPin(null));
      let queued = false;
      map.on('move', () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; declutter(); });
      });
      mapState.map = map;
    }
    drawPins();
  }

  function drawPins() {
    const gl = window.maplibregl;
    const { map } = mapState;
    if (!gl || !map) return;
    mapState.markers.forEach((m) => m.remove());
    mapState.markers.clear();
    const pts = state.places.filter(hasCoords).sort(byTop);
    $('#mapCount').textContent = pts.length ? `${pts.length} ${pts.length === 1 ? 'spot' : 'spots'}` : '';
    $('.map-empty', $('#screen-map'))?.remove();
    if (!pts.length) {
      $('#screen-map').insertAdjacentHTML('beforeend', `<div class="map-empty glass">${state.places.length ? 'No spots with locations yet' : 'Spots you add will drop pins here'}</div>`);
      return;
    }
    // add lowest rated first so the best pins sit on top
    pts.slice().reverse().forEach((p, i) => {
      const el = pinEl(p, i);
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', `${p.name}, rated ${fmtRating(p.rating)} out of 10`);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (el.cluster && el.cluster.length > 1 && map.getZoom() < 16.5) zoomToCluster(el.cluster);
        else selectPin(p.id);
      });
      const m = new gl.Marker({ element: el, anchor: 'bottom' }).setLngLat([p.lng, p.lat]).addTo(map);
      el.fullWidth = el.offsetWidth;
      mapState.markers.set(p.id, m);
    });
    fitMap(false, true);
    declutter();
  }

  /* Pins that would overlap fold into the best-rated one nearby, which shows a "+N" badge. */
  function declutter() {
    const { map } = mapState;
    if (!map) return;
    const order = state.places.filter((p) => hasCoords(p) && mapState.markers.has(p.id)).sort(byTop);
    if (mapState.selected) order.sort((a, b) => (b.id === mapState.selected) - (a.id === mapState.selected));
    // Best spots get full cards; spots that would collide shrink to photo bubbles;
    // only bubbles that would sit on top of each other fold into a "+N" badge.
    const placed = [];
    const hits = (b) => placed.find((o) => b.l < o.box.r && b.r > o.box.l && b.t < o.box.b && b.b > o.box.t);
    order.forEach((p) => {
      const el = mapState.markers.get(p.id).getElement();
      const pt = map.project([p.lng, p.lat]);
      const w = (el.fullWidth || 170) + 6;
      const full = { l: pt.x - w / 2, r: pt.x + w / 2, t: pt.y - 56, b: pt.y };
      const dot = { l: pt.x - 14, r: pt.x + 14, t: pt.y - 40, b: pt.y - 8 }; // bubbles may overlap a little
      const selected = p.id === mapState.selected;
      let mode = 'hidden';
      let owner = null;
      if (selected || !hits(full)) mode = 'full';
      else if (!hits(dot)) mode = 'dot';
      else owner = hits(dot);
      el.classList.toggle('is-hidden', mode === 'hidden');
      el.classList.toggle('is-compact', mode === 'dot');
      if (owner) owner.members.push(p);
      else placed.push({ box: mode === 'full' ? full : dot, el, members: [p] });
    });
    placed.forEach((g) => {
      const n = g.members.length - 1;
      g.el.cluster = g.members;
      g.el.classList.toggle('has-more', n > 0);
      const badge = $('.pin-more', g.el);
      if (badge) badge.textContent = n > 0 ? `+${n}` : '';
    });
  }

  function zoomToCluster(members) {
    const gl = window.maplibregl;
    const b = new gl.LngLatBounds();
    members.forEach((p) => b.extend([p.lng, p.lat]));
    haptic();
    mapState.map.fitBounds(b, { padding: { top: 150, bottom: 190, left: 90, right: 90 }, maxZoom: 17.5, duration: 800 });
  }

  // The opening view frames the densest cluster of spots (usually campus and downtown)
  // so it isn't zoomed out too far to tell spots apart. The locate button shows everything.
  function corePlaces(pts) {
    const km = (a, b) => Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 111 * Math.cos((a.lat * Math.PI) / 180));
    const near = (c) => pts.filter((p) => km(c, p) <= 1.6);
    const best = pts.map(near).sort((a, b) => b.length - a.length)[0];
    return best.length >= 3 ? best : pts;
  }

  function fitMap(animate = true, core = false) {
    const gl = window.maplibregl;
    let pts = state.places.filter(hasCoords);
    if (core && pts.length > 2) pts = corePlaces(pts);
    if (!gl || !mapState.map || !pts.length) return;
    const opts = core
      ? { animate, duration: animate ? 900 : 0, padding: { top: 120, bottom: 160, left: 75, right: 75 }, maxZoom: 16 }
      : { animate, duration: animate ? 900 : 0, padding: { top: 130, bottom: 170, left: 110, right: 110 }, maxZoom: 15 };
    if (pts.length === 1) { mapState.map.easeTo({ center: [pts[0].lng, pts[0].lat], zoom: 15, duration: opts.duration }); return; }
    const b = new gl.LngLatBounds();
    pts.forEach((p) => b.extend([p.lng, p.lat]));
    mapState.map.fitBounds(b, opts);
  }

  function selectPin(id) {
    const prev = mapState.selected && mapState.markers.get(mapState.selected);
    if (prev) prev.getElement().classList.remove('is-selected');
    mapState.selected = id;
    const preview = $('#mapPreview');
    if (!id) { preview.classList.remove('is-shown'); declutter(); return; }
    const m = mapState.markers.get(id);
    const p = state.byId.get(id);
    if (m) m.getElement().classList.add('is-selected');
    declutter();
    haptic();
    preview.innerHTML = `
      <a class="map-card" href="#/p/${esc(p.id)}">
        ${photo(p)}
        <div class="map-card-text">
          <h3>${esc(p.name)}</h3>
          <p>${metaLine(p)}</p>
          ${stars(p.rating)}
        </div>
        ${icon('chev', 'chev')}
      </a>`;
    preview.classList.add('is-shown');
    mapState.map.easeTo({ center: [p.lng, p.lat], padding: { top: 0, bottom: 160, left: 0, right: 0 }, duration: 600 });
  }

  /* ---------- Tabs ---------- */

  const TABS = ['guide', 'map', 'stats'];

  function setTab(tab) {
    if (tab === state.tab) {
      const scr = $(`#screen-${tab}`);
      scr.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      if (tab === 'map') { selectPin(null); fitMap(); }
      return;
    }
    haptic();
    state.tab = tab;
    $$('.screen').forEach((s) => s.classList.toggle('is-active', s.dataset.tab === tab));
    $$('#tabbar button').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === tab));
    $('#tabbar').style.setProperty('--i', TABS.indexOf(tab));
    if (tab === 'map') {
      initMap().then(() => mapState.map && mapState.map.resize());
    }
    if (tab === 'stats') playStats();
  }

  /* Large-title collapse */
  function bindNav(screen) {
    const nav = $('.nav', screen);
    if (!nav) return;
    let ticking = false;
    screen.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        nav.style.setProperty('--t', clamp((screen.scrollTop - 26) / 22, 0, 1).toFixed(3));
        ticking = false;
      });
    }, { passive: true });
  }

  /* ---------- Sheet ---------- */

  const sheet = {
    el: null,
    scroll: null,
    kind: null,
    id: null,
    mini: null,
    closeTimer: null,
  };

  function openSheet(kind, html, { compact = false, plain = false } = {}) {
    clearTimeout(sheet.closeTimer);
    const el = sheet.el;
    destroyMini();
    sheet.kind = kind;
    el.classList.toggle('compact', compact);
    el.classList.toggle('plain', plain);
    el.classList.remove('is-closing');
    sheet.scroll.innerHTML = html;
    sheet.scroll.scrollTop = 0;
    el.style.transform = '';
    el.setAttribute('aria-hidden', 'false');
    const root = document.documentElement;
    root.classList.add('sheet-open');
    root.classList.toggle('sheet-full', !compact);
    // force layout so the slide-in transition runs
    void el.offsetHeight;
    el.classList.add('is-open');
    haptic(6);
  }

  function hideSheet() {
    const el = sheet.el;
    if (!el.classList.contains('is-open')) return;
    el.classList.remove('is-open');
    el.classList.add('is-closing');
    el.style.transform = '';
    el.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('sheet-open', 'sheet-full');
    $('#app').style.transform = '';
    sheet.kind = null;
    sheet.id = null;
    spin.cancel && spin.cancel();
    sheet.closeTimer = setTimeout(() => {
      el.classList.remove('is-closing');
      destroyMini();
      sheet.scroll.innerHTML = '';
    }, 520);
  }

  function destroyMini() {
    if (sheet.mini) { sheet.mini.remove(); sheet.mini = null; }
  }

  /* drag to dismiss */
  function bindSheetDrag() {
    const el = sheet.el;
    const app = $('#app');
    let d = null;

    el.addEventListener('touchstart', (e) => {
      if (!el.classList.contains('is-open') || e.touches.length > 1) return;
      const t = e.touches[0];
      d = { x0: t.clientX, y0: t.clientY, dy: 0, decided: false, active: false, samples: [[t.clientY, e.timeStamp]] };
    }, { passive: true });

    el.addEventListener('touchmove', (e) => {
      if (!d) return;
      const t = e.touches[0];
      const dx = t.clientX - d.x0;
      const dy = t.clientY - d.y0;
      if (!d.decided) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        d.decided = true;
        d.active = dy > 0 && Math.abs(dy) > Math.abs(dx) && sheet.scroll.scrollTop <= 0;
        if (d.active) {
          el.classList.add('is-dragging');
          document.documentElement.classList.add('is-dragging');
          d.h = el.offsetHeight;
        }
      }
      if (!d.active) return;
      e.preventDefault();
      d.dy = Math.max(0, dy);
      d.samples.push([t.clientY, e.timeStamp]);
      if (d.samples.length > 5) d.samples.shift();
      el.style.transform = `translateY(${d.dy}px)`;
      if (document.documentElement.classList.contains('sheet-full')) {
        const p = 1 - clamp(d.dy / d.h, 0, 1);
        app.style.transform = `translateY(calc((var(--safe-t) * 0.5 + 6px) * ${p})) scale(${1 - 0.07 * p})`;
        app.style.borderRadius = `${22 * p}px`;
      }
    }, { passive: false });

    const end = () => {
      if (!d) return;
      const wasActive = d.active;
      el.classList.remove('is-dragging');
      document.documentElement.classList.remove('is-dragging');
      if (wasActive) {
        const [a, b] = [d.samples[0], d.samples[d.samples.length - 1]];
        const v = (b[0] - a[0]) / Math.max(1, b[1] - a[1]); // px per ms
        app.style.borderRadius = '';
        if (d.dy > Math.min(160, d.h * 0.28) || v > 0.55) {
          closeSheet();
        } else {
          el.style.transform = '';
          app.style.transform = '';
        }
      }
      d = null;
    };
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
  }

  /* ---------- Detail ---------- */

  function directionsUrl(p) {
    const dest = p.address || `${p.name}, Auburn, AL`;
    if (isApple) return `https://maps.apple.com/?daddr=${encodeURIComponent(dest)}${hasCoords(p) ? `&sll=${p.lat},${p.lng}` : ''}`;
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${p.name}, ${dest}`)}`;
  }

  const telHref = (phone) => `tel:${String(phone).replace(/[^\d+]/g, '')}`;
  const prettyUrl = (u) => String(u).replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

  function detailHtml(p) {
    const photos = p.photos.length ? p.photos : [null];
    const actions = [
      `<a class="action primary" href="${esc(directionsUrl(p))}" target="_blank" rel="noopener">${icon('go')}Directions</a>`,
      p.phone ? `<a class="action" href="${esc(telHref(p.phone))}">${icon('phone')}Call</a>` : '',
      p.website ? `<a class="action" href="${esc(p.website)}" target="_blank" rel="noopener">${icon('globe')}Website</a>` : '',
      `<button class="action" data-share="${esc(p.id)}">${icon('share')}Share</button>`,
    ].filter(Boolean);

    const sub = [p.area, p.visited ? `Tried ${longDate(p.visited)}` : ''].filter(Boolean).map(esc).join(' &middot; ');

    const bubbles = p.comments.map((c, i) => `<div class="bubble ${i === p.comments.length - 1 ? 'tail' : ''}" style="--n:${i}">${esc(c)}</div>`).join('');

    const rows = [
      p.address ? `<a class="row" href="${esc(directionsUrl(p))}" target="_blank" rel="noopener"><div class="row-text"><div class="row-label">Address</div><div class="row-value">${esc(p.address)}</div></div><span class="row-icon">${icon('pin')}</span></a>` : '',
      p.hours ? `<div class="row"><div class="row-text"><div class="row-label">Hours</div><div class="row-value">${String(p.hours).split(/\s*[,;]\s*/).map(esc).join('<br>')}</div></div><span class="row-icon">${icon('clock')}</span></div>` : '',
      p.phone ? `<a class="row" href="${esc(telHref(p.phone))}"><div class="row-text"><div class="row-label">Phone</div><div class="row-value">${esc(p.phone)}</div></div><span class="row-icon">${icon('phone')}</span></a>` : '',
      p.website ? `<a class="row" href="${esc(p.website)}" target="_blank" rel="noopener"><div class="row-text"><div class="row-label">Website</div><div class="row-value">${esc(prettyUrl(p.website))}</div></div><span class="row-icon">${icon('globe')}</span></a>` : '',
    ].filter(Boolean).join('');

    return `
      <div class="d-hero">
        <div class="d-photos" id="dPhotos">${photos.map((_, i) => photo(p, i, i === 0)).join('')}</div>
        ${photos.length > 1 ? `<div class="d-dots">${photos.map((_, i) => `<span class="${i ? '' : 'on'}"></span>`).join('')}</div>` : ''}
      </div>
      <div class="d-body">
        <div>
          ${p.category || p.price ? `<p class="d-eyebrow">${metaLine(p, ['category', 'price'])}</p>` : ''}
          <h1 class="d-title">${esc(p.name)}</h1>
          ${sub ? `<p class="d-sub">${sub}</p>` : ''}
          ${p.tags.length ? `<div class="d-tags">${p.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
        </div>

        <div class="score">
          <div class="score-num">${fmtRating(p.rating)}<small>/10</small></div>
          <div class="score-side">
            ${stars(p.rating, 'pop')}
            <span class="score-verdict">Our verdict: ${verdictOf(p)}</span>
          </div>
        </div>

        <div class="actions" style="--n:${actions.length}">${actions.join('')}</div>

        ${bubbles ? `
        <section class="d-section">
          <h2 class="d-section-title">What we said</h2>
          <div class="chat">
            ${p.visited ? `<div class="chat-stamp"><b>${esc(fmtDate(parseDate(p.visited), { weekday: 'short' }))}</b> ${esc(shortDate(p.visited))}</div>` : ''}
            ${bubbles}
          </div>
        </section>` : ''}

        ${p.mustTry.length ? `
        <section class="d-section">
          <h2 class="d-section-title">Order this</h2>
          <div class="tags">${p.mustTry.map((m) => `<span class="tag">${icon('flame')}${esc(m)}</span>`).join('')}</div>
        </section>` : ''}

        ${p.blurb ? `
        <section class="d-section">
          <h2 class="d-section-title">About</h2>
          <p class="prose">${esc(p.blurb)}</p>
        </section>` : ''}

        ${rows || hasCoords(p) ? `
        <section class="d-section">
          <h2 class="d-section-title">Details</h2>
          ${hasCoords(p) ? `<a class="minimap" href="${esc(directionsUrl(p))}" target="_blank" rel="noopener" aria-label="Open in Maps"><div id="miniMap" style="position:absolute;inset:0"></div><span class="minimap-cover"></span></a>` : ''}
          ${rows ? `<div class="group" ${hasCoords(p) ? '' : ''}>${rows}</div>` : ''}
        </section>` : ''}

        ${p.photoCredit ? `<p class="credit">Photos: ${esc(p.photoCredit)}</p>` : ''}
      </div>`;
  }

  function openPlace(id) {
    const p = state.byId.get(id);
    if (!p) { closeSheet(); return; }
    openSheet('place', detailHtml(p));
    sheet.id = id;

    const photos = $('#dPhotos');
    const dots = $$('.d-dots span');
    if (photos && dots.length) {
      photos.addEventListener('scroll', () => {
        const i = Math.round(photos.scrollLeft / photos.clientWidth);
        dots.forEach((d, j) => d.classList.toggle('on', i === j));
      }, { passive: true });
    }

    if (hasCoords(p)) {
      loadMapLib().then((gl) => {
        setTimeout(() => {
          const host = $('#miniMap');
          if (!host || sheet.id !== id) return;
          const m = new gl.Map({
            container: host, style: mapStyle(), center: [p.lng, p.lat], zoom: 15.2,
            interactive: false, attributionControl: false, fadeDuration: 0,
          });
          new gl.Marker({ element: pinEl(p, 3, true), anchor: 'bottom' }).setLngLat([p.lng, p.lat]).addTo(m);
          sheet.mini = m;
        }, 420);
      }).catch(() => { $('.minimap')?.remove(); });
    }
  }

  /* ---------- Rankings sheet ---------- */

  function openRanks() {
    const list = ranked();
    const ranks = rankMap();
    openSheet('ranks', `
      <div class="ranks">
        <p class="eyebrow">Hall of Fame</p>
        <h1 class="ranks-title">Every spot, ranked</h1>
        <p class="ranks-sub">${list.length} spots, best to worst</p>
        <div class="ranks-list">
          ${list.map((p, i) => `<div class="ranks-item" style="--n:${Math.min(i, 14)}">${lrow(p, `${rankBadge(ranks.get(p.id))}${photo(p)}`, `<small class="${isMustGo(p) ? 'hot' : ''}">${verdictOf(p)}</small>`)}</div>`).join('')}
        </div>
      </div>`, { plain: true });
  }

  /* ---------- Add sheet ---------- */

  const TEMPLATE = 'Add to the Grub Guide: [place name], [rating]/10. [what we thought]';

  function openAdd() {
    openSheet('add', `
      <div class="compact-body">
        <div class="compact-icon">${icon('sparkle')}</div>
        <h2>Add a spot</h2>
        <p>Just tell Claude. It does the legwork and the guide updates itself.</p>
        <div class="steps">
          <div class="step"><span class="step-n">1</span><p>Open the Claude chat for this guide.<br><span>The same one that built it.</span></p></div>
          <div class="step"><span class="step-n">2</span><p>Send the place, your rating out of 10, and a note or two.</p></div>
          <div class="step"><span class="step-n">3</span><p>Claude finds photos, the address and details, then publishes.<br><span>Refresh in a minute or two.</span></p></div>
        </div>
        <div class="template">Add to the Grub Guide: <em>Momma Goldberg’s</em>, <em>8.5/10</em>. <em>The Momma’s sub is unreal. Go for the fries too.</em></div>
        <button class="btn btn-tinted btn-block" data-copy>${icon('copy')}Copy a template</button>
      </div>`, { compact: true });
  }

  /* ---------- Pick sheet (slot machine) ---------- */

  const spin = { cancel: null };

  function weightedPick(list) {
    const w = list.map((p) => Math.pow(Math.max(0.3, p.rating / 2 - 1.5), 2.2));
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < list.length; i++) { r -= w[i]; if (r <= 0) return list[i]; }
    return list[list.length - 1];
  }

  function openPick() {
    if (state.places.length < 2) {
      toast(state.places.length ? 'Add one more spot to spin' : 'Add a spot first', 'dice');
      return;
    }
    openSheet('pick', `
      <div class="compact-body">
        <h2>Where to tonight?</h2>
        <p>We’ll spin through your guide. Higher rated spots land more often.</p>
        <div class="slot"><div class="slot-line"></div><div class="slot-reel" id="reel"></div></div>
        <div id="pickResult"></div>
        <button class="btn btn-primary btn-block" id="spinBtn">${icon('dice')}Spin</button>
      </div>`, { compact: true });
    const reel = $('#reel');
    const names = [...state.places].sort(() => Math.random() - 0.5);
    reel.innerHTML = names.slice(0, 3).map((p) => `<div class="slot-item">${esc(p.name)}</div>`).join('');
    reel.style.transform = 'translateY(-52px)';
  }

  function doSpin() {
    const reel = $('#reel');
    const btn = $('#spinBtn');
    if (!reel || btn.disabled) return;
    const winner = weightedPick(state.places);
    const pool = state.places;
    const count = 34;
    const items = [];
    for (let i = 0; i < count; i++) items.push(pool[Math.floor(Math.random() * pool.length)]);
    items.push(winner, pool[Math.floor(Math.random() * pool.length)]);
    reel.style.transition = 'none';
    reel.style.transform = 'translateY(0)';
    reel.innerHTML = items.map((p) => `<div class="slot-item">${esc(p.name)}</div>`).join('');
    $('#pickResult').innerHTML = '';
    btn.disabled = true;
    void reel.offsetHeight;

    const target = -(count * 52);
    const dur = reduceMotion.matches ? 10 : 2600;
    reel.style.transition = `transform ${dur}ms cubic-bezier(0.12, 0.72, 0.16, 1)`;
    reel.style.transform = `translateY(${target}px)`;

    // tick haptics as names pass the window
    let last = 0;
    let raf;
    const tick = () => {
      const m = new DOMMatrixReadOnly(getComputedStyle(reel).transform);
      const idx = Math.floor(-m.m42 / 52);
      if (idx !== last) { last = idx; haptic(4); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const done = setTimeout(() => {
      cancelAnimationFrame(raf);
      haptic(18);
      const res = $('#pickResult');
      if (!res) return;
      res.innerHTML = `
        <a class="pick-result" href="#/p/${esc(winner.id)}" data-replace>
          ${photo(winner, 0, true)}
          <div>
            <h3>${esc(winner.name)}</h3>
            <p>${metaLine(winner)}</p>
            ${stars(winner.rating)}
          </div>
        </a>
        <div class="btn-row" style="margin-bottom:10px">
          <button class="btn btn-tinted" id="spinAgain">Spin again</button>
          <a class="btn btn-primary" href="#/p/${esc(winner.id)}" data-replace>Let’s go</a>
        </div>`;
      btn.hidden = true;
    }, dur + 60);

    spin.cancel = () => { cancelAnimationFrame(raf); clearTimeout(done); spin.cancel = null; };
  }

  /* ---------- Share + copy ---------- */

  async function sharePlace(id) {
    const p = state.byId.get(id);
    if (!p) return;
    const url = `${location.origin}${location.pathname}#/p/${encodeURIComponent(p.id)}`;
    const text = `${p.name}: ${fmtRating(p.rating)}/10 on our Auburn Grub Guide`;
    try {
      if (navigator.share) { await navigator.share({ title: p.name, text, url }); return; }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast('Link copied');
    } catch (_) { /* user cancelled */ }
  }

  async function copyTemplate() {
    try {
      await navigator.clipboard.writeText(TEMPLATE);
      haptic(12);
      toast('Template copied');
    } catch (_) {
      toast('Couldn’t copy', 'x');
    }
  }

  /* ---------- Router ---------- */

  function parseRoute() {
    const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    if (h.startsWith('p/')) return { kind: 'place', id: h.slice(2) };
    if (h === 'add') return { kind: 'add' };
    if (h === 'pick') return { kind: 'pick' };
    if (h === 'ranks') return { kind: 'ranks' };
    return { kind: null };
  }

  function applyRoute() {
    const r = parseRoute();
    if (!r.kind) { hideSheet(); return; }
    if (!state.loaded) return;
    const same = sheet.kind === r.kind && (r.kind !== 'place' || sheet.id === r.id);
    if (same) return;
    const open = () => ({ place: () => openPlace(r.id), add: openAdd, pick: openPick, ranks: openRanks })[r.kind]();
    if (sheet.kind) {
      hideSheet();
      sheet.closeTimer && clearTimeout(sheet.closeTimer);
      setTimeout(open, 340);
    } else {
      open();
    }
  }

  function go(hash, { replace = false } = {}) {
    if (location.hash === hash) return;
    if (replace) history.replaceState(history.state, '', hash);
    else history.pushState({ app: true }, '', hash);
    applyRoute();
  }

  function closeSheet() {
    if (history.state && history.state.app) {
      history.back();
    } else {
      history.replaceState(null, '', location.pathname + location.search);
      applyRoute();
    }
  }

  /* ---------- Events ---------- */

  function bind() {
    document.addEventListener('touchstart', () => {}, { passive: true }); // enables :active on iOS

    // image fade-in
    document.addEventListener('load', (e) => {
      if (e.target.tagName === 'IMG') e.target.classList.add('is-loaded');
    }, true);
    document.addEventListener('error', (e) => {
      if (e.target.tagName === 'IMG' && e.target.closest('.ph')) e.target.remove();
    }, true);

    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#/"]');
      if (a) {
        e.preventDefault();
        haptic(6);
        go(a.getAttribute('href'), { replace: a.hasAttribute('data-replace') || sheet.kind === 'pick' });
        return;
      }
      const open = e.target.closest('[data-open]');
      if (open) { go(`#/${open.dataset.open}`); return; }
      const share = e.target.closest('[data-share]');
      if (share) { sharePlace(share.dataset.share); return; }
      if (e.target.closest('[data-copy]')) { copyTemplate(); return; }
      if (e.target.closest('#spinBtn')) { doSpin(); return; }
      if (e.target.closest('#spinAgain')) { $('#spinBtn').hidden = false; $('#spinBtn').disabled = false; doSpin(); return; }
      const chip = e.target.closest('.chip');
      if (chip) {
        haptic(6);
        state.category = chip.dataset.cat;
        renderGuide();
        chip.scrollIntoView && $(`.chip[data-cat="${CSS.escape(state.category)}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
        return;
      }
      const seg = e.target.closest('#sort button');
      if (seg) { if (seg.dataset.sort !== state.sort) { haptic(6); setSort(seg.dataset.sort); } return; }
      const tab = e.target.closest('#tabbar button');
      if (tab) { setTab(tab.dataset.tab); }
    });

    $('#btnAdd').addEventListener('click', () => go('#/add'));
    $('#btnPick').addEventListener('click', () => (state.places.length < 2 ? openPick() : go('#/pick')));
    $('#mapFit').addEventListener('click', () => { haptic(); selectPin(null); fitMap(); });
    $('#sheetClose').addEventListener('click', closeSheet);
    $('#scrim').addEventListener('click', closeSheet);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheet.kind) closeSheet(); });

    const search = $('#search');
    const label = $('.search');
    let qTimer;
    search.addEventListener('input', () => {
      label.classList.toggle('has-text', !!search.value);
      clearTimeout(qTimer);
      qTimer = setTimeout(() => { state.query = search.value.trim(); renderGuide(false); }, 90);
    });
    search.addEventListener('keydown', (e) => { if (e.key === 'Enter') search.blur(); });
    $('#searchClear').addEventListener('click', () => {
      search.value = '';
      label.classList.remove('has-text');
      state.query = '';
      renderGuide();
      search.focus();
    });

    window.addEventListener('popstate', applyRoute);
    window.addEventListener('hashchange', applyRoute);

    darkQuery.addEventListener?.('change', () => {
      if (mapState.map) mapState.map.setStyle(mapStyle());
    });

    $$('.screen').forEach(bindNav);
    bindSheetDrag();
  }

  /* ---------- Boot ---------- */

  async function load() {
    skeleton();
    try {
      const res = await fetch(DATA_URL, { cache: 'no-cache' });
      if (!res.ok) throw new Error(res.status);
      state.places = normalize(await res.json());
    } catch (err) {
      console.error('Could not load places', err);
      state.places = [];
    }
    state.byId = new Map(state.places.map((p) => [p.id, p]));
    state.loaded = true;
    renderGuide();
    renderStats();
    if (mapState.map) drawPins();
    applyRoute();
  }

  function boot() {
    sheet.el = $('#sheet');
    sheet.scroll = $('#sheetScroll');
    hydrateIcons();
    bind();
    load();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
