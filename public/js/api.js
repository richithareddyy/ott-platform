/* Thin client for the REST API. Stores the session token in localStorage. */
const Api = (() => {
  const KEY = 'streambox.session';

  function readSession() {
    try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
  }
  let session = readSession();

  function setSession(next) {
    session = next;
    try {
      if (next) localStorage.setItem(KEY, JSON.stringify(next));
      else localStorage.removeItem(KEY);
    } catch { /* storage unavailable: session lasts for this page only */ }
    window.dispatchEvent(new CustomEvent('session-change'));
  }

  class ApiError extends Error {
    constructor(status, message, details) {
      super(message);
      this.status = status;
      this.details = details;
    }
  }

  async function request(method, path, body) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (session?.token) headers.Authorization = `Bearer ${session.token}`;
    const res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 && session) setSession(null);
      throw new ApiError(res.status, data.error?.message || `Request failed (${res.status})`, data.error?.details);
    }
    return data;
  }

  const qs = (params) => {
    const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null));
    return s.toString() ? `?${s}` : '';
  };

  return {
    ApiError,
    get session() { return session; },
    get isGuest() { return session?.user.role === 'demo'; },
    async demo() { setSession(await request('POST', '/auth/demo')); },
    async login(email, password) { setSession(await request('POST', '/auth/login', { email, password })); },
    async register(name, email, password) { setSession(await request('POST', '/auth/register', { name, email, password })); },
    logout() { setSession(null); },

    genres: () => request('GET', '/titles/genres'),
    rows: () => request('GET', '/titles/rows'),
    listTitles: (params) => request('GET', `/titles${qs(params)}`),
    search: (q, page = 1) => request('GET', `/titles/search${qs({ q, page })}`),
    title: (id) => request('GET', `/titles/${id}`),
    play: (id) => request('POST', `/titles/${id}/play`),
    reviews: (id, before) => request('GET', `/titles/${id}/reviews${qs({ before })}`),
    saveReview: (id, rating, body) => request('PUT', `/titles/${id}/reviews/mine`, { rating, body }),
    deleteReview: (id) => request('DELETE', `/titles/${id}/reviews/mine`),

    watchlist: () => request('GET', '/me/watchlist'),
    addToWatchlist: (id) => request('PUT', `/me/watchlist/${id}`),
    removeFromWatchlist: (id) => request('DELETE', `/me/watchlist/${id}`),
    continueWatching: () => request('GET', '/me/continue-watching'),
    saveProgress: (id, positionSeconds, durationSeconds) =>
      request('PUT', `/me/progress/${id}`, { positionSeconds, durationSeconds, reportedAt: Date.now() }),

    createTitle: (data) => request('POST', '/titles', data),
    updateTitle: (id, data) => request('PATCH', `/titles/${id}`, data),
    deleteTitle: (id) => request('DELETE', `/titles/${id}`),
  };
})();
