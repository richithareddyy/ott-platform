/* Page views. Each view renders into #view and may return a cleanup function. */
const Views = (() => {
  const { esc } = UI;
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
      UI.toast('You’re exploring as a guest. Create an account anytime to keep your own list.');
      return true;
    } catch {
      return requireLogin();
    }
  }

  const guestNote = (what) =>
    `<p class="guest-note">Guests can browse, play, and use My List. <a href="#/register?next=${encodeURIComponent(location.hash.slice(1))}">Create a free account</a> to ${what}.</p>`;

  /* ------------------------------ Home ------------------------------ */
  async function home() {
    const [{ featured, rows }, cont] = await Promise.all([
      Api.rows(),
      Api.session ? Api.continueWatching().catch(() => ({ items: [] })) : { items: [] },
    ]);
    const hero = featured[0];
    view().innerHTML = `
      ${hero ? `<section class="hero" style="--h:${Number(hero.posterHue) || 210}">
        <div>
          <div class="eyebrow">Featured</div>
          <h1>${esc(hero.name)}</h1>
          <p>${esc(hero.synopsis)}</p>
          <div class="muted">${esc(hero.releaseYear)} · ${esc(hero.maturityRating)} · ${esc(hero.genres.join(', '))}</div>
          <div class="actions">
            <a class="btn primary" href="#/watch/${esc(hero._id)}">▶ Play</a>
            <a class="btn" href="#/title/${esc(hero._id)}">More info</a>
          </div>
        </div>
        ${UI.poster(hero)}
      </section>` : ''}
      ${UI.row('Continue watching', cont.items, { progress: true })}
      ${UI.row('Featured', featured)}
      ${rows.map((r) => UI.row(r.genre, r.titles, { href: `#/browse?genre=${encodeURIComponent(r.genre)}` })).join('')}
      ${!featured.length && !rows.length ? '<div class="center"><h2>No titles yet</h2><p class="muted">Run <code>npm run seed</code> to load the sample catalog.</p></div>' : ''}
    `;
  }

  /* ----------------------------- Browse ----------------------------- */
  async function browse(params) {
    const { genres } = await Api.genres();
    const state = { genre: params.get('genre') || '', type: params.get('type') || '', sort: params.get('sort') || 'popular' };
    const opt = (v, label, cur) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(label)}</option>`;
    view().innerHTML = `
      <h1>Browse</h1>
      <form class="toolbar" id="filters">
        <div class="field"><label for="f-genre">Genre</label>
          <select id="f-genre" name="genre">${opt('', 'All genres', state.genre)}${genres.map((g) => opt(g, g, state.genre)).join('')}</select></div>
        <div class="field"><label for="f-type">Type</label>
          <select id="f-type" name="type">${opt('', 'Movies & series', state.type)}${opt('movie', 'Movies', state.type)}${opt('series', 'Series', state.type)}</select></div>
        <div class="field"><label for="f-sort">Sort by</label>
          <select id="f-sort" name="sort">${opt('popular', 'Most popular', state.sort)}${opt('newest', 'Newest', state.sort)}${opt('top', 'Top rated', state.sort)}</select></div>
      </form>
      <div class="grid" id="results"></div>
      <div class="center" id="more-wrap"></div>`;

    document.getElementById('filters').addEventListener('change', (e) => {
      const data = new URLSearchParams([...new FormData(e.currentTarget)].filter(([, v]) => v));
      location.hash = `#/browse${data.toString() ? `?${data}` : ''}`;
    });

    const results = document.getElementById('results');
    const moreWrap = document.getElementById('more-wrap');
    let cursor = null;
    async function loadPage() {
      moreWrap.innerHTML = UI.spinner();
      const page = await Api.listTitles({ ...state, cursor, limit: 24 });
      results.insertAdjacentHTML('beforeend', page.items.map((t) => UI.card(t)).join(''));
      cursor = page.nextCursor;
      if (!results.children.length) moreWrap.innerHTML = '<p class="empty">No titles match these filters.</p>';
      else moreWrap.innerHTML = cursor ? '<button class="btn" id="more">Load more</button>' : '';
      document.getElementById('more')?.addEventListener('click', () => loadPage().catch((e) => UI.toast(e.message, true)));
    }
    await loadPage();
  }

  /* ----------------------------- Search ----------------------------- */
  async function search(params) {
    const q = (params.get('q') || '').trim();
    document.getElementById('search-input').value = q;
    if (!q) { view().innerHTML = '<div class="center"><h2>Search the catalog</h2><p class="muted">Try a title, genre word, or cast name.</p></div>'; return; }
    const page = Number(params.get('page')) || 1;
    const data = await Api.search(q, page);
    const link = (p) => `#/search?q=${encodeURIComponent(q)}&page=${p}`;
    view().innerHTML = `
      <h1>Results for “${esc(q)}”</h1>
      <p class="muted">${data.total} title${data.total === 1 ? '' : 's'} found</p>
      ${data.items.length ? `<div class="grid">${data.items.map((t) => UI.card(t)).join('')}</div>` : '<p class="empty">No matches. Check the spelling or try a different word.</p>'}
      ${data.pages > 1 ? `<div class="center">
        ${page > 1 ? `<a class="btn" href="${link(page - 1)}">← Previous</a>` : ''}
        <span class="muted">&nbsp;Page ${page} of ${data.pages}&nbsp;</span>
        ${page < data.pages ? `<a class="btn" href="${link(page + 1)}">Next →</a>` : ''}
      </div>` : ''}`;
  }

  /* -------------------------- Title detail -------------------------- */
  async function title(_params, id) {
    const [{ title: t, viewer }, reviews] = await Promise.all([Api.title(id), Api.reviews(id)]);
    let inList = viewer?.inWatchlist || false;
    let rating = viewer?.myReview?.rating || 0;
    const resume = viewer?.progress && !viewer.progress.completed && viewer.progress.positionSeconds > 5;

    view().innerHTML = `
      <div class="detail">
        ${UI.poster(t)}
        <div>
          <div class="eyebrow">${t.type === 'series' ? 'Series' : 'Movie'}</div>
          <h1>${esc(t.name)}</h1>
          <div class="facts">
            <span>${esc(t.releaseYear)}</span><span>${esc(t.maturityRating)}</span>
            <span>${esc(UI.fmtDuration(t.durationMinutes))}${t.type === 'series' ? ' per episode' : ''}</span>
            <span>${t.ratingCount ? `<span class="stars">★</span> ${t.ratingAvg.toFixed(1)} (${t.ratingCount})` : 'No ratings yet'}</span>
            <span>${t.viewCount.toLocaleString()} views</span>
          </div>
          <div>${t.genres.map((g) => `<a class="chip" href="#/browse?genre=${encodeURIComponent(g)}">${esc(g)}</a>`).join('')}</div>
          <p>${esc(t.synopsis)}</p>
          ${t.cast.length ? `<p class="muted">Starring: ${esc(t.cast.join(', '))}</p>` : ''}
          <div class="actions">
            <a class="btn primary" href="#/watch/${esc(t._id)}">▶ ${resume ? 'Resume' : 'Play'}</a>
            <button class="btn" id="list-btn"></button>
          </div>

          <section class="reviews">
            <h2>Reviews</h2>
            ${Api.isGuest ? guestNote('rate and review titles') : Api.session ? `<form class="review" id="review-form">
              <strong>${viewer?.myReview ? 'Your review' : 'Rate this title'}</strong>
              <div class="star-input" id="star-input">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-n="${n}" aria-label="${n} star${n > 1 ? 's' : ''}">★</button>`).join('')}</div>
              <div class="field"><textarea name="body" maxlength="2000" placeholder="What did you think? (optional)">${esc(viewer?.myReview?.body || '')}</textarea></div>
              <p class="error-text"></p>
              <div class="actions" style="margin:0">
                <button class="btn primary small">Save review</button>
                ${viewer?.myReview ? '<button type="button" class="btn small danger" id="delete-review">Delete</button>' : ''}
              </div>
            </form>` : `<p class="muted"><a href="#/login?next=${encodeURIComponent(`/title/${t._id}`)}"><u>Sign in</u></a> to rate and review.</p>`}
            <div id="review-list"></div>
            <div id="review-more"></div>
          </section>
        </div>
      </div>`;

    const listBtn = document.getElementById('list-btn');
    const paintList = () => { listBtn.textContent = inList ? '✓ In My List' : '+ My List'; };
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
          <header><strong>${esc(r.userName)}</strong><span class="stars" aria-label="${r.rating} out of 5">${UI.stars(r.rating)}</span></header>
          ${r.body ? `<p style="margin:0">${esc(r.body)}</p>` : ''}
          <small class="muted">${new Date(r.createdAt).toLocaleDateString()}</small>
        </article>`).join(''));
      if (!reviewList.children.length) reviewList.innerHTML = '<p class="empty">No reviews yet.</p>';
      reviewMore.innerHTML = page.nextCursor ? '<button class="btn small">More reviews</button>' : '';
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
    view().innerHTML = `
      <div class="player-wrap">
        <p><a class="muted" href="#/title/${esc(t._id)}">← Back to details</a></p>
        ${play.streamUrl
          ? `<video id="player" controls autoplay playsinline preload="metadata" src="${esc(play.streamUrl)}"></video>`
          : `<div class="player-empty"><div><h2>No video file for this title</h2>
              <p class="muted">Place an MP4 in the <code>media/</code> folder and set it as this title's video file in Admin.</p></div></div>`}
        <h1 style="margin-top:16px">${esc(t.name)}</h1>
        <p class="muted">${esc(t.synopsis)}</p>
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
    view().innerHTML = `
      <h1>My List</h1>
      ${Api.isGuest ? guestNote('keep a list that’s only yours') : ''}
      ${items.length ? `<div class="grid">${items.map((t) => UI.card(t)).join('')}</div>`
        : '<p class="empty">Your list is empty. Use “+ My List” on any title to save it here.</p>'}`;
  }

  /* ------------------------------ Auth ------------------------------ */
  function authForm(params, mode) {
    const next = params.get('next') || '/';
    const isLogin = mode === 'login';
    view().innerHTML = `
      <div class="auth-card">
        <h1>${isLogin ? 'Sign in' : 'Create account'}</h1>
        <form class="form" id="auth-form" novalidate>
          ${isLogin ? '' : '<div class="field"><label for="a-name">Name</label><input id="a-name" name="name" autocomplete="name" required maxlength="60" /></div>'}
          <div class="field"><label for="a-email">Email</label><input id="a-email" name="email" type="email" autocomplete="email" required /></div>
          <div class="field"><label for="a-pass">Password</label><input id="a-pass" name="password" type="password" autocomplete="${isLogin ? 'current-password' : 'new-password'}" required minlength="8" /></div>
          <p class="error-text"></p>
          <button class="btn primary">${isLogin ? 'Sign in' : 'Create account'}</button>
          <p class="muted">${isLogin
            ? `New here? <a href="#/register?next=${encodeURIComponent(next)}"><u>Create an account</u></a>`
            : `Already have an account? <a href="#/login?next=${encodeURIComponent(next)}"><u>Sign in</u></a>`}</p>
        </form>
        ${Api.isGuest ? '' : `<div class="divider"><span>or</span></div>
        <button class="btn block" id="guest-btn">Continue as guest</button>
        <p class="muted small-print">No sign-up needed. Explore with a shared demo account.</p>`}
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
    if (Api.session.user.role !== 'admin') { view().innerHTML = '<div class="center"><h2>Admins only</h2></div>'; return; }
    const editId = params.get('edit');
    if (editId || params.has('new')) return adminForm(editId);

    const sort = params.get('sort') || 'newest';
    const { items, nextCursor } = await Api.listTitles({ sort, limit: 50 });
    view().innerHTML = `
      <div class="toolbar" style="justify-content:space-between">
        <h1 style="margin:0">Manage titles</h1>
        <a class="btn primary" href="#/admin?new=1">+ New title</a>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Name</th><th>Type</th><th>Year</th><th>Genres</th><th>Views</th><th>Rating</th><th></th></tr></thead>
        <tbody>${items.map((t) => `<tr>
          <td><a href="#/title/${esc(t._id)}">${esc(t.name)}</a></td><td>${esc(t.type)}</td><td>${esc(t.releaseYear)}</td>
          <td>${esc(t.genres.join(', '))}</td><td>${t.viewCount.toLocaleString()}</td><td>${esc(UI.fmtRating(t))}</td>
          <td><a class="btn small" href="#/admin?edit=${esc(t._id)}">Edit</a><button class="btn small danger" data-del="${esc(t._id)}" data-name="${esc(t.name)}">Delete</button></td>
        </tr>`).join('')}</tbody>
      </table></div>
      ${nextCursor ? '<p class="muted">Showing the 50 most recent releases. Use Search to find others.</p>' : ''}`;

    view().querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm(`Delete “${b.dataset.name}”? Reviews, watchlist entries and progress for it are removed too.`)) return;
      try { await Api.deleteTitle(b.dataset.del); UI.toast('Title deleted'); App.render(); } catch (e) { UI.toast(e.message, true); }
    }));
  }

  async function adminForm(editId) {
    const [{ genres, maturityRatings }, existing] = await Promise.all([Api.genres(), editId ? Api.title(editId) : null]);
    const t = existing?.title || { type: 'movie', genres: [], cast: [], posterHue: Math.floor(Math.random() * 360), featured: false };
    const sel = (name, values, cur) => `<select name="${name}" id="t-${name}" required>${values.map((v) => `<option ${v === cur ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
    view().innerHTML = `
      <p><a class="muted" href="#/admin">← All titles</a></p>
      <h1>${editId ? `Edit “${esc(t.name)}”` : 'New title'}</h1>
      <form class="form wide" id="title-form">
        <div class="field full"><label for="t-name">Name</label><input id="t-name" name="name" required maxlength="120" value="${esc(t.name)}" /></div>
        <div class="field"><label for="t-type">Type</label>${sel('type', ['movie', 'series'], t.type)}</div>
        <div class="field"><label for="t-maturityRating">Maturity rating</label>${sel('maturityRating', maturityRatings, t.maturityRating)}</div>
        <div class="field"><label for="t-releaseYear">Release year</label><input id="t-releaseYear" name="releaseYear" type="number" min="1900" max="2100" required value="${esc(t.releaseYear)}" /></div>
        <div class="field"><label for="t-durationMinutes">Duration (minutes)</label><input id="t-durationMinutes" name="durationMinutes" type="number" min="1" max="1000" required value="${esc(t.durationMinutes)}" /></div>
        <div class="field full"><label>Genres (1–4)</label><div>${genres.map((g) => `<label class="check" style="display:inline-flex;margin:0 14px 6px 0"><input type="checkbox" name="genres" value="${esc(g)}" ${t.genres.includes(g) ? 'checked' : ''} /> ${esc(g)}</label>`).join('')}</div></div>
        <div class="field full"><label for="t-synopsis">Synopsis</label><textarea id="t-synopsis" name="synopsis" required maxlength="1000">${esc(t.synopsis)}</textarea></div>
        <div class="field full"><label for="t-cast">Cast (comma-separated)</label><input id="t-cast" name="cast" value="${esc(t.cast.join(', '))}" /></div>
        <div class="field"><label for="t-videoFile">Video file in media/</label><input id="t-videoFile" name="videoFile" placeholder="example.mp4" value="${esc(t.videoFile)}" /></div>
        <div class="field"><label for="t-posterHue">Poster colour (0–359)</label><input id="t-posterHue" name="posterHue" type="number" min="0" max="359" value="${esc(t.posterHue)}" /></div>
        <label class="check full"><input type="checkbox" name="featured" ${t.featured ? 'checked' : ''} /> Featured on the home page</label>
        <p class="error-text full"></p>
        <div class="full"><button class="btn primary">${editId ? 'Save changes' : 'Create title'}</button></div>
      </form>`;

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

  const notFound = () => { view().innerHTML = '<div class="center"><h2>Page not found</h2><a class="btn" href="#/">Go home</a></div>'; };

  return { home, browse, search, title, watch, myList, login: (p) => authForm(p, 'login'), register: (p) => authForm(p, 'register'), admin, notFound };
})();
