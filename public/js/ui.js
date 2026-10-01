/* Shared rendering helpers. All user/API text goes through esc() before hitting innerHTML. */

/* Portfolio credit shown in the footer and the visitor note. */
const SITE = {
  author: 'Richitha Rekula',
  github: 'https://github.com/richithareddyy/ott-platform',
};

const UI = (() => {
  const esc = (v) =>
    String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const fmtDuration = (min) => (min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min}m`);
  const fmtRating = (t) => (t.ratingCount ? `★ ${t.ratingAvg.toFixed(1)}` : 'Not rated');
  const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
  const kind = (t) => (t.type === 'series' ? 'Series' : 'Film');

  const icon = {
    play: '<svg class="icon fill" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg>',
    plus: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    check: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    info: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.4"/></svg>',
    chevL: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6"/></svg>',
    chevR: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6"/></svg>',
  };

  /** Quiet one-line facts: "2024 · R · 1h 51m". */
  function facts(t, { duration = true, maturity = true } = {}) {
    const parts = [t.releaseYear];
    if (maturity) parts.push(t.maturityRating);
    if (duration) parts.push(t.type === 'series' ? 'Series' : fmtDuration(t.durationMinutes));
    return parts.filter(Boolean).map(esc).join('<span class="dot">·</span>');
  }

  function rating(t) {
    return t.ratingCount
      ? `<span class="rating" aria-label="Rated ${t.ratingAvg.toFixed(1)} out of 5"><span class="star">★</span>${t.ratingAvg.toFixed(1)}</span>`
      : '';
  }

  /** Portrait 2:3 key art. Nothing sits on top except an optional progress line. */
  function poster(t, { progress } = {}) {
    return `<div class="poster">${Posters.svg(t)}${progress != null
      ? `<div class="progress" role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100" aria-label="${progress}% watched"><i style="width:${progress}%"></i></div>`
      : ''}</div>`;
  }

  /** Wide backdrop art for hero and detail headers. */
  const backdrop = (t) => `<div class="backdrop" aria-hidden="true">${Posters.svg(t, { wide: true })}</div>`;

  /** Poster → title → metadata → rating, as one unit. */
  function card(t, { progress } = {}) {
    const pct = progress && progress.durationSeconds
      ? Math.min(100, Math.round((progress.positionSeconds / progress.durationSeconds) * 100))
      : null;
    return `<a class="card" href="#/title/${esc(t._id)}">
      ${poster(t, { progress: pct })}
      <span class="card-title">${esc(t.name)}</span>
      <span class="card-meta"><span>${esc(t.releaseYear)}<span class="dot">·</span>${esc(t.type === 'series' ? 'Series' : fmtDuration(t.durationMinutes))}</span>${rating(t)}</span>
    </a>`;
  }

  function row(heading, items, { href, progress } = {}) {
    if (!items.length) return '';
    return `<section class="row">
      <header class="row-head">
        <h2>${esc(heading)}</h2>
        ${href ? `<a class="row-link" href="${esc(href)}">See all</a>` : ''}
      </header>
      <div class="row-viewport">
        <button class="row-nav prev" data-scroll="-1" aria-label="Scroll ${esc(heading)} left" tabindex="-1">${icon.chevL}</button>
        <div class="row-track">${items.map((t) => card(t, progress ? { progress: t } : {})).join('')}</div>
        <button class="row-nav next" data-scroll="1" aria-label="Scroll ${esc(heading)} right" tabindex="-1">${icon.chevR}</button>
      </div>
    </section>`;
  }

  let toastTimer;
  function toast(message, isError = false) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.classList.toggle('error', isError);
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  /** Skeleton placeholder shaped like a row of posters. */
  const spinner = () => `<div class="skeleton" aria-label="Loading" role="status">
    <div class="sk-line"></div>
    <div class="grid">${'<div class="sk-card"><div class="sk-poster"></div><div class="sk-text"></div><div class="sk-text short"></div></div>'.repeat(8)}</div>
  </div>`;

  const errorBlock = (err) => `<div class="state"><h2>Something went wrong</h2><p>${esc(err.message)}</p><a class="btn" href="#/">Back to home</a></div>`;

  function formError(form, err) {
    const el = form.querySelector('.error-text');
    const details = err.details ? Object.entries(err.details).map(([k, v]) => `${k} ${v}`).join('; ') : '';
    el.textContent = details ? `${err.message}: ${details}` : err.message;
  }

  return { esc, fmtDuration, fmtRating, stars, kind, icon, facts, rating, poster, backdrop, card, row, toast, spinner, errorBlock, formError };
})();
