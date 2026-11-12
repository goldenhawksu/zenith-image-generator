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
  expect(new Headers(init.headers).get('User-Agent')).toBe('Mozilla/5.0 (compatible; ZenithImageProxy/1.0)')
  expect(JSON.parse(init.body as string)).toEqual({model:env.IMAGE_MODEL,prompt:'cat',size:'1024x1536',n:1,response_format:'b64_json'})
  const text=await response.text();expect(text).toContain('data:image/png;base64,aGVsbG8=');expect(text).not.toContain(env.IMAGE_API_KEY)
 })
 it('selects each allowlisted server model and never passes an arbitrary browser model',async()=>{
  const upstream=vi.fn(async()=>Response.json({data:[{b64_json:'aGVsbG8='}]}));vi.stubGlobal('fetch',upstream)
  for(const model of ['gpt-image-2.5-sunburst','gpt-image-2.6-sunburst','untrusted-model']) {
   const response=await handler.fetch(await request('/v1/images/generations',{prompt:'cat',model}),env,ctx)
   expect(response.status).toBe(200)
   expect(JSON.parse((upstream.mock.calls.at(-1) as unknown as [string,RequestInit])[1].body as string).model).toBe(model==='untrusted-model'?env.IMAGE_MODEL:model)
  }
 })
 it('overrides untrusted model for default provider and sanitizes upstream failures',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(env.IMAGE_API_KEY,{status:401})))
  const r=await handler.fetch(await request('/v1/images/generations',{prompt:'cat',model:'gpt-image-2.6-sunburst'}),env,ctx)
  expect(r.status).toBe(502);expect(await r.text()).not.toContain(env.IMAGE_API_KEY)
 })
 it('uses the server Gitee credential only for authenticated Gitee images',async()=>{
  const giteeEnv={...env,GITEE_API_KEY:crypto.randomUUID()}
  const upstream=vi.fn(async()=>Response.json({data:[{url:'https://images.test/cat.png'}]}));vi.stubGlobal('fetch',upstream)
  const body={prompt:'cat',model:'gitee/z-image-turbo',size:'1024x1024'}
  for(const path of ['/v1/images/generations','/api/v1/images/generations']) {
   const denied=await onRequest({request:await request(path,body,false),env:giteeEnv,next:async()=>new Response('SPA')})
   expect(denied.status).toBe(401)
  }
  expect(upstream).not.toHaveBeenCalled()
  const response=await onRequest({request:await request('/v1/images/generations',body),env:giteeEnv,next:async()=>new Response('SPA')})
  expect(response.status).toBe(200)
  const [url,init]=upstream.mock.calls[0] as unknown as [string,RequestInit]
  expect(url).toBe('https://ai.gitee.com/v1/images/generations')
  // Boolean comparison keeps credential values out of assertion output.
  expect(new Headers(init.headers).get('Authorization')===`Bearer ${giteeEnv.GITEE_API_KEY}`).toBe(true)
  expect(JSON.parse(init.body as string).model).toBe('z-image-turbo')
  expect(init.redirect).toBe('manual')
  expect(init.signal).toBeInstanceOf(AbortSignal)
  expect((await response.text()).includes(giteeEnv.GITEE_API_KEY)).toBe(false)
 })
 it('fails closed without a Gitee server key and sanitizes Gitee upstream failures',async()=>{
  const body={prompt:'cat',model:'gitee/z-image-turbo'}
  const upstream=vi.fn(async()=>Response.json({error:{message:'private provider failure'}},{status:401}));vi.stubGlobal('fetch',upstream)
  expect((await handler.fetch(await request('/v1/images/generations',body),env,ctx)).status).toBe(503)
  expect(upstream).not.toHaveBeenCalled()
  const response=await handler.fetch(await request('/v1/images/generations',body),{...env,GITEE_API_KEY:crypto.randomUUID()},ctx)
  expect(response.status).toBe(502)
  expect(await response.text()).not.toContain('private provider failure')
 })
 it('uses manual redirects and rejects upstream redirects without following',async()=>{
  const upstream=vi.fn(async (_url: unknown, init: RequestInit)=>{
   return new Response(null,{status:302,headers:{Location:'https://untrusted.test'}})
  });vi.stubGlobal('fetch',upstream)
  expect((await handler.fetch(await request(),env,ctx)).status).toBe(502)
  expect(upstream.mock.calls[0][1].redirect).toBe('manual')
  expect(upstream).toHaveBeenCalledOnce()
 })
 it('publishes both server GPT models to authenticated clients',async()=>{
  const req=await request();const response=await handler.fetch(new Request('https://zenith.test/v1/models',{headers:req.headers}),env,ctx)
  expect(response.status).toBe(200)
  const result=await response.json() as {data:Array<{id:string}>}
  expect(result.data.map(m=>m.id)).toEqual(expect.arrayContaining(['gpt-image-2.5-sunburst','gpt-image-2.6-sunburst']))
 })
 it('does not use the server Gitee key for unverified models or other channels',async()=>{
  const upstream=vi.fn();vi.stubGlobal('fetch',upstream)
  const giteeEnv={...env,GITEE_API_KEY:crypto.randomUUID()}
  expect((await handler.fetch(await request('/v1/images/generations',{prompt:'cat',model:'gitee/Qwen-Image'}),giteeEnv,ctx)).status).toBe(400)
  expect(upstream).not.toHaveBeenCalled()
 })
 it('fails closed when image secrets missing and rejects cross-origin mutation',async()=>{
  expect((await handler.fetch(await request(),{...env,IMAGE_API_KEY:undefined},ctx)).status).toBe(503)
  const r=await request();r.headers.set('Origin','https://evil.test')
  expect((await handler.fetch(r,env,ctx)).status).toBe(403)
 })
})
