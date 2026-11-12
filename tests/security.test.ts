import { test } from 'node:test'
import assert from 'node:assert/strict'
import app from '../apps/api/src/index'

export const env = { ACCESS_PASSWORD: 'test-only-password', SESSION_SECRET: 'test-only-secret-at-least-32-characters' }

test('every API route fails closed without a signed session, including HF and unknown routes', async () => {
  for (const path of ['/api', '/api/', '/api/generate', '/api/generate-hf', '/api/upscale', '/api/unknown']) {
    const res = await app.request(`https://zenith.test${path}`, { method: path.endsWith('/') || path === '/api' ? 'GET' : 'POST' }, env)
    assert.equal(res.status, 401, path)
    assert.match(res.headers.get('cache-control') || '', /no-store/)
  }
})
