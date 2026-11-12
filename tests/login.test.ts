import { test } from 'node:test'
import assert from 'node:assert/strict'
import app from '../apps/api/src/index'
import { onRequest } from '../apps/web/functions/_middleware'

const env = { ACCESS_PASSWORD: 'test-only-password', SESSION_SECRET: 'test-only-secret-at-least-32-characters' }
const next = async () => new Response('<html>private app</html>', { headers: { 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=3600' } })
const request = (path: string, init?: RequestInit, bindings = env) => onRequest({ request: new Request(`https://zenith.test${path}`, init), env: bindings, next })
async function login() {
  return request('/auth/login', { method: 'POST', headers: { Origin: 'https://zenith.test', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'password=test-only-password' })
}
test('Pages login routes bypass HTML gate, issue secure session, protect deep links, and logout', async () => {
  assert.equal((await request('/flow')).status, 303)
  assert.equal((await request('/index.html')).status, 303)
  const form = await request('/auth/login')
  assert.equal(form.status, 200)
  assert.match(await form.text(), /type="password"/)
  const res = await login()
  assert.equal(res.status, 303)
  const cookie = res.headers.get('set-cookie')!
  for (const attribute of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/', 'Max-Age=43200']) assert.ok(cookie.includes(attribute))
  assert.ok(!cookie.includes(env.ACCESS_PASSWORD))
  const headers = { Cookie: cookie.split(';')[0] }
  assert.equal((await app.request('https://zenith.test/api', { headers }, env)).status, 200)
  const html = await request('/flow', { headers })
  assert.equal(html.status, 200)
  assert.match(html.headers.get('cache-control')!, /no-store/)
  const logout = await request('/auth/logout', { method: 'POST', headers: { ...headers, Origin: 'https://zenith.test' } })
  assert.match(logout.headers.get('set-cookie')!, /Max-Age=0/)
})
test('login rejects wrong password, cross-origin and missing Origin; missing secrets fail closed', async () => {
  for (const origin of [undefined, 'https://evil.test', 'null']) {
    const res = await request('/auth/login', { method: 'POST', headers: origin ? { Origin: origin } : {}, body: 'password=test-only-password' })
    assert.equal(res.status, 403)
  }
  assert.equal((await request('/auth/login', { method: 'POST', headers: { Origin: 'https://zenith.test', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'password=wrong' })).status, 401)
  for (const bindings of [{ ...env, SESSION_SECRET: '' }, { ...env, ACCESS_PASSWORD: '' }]) {
    assert.equal((await request('/auth/login', undefined, bindings)).status, 503)
    assert.equal((await app.request('https://zenith.test/api', {}, bindings)).status, 401)
  }
})
test('tampered, forged, malformed and expired cookies do not authenticate', async () => {
  const cookie = (await login()).headers.get('set-cookie')!.split(';')[0]
  const [name, value] = cookie.split('=')
  const parts = value.split('.')
  for (const token of ['garbage', `${parts[0]}.changed.${parts[2]}`, `1.${parts[1]}.${parts[2]}`, `${parts[0]}.${parts[1]}.invalid`]) {
    assert.equal((await app.request('https://zenith.test/api', { headers: { Cookie: `${name}=${token}` } }, env)).status, 401)
  }
  const original = Date.now
  Date.now = () => original() + 43201000
  try { assert.equal((await app.request('https://zenith.test/api', { headers: { Cookie: cookie } }, env)).status, 401) } finally { Date.now = original }
})
