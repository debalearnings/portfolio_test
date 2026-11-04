/* Research pages
   1. YouTube card: thumbnail with a play button; the player opens large in a lightbox and loads only on click.
   2. Split fitting: text-beside-media blocks get the column ratio that makes text and media end at the same height.
   3. Puzzle packing: tiles keep their natural height and are packed into the 12-column grid (masonry), so short tiles
      no longer stretch to match tall neighbours. Without JS the plain grid still works. */
(() => {
  'use strict';
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- 1. YouTube lightbox ---------- */
  const dialog = document.querySelector('.dz-yt-dialog');
  if (dialog) {
    const frame = dialog.querySelector('.frame');
    $$('[data-youtube]').forEach(btn => btn.addEventListener('click', () => {
      const id = encodeURIComponent(btn.dataset.youtube);
      frame.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1" title="${btn.getAttribute('aria-label') || 'Research video'}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
      dialog.showModal();
    }));
    dialog.querySelector('.close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => { frame.innerHTML = ''; });
  }

  /* ---------- 2. Split fitting ---------- */
  const wide = () => window.innerWidth > 760;
  function fit(el) {
    const text = el.querySelector(':scope > .dz-text, :scope > .dz-gist');
    const media = el.querySelector(':scope > .dz-media-col, :scope > .dz-lead-media');
    if (!text || !media) return;
    if (!wide()) { el.style.removeProperty('--mfr'); return; }
    const lo0 = parseFloat(el.dataset.fitMin || 0.55), hi0 = parseFloat(el.dataset.fitMax || 2.4);
    let lo = lo0, hi = hi0;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      el.style.setProperty('--mfr', mid + 'fr');
      const d = media.getBoundingClientRect().height - text.getBoundingClientRect().height;
      if (Math.abs(d) < 4) break;
      if (d > 0) hi = mid; else lo = mid;
    }
  }

  /* ---------- 3. Puzzle packing ----------
     Two tracks: a wide one (7/12) and a narrow one (5/12). Each tile goes into whichever track is currently shorter
     (respecting its preferred width when the tracks are nearly level); full-width tiles wait until both tracks are level,
     with later tiles pulled forward to fill the shorter track. Result: columns end together, no holes. */
  const grid = document.querySelector('.dz-grid');
  const GAP = 16;
  function spanOf(t) { const m = (t.style.gridColumn || '').match(/span (\d+)/) || t.className.match(/\bc(\d+)\b/); return m ? +m[1] : 6; }
  function heightAt(t, w) { t.style.width = w + 'px'; if (t.classList.contains('split') && !t.classList.contains('unsplit')) fit(t); return t.getBoundingClientRect().height; }
  function pack() {
    if (!grid) return;
    const tiles = $$(':scope > .dz-tile', grid);
    const reset = () => { grid.classList.remove('is-packed'); grid.style.height = ''; tiles.forEach(t => { t.style.left = t.style.top = t.style.width = ''; }); };
    if (!wide()) { reset(); return; }
    if (tiles.every(t => spanOf(t) === 4)) { reset(); grid.style.alignItems = 'stretch'; return; }
    grid.classList.add('is-packed');
    const W = grid.clientWidth, wN = Math.round((W - GAP) * 5 / 12), wW = W - GAP - wN;
    const X = [0, wW + GAP], WD = [wW, wN];
    const isFull = t => spanOf(t) >= 12 && !(t.classList.contains('unsplit') && t.style.gridColumn);
    const prefers = t => { if (t.dataset.track) return t.dataset.track === 'wide' ? 0 : 1; const s = spanOf(t); return s >= 7 ? 0 : s <= 5 ? 1 : -1; };
    // split the page into segments of half-width tiles separated by full-width tiles
    const segs = [[]];
    tiles.forEach(t => { if (isFull(t)) segs.push(t, []); else segs[segs.length - 1].push(t); });
    let y = 0;
    for (const seg of segs) {
      if (!Array.isArray(seg)) { const h = heightAt(seg, W); seg.style.left = '0px'; seg.style.top = y + 'px'; y += h + GAP; continue; }
      if (!seg.length) continue;
      const H = seg.map(t => [heightAt(t, WD[0]), heightAt(t, WD[1])]);
      const P = seg.map(prefers);
      const F = seg.map(t => t.dataset.track ? 1 : 0);   // tiles pinned to a track
      const n = seg.length, limit = n <= 11 ? (1 << n) : 0;
      let best = null, bestMask = 0;
      const score = mask => {
        const h = [0, 0]; let pen = 0, prevTop = -1;
        for (let i = 0; i < n; i++) {
          const k = (mask >> i) & 1, top = h[k];
          if (top < prevTop - 40) pen += (prevTop - top) * 0.35;   // a later section starting above an earlier one
          if (i === 0 && k !== 0) pen += 30;                       // first section of a band reads from the left
          prevTop = top; h[k] += H[i][k] + GAP; if (P[i] >= 0 && P[i] !== k) pen += F[i] ? 1e6 : 40;
        }
        return Math.max(h[0], h[1]) + Math.abs(h[0] - h[1]) * 0.5 + pen;
      };
      if (limit) { for (let m = 0; m < limit; m++) { const sc = score(m); if (best === null || sc < best) { best = sc; bestMask = m; } } }
      else { const h = [0, 0]; for (let i = 0; i < n; i++) { const k = h[0] <= h[1] ? 0 : 1; bestMask |= k << i; h[k] += H[i][k] + GAP; } }
      const h = [y, y];
      seg.forEach((t, i) => { const k = (bestMask >> i) & 1; t.style.width = WD[k] + 'px'; if (t.classList.contains('split') && !t.classList.contains('unsplit')) fit(t); t.style.left = X[k] + 'px'; t.style.top = h[k] + 'px'; h[k] += H[i][k] + GAP; });
      y = Math.max(h[0], h[1]);
    }
    grid.style.height = (y - GAP) + 'px';
  }

  /* A split whose two sides cannot be balanced becomes a stacked tile:
     - media far taller than the text (portrait figures) → a narrower column tile, so neighbours pack beside it;
     - text far taller than the media (wide, short figures) → full width with the figure under the text. */
  function rebalance(el) {
    if (!el.classList.contains('dz-tile')) return;
    const text = el.querySelector(':scope > .dz-text'), media = el.querySelector(':scope > .dz-media-col');
    el.classList.remove('unsplit'); el.style.gridColumn = '';
    if (!wide() || !text || !media) return;
    fit(el);
    const th = text.getBoundingClientRect().height, mh = media.getBoundingClientRect().height;
    if (mh > th * 1.3 + 40) {
      const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
      el.classList.add('unsplit'); el.style.gridColumn = 'span ' + Math.max(1, Math.round(cols * 5 / 12));
    } else if (th > mh * 1.45 + 40) {
      el.classList.add('unsplit');
    }
  }
  function layout() {
    $$('.dz-lead[data-fit]').forEach(fit);
    if (grid) { grid.classList.remove('is-packed'); $$(':scope > .dz-tile', grid).forEach(t => { t.style.width = ''; }); }
    $$('.dz-grid [data-fit]').forEach(rebalance);
    pack();
  }
  let pending = 0;
  const schedule = () => { cancelAnimationFrame(pending); pending = requestAnimationFrame(layout); };
  layout();
  window.addEventListener('resize', schedule);
  window.addEventListener('load', schedule);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  $$('.dz-grid img, .dz-lead img').forEach(img => { if (!img.complete) img.addEventListener('load', schedule, { once: true }); });
})();
