import { authenticated, configured, createSession, passwordMatches, COOKIE_NAME, SESSION_SECONDS, privateHeaders, type AuthEnv } from '../../api/src/auth'

type Context = { request: Request; env: AuthEnv; next: () => Promise<Response> }
const headers = { ...privateHeaders, 'X-Content-Type-Options': 'nosniff' }
const redirect = (location: string, cookie?: string) => new Response(null, { status: 303, headers: { ...headers, Location: location, ...(cookie ? { 'Set-Cookie': cookie } : {}) } })
const cookie = (value: string, maxAge: number) => `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`
const loginPage = (error = '', status = 200) => new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Zenith — Sign in</title><style>*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;padding:24px;background:radial-gradient(ellipse at top,#2c1a10,#09090b 65%);color:#f4f4f5;font:16px system-ui,sans-serif}main{width:100%;max-width:400px;padding:36px;border:1px solid #3f3f46;border-radius:20px;background:#18181bee;box-shadow:0 24px 80px #0008}h1{color:#f97316;letter-spacing:.22em;text-transform:uppercase;margin:0 0 28px}h2{font-size:22px}p{color:#fca5a5;min-height:20px;font-size:14px}label{display:block;color:#a1a1aa;font-size:14px}input{display:block;width:100%;margin:10px 0 22px;padding:13px;border:1px solid #3f3f46;border-radius:9px;background:#09090b;color:#fafafa;font:inherit}input:focus{outline:2px solid #f97316;outline-offset:2px}button{width:100%;padding:13px;border:0;border-radius:9px;background:#f97316;color:#09090b;font:600 16px system-ui;cursor:pointer}button:hover{background:#fb923c}</style></head><body><main><h1>Zenith</h1><h2>Sign in</h2><p>${error}</p><form method="post" action="/auth/login"><label>Password <input type="password" name="password" required autocomplete="current-password" maxlength="1024"></label><button type="submit">Sign in</button></form></main></body></html>`, { status, headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'" } })

export async function onRequest({ request, env, next }: Context): Promise<Response> {
  const url = new URL(request.url)
  // Handle auth here: Pages' SPA fallback must not swallow these routes.
  if (url.pathname === '/auth/login' || url.pathname === '/auth/logout') {
    if (!configured(env)) return new Response('Authentication is not configured', { status: 503, headers })
    if (request.method === 'POST' && request.headers.get('Origin') !== url.origin) return new Response('Invalid origin', { status: 403, headers })
    if (url.pathname === '/auth/logout') {
      if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { ...headers, Allow: 'POST' } })
      return redirect('/auth/login', cookie('', 0))
    }
    if (request.method === 'GET') return loginPage()
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers })
    if (!request.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded')) return new Response('Invalid form', { status: 400, headers })
    const text = await request.text()
    if (text.length > 4096) return new Response('Form too large', { status: 413, headers })
    const password = new URLSearchParams(text).get('password') || ''
    if (!await passwordMatches(password, env.ACCESS_PASSWORD!)) return loginPage('Invalid password', 401)
    return redirect('/', cookie(await createSession(env), SESSION_SECONDS))
  }
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    // Also protect unknown routes; the standalone Hono app independently verifies sessions.
    if (!await authenticated(request, env)) return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } })
  } else if (!await authenticated(request, env)) {
    // Only explicit Vite assets are public, never arbitrary extensions or SPA fallbacks.
    if (url.pathname.startsWith('/assets/')) {
      const response = await next()
      if (!response.headers.get('Content-Type')?.includes('text/html')) return response
    }
    return redirect('/auth/login')
  }
  const downstream = await next()
  const response = new Response(downstream.body, downstream)
  for (const [key, value] of Object.entries(headers)) response.headers.set(key, value)
  return response
}
