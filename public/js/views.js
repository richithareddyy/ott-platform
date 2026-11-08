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
    return `<div class="spot-art">${UI.backdrop(t)}<span class="spot-tag">${esc(UI.kind(t))}</span></div>
      <div class="spot-panel">
        <p class="eyebrow">${esc(t.genres.join(' · '))}</p>
        <h3>${esc(t.name)}</h3>
        <p class="facts">${UI.facts(t)}${t.ratingCount ? `<span class="dot">·</span>${UI.rating(t)}` : ''}</p>
        <p class="spot-synopsis">${esc(t.synopsis)}</p>
        ${t.cast.length ? `<p class="spot-cast"><span>Starring</span> ${esc(t.cast.join(', '))}</p>` : ''}
        <div class="actions">
          <a class="btn primary" href="#/watch/${esc(t._id)}">${icon.play}Play</a>
          <a class="btn outline" href="#/title/${esc(t._id)}">Details</a>
        </div>
      </div>`;
  }

  async function home() {
    const [{ featured, rows }, cont, popular, top, fresh] = await Promise.all([
      Api.rows(),
      Api.session ? Api.continueWatching().catch(() => ({ items: [] })) : { items: [] },
      Api.listTitles({ sort: 'popular', limit: 16 }),
      Api.listTitles({ sort: 'top', limit: 16 }),
      Api.listTitles({ sort: 'newest', limit: 16 }),
    ]);
    const hero = featured[0];
    const picks = popular.items.filter((t) => !hero || t._id !== hero._id).slice(0, 4);
    const first = picks.length ? (await Api.title(picks[0]._id)).title : null;

    view().innerHTML = `
      ${hero ? `<section class="hero">
        ${posterWall(popular.items)}
        <div class="page hero-body">
          <p class="eyebrow">Featured ${esc(UI.kind(hero).toLowerCase())} · ${esc(hero.genres[0])}</p>
          <h1 class="hero-title">${esc(hero.name)}</h1>
          <p class="hero-synopsis">${esc(hero.synopsis)}</p>
          <p class="facts">${UI.facts(hero)}${hero.ratingCount ? `<span class="dot">·</span>${UI.rating(hero)}` : ''}</p>
          <div class="actions">
            <a class="btn primary large" href="#/watch/${esc(hero._id)}">${icon.play}Play</a>
            <a class="btn outline large" href="#/title/${esc(hero._id)}">More info</a>
          </div>
          ${!Api.session ? '<p class="hero-hint">No account needed. <button class="link-btn" data-start-demo>Try the demo</button> to browse as a guest.</p>' : ''}
        </div>
      </section>` : ''}

      ${cont.items.length ? `<section class="page section reveal">
        ${UI.row('Continue watching', cont.items, { progress: true, eyebrow: 'Pick up where you left off' })}
      </section>` : ''}

      ${first ? `<section class="page section reveal">
        <header class="section-head"><p class="eyebrow">Trending now</p><h2>What everyone’s watching</h2></header>
        <div class="tabs" role="tablist" aria-label="Trending titles">
          ${picks.map((t, i) => `<button class="tab" role="tab" aria-selected="${i === 0}" data-spot="${esc(t._id)}">${esc(t.name)}</button>`).join('')}
        </div>
        <div class="spot" id="spot" role="tabpanel">${spotlightBody(first)}</div>
      </section>` : ''}

      <section class="page section reveal">
        ${UI.row('Most watched', popular.items, { href: '#/browse?sort=popular', eyebrow: 'Popular' })}
      </section>
      <section class="page section reveal">
        ${UI.row('Highest rated', top.items.filter((t) => t.ratingCount), { href: '#/browse?sort=top', eyebrow: 'Top rated' })}
      </section>

      ${rows.length ? `<section class="band reveal">
        <div class="page">
          <header class="section-head"><p class="eyebrow">Genres</p><h2>Browse by genre</h2></header>
          <div class="genre-grid">
            ${rows.map((r) => `<a class="genre-tile" href="#/browse?genre=${encodeURIComponent(r.genre)}">
              <span class="genre-stack" aria-hidden="true">${r.titles.slice(0, 3).map((t) => UI.poster(t)).join('')}</span>
              <span class="genre-name">${esc(r.genre)}</span>
              <span class="genre-top">${esc(r.titles[0].name)}</span>
            </a>`).join('')}
          </div>
        </div>
      </section>` : ''}

      <section class="page section reveal">
        ${UI.row('New releases', fresh.items, { href: '#/browse?sort=newest', eyebrow: 'Just added' })}
      </section>
      ${!featured.length && !rows.length ? '<div class="page"><div class="state"><h2>No titles yet</h2><p>Run <code>npm run seed</code> to load the sample catalog.</p></div></div>' : ''}`;

    view().querySelector('[data-start-demo]')?.addEventListener('click', (e) => startDemo(e.currentTarget));

    const spot = document.getElementById('spot');
    const cache = new Map(first ? [[first._id, first]] : []);
    view().querySelectorAll('[data-spot]').forEach((tab) => tab.addEventListener('click', async () => {
      view().querySelectorAll('[data-spot]').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
      const id = tab.dataset.spot;
      if (!cache.has(id)) cache.set(id, (await Api.title(id)).title);
      if (tab.getAttribute('aria-selected') === 'true') spot.innerHTML = spotlightBody(cache.get(id));
    }));
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
    const q = (params.get('q') || '').trim();
    document.getElementById('search-input').value = q;
    const page = Number(params.get('page')) || 1;
    const data = q ? await Api.search(q, page) : null;
    const link = (p) => `#/search?q=${encodeURIComponent(q)}&page=${p}`;
    view().innerHTML = `<div class="page">
      <form class="search-page" id="search-page" role="search">
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
        <input type="search" name="q" value="${esc(q)}" placeholder="Search titles, people, genres" aria-label="Search" maxlength="100" autocomplete="off" />
      </form>
      ${!q ? '<div class="state"><h2>Find something to watch</h2><p>Search by title, cast member, or a word from the story.</p></div>' : `
        <p class="result-count">${data.total} result${data.total === 1 ? '' : 's'} for “${esc(q)}”</p>
        ${data.items.length ? `<div class="grid">${data.items.map((t) => UI.card(t)).join('')}</div>`
          : '<div class="state"><h2>No matches</h2><p>Check the spelling, or try a cast name or a single word.</p></div>'}
        ${data.pages > 1 ? `<nav class="pager" aria-label="Pages">
          ${page > 1 ? `<a class="btn secondary" href="${link(page - 1)}">Previous</a>` : '<span></span>'}
          <span class="muted">Page ${page} of ${data.pages}</span>
          ${page < data.pages ? `<a class="btn secondary" href="${link(page + 1)}">Next</a>` : '<span></span>'}
        </nav>` : ''}`}
    </div>`;
    const form = document.getElementById('search-page');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const next = form.q.value.trim();
      if (next) location.hash = `#/search?q=${encodeURIComponent(next)}`;
    });
    if (!q && window.matchMedia('(max-width: 760px)').matches) form.q.focus();
  }

  async function title(_params, id) {
    const [{ title: t, viewer }, reviews] = await Promise.all([Api.title(id), Api.reviews(id)]);
    let inList = viewer?.inWatchlist || false;
    let rating = viewer?.myReview?.rating || 0;
    const resume = viewer?.progress && !viewer.progress.completed && viewer.progress.positionSeconds > 5;

    view().innerHTML = `
      <section class="detail-head">
        ${UI.backdrop(t)}
        <div class="page detail-inner">
          <div class="detail-poster">${UI.poster(t)}</div>
          <div class="detail-info">
            <p class="eyebrow">${esc(UI.kind(t))} · ${esc(t.genres.join(' · '))}</p>
            <h1 class="detail-title">${esc(t.name)}</h1>
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
    const paintList = () => { listBtn.innerHTML = inList ? `${icon.check}In My List` : `${icon.plus}My List`; };
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
        UI.toast(inList ? 'Added to My List' : 'Removed from My List');
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
        : '<div class="state"><h2>Your list is empty</h2><p>Use My List on any title to save it here.</p><a class="btn secondary" href="#/browse">Browse titles</a></div>'}
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
    if (Api.session.user.role !== 'admin') { view().innerHTML = '<div class="page"><div class="state"><h2>Admins only</h2><p>This area is for catalog administrators.</p></div></div>'; return; }
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
