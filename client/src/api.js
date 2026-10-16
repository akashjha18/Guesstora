export const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const getToken = () => localStorage.getItem('perkbyte_token') || localStorage.getItem('gusstora_token') || '';
export const getRefreshToken = () => localStorage.getItem('perkbyte_refresh_token') || localStorage.getItem('gusstora_refresh_token') || '';

export const setAuthSession = ({ accessToken, refreshToken, token }) => {
  const at = accessToken || token;
  if (at) {
    localStorage.setItem('perkbyte_token', at);
    localStorage.setItem('gusstora_token', at);
  }
  if (refreshToken) {
    localStorage.setItem('perkbyte_refresh_token', refreshToken);
    localStorage.setItem('gusstora_refresh_token', refreshToken);
  }
};

export const clearAuthSession = () => {
  localStorage.removeItem('perkbyte_token');
  localStorage.removeItem('gusstora_token');
  localStorage.removeItem('perkbyte_refresh_token');
  localStorage.removeItem('gusstora_refresh_token');
  localStorage.removeItem('gusstora_user');
};

let refreshPromise = null;

export async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearAuthSession();
    throw new Error('No refresh token available');
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        clearAuthSession();
        window.dispatchEvent(new CustomEvent('auth:session_expired', { detail: data }));
        throw new Error(data.message || 'Session expired. Please sign in again.');
      }

      setAuthSession({
        accessToken: data.accessToken || data.token,
        refreshToken: data.refreshToken,
      });

      return data.accessToken || data.token;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function api(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  let response = await fetch(`${BASE}${path}`, { ...options, headers });

  // Transparent auto-refresh on 401 (except for auth routes like login/register/refresh)
  if (response.status === 401 && !path.startsWith('/auth/')) {
    try {
      const newAccessToken = await refreshAccessToken();
      const retryHeaders = {
        ...headers,
        Authorization: `Bearer ${newAccessToken}`,
      };
      response = await fetch(`${BASE}${path}`, { ...options, headers: retryHeaders });
    } catch (refreshErr) {
      console.warn('Auto token refresh failed:', refreshErr.message);
    }
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}

export async function logoutUser() {
  const refreshToken = getRefreshToken();
  const token = getToken();
  try {
    await fetch(`${BASE}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ refreshToken }),
    });
  } catch (e) {
    console.warn('Logout request error:', e);
  } finally {
    clearAuthSession();
  }
}
