import { describe, it, expect, vi, afterEach } from 'vitest'
import { onRequest } from '../apps/web/functions/_middleware'
import { authenticated, createSession, COOKIE_NAME, SESSION_SECONDS } from '../apps/api/src/auth'
const env = { ACCESS_PASSWORD: 'test-password-only', SESSION_SECRET: 'a'.repeat(40) }
const req = (path: string, init?: RequestInit) => new Request(`https://zenith.test${path}`, init)
const call = (request: Request, next = vi.fn(async () => new Response('<html>SPA</html>', { headers: { 'Content-Type': 'text/html' } }))) => onRequest({request, env, next})
afterEach(() => vi.useRealTimers())
describe('private deployment', () => {
 it('denies anonymous API and all SPA fallbacks', async () => {
  for (const path of ['/api','/api/unknown','/v1','/v1/models','/v1/images/generations']) expect((await call(req(path))).status).toBe(401)
  for (const path of ['/','/flow','/unknown.png','/assets/missing.js']) expect((await call(req(path))).headers.get('Location')).toBe('/auth/login')
 })
 it('preserves login UI and validates method, origin, form and password', async () => {
  expect(await (await call(req('/auth/login'))).text()).toContain('<form method="post" action="/auth/login">')
  expect((await call(req('/auth/login',{method:'PUT'}))).status).toBe(405)
  expect((await call(req('/auth/login',{method:'POST'}))).status).toBe(403)
  expect((await call(req('/auth/login',{method:'POST',headers:{Origin:'https://zenith.test'}}))).status).toBe(400)
  expect((await call(req('/auth/login',{method:'POST',headers:{Origin:'https://zenith.test','Content-Type':'application/x-www-form-urlencoded'},body:'password=wrong'}))).status).toBe(401)
 })
 it('signs a secure 12h session and rejects tampering and expiry', async () => {
  const response = await call(req('/auth/login',{method:'POST',headers:{Origin:'https://zenith.test','Content-Type':'application/x-www-form-urlencoded'},body:'password=test-password-only'}))
  expect(response.status).toBe(303)
  const cookie = response.headers.get('Set-Cookie')!
  expect(cookie).toContain('HttpOnly; Secure; SameSite=Strict; Max-Age=43200')
  expect(await authenticated(req('/',{headers:{Cookie:cookie}}),env)).toBe(true)
  expect(await authenticated(req('/',{headers:{Cookie:cookie.replace(/session=./,'session=X')}}),env)).toBe(false)
  vi.useFakeTimers();vi.setSystemTime(Date.now()+(SESSION_SECONDS+1)*1000)
  expect(await authenticated(req('/',{headers:{Cookie:cookie}}),env)).toBe(false)
 })
 it('fails closed without configuration and logs out only same-origin POST', async () => {
  expect((await onRequest({request:req('/auth/login'),env:{},next:async()=>new Response('bad')})).status).toBe(503)
  expect((await call(req('/auth/logout'))).status).toBe(405)
  expect((await call(req('/auth/logout',{method:'POST',headers:{Origin:'https://evil.test'}}))).status).toBe(403)
  expect((await call(req('/auth/logout',{method:'POST',headers:{Origin:'https://zenith.test'}}))).headers.get('Set-Cookie')).toContain('Max-Age=0')
 })
})
