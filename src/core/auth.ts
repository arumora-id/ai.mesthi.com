export type AuthMode = 'session' | 'bearer'
export type AuthState = 'unknown' | 'authenticated' | 'unauthenticated'

export const authMode: AuthMode =
  import.meta.env.VITE_AUTH_MODE === 'bearer' ? 'bearer' : 'session'

let bearerToken = ''
let authState: AuthState = 'unknown'

export function setAccessToken(token: string) {
  bearerToken = token.trim()
  authState = bearerToken ? 'unknown' : 'unauthenticated'
}

export function getAccessToken() {
  return bearerToken
}

export function hasAccessToken() {
  return authMode === 'session' || Boolean(bearerToken)
}

export function getAuthState() {
  return authState
}

export function markAuthenticated() {
  authState = 'authenticated'
}

export function markUnauthenticated() {
  authState = 'unauthenticated'
  if (authMode === 'bearer') bearerToken = ''
}

function currentReturnUrl() {
  return location.href
}

function authBaseUrl() {
  return (import.meta.env.VITE_AUTH_BASE_URL || 'https://auth.mesthi.com').replace(/\/$/, '')
}

function buildAuthUrl(path: string, returnUrl?: string) {
  const url = new URL(path, authBaseUrl() + '/')
  if (returnUrl) url.searchParams.set('return_url', returnUrl)
  return url.toString()
}

export function beginLogin() {
  location.assign(buildAuthUrl('/login', currentReturnUrl()))
}

export function beginRegistration() {
  location.assign(buildAuthUrl('/register', currentReturnUrl()))
}

export function beginLogout() {
  markUnauthenticated()
  location.assign(buildAuthUrl('/logout', location.origin + '/'))
}
