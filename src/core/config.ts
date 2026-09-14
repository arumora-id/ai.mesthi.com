// Public configuration only. Credentials belong to the authentication gateway.
export function apiBase(value = import.meta.env.VITE_API_BASE_URL || '/api'): string {
  if (!/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(value))
    throw new Error('The API gateway must be an absolute same-origin path, such as /api.')
  return value
}
export const signInUrl = '/oauth2/start?rd=%2F'
export const signOutUrl = '/oauth2/sign_out?rd=%2F'
