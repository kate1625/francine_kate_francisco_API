const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const SESSION_KEY = 'stockroom.session';
let refreshInFlight = null;

export function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

export function writeSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

async function send(path, options = {}, retried = false) {
  const session = readSession();
  const isPublicAuthRequest = ['/auth/login', '/auth/register', '/auth/refresh'].includes(path);
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (session?.accessToken) {
    headers.set('Authorization', `Bearer ${session.accessToken}`);
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (response.status === 401 && session?.refreshToken && !retried && !isPublicAuthRequest) {
    if (!refreshInFlight) {
      refreshInFlight = fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: session.refreshToken }),
      })
        .then(async (refreshResponse) => {
          const refreshData = await refreshResponse.json().catch(() => ({}));
          if (!refreshResponse.ok || !refreshData.tokens?.access_token) return false;
          writeSession({
            ...session,
            accessToken: refreshData.tokens.access_token,
            refreshToken: refreshData.tokens.refresh_token || session.refreshToken,
          });
          return true;
        })
        .finally(() => {
          refreshInFlight = null;
        });
    }

    if (await refreshInFlight) {
      return send(path, options, true);
    }
    clearSession();
    window.dispatchEvent(new Event('session-expired'));
  }

  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed (${response.status})`);
  }
  return data;
}

export const api = {
  request: send,
  register: (details) => send('/auth/register', {
    method: 'POST',
    body: JSON.stringify(details),
  }),
  login: (credentials) => send('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  }),
  logout: (refreshToken) => send('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  }),
  products: () => send('/products'),
  createProduct: (product) => send('/products', {
    method: 'POST',
    body: JSON.stringify(product),
  }),
  updateProduct: (id, product) => send(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(product),
  }),
  deleteProduct: (id) => send(`/products/${id}`, { method: 'DELETE' }),
};
