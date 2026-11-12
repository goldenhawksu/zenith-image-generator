import { afterEach, describe, expect, it, vi } from 'vitest'
import handler from '../apps/api/src/index'
import { onRequest } from '../apps/web/functions/_middleware'
import { createSession, COOKIE_NAME } from '../apps/api/src/auth'
const env = {ACCESS_PASSWORD:'test-only',SESSION_SECRET:'x'.repeat(40),IMAGE_API_KEY:'server-only-test-key',IMAGE_API_BASE_URL:'https://upstream.test/v1',IMAGE_MODEL:'gpt-image-2.6-sunburst'}
const ctx = {waitUntil:vi.fn(),passThroughOnException:vi.fn()} as any
async function request(path='/v1/images/generations',body: unknown={prompt:'a cat',size:'512x768'},auth=true) {return new Request('https://zenith.test'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://zenith.test',...(auth?{Cookie:`${COOKIE_NAME}=${await createSession(env)}`}:{})},body:JSON.stringify(body)})}
afterEach(()=>vi.unstubAllGlobals())
describe('deployment adapter',()=>{
 it('standalone worker protects every endpoint without bearer bypass',async()=>{
  for(const path of ['/','/v1/models','/api/unknown','/v1/unknown']) expect((await handler.fetch(new Request('https://zenith.test'+path,{headers:{Authorization:'Bearer irrelevant'}}),env,ctx)).status).toBe(401)
 })
 it('Pages routes /v1 to server, defaults env model, normalizes dimensions, ignores browser credentials',async()=>{
  const upstream=vi.fn(async()=>Response.json({data:[{b64_json:'aGVsbG8='}]}));vi.stubGlobal('fetch',upstream)
  const response=await onRequest({request:await request('/v1/images/generations',{prompt:'cat',size:'512x768',api_key:'browser-value',base_url:'https://attacker.test'}),env,next:async()=>new Response('SPA')})
  expect(response.status).toBe(200);expect(upstream).toHaveBeenCalledOnce()
  const [url,init]=upstream.mock.calls[0] as unknown as [string,RequestInit]
  expect(url).toBe('https://upstream.test/v1/images/generations')
  expect(new Headers(init.headers).get('Authorization')).toBe('Bearer server-only-test-key')
  expect(JSON.parse(init.body as string)).toEqual({model:env.IMAGE_MODEL,prompt:'cat',size:'1024x1536',n:1,response_format:'b64_json'})
  const text=await response.text();expect(text).toContain('data:image/png;base64,aGVsbG8=');expect(text).not.toContain(env.IMAGE_API_KEY)
 })
 it('overrides untrusted model for default provider and sanitizes upstream failures',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(env.IMAGE_API_KEY,{status:401})))
  const r=await handler.fetch(await request('/v1/images/generations',{prompt:'cat',model:'gpt-image-2.6-sunburst'}),env,ctx)
  expect(r.status).toBe(502);expect(await r.text()).not.toContain(env.IMAGE_API_KEY)
 })
 it('fails closed when image secrets missing and rejects cross-origin mutation',async()=>{
  expect((await handler.fetch(await request(),{...env,IMAGE_API_KEY:undefined},ctx)).status).toBe(503)
  const r=await request();r.headers.set('Origin','https://evil.test')
  expect((await handler.fetch(r,env,ctx)).status).toBe(403)
 })
})
