// Each view renders into #view and can return a cleanup function (the player uses this).
const Views = (() => {
  const { esc, icon } = UI;
  const view = () => document.getElementById('view');
  const requireLogin = () => {
    if (Api.session) return true;
    location.hash = `#/login?next=${encodeURIComponent(location.hash.slice(1))}`;
    return false;
  };

  // Play and My List sign visitors into the guest account instead of showing a login wall.
  async function ensureSession() {
    if (Api.session) return true;
    try {
      await Api.demo();
      UI.toast('You’re browsing as a guest. Create an account anytime to keep your own list.');
      return true;
    } catch {
      return requireLogin();
    }
  }

  async function startDemo(btn) {
    if (btn) btn.disabled = true;
    try {
      await Api.demo();
      UI.toast('You’re browsing as a guest.');
      App.render();
    } catch (err) {
      UI.toast(err.message, true);
      if (btn) btn.disabled = false;
    }
  }

  const guestNote = (what) =>
    `<p class="note">You’re using the shared guest account. <a href="#/register?next=${encodeURIComponent(location.hash.slice(1))}">Create a free account</a> to ${what}.</p>`;

  const pageHead = (title, sub = '', eyebrow = '') =>
    `<header class="page-head">${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ''}<h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</header>`;

  // Faint columns of posters behind the hero, offset so they read as a wall.
  function posterWall(items) {
    if (!items.length) return '';
    const cols = Array.from({ length: 10 }, (_, c) => {
      const stack = [0, 1, 2].map((i) => UI.poster(items[(c * 3 + i) % items.length])).join('');
      return `<div class="wall-col" style="--shift:${[-40, -140, -80, -170, -20, -120, -60, -150, -30, -100][c]}px">${stack}</div>`;
    });
    return `<div class="wall" aria-hidden="true">${cols.join('')}</div>`;
  }

  function spotlightBody(t) {
    return `<div class="spot-art">${UI.backdrop(t)}</div>
      <div class="spot-panel">
        <p class="meta-line">${esc(t.genres.join(' · '))}</p>
        <h3 class="film-title">${esc(t.name)}</h3>
        <p class="facts">${UI.facts(t)}${t.ratingCount ? `<span class="dot">·</span>${UI.rating(t)}` : ''}</p>
        <p class="spot-synopsis">${esc(t.synopsis)}</p>
        ${t.director ? `<p class="spot-cast"><span>Directed by</span> ${esc(t.director)}</p>` : ''}
        <div class="actions">
          <a class="btn primary" href="#/watch/${esc(t._id)}">${icon.play}Play</a>
          <a class="btn outline" href="#/title/${esc(t._id)}">Details</a>
        </div>
        ${t.credit ? `<p class="spot-credit">© ${esc(t.credit)}${t.license ? ` · ${esc(t.license)}` : ''}</p>` : ''}
      </div>`;
  }

  const sectionHead = (eyebrow, heading, link = '') =>
    `<header class="section-head row-head"><div><p class="eyebrow">${eyebrow}</p><h2>${heading}</h2></div>${link}</header>`;

  // Short films as a small editorial grid rather than another carousel.
  function shorts(items) {
    if (items.length < 2) return '';
    return `<section class="page section reveal">
      ${sectionHead('Shorts', 'Under ten minutes')}
      <div class="shorts">${items.map((t) => `<a class="short" href="#/title/${esc(t._id)}">
        <span class="short-art">${UI.art(t)}<span class="runtime">${esc(t.durationMinutes)} min</span></span>
        <span class="film-title">${esc(t.name)}</span>
        <span class="meta-line">${esc(t.releaseYear)} · ${esc(t.genres.slice(0, 2).join(' · '))}</span>
      </a>`).join('')}</div>
    </section>`;
  }

  // Every film placed on a timeline by release year.
  function archive(items) {
    if (items.length < 3) return '';
    const sorted = [...items].sort((a, b) => a.releaseYear - b.releaseYear);
    const first = sorted[0].releaseYear;
    const last = sorted[sorted.length - 1].releaseYear;
    return `<section class="page section reveal">
      ${sectionHead(`The archive · ${first}–${last}`, 'Open films, in the order they were made')}
      <ol class="archive" aria-label="Films by release year">${sorted.map((t) => `<li>
        <a class="archive-item" href="#/title/${esc(t._id)}">
          <span class="archive-year">${esc(t.releaseYear)}</span>
          <span class="archive-art">${UI.art(t)}</span>
          <span class="film-title">${esc(t.name)}</span>
          <span class="meta-line">${esc(t.credit || UI.kind(t))}</span>
        </a>
      </li>`).join('')}</ol>
    </section>`;
  }

  async function home() {
    const [{ featured, rows }, cont, popular, all] = await Promise.all([
      Api.rows(),
      Api.session ? Api.continueWatching().catch(() => ({ items: [] })) : { items: [] },
      Api.listTitles({ sort: 'popular', limit: 16 }),
      Api.listTitles({ sort: 'newest', limit: 50 }),
    ]);
    // The featured screening changes daily, cycling through the featured titles.
    const day = Math.floor(Date.now() / 86400000);
    const hero = featured.length ? featured[day % featured.length] : null;
    const program = all.items.filter((t) => !hero || t._id !== hero._id).slice(0, 5);
    const first = program.length ? (await Api.title(program[0]._id)).title : null;
    const watched = popular.items.filter((t) => t.viewCount > 0);

    view().innerHTML = `
      ${hero ? `<section class="hero">
        ${posterWall(popular.items)}
        <div class="page hero-body">
          <p class="eyebrow">Tonight at Kinoloft</p>
          <h1 class="hero-title">${esc(hero.name)}</h1>
          <p class="hero-synopsis">${esc(hero.synopsis)}</p>
          <p class="facts">${UI.facts(hero)}<span class="dot">·</span>${esc(hero.genres.join(', '))}</p>
          <div class="actions">
            <a class="btn primary large" href="#/watch/${esc(hero._id)}">${icon.play}Play</a>
            <a class="btn outline large" href="#/title/${esc(hero._id)}">More info</a>
          </div>
          ${!Api.session ? '<p class="hero-hint">No account needed. <button class="link-btn" data-start-demo>Try the demo</button> to save films and resume where you stopped.</p>' : ''}
        </div>
      </section>` : ''}

      ${cont.items.length ? `<section class="page section reveal">
        ${UI.row('Continue watching', cont.items, { progress: true, eyebrow: 'Pick up where you left off' })}
      </section>` : ''}

      ${first ? `<section class="page section reveal">
        ${sectionHead('Now showing', 'The rest of the program')}
        <div class="tabs" role="tablist" aria-label="Films in the program">
          ${program.map((t, i) => `<button class="tab" role="tab" id="tab-${esc(t._id)}" aria-controls="spot" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-spot="${esc(t._id)}">${esc(t.name)}</button>`).join('')}
        </div>
        <div class="spot" id="spot" role="tabpanel" aria-labelledby="tab-${esc(program[0]._id)}">${spotlightBody(first)}</div>
      </section>` : ''}

      ${shorts(all.items.filter((t) => t.durationMinutes <= 10))}
      ${archive(all.items)}

      ${rows.length ? `<section class="band reveal">
        <div class="page">
          ${sectionHead('Collections', 'Browse by genre')}
          <div class="genre-grid">
            ${rows.map((r) => `<a class="genre-tile" href="#/browse?genre=${encodeURIComponent(r.genre)}">
              <span class="genre-stack" aria-hidden="true">${r.titles.slice(0, 3).map((t) => UI.poster(t)).join('')}</span>
              <span class="genre-name">${esc(r.genre)}</span>
              <span class="genre-top">${r.titles.length === 1 ? esc(r.titles[0].name) : `${esc(r.titles[0].name)} and more`}</span>
            </a>`).join('')}
          </div>
        </div>
      </section>` : ''}

      ${watched.length >= 3 ? `<section class="page section reveal">
        ${UI.row('Most watched at Kinoloft', watched, { href: '#/browse?sort=popular', eyebrow: 'Audience' })}
      </section>` : ''}
      ${!featured.length && !rows.length ? '<div class="page"><div class="state"><h2>The program is being prepared</h2><p>No films have been loaded yet. Run <code>npm run seed</code> to load the catalog.</p></div></div>' : ''}`;

    view().querySelector('[data-start-demo]')?.addEventListener('click', (e) => startDemo(e.currentTarget));

    // Tabs follow the WAI-ARIA pattern: arrow keys move between them.
    const spot = document.getElementById('spot');
    const tabs = [...view().querySelectorAll('[data-spot]')];
    const cache = new Map(first ? [[first._id, first]] : []);
    async function select(tab) {
      tabs.forEach((t) => { const on = t === tab; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
      spot.setAttribute('aria-labelledby', tab.id);
      const id = tab.dataset.spot;
      spot.classList.add('is-loading');
      if (!cache.has(id)) cache.set(id, (await Api.title(id)).title);
      if (tab.getAttribute('aria-selected') === 'true') {
        spot.innerHTML = spotlightBody(cache.get(id));
        spot.classList.remove('is-loading');
      }
    }
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(tab));
      tab.addEventListener('keydown', (e) => {
        const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        if (!step) return;
        e.preventDefault();
        const next = tabs[(i + step + tabs.length) % tabs.length];
        next.focus();
        select(next);
      });
    });
  }

  async function browse(params) {
    const { genres } = await Api.genres();
    const state = { genre: params.get('genre') || '', type: params.get('type') || '', sort: params.get('sort') || 'popular' };
    const opt = (v, label, cur) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(label)}</option>`;
    view().innerHTML = `<div class="page">
      ${pageHead(state.genre ? esc(state.genre) : 'All titles', '', 'Browse')}
      <form class="filters" id="filters" aria-label="Filter titles">
        <label class="select"><span>Genre</span>
          <select name="genre">${opt('', 'All', state.genre)}${genres.map((g) => opt(g, g, state.genre)).join('')}</select></label>
        <label class="select"><span>Type</span>
          <select name="type">${opt('', 'Films & series', state.type)}${opt('movie', 'Films', state.type)}${opt('series', 'Series', state.type)}</select></label>
        <label class="select"><span>Sort</span>
          <select name="sort">${opt('popular', 'Most watched', state.sort)}${opt('newest', 'Newest', state.sort)}${opt('top', 'Highest rated', state.sort)}</select></label>
      </form>
      <div class="grid" id="results"></div>
      <div class="more" id="more-wrap"></div>
    </div>`;

    document.getElementById('filters').addEventListener('change', (e) => {
      const data = new URLSearchParams([...new FormData(e.currentTarget)].filter(([, v]) => v));
      location.hash = `#/browse${data.toString() ? `?${data}` : ''}`;
    });

    const results = document.getElementById('results');
    const moreWrap = document.getElementById('more-wrap');
    let cursor = null;
    async function loadPage() {
      moreWrap.innerHTML = '<span class="loading-dots" aria-label="Loading"></span>';
      const page = await Api.listTitles({ ...state, cursor, limit: 24 });
      results.insertAdjacentHTML('beforeend', page.items.map((t) => UI.card(t)).join(''));
      cursor = page.nextCursor;
      if (!results.children.length) moreWrap.innerHTML = '<div class="state"><h2>Nothing here yet</h2><p>No titles match these filters.</p><a class="btn" href="#/browse">Clear filters</a></div>';
      else moreWrap.innerHTML = cursor ? '<button class="btn secondary" id="more">Show more</button>' : '';
      document.getElementById('more')?.addEventListener('click', () => loadPage().catch((e) => UI.toast(e.message, true)));
    }
    await loadPage();
  }

  async function search(params) {
    const { genres } = await Api.genres();
    let q = (params.get('q') || '').trim();
    view().innerHTML = `<div class="page search-view">
      ${pageHead('Search', '', 'Find a film')}
      <form class="search-page" id="search-page" role="search">
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
        <label class="sr-only" for="search-q">Search films, filmmakers, genres</label>
        <input id="search-q" type="search" name="q" value="${esc(q)}" placeholder="Search films, filmmakers, genres" maxlength="100" autocomplete="off" enterkeyhint="search" data-autofocus aria-describedby="search-status" />
        <kbd class="kbd" aria-hidden="true">Esc</kbd>
      </form>
      <p class="sr-only" id="search-status" role="status" aria-live="polite"></p>
      <div id="search-results"></div>
    </div>`;

    const form = document.getElementById('search-page');
    const input = form.q;
    const results = document.getElementById('search-results');
    const status = document.getElementById('search-status');
    const link = (term, page) => `#/search?q=${encodeURIComponent(term)}${page > 1 ? `&page=${page}` : ''}`;

    const idle = () => `<div class="state compact">
        <h2>What are you in the mood for?</h2>
        <p>Search by title, director, studio, genre, or a word from the story.</p>
        <div class="chips">${genres.map((g) => `<a class="chip" href="#/browse?genre=${encodeURIComponent(g)}">${esc(g)}</a>`).join('')}</div>
      </div>`;

    let seq = 0;
    async function run(term, page = 1) {
      const id = ++seq;
      if (!term) { results.innerHTML = idle(); status.textContent = ''; return; }
      results.innerHTML = `<div class="grid results-loading" aria-hidden="true">${'<div class="sk-card"><div class="sk-poster"></div><div class="sk-text"></div><div class="sk-text short"></div></div>'.repeat(4)}</div>`;
      let data;
      try {
        data = await Api.search(term, page);
      } catch (err) {
        if (id === seq) results.innerHTML = `<div class="state compact"><h2>Search is unavailable right now</h2><p>${esc(err.message)}</p></div>`;
        return;
      }
      if (id !== seq) return; // a newer search started while this one was in flight
      status.textContent = `${data.total} result${data.total === 1 ? '' : 's'} for ${term}`;
      if (!data.items.length) {
        results.innerHTML = `<div class="state compact">
          <h2>Nothing in the program matches “${esc(term)}”</h2>
          <p>Try a single word, a director’s surname, or a genre such as animation.</p>
          <a class="btn outline" href="#/browse">Browse all films</a>
        </div>`;
        return;
      }
      results.innerHTML = `
        <p class="result-count">${data.partial ? `No exact word matches. Showing titles that contain “${esc(term)}”.` : `${data.total} result${data.total === 1 ? '' : 's'} for “${esc(term)}”`}</p>
        <div class="grid results">${data.items.map((t) => UI.card(t)).join('')}</div>
        ${data.pages > 1 ? `<nav class="pager" aria-label="Pages">
          ${page > 1 ? `<a class="btn secondary" href="${link(term, page - 1)}">Previous</a>` : '<span></span>'}
          <span class="muted">Page ${page} of ${data.pages}</span>
          ${page < data.pages ? `<a class="btn secondary" href="${link(term, page + 1)}">Next</a>` : '<span></span>'}
        </nav>` : ''}`;
    }

    // Results update as you type; the URL follows without re-rendering the page.
    let timer;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        q = input.value.trim();
        history.replaceState(null, '', q ? link(q, 1) : '#/search');
        run(q);
      }, 250);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && input.value) { e.preventDefault(); input.value = ''; input.dispatchEvent(new Event('input')); }
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      clearTimeout(timer);
      q = input.value.trim();
      history.replaceState(null, '', q ? link(q, 1) : '#/search');
      run(q);
      results.querySelector('a')?.focus();
    });
    await run(q, Number(params.get('page')) || 1);
    return () => clearTimeout(timer);
  }

  async function title(_params, id) {
    const [{ title: t, viewer }, reviews] = await Promise.all([Api.title(id), Api.reviews(id)]);
    let inList = viewer?.inWatchlist || false;
    let rating = viewer?.myReview?.rating || 0;
    const resume = viewer?.progress && !viewer.progress.completed && viewer.progress.positionSeconds > 5;
    App.setTitle(t.name);

    view().innerHTML = `
      <section class="detail-head">
        ${UI.backdrop(t)}
        <div class="page detail-inner">
          <div class="detail-poster">${UI.poster(t)}</div>
          <div class="detail-info">
            <p class="eyebrow">${esc(UI.kind(t))}</p>
            <h1 class="detail-title film-title">${esc(t.name)}</h1>
            <p class="facts">${UI.facts(t)}${t.ratingCount ? `<span class="dot">·</span>${UI.rating(t)}<span class="muted-count">(${t.ratingCount})</span>` : ''}</p>
            <div class="actions">
              <a class="btn primary" href="#/watch/${esc(t._id)}">${icon.play}${resume ? 'Resume' : 'Play'}</a>
              <button class="btn secondary" id="list-btn"></button>
            </div>
            <p class="synopsis">${esc(t.synopsis)}</p>
            <dl class="credits">
              ${t.director ? `<div><dt>Directed by</dt><dd>${esc(t.director)}</dd></div>` : ''}
              ${t.cast.length ? `<div><dt>Starring</dt><dd>${esc(t.cast.join(', '))}</dd></div>` : ''}
              ${t.credit ? `<div><dt>Made by</dt><dd>© ${esc(t.credit)}</dd></div>` : ''}
              ${t.license ? `<div><dt>License</dt><dd><a href="${esc(t.licenseUrl)}" target="_blank" rel="noopener license">${esc(t.license)}</a></dd></div>` : ''}
              ${t.sourceUrl ? `<div><dt>Source</dt><dd><a href="${esc(t.sourceUrl)}" target="_blank" rel="noopener">Watch on YouTube</a></dd></div>` : ''}
              <div><dt>Genres</dt><dd>${t.genres.map((g) => `<a href="#/browse?genre=${encodeURIComponent(g)}">${esc(g)}</a>`).join(', ')}</dd></div>
              ${t.viewCount ? `<div><dt>Views</dt><dd>${t.viewCount.toLocaleString()}</dd></div>` : ''}
            </dl>
          </div>
        </div>
      </section>

      <section class="page reviews">
        <div class="reviews-summary">
          <h2>Ratings &amp; reviews</h2>
          ${t.ratingCount
            ? `<p class="score"><strong>${t.ratingAvg.toFixed(1)}</strong><span>out of 5</span></p><p class="muted">${t.ratingCount} rating${t.ratingCount === 1 ? '' : 's'}</p>`
            : '<p class="muted">No ratings yet.</p>'}
          ${Api.isGuest ? guestNote('rate and review titles') : Api.session ? `<form class="review-form" id="review-form">
            <p class="label">${viewer?.myReview ? 'Your review' : 'Rate this title'}</p>
            <div class="star-input" id="star-input">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-n="${n}" aria-label="${n} star${n > 1 ? 's' : ''}">★</button>`).join('')}</div>
            <textarea name="body" maxlength="2000" placeholder="What did you think? (optional)" aria-label="Review">${esc(viewer?.myReview?.body || '')}</textarea>
            <p class="error-text"></p>
            <div class="form-actions">
              <button class="btn primary small">Save review</button>
              ${viewer?.myReview ? '<button type="button" class="btn text small" id="delete-review">Delete</button>' : ''}
            </div>
          </form>` : `<p class="muted"><a class="text-link" href="#/login?next=${encodeURIComponent(`/title/${t._id}`)}">Sign in</a> to rate and review.</p>`}
        </div>
        <div class="reviews-list">
          <div id="review-list"></div>
          <div id="review-more"></div>
        </div>
      </section>`;

    const listBtn = document.getElementById('list-btn');
    const paintList = () => {
      listBtn.innerHTML = inList ? `${icon.check}In My List` : `${icon.plus}My List`;
      listBtn.setAttribute('aria-pressed', String(inList));
    };
    paintList();
    listBtn.addEventListener('click', async () => {
      listBtn.disabled = true;
      const wasSignedOut = !Api.session;
      if (!(await ensureSession())) return;
      try {
        if (inList) await Api.removeFromWatchlist(id); else await Api.addToWatchlist(id);
        inList = !inList;
        if (wasSignedOut) return App.render(); // refresh viewer-specific sections for the new guest session
        paintList();
        listBtn.classList.remove('just-saved');
        if (inList) { void listBtn.offsetWidth; listBtn.classList.add('just-saved'); }
        UI.toast(inList ? `${t.name} is in your list` : `${t.name} was removed from your list`);
      } catch (e) { UI.toast(e.message, true); } finally { listBtn.disabled = false; }
    });

    const reviewList = document.getElementById('review-list');
    const reviewMore = document.getElementById('review-more');
    const renderReviews = (page) => {
      reviewList.insertAdjacentHTML('beforeend', page.items.map((r) => `
        <article class="review">
          <header><strong>${esc(r.userName)}</strong><span class="stars" aria-label="${r.rating} out of 5">${UI.stars(r.rating)}</span><time>${new Date(r.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</time></header>
          ${r.body ? `<p>${esc(r.body)}</p>` : ''}
        </article>`).join(''));
      if (!reviewList.children.length) reviewList.innerHTML = '<p class="muted">No written reviews yet.</p>';
      reviewMore.innerHTML = page.nextCursor ? '<button class="btn text small">More reviews</button>' : '';
      reviewMore.querySelector('button')?.addEventListener('click', async () => renderReviews(await Api.reviews(id, page.nextCursor)));
    };
    renderReviews(reviews);

    const form = document.getElementById('review-form');
    if (form) {
      const starBtns = [...form.querySelectorAll('#star-input button')];
      const paintStars = () => starBtns.forEach((b) => b.classList.toggle('on', Number(b.dataset.n) <= rating));
      paintStars();
      starBtns.forEach((b) => b.addEventListener('click', () => { rating = Number(b.dataset.n); paintStars(); }));
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!rating) { form.querySelector('.error-text').textContent = 'Pick a star rating first.'; return; }
        try {
          await Api.saveReview(id, rating, form.body.value);
          UI.toast('Review saved');
          App.render();
        } catch (err) { UI.formError(form, err); }
      });
      document.getElementById('delete-review')?.addEventListener('click', async () => {
        if (!confirm('Delete your review?')) return;
        try { await Api.deleteReview(id); UI.toast('Review deleted'); App.render(); } catch (err) { UI.toast(err.message, true); }
      });
    }
  }

  // Loads YouTube's IFrame Player API once and resolves with the YT global.
  let ytReady;
  function loadYouTube() {
    if (!ytReady) {
      ytReady = new Promise((resolve, reject) => {
        window.onYouTubeIframeAPIReady = () => resolve(window.YT);
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.onerror = () => { ytReady = null; reject(new Error('The YouTube player could not be loaded.')); };
        document.head.append(tag);
      });
    }
    return ytReady;
  }

  // Shared progress reporter for both players: throttled while playing, forced on pause/end/leave.
  function progressReporter(id, read) {
    let lastSent = 0;
    return (force = false) => {
      const { position, duration } = read();
      if (!duration) return;
      const now = Date.now();
      if (!force && now - lastSent < 10000) return;
      lastSent = now;
      Api.saveProgress(id, Math.floor(position), Math.floor(duration)).catch(() => {});
    };
  }

  function credits(t) {
    if (!t.credit && !t.license) return '';
    return `<p class="film-credit">${t.credit ? `© ${esc(t.credit)}` : ''}${t.license
      ? ` · <a href="${esc(t.licenseUrl)}" target="_blank" rel="noopener license">${esc(t.license)}</a>` : ''}${t.sourceUrl
      ? ` · <a href="${esc(t.sourceUrl)}" target="_blank" rel="noopener">Watch on YouTube</a>` : ''}</p>`;
  }

  async function watch(_params, id) {
    if (!(await ensureSession())) return;
    const [{ title: t }, play] = await Promise.all([Api.title(id), Api.play(id)]);
    App.setTitle(`Watching ${t.name}`);
    let screen;
    if (t.youtubeId) screen = '<div id="yt-player"></div>';
    else if (play.streamUrl) screen = `<video id="player" controls autoplay playsinline preload="metadata" src="${esc(play.streamUrl)}"></video>`;
    else {
      screen = `${UI.backdrop(t)}<div class="player-empty"><p class="label">Video unavailable</p>
        <p>This title has no video yet. Add an MP4 to <code>media/</code> and assign it in Admin to enable playback.</p></div>`;
    }
    view().innerHTML = `<div class="page player-page">
      <a class="back" href="#/title/${esc(t._id)}">${icon.chevL}${esc(t.name)}</a>
      <div class="player">${screen}</div>
      <div class="player-info">
        <h1>${esc(t.name)}</h1>
        <p class="facts">${UI.facts(t)}</p>
        ${credits(t)}
        <p class="synopsis">${esc(t.synopsis)}</p>
      </div>
    </div>`;

    if (t.youtubeId) {
      let yt;
      const send = progressReporter(id, () => ({ position: yt?.getCurrentTime?.() || 0, duration: yt?.getDuration?.() || 0 }));
      let timer;
      try {
        const YT = await loadYouTube();
        if (!document.getElementById('yt-player')) return; // navigated away while the API loaded
        yt = new YT.Player('yt-player', {
          host: 'https://www.youtube-nocookie.com',
          videoId: t.youtubeId,
          playerVars: { start: Math.floor(play.resumeAt || 0), rel: 0, playsinline: 1 },
          events: {
            onStateChange: (e) => {
              if (e.data === YT.PlayerState.PLAYING) { clearInterval(timer); timer = setInterval(() => send(), 5000); }
              else { clearInterval(timer); if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) send(true); }
            },
          },
        });
      } catch (err) {
        UI.toast(err.message, true);
      }
      return () => { clearInterval(timer); send(true); yt?.destroy?.(); };
    }

    const video = document.getElementById('player');
    if (!video) return;
    const send = progressReporter(id, () => ({ position: video.currentTime, duration: video.duration || 0 }));
    video.addEventListener('loadedmetadata', () => {
      if (play.resumeAt > 0 && play.resumeAt < video.duration - 5) video.currentTime = play.resumeAt;
    }, { once: true });
    video.addEventListener('error', () => UI.toast('This video could not be loaded.', true));
    video.addEventListener('timeupdate', () => send());
    video.addEventListener('pause', () => send(true));
    video.addEventListener('ended', () => send(true));
    return () => { send(true); video.pause(); video.removeAttribute('src'); video.load(); };
  }

  async function myList() {
    if (!(await ensureSession())) return;
    const { items } = await Api.watchlist();
    view().innerHTML = `<div class="page">
      ${pageHead('My List', items.length ? `${items.length} title${items.length === 1 ? '' : 's'} saved` : '', 'Your library')}
      ${Api.isGuest ? guestNote('keep a list that’s only yours') : ''}
      ${items.length ? `<div class="grid">${items.map((t) => UI.card(t)).join('')}</div>`
        : '<div class="state"><h2>Nothing saved yet</h2><p>Press My List on any film and it waits here for you, along with your place in it.</p><a class="btn outline" href="#/browse">Browse the program</a></div>'}
    </div>`;
  }

  function authForm(params, mode) {
    const next = params.get('next') || '/';
    const isLogin = mode === 'login';
    view().innerHTML = `<div class="page auth">
      <h1>${isLogin ? 'Sign in' : 'Create your account'}</h1>
      <form class="form" id="auth-form" novalidate>
        ${isLogin ? '' : '<div class="field"><label for="a-name">Name</label><input id="a-name" name="name" autocomplete="name" required maxlength="60" /></div>'}
        <div class="field"><label for="a-email">Email</label><input id="a-email" name="email" type="email" autocomplete="email" required /></div>
        <div class="field"><label for="a-pass">Password</label><input id="a-pass" name="password" type="password" autocomplete="${isLogin ? 'current-password' : 'new-password'}" required minlength="8" />${isLogin ? '' : '<small>At least 8 characters.</small>'}</div>
        <p class="error-text"></p>
        <button class="btn primary block">${isLogin ? 'Sign in' : 'Create account'}</button>
      </form>
      <p class="muted switch">${isLogin
        ? `New to Kinoloft? <a class="text-link" href="#/register?next=${encodeURIComponent(next)}">Create an account</a>`
        : `Already have an account? <a class="text-link" href="#/login?next=${encodeURIComponent(next)}">Sign in</a>`}</p>
      ${Api.isGuest ? '' : `<div class="divider"><span>or</span></div>
      <button class="btn secondary block" id="guest-btn">Continue as guest</button>`}
    </div>`;
    document.getElementById('guest-btn')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        await Api.demo();
        location.hash = `#${next.startsWith('/') ? next : '/'}`;
      } catch (err) { UI.toast(err.message, true); btn.disabled = false; }
    });
    const form = document.getElementById('auth-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button');
      btn.disabled = true;
      try {
        if (isLogin) await Api.login(form.email.value, form.password.value);
        else await Api.register(form.name.value, form.email.value, form.password.value);
        location.hash = `#${next.startsWith('/') ? next : '/'}`;
      } catch (err) { UI.formError(form, err); } finally { btn.disabled = false; }
    });
  }

  async function admin(params) {
    if (!requireLogin()) return;
    if (Api.session.user.role !== 'admin') { view().innerHTML = '<div class="page"><div class="state"><h2>This area is for catalog admins</h2><p>Your account can browse, save, and review films, but not edit the catalog.</p><a class="btn outline" href="#/">Back to the program</a></div></div>'; return; }
    const editId = params.get('edit');
    if (editId || params.has('new')) return adminForm(editId);

    const sort = params.get('sort') || 'newest';
    const { items, nextCursor } = await Api.listTitles({ sort, limit: 50 });
    view().innerHTML = `<div class="page">
      <header class="page-head split"><h1>Catalog</h1><a class="btn primary small" href="#/admin?new=1">${icon.plus}New title</a></header>
      <div class="table-wrap"><table>
        <thead><tr><th>Title</th><th>Type</th><th>Year</th><th>Genres</th><th class="num">Views</th><th class="num">Rating</th><th></th></tr></thead>
        <tbody>${items.map((t) => `<tr>
          <td><a href="#/title/${esc(t._id)}">${esc(t.name)}</a></td><td>${esc(UI.kind(t))}</td><td>${esc(t.releaseYear)}</td>
          <td class="muted">${esc(t.genres.join(', '))}</td><td class="num">${t.viewCount.toLocaleString()}</td><td class="num">${t.ratingCount ? t.ratingAvg.toFixed(1) : '–'}</td>
          <td class="row-actions"><a class="btn text small" href="#/admin?edit=${esc(t._id)}">Edit</a><button class="btn text small danger" data-del="${esc(t._id)}" data-name="${esc(t.name)}">Delete</button></td>
        </tr>`).join('')}</tbody>
      </table></div>
      ${nextCursor ? '<p class="muted small">Showing the 50 most recent releases. Use Search to find others.</p>' : ''}
    </div>`;

    view().querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm(`Delete “${b.dataset.name}”? Reviews, watchlist entries and progress for it are removed too.`)) return;
      try { await Api.deleteTitle(b.dataset.del); UI.toast('Title deleted'); App.render(); } catch (e) { UI.toast(e.message, true); }
    }));
  }

  async function adminForm(editId) {
    const [{ genres, maturityRatings }, existing] = await Promise.all([Api.genres(), editId ? Api.title(editId) : null]);
    const t = existing?.title || { type: 'movie', genres: [], cast: [], posterHue: Math.floor(Math.random() * 360), featured: false };
    const sel = (name, values, cur, labels = {}) => `<select name="${name}" id="t-${name}" required>${values.map((v) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(labels[v] || v)}</option>`).join('')}</select>`;
    view().innerHTML = `<div class="page narrow">
      <a class="back" href="#/admin">${icon.chevL}Catalog</a>
      ${pageHead(editId ? `Edit ${esc(t.name)}` : 'New title')}
      <form class="form wide" id="title-form">
        <div class="field full"><label for="t-name">Title</label><input id="t-name" name="name" required maxlength="120" value="${esc(t.name)}" /></div>
        <div class="field"><label for="t-type">Type</label>${sel('type', ['movie', 'series'], t.type, { movie: 'Film', series: 'Series' })}</div>
        <div class="field"><label for="t-maturityRating">Maturity rating</label>${sel('maturityRating', maturityRatings, t.maturityRating)}</div>
        <div class="field"><label for="t-releaseYear">Release year</label><input id="t-releaseYear" name="releaseYear" type="number" min="1900" max="2100" required value="${esc(t.releaseYear)}" /></div>
        <div class="field"><label for="t-durationMinutes">Runtime (minutes)</label><input id="t-durationMinutes" name="durationMinutes" type="number" min="1" max="1000" required value="${esc(t.durationMinutes)}" /></div>
        <fieldset class="field full"><legend>Genres (1–4)</legend><div class="checks">${genres.map((g) => `<label class="check"><input type="checkbox" name="genres" value="${esc(g)}" ${t.genres.includes(g) ? 'checked' : ''} /> ${esc(g)}</label>`).join('')}</div></fieldset>
        <div class="field full"><label for="t-synopsis">Synopsis</label><textarea id="t-synopsis" name="synopsis" required maxlength="1000">${esc(t.synopsis)}</textarea></div>
        <div class="field full"><label for="t-cast">Cast</label><input id="t-cast" name="cast" value="${esc(t.cast.join(', '))}" /><small>Separate names with commas.</small></div>
        <div class="field"><label for="t-videoFile">Video file</label><input id="t-videoFile" name="videoFile" placeholder="example.mp4" value="${esc(t.videoFile)}" /><small>A file in the media/ folder.</small></div>
        <div class="field"><label for="t-posterHue">Artwork hue (0–359)</label><input id="t-posterHue" name="posterHue" type="number" min="0" max="359" value="${esc(t.posterHue)}" /></div>
        <label class="check full"><input type="checkbox" name="featured" ${t.featured ? 'checked' : ''} /> Feature on the home page</label>
        <p class="error-text full"></p>
        <div class="full form-actions"><button class="btn primary">${editId ? 'Save changes' : 'Create title'}</button><a class="btn text" href="#/admin">Cancel</a></div>
      </form>
    </div>`;

    const form = document.getElementById('title-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const data = {
        name: fd.get('name'), type: fd.get('type'), maturityRating: fd.get('maturityRating'),
        releaseYear: Number(fd.get('releaseYear')), durationMinutes: Number(fd.get('durationMinutes')),
        genres: fd.getAll('genres'), synopsis: fd.get('synopsis'),
        cast: String(fd.get('cast')).split(',').map((s) => s.trim()).filter(Boolean),
        videoFile: fd.get('videoFile'), posterHue: Number(fd.get('posterHue')), featured: fd.has('featured'),
      };
      try {
        if (editId) await Api.updateTitle(editId, { ...data, version: t.version });
        else await Api.createTitle(data);
        UI.toast(editId ? 'Changes saved' : 'Title created');
        location.hash = '#/admin';
      } catch (err) { UI.formError(form, err); }
    });
  }

  function account() {
    if (!requireLogin()) return;
    const { user } = Api.session;
    if (Api.isGuest) {
      view().innerHTML = `<div class="page narrow">
        ${pageHead('Guest account', '', 'Account')}
        <p class="note">You're using the shared guest account. Its list and playback positions are visible to every guest, and it can't be deleted. <a href="#/register">Create your own account</a> to keep things private.</p>
        <div class="form-actions"><button class="btn outline" id="sign-out">Exit guest mode</button></div>
      </div>`;
      document.getElementById('sign-out').addEventListener('click', () => { Api.logout(); location.hash = '#/'; });
      return;
    }
    view().innerHTML = `<div class="page narrow">
      ${pageHead(esc(user.name), esc(user.email), 'Account')}
      <section class="account-panel">
        <h2>Your data</h2>
        <p>Kinoloft stores your name, email, list, playback progress, and reviews. The <a class="text-link" href="#/privacy">privacy policy</a> explains exactly what is kept and where.</p>
        <div class="form-actions"><button class="btn outline" id="sign-out">Sign out</button></div>
      </section>
      ${user.role === 'admin' ? `<section class="account-panel">
        <h2>Catalog admin</h2>
        <p>Add, edit, and remove films. Every change is checked on the server, and edits fail safely if another admin saved first.</p>
        <div class="form-actions"><a class="btn outline" href="#/admin">Open catalog admin</a></div>
      </section>` : ''}
      <section class="account-panel danger-zone">
        <h2>Delete account</h2>
        <p>Permanently deletes your account, My List, playback progress, and reviews. This can't be undone.</p>
        <p class="error-text" id="delete-error"></p>
        <div class="form-actions"><button class="btn danger-fill" id="delete-account">Delete my account</button></div>
      </section>
    </div>`;
    document.getElementById('sign-out').addEventListener('click', () => { Api.logout(); location.hash = '#/'; });
    document.getElementById('delete-account').addEventListener('click', async (e) => {
      if (!confirm('Delete your account and everything saved to it? This cannot be undone.')) return;
      e.currentTarget.disabled = true;
      try {
        await Api.deleteAccount();
        Api.logout();
        UI.toast('Your account has been deleted.');
        location.hash = '#/';
      } catch (err) {
        document.getElementById('delete-error').textContent = err.message;
        e.currentTarget.disabled = false;
      }
    });
  }

  const legal = (page) => async () => {
    view().innerHTML = await Legal[page]();
    view().querySelector(`[data-legal="${page}"]`)?.setAttribute('aria-current', 'page');
  };

  const notFound = () => { view().innerHTML = '<div class="page"><div class="state"><h2>Page not found</h2><p>The page you’re looking for doesn’t exist.</p><a class="btn secondary" href="#/">Back to home</a></div></div>'; };

  return { home, browse, search, title, watch, myList, account,
    terms: legal('terms'), privacy: legal('privacy'), credits: legal('credits'), copyright: legal('copyright'), login: (p) => authForm(p, 'login'), register: (p) => authForm(p, 'register'), admin, notFound };
})();
