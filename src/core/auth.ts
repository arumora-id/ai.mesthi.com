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

export function registrationAvailable() {
  return Boolean(import.meta.env.VITE_AUTH_REGISTER_URL?.trim())
}

function currentRelativeUrl() {
  const value = location.pathname + location.search + location.hash
  return value.startsWith('/') ? value : '/'
}

function resolveAuthUrl(configured: string | undefined, fallback: string, returnTo?: string) {
  const raw = configured?.trim() || fallback
  const url = new URL(raw, location.origin)

  if (returnTo && url.origin === location.origin && !url.searchParams.has('rd'))
    url.searchParams.set('rd', returnTo)

  return url.toString()
}

export function beginLogin() {
  location.assign(
    resolveAuthUrl(import.meta.env.VITE_AUTH_LOGIN_URL, '/oauth2/start', currentRelativeUrl()),
  )
}

export function beginRegistration() {
  const configured = import.meta.env.VITE_AUTH_REGISTER_URL?.trim()
  if (!configured) {
    beginLogin()
    return
  }

  location.assign(new URL(configured, location.origin).toString())
}

export function beginLogout() {
  markUnauthenticated()
  location.assign(resolveAuthUrl(import.meta.env.VITE_AUTH_LOGOUT_URL, '/oauth2/sign_out', '/'))
}
