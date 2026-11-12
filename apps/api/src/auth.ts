export type AuthEnv = { ACCESS_PASSWORD?: string; SESSION_SECRET?: string }
export const COOKIE_NAME = '__Host-zenith_session'
export const SESSION_SECONDS = 60 * 60 * 12
export const privateHeaders = { 'Cache-Control': 'private, no-store', 'Pragma': 'no-cache' }

export function configured(env: AuthEnv): boolean {
  return !!env?.ACCESS_PASSWORD && !!env?.SESSION_SECRET && env.SESSION_SECRET.length >= 32
}

async function signingKey(secret: string) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export async function createSession(env: AuthEnv): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('')
  const payload = `${expires}.${nonce}`
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', await signingKey(env.SESSION_SECRET!), new TextEncoder().encode(payload)))
  return `${payload}.${btoa(String.fromCharCode(...signature)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`
}

export async function passwordMatches(password: string, expected: string): Promise<boolean> {
  const digest = (s: string) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  const [a, b] = await Promise.all([digest(password), digest(expected)])
  const aa = new Uint8Array(a), bb = new Uint8Array(b)
  let different = 0
  for (let i = 0; i < aa.length; i++) different |= aa[i] ^ bb[i]
  return different === 0
}

export async function authenticated(request: Request, env: AuthEnv): Promise<boolean> {
  if (!configured(env)) return false
  const token = request.headers.get('Cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1)
  if (!token) return false
  try {
    const [expires, nonce, signature, extra] = token.split('.')
    if (extra || !/^\d+$/.test(expires) || !nonce || !signature) return false
    const now = Math.floor(Date.now() / 1000)
    if (Number(expires) <= now || Number(expires) > now + SESSION_SECONDS) return false
    return await crypto.subtle.verify('HMAC', await signingKey(env.SESSION_SECRET!), Uint8Array.from(atob(signature.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)), new TextEncoder().encode(`${expires}.${nonce}`))
  } catch { return false }
}
