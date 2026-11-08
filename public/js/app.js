// Hash router plus the bits of the shell that live outside #view.
const App = (() => {
  // Opening slate: removed once its fade finishes, or right away on click or key press.
  const intro = document.getElementById('intro');
  if (intro) {
    const dismiss = () => intro.remove();
    intro.addEventListener('animationend', (e) => { if (e.animationName === 'intro-out') dismiss(); });
    intro.addEventListener('click', dismiss);
    addEventListener('keydown', dismiss, { once: true });
    setTimeout(dismiss, 3000);
  }

  // [pattern, view, nav item to highlight, page title]
  const routes = [
    [/^\/$/, Views.home, 'home', null],
    [/^\/browse$/, Views.browse, 'browse', 'Browse'],
    [/^\/search$/, Views.search, 'search', 'Search'],
    [/^\/title\/([a-f0-9]{24})$/, Views.title, null, null],
    [/^\/watch\/([a-f0-9]{24})$/, Views.watch, null, null],
    [/^\/my-list$/, Views.myList, 'my-list', 'My List'],
    [/^\/login$/, Views.login, null, 'Sign in'],
    [/^\/register$/, Views.register, null, 'Create account'],
    [/^\/admin$/, Views.admin, null, 'Catalog admin'],
    [/^\/account$/, Views.account, null, 'Account'],
    [/^\/terms$/, Views.terms, null, 'Terms of use'],
    [/^\/privacy$/, Views.privacy, null, 'Privacy policy'],
    [/^\/credits$/, Views.credits, null, 'Credits'],
    [/^\/copyright$/, Views.copyright, null, 'Copyright'],
  ];

  // Views with their own heading (titles, the player) call setTitle once data arrives.
  function setTitle(label) {
    document.title = label ? `${label} · Kinoloft` : 'Kinoloft · Open films, streamed';
    document.getElementById('route-status').textContent = label || 'Home';
  }

  let cleanup = null;
  let renderId = 0;

  async function render() {
    const id = ++renderId;
    const [path, query = ''] = (location.hash.slice(1) || '/').split('?');
    const params = new URLSearchParams(query);
    const match = routes.find(([re]) => re.test(path));
    const [re, fn, navKey, label] = match || [null, Views.notFound, null, 'Page not found'];
    setTitle(label);

    if (typeof cleanup === 'function') cleanup();
    cleanup = null;
    document.querySelectorAll('[data-nav]').forEach((a) => {
      const on = a.dataset.nav === navKey;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });

    const el = document.getElementById('view');
    el.innerHTML = UI.loading();
    window.scrollTo(0, 0);
    try {
      const result = await fn(params, ...(re ? path.match(re).slice(1) : []));
      if (id === renderId) cleanup = result || null;
      else if (typeof result === 'function') result(); // navigated away mid-load
    } catch (err) {
      if (id === renderId) el.innerHTML = `<div class="page">${UI.errorBlock(err)}</div>`;
    }
    if (id === renderId) {
      updateRowNav();
      watchReveals();
    }
    if (id === renderId) (el.querySelector('[data-autofocus]') || el).focus({ preventScroll: true });
  }

  function paintAccount() {
    const s = Api.session;
    document.body.classList.toggle('signed-in', Boolean(s));
    document.body.classList.toggle('is-admin', s?.user.role === 'admin');
    const account = document.getElementById('account');
    if (!s) {
      account.innerHTML = '<a class="btn text small" href="#/login">Sign in</a><button class="btn primary small" id="demo-btn">Try the demo</button>';
    } else if (Api.isGuest) {
      account.innerHTML = '<a class="who" href="#/account" title="Shared demo account">Guest</a>'
        + '<a class="btn text small accent" href="#/register">Sign up</a>'
        + '<button class="btn text small" id="logout">Exit</button>';
    } else {
      account.innerHTML = `<a class="who" href="#/account" title="Account">${UI.esc(s.user.name)}</a><button class="btn text small" id="logout">Sign out</button>`;
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

  // Sections fade up once as they scroll into view.
  const revealer = 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches
    ? new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      revealer.unobserve(e.target);
    }), { rootMargin: '0px 0px -6% 0px' })
    : null;
  function watchReveals() {
    document.querySelectorAll('.reveal:not(.in)').forEach((el) => (revealer ? revealer.observe(el) : el.classList.add('in')));
  }

  // Row arrows are hidden at either end of a row.
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

  // "/" opens search from anywhere, unless the visitor is already typing.
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest('input, textarea, select, [contenteditable]')) return;
    e.preventDefault();
    const input = document.querySelector('#search-page input');
    if (input) input.focus(); else location.hash = '#/search';
  });
  window.addEventListener('hashchange', render);
  window.addEventListener('session-change', paintAccount);


  paintAccount();
  render();
  return { render, setTitle };
})();
