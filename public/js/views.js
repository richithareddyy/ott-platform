/* Page views. Each view renders into #view and may return a cleanup function. */
const Views = (() => {
  const { esc, icon } = UI;
  const view = () => document.getElementById('view');
  const requireLogin = () => {
    if (Api.session) return true;
    location.hash = `#/login?next=${encodeURIComponent(location.hash.slice(1))}`;
    return false;
  };

  // Signed-out visitors are moved into the shared guest account instead of
  // hitting a sign-in wall, so Play and My List just work.
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

  const pageHead = (title, sub = '') => `<header class="page-head"><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</header>`;

  /* ------------------------------ Home ------------------------------ */
  async function home() {
    const [{ featured, rows }, cont, popular, top] = await Promise.all([
      Api.rows(),
      Api.session ? Api.continueWatching().catch(() => ({ items: [] })) : { items: [] },
      Api.listTitles({ sort: 'popular', limit: 16 }),
      Api.listTitles({ sort: 'top', limit: 16 }),
    ]);
    const hero = featured[0];
    view().innerHTML = `
      ${!Api.session ? `<div class="visitor-bar"><div class="page">
        <span>StreamBox is a portfolio project by ${esc(SITE.author)}.</span>
        <button class="link-btn" data-start-demo>Explore as a guest</button>
        <span class="muted">No account needed</span>
        <a class="muted push" href="${esc(SITE.github)}" target="_blank" rel="noopener">Source on GitHub</a>
      </div></div>` : ''}
      ${hero ? `<section class="hero">
        ${UI.backdrop(hero)}
        <div class="page hero-body">
          <p class="kicker">Featured ${UI.kind(hero).toLowerCase()}</p>
          <h1 class="display">${esc(hero.name)}</h1>
          <p class="facts">${UI.facts(hero)}<span class="dot">·</span>${esc(hero.genres.join(', '))}${hero.ratingCount ? `<span class="dot">·</span>${UI.rating(hero)}` : ''}</p>
          <p class="synopsis">${esc(hero.synopsis)}</p>
          <div class="actions">
            <a class="btn primary" href="#/watch/${esc(hero._id)}">${icon.play}Play</a>
            <a class="btn secondary" href="#/title/${esc(hero._id)}">${icon.info}More info</a>
          </div>
        </div>
      </section>` : ''}
      <div class="page rows">
        ${UI.row('Continue watching', cont.items, { progress: true })}
        ${UI.row('Most watched', popular.items, { href: '#/browse?sort=popular' })}
        ${UI.row('Highest rated', top.items, { href: '#/browse?sort=top' })}
        ${rows.map((r) => UI.row(r.genre, r.titles, { href: `#/browse?genre=${encodeURIComponent(r.genre)}` })).join('')}
        ${!featured.length && !rows.length ? '<div class="state"><h2>No titles yet</h2><p>Run <code>npm run seed</code> to load the sample catalog.</p></div>' : ''}
      </div>`;
    view().querySelector('[data-start-demo]')?.addEventListener('click', (e) => startDemo(e.currentTarget));
  }

  /* ----------------------------- Browse ----------------------------- */
  async function browse(params) {
    const { genres } = await Api.genres();
    const state = { genre: params.get('genre') || '', type: params.get('type') || '', sort: params.get('sort') || 'popular' };
    const opt = (v, label, cur) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(label)}</option>`;
    view().innerHTML = `<div class="page">
      ${pageHead(state.genre ? esc(state.genre) : 'Browse')}
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

  /* ----------------------------- Search ----------------------------- */
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

  /* -------------------------- Title detail -------------------------- */
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
            <p class="kicker">${UI.kind(t)}</p>
            <h1 class="display">${esc(t.name)}</h1>
            <p class="facts">${UI.facts(t)}${t.ratingCount ? `<span class="dot">·</span>${UI.rating(t)}<span class="muted-count">(${t.ratingCount})</span>` : ''}</p>
            <div class="actions">
              <a class="btn primary" href="#/watch/${esc(t._id)}">${icon.play}${resume ? 'Resume' : 'Play'}</a>
              <button class="btn secondary" id="list-btn"></button>
            </div>
            <p class="synopsis">${esc(t.synopsis)}</p>
            <dl class="credits">
              ${t.cast.length ? `<div><dt>Starring</dt><dd>${esc(t.cast.join(', '))}</dd></div>` : ''}
              <div><dt>Genres</dt><dd>${t.genres.map((g) => `<a href="#/browse?genre=${encodeURIComponent(g)}">${esc(g)}</a>`).join(', ')}</dd></div>
              <div><dt>Views</dt><dd>${t.viewCount.toLocaleString()}</dd></div>
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

  /* ----------------------------- Player ----------------------------- */
  async function watch(_params, id) {
    if (!(await ensureSession())) return;
    const [{ title: t }, play] = await Promise.all([Api.title(id), Api.play(id)]);
    view().innerHTML = `<div class="page player-page">
      <a class="back" href="#/title/${esc(t._id)}">${icon.chevL}${esc(t.name)}</a>
      <div class="player">
        ${play.streamUrl
          ? `<video id="player" controls autoplay playsinline preload="metadata" src="${esc(play.streamUrl)}"></video>`
          : `${UI.backdrop(t)}<div class="player-empty"><p class="label">Video unavailable</p>
              <p>This demo title has no video file. Add an MP4 to <code>media/</code> and assign it in Admin to enable playback.</p></div>`}
      </div>
      <div class="player-info">
        <h1>${esc(t.name)}</h1>
        <p class="facts">${UI.facts(t)}</p>
        <p class="synopsis">${esc(t.synopsis)}</p>
      </div>
    </div>`;

    const video = document.getElementById('player');
    if (!video) return;

    let lastSent = 0;
    const send = (force = false) => {
      if (!video.duration || Number.isNaN(video.duration)) return;
      const now = Date.now();
      if (!force && now - lastSent < 10000) return;
      lastSent = now;
      Api.saveProgress(id, Math.floor(video.currentTime), Math.floor(video.duration)).catch(() => {});
    };
    video.addEventListener('loadedmetadata', () => {
      if (play.resumeAt > 0 && play.resumeAt < video.duration - 5) video.currentTime = play.resumeAt;
    }, { once: true });
    video.addEventListener('error', () => UI.toast('This video could not be loaded.', true));
    video.addEventListener('timeupdate', () => send());
    video.addEventListener('pause', () => send(true));
    video.addEventListener('ended', () => send(true));
    return () => { send(true); video.pause(); video.removeAttribute('src'); video.load(); };
  }

  /* ----------------------------- My List ---------------------------- */
  async function myList() {
    if (!(await ensureSession())) return;
    const { items } = await Api.watchlist();
    view().innerHTML = `<div class="page">
      ${pageHead('My List', items.length ? `${items.length} title${items.length === 1 ? '' : 's'}` : '')}
      ${Api.isGuest ? guestNote('keep a list that’s only yours') : ''}
      ${items.length ? `<div class="grid">${items.map((t) => UI.card(t)).join('')}</div>`
        : '<div class="state"><h2>Your list is empty</h2><p>Use My List on any title to save it here.</p><a class="btn secondary" href="#/browse">Browse titles</a></div>'}
    </div>`;
  }

  /* ------------------------------ Auth ------------------------------ */
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
        ? `New to StreamBox? <a class="text-link" href="#/register?next=${encodeURIComponent(next)}">Create an account</a>`
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

  /* ------------------------------ Admin ----------------------------- */
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

  const notFound = () => { view().innerHTML = '<div class="page"><div class="state"><h2>Page not found</h2><p>The page you’re looking for doesn’t exist.</p><a class="btn secondary" href="#/">Back to home</a></div></div>'; };

  return { home, browse, search, title, watch, myList, login: (p) => authForm(p, 'login'), register: (p) => authForm(p, 'register'), admin, notFound };
})();
