/* Hash router and app shell. */
const App = (() => {
  const routes = [
    [/^\/$/, Views.home, 'home'],
    [/^\/browse$/, Views.browse, 'browse'],
    [/^\/search$/, Views.search, 'search'],
    [/^\/title\/([a-f0-9]{24})$/, Views.title, null],
    [/^\/watch\/([a-f0-9]{24})$/, Views.watch, null],
    [/^\/my-list$/, Views.myList, 'my-list'],
    [/^\/login$/, Views.login, null],
    [/^\/register$/, Views.register, null],
    [/^\/admin$/, Views.admin, 'admin'],
  ];

  let cleanup = null;
  let renderId = 0;

  async function render() {
    const id = ++renderId;
    const [path, query = ''] = (location.hash.slice(1) || '/').split('?');
    const params = new URLSearchParams(query);
    const match = routes.find(([re]) => re.test(path));
    const [re, fn, navKey] = match || [null, Views.notFound, null];

    if (typeof cleanup === 'function') cleanup();
    cleanup = null;
    document.querySelectorAll('[data-nav]').forEach((a) => {
      const on = a.dataset.nav === navKey;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.body.dataset.route = navKey || path.split('/')[1] || 'home';

    const el = document.getElementById('view');
    el.innerHTML = UI.spinner();
    window.scrollTo(0, 0);
    try {
      const result = await fn(params, ...(re ? path.match(re).slice(1) : []));
      if (id === renderId) cleanup = result || null;
      else if (typeof result === 'function') result(); // navigated away mid-load
    } catch (err) {
      if (id === renderId) el.innerHTML = `<div class="page">${UI.errorBlock(err)}</div>`;
    }
    if (id === renderId) updateRowNav();
    el.focus({ preventScroll: true });
  }

  function paintAccount() {
    const s = Api.session;
    document.body.classList.toggle('signed-in', Boolean(s));
    document.body.classList.toggle('is-admin', s?.user.role === 'admin');
    const account = document.getElementById('account');
    if (!s) {
      account.innerHTML = '<a class="btn text small" href="#/login">Sign in</a><button class="btn primary small" id="demo-btn">Try demo</button>';
    } else if (Api.isGuest) {
      account.innerHTML = '<span class="who" title="Shared demo account">Guest</span>'
        + '<a class="btn text small accent" href="#/register">Sign up</a>'
        + '<button class="btn text small" id="logout">Exit</button>';
    } else {
      account.innerHTML = `<span class="who">${UI.esc(s.user.name)}</span><button class="btn text small" id="logout">Sign out</button>`;
    }
    document.getElementById('logout')?.addEventListener('click', () => { Api.logout(); location.hash = '#/'; });
    document.getElementById('demo-btn')?.addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;
      try {
        await Api.demo();
        UI.toast('You’re browsing as a guest.');
        render();
      } catch (err) { UI.toast(err.message, true); paintAccount(); }
    });
  }

  /* Row arrows: page through a row; hidden at either end. */
  function updateRowNav(track) {
    const tracks = track ? [track] : document.querySelectorAll('.row-track');
    tracks.forEach((t) => {
      const vp = t.parentElement;
      vp.classList.toggle('at-start', t.scrollLeft <= 4);
      vp.classList.toggle('at-end', t.scrollLeft + t.clientWidth >= t.scrollWidth - 4);
    });
  }
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-scroll]');
    if (!btn) return;
    const track = btn.parentElement.querySelector('.row-track');
    track.scrollBy({ left: Number(btn.dataset.scroll) * track.clientWidth * 0.9, behavior: 'smooth' });
  });
  document.addEventListener('scroll', (e) => {
    if (e.target.classList?.contains('row-track')) updateRowNav(e.target);
  }, true);
  window.addEventListener('resize', () => updateRowNav());

  window.addEventListener('scroll', () => {
    document.body.classList.toggle('scrolled', window.scrollY > 8);
  }, { passive: true });

  document.getElementById('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = document.getElementById('search-input').value.trim();
    if (q) location.hash = `#/search?q=${encodeURIComponent(q)}`;
  });
  window.addEventListener('hashchange', render);
  window.addEventListener('session-change', paintAccount);

  document.getElementById('footer-author').textContent = SITE.author;
  document.getElementById('footer-source').href = SITE.github;

  paintAccount();
  render();
  return { render };
})();
