const TOKEN_KEY = 'auth_token';

// export function getAuthToken(): string | null {
//   if (typeof window === 'undefined') return null;
//   return localStorage.getItem(TOKEN_KEY);
// }

// export function setAuthToken(token: string) {
//   if (typeof window === 'undefined') return;
//   localStorage.setItem(TOKEN_KEY, token);
// }

// export function clearAuthToken() {
//   if (typeof window === 'undefined') return;
//   localStorage.removeItem(TOKEN_KEY);
// }

/**
 * Обёртка над fetch.
 * Cookie `session_id` прикладывается автоматически благодаря `credentials: 'include'`.
 * Никакого localStorage — токен живёт в HttpOnly cookie.
 */
export async function apiFetch(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);

  // Content-Type — только если есть body и не FormData
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(input, {
    ...init,
    credentials: 'include',
    headers,
  });
}