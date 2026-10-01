/* Hash router and app shell. */
const App = (() => {
  const routes = [
    [/^\/$/, Views.home, 'home'],
    [/^\/browse$/, Views.browse, 'browse'],
    [/^\/search$/, Views.search, null],
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
    document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === navKey));

    const el = document.getElementById('view');
    el.innerHTML = UI.spinner();
    window.scrollTo(0, 0);
    try {
      const result = await fn(params, ...(re ? path.match(re).slice(1) : []));
      if (id === renderId) cleanup = result || null;
      else if (typeof result === 'function') result(); // navigated away mid-load
    } catch (err) {
      if (id === renderId) el.innerHTML = UI.errorBlock(err);
    }
    el.focus({ preventScroll: true });
  }

  function paintAccount() {
    const s = Api.session;
    document.body.classList.toggle('signed-in', Boolean(s));
    document.body.classList.toggle('is-admin', s?.user.role === 'admin');
    const account = document.getElementById('account');
    if (!s) {
      account.innerHTML = '<button class="btn small ghost" id="demo-btn">Try the demo</button><a class="btn small primary" href="#/login">Sign in</a>';
    } else if (Api.isGuest) {
      account.innerHTML = '<span class="guest-chip" title="Shared demo account">Guest</span>'
        + '<a class="btn small primary" href="#/register"><span class="long">Create account</span><span class="short">Sign up</span></a>'
        + '<button class="btn small ghost" id="logout">Exit</button>';
    } else {
      account.innerHTML = `<span class="who">${UI.esc(s.user.name)}</span><button class="btn small" id="logout">Sign out</button>`;
    }
    document.getElementById('logout')?.addEventListener('click', () => { Api.logout(); location.hash = '#/'; });
    document.getElementById('demo-btn')?.addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;
      try {
        await Api.demo();
        UI.toast('Welcome! You’re exploring StreamBox as a guest.');
        render();
      } catch (err) { UI.toast(err.message, true); paintAccount(); }
    });
  }

  document.getElementById('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = document.getElementById('search-input').value.trim();
    if (q) location.hash = `#/search?q=${encodeURIComponent(q)}`;
  });
  window.addEventListener('hashchange', render);
  window.addEventListener('session-change', paintAccount);

  paintAccount();
  render();
  return { render };
})();
