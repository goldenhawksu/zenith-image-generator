import { test } from 'node:test'
import assert from 'node:assert/strict'
import app from '../apps/api/src/index'
import { createSession, COOKIE_NAME } from '../apps/api/src/auth'
const env = { ACCESS_PASSWORD: 'test-only-password', SESSION_SECRET: 'test-only-secret-at-least-32-characters', IMAGE_API_BASE_URL: 'https://images.test/v1', IMAGE_API_KEY: 'server-only-key' }
test('authenticated generation uses server OpenAI configuration and default model, never Gitee extras or client key/model', async () => {
  const original = globalThis.fetch
  let called = false
  globalThis.fetch = async (input, init) => {
    called = true
    const req = new Request(input, init)
    assert.equal(req.url, 'https://images.test/v1/images/generations')
    assert.equal(req.headers.get('authorization'), 'Bearer server-only-key')
    assert.deepEqual(await req.json(), { prompt: 'a mountain', model: 'gpt-image-2.6-sunburst', size: '1024x1024' })
    return Response.json({ data: [{ b64_json: 'aW1hZ2U=' }] })
  }
  try {
    const cookie = `${COOKIE_NAME}=${await createSession(env)}`
    const res = await app.request('https://zenith.test/api/generate', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-API-Key': 'ignored-client-key' }, body: JSON.stringify({ prompt: 'a mountain', model: 'ignored-client-model', negative_prompt: 'ignored', num_inference_steps: 9 }) }, env)
    assert.equal(res.status, 200)
    assert.equal(called, true)
    assert.deepEqual(await res.json(), { b64_json: 'aW1hZ2U=' })
  } finally { globalThis.fetch = original }
})
test('upstream exceptions never expose provider credentials', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => Response.json({ error: { message: 'Authorization: Bearer server-only-key' } }, { status: 400 })
  try {
    const cookie = `${COOKIE_NAME}=${await createSession(env)}`
    const res = await app.request('https://zenith.test/api/generate', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'test' }) }, env)
    assert.equal(res.status, 500)
    assert.deepEqual(await res.json(), { error: 'Image generation failed' })
  } finally { globalThis.fetch = original }
})
test('image provider fails closed if env is missing, with no browser key needed', async () => {
  const cookie = `${COOKIE_NAME}=${await createSession(env)}`
  const res = await app.request('https://zenith.test/api/generate', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'test' }) }, { ...env, IMAGE_API_KEY: '' })
  assert.equal(res.status, 503)
})
