/* Shared rendering helpers. All user/API text goes through esc() before hitting innerHTML. */
const UI = (() => {
  const esc = (v) =>
    String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const fmtDuration = (min) => (min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min}m`);
  const fmtRating = (t) => (t.ratingCount ? `★ ${t.ratingAvg.toFixed(1)}` : 'Not rated');
  const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

  function poster(t) {
    return `<div class="poster" style="--h:${Number(t.posterHue) || 210}">
      ${Posters.svg(t)}
      <span class="badge">${esc(t.maturityRating)}</span>
      ${t.type === 'series' ? '<span class="badge series">SERIES</span>' : ''}
      <span class="poster-name">${esc(t.name)}</span>
    </div>`;
  }

  function card(t, { progress } = {}) {
    const pct = progress && progress.durationSeconds
      ? Math.min(100, Math.round((progress.positionSeconds / progress.durationSeconds) * 100))
      : null;
    return `<a class="card" href="#/title/${esc(t._id)}">
      ${poster(t)}
      ${pct !== null ? `<div class="progress" aria-label="${pct}% watched"><div style="width:${pct}%"></div></div>` : ''}
      <div class="meta">${esc(t.releaseYear)} · ${esc(t.type === 'series' ? 'Series' : fmtDuration(t.durationMinutes))} · ${esc(fmtRating(t))}</div>
    </a>`;
  }

  function row(heading, items, { href, progress } = {}) {
    if (!items.length) return '';
    return `<section class="row">
      <div class="row-head"><h2>${esc(heading)}</h2>${href ? `<a href="${esc(href)}">See all →</a>` : ''}</div>
      <div class="row-track">${items.map((t) => card(t, progress ? { progress: t } : {})).join('')}</div>
    </section>`;
  }

  let toastTimer;
  function toast(message, isError = false) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.classList.toggle('error', isError);
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
  }

  const spinner = () => '<div class="spinner" aria-label="Loading"></div>';
  const errorBlock = (err) => `<div class="center"><h2>Something went wrong</h2><p class="muted">${esc(err.message)}</p></div>`;

  function formError(form, err) {
    const el = form.querySelector('.error-text');
    const details = err.details ? Object.entries(err.details).map(([k, v]) => `${k} ${v}`).join('; ') : '';
    el.textContent = details ? `${err.message}: ${details}` : err.message;
  }

  return { esc, fmtDuration, fmtRating, stars, poster, card, row, toast, spinner, errorBlock, formError };
})();
