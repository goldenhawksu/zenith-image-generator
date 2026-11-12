// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { loadSettings, PROVIDER_OPTIONS, getDefaultModel, PROVIDER_CONFIGS } from '../apps/web/src/lib/constants'
import { getFullImageModelId, openai } from '../apps/web/src/lib/api'
import { readFileSync } from 'node:fs'
it('migrates stale browser provider to server default without losing prompts',()=>{
 localStorage.setItem('zenith-settings',JSON.stringify({provider:'gitee',model:'z-image-turbo',prompt:'keep me'}))
 expect(loadSettings()).toMatchObject({provider:'sub2api',model:'gpt-image-2.6-sunburst',prompt:'keep me'})
 expect(PROVIDER_OPTIONS.find(p=>p.value==='sub2api')?.requiresAuth).toBe(false)
 expect(PROVIDER_CONFIGS.sub2api.requiresAuth).toBe(false)
 expect(getDefaultModel('sub2api' as any)).toBe('gpt-image-2.6-sunburst')
})
it('home uses same-origin server generation without bearer token',async()=>{
 const fetch=vi.fn(async()=>Response.json({data:[{url:'data:image/png;base64,aA=='}]}));vi.stubGlobal('fetch',fetch)
 await openai.generateImage({model:getFullImageModelId('sub2api' as any,'gpt-image-2.6-sunburst'),prompt:'cat',size:'1024x1024'})
 expect(fetch.mock.calls[0][0]).toBe('/v1/images/generations')
 expect(new Headers((fetch.mock.calls[0] as any)[1].headers).has('Authorization')).toBe(false)
 vi.unstubAllGlobals()
})
it('every flow generation path defaults to server provider and never hardcodes Gitee',()=>{
 for(const file of ['ImageNode','AIResultNode','SingleImageNode','ImageGridNode']) {
  const source=readFileSync(`apps/web/src/components/flow/${file}.tsx`,'utf8')
  expect(source).not.toContain("?? 'huggingface'")
  expect(source).not.toContain("model: 'gitee/z-image-turbo'")
  expect(source).not.toContain("decryptTokenFromStore('gitee')")
 }
 for(const file of ['apps/web/src/hooks/useImageGenerator.ts','apps/web/src/pages/FlowPageV2.tsx']) expect(readFileSync(file,'utf8')).not.toContain("?? 'huggingface'")
})

it('hides token entry for server provider in both settings components',()=>{
 for(const name of ['SettingsModal','ApiConfigAccordion']) expect(readFileSync(`apps/web/src/components/feature/${name}.tsx`,'utf8')).toContain("{provider !== 'sub2api' && (")
})
it('preserves explicit alternative provider choices after migration',()=>{
 localStorage.setItem('zenith-settings',JSON.stringify({provider:'gitee',model:'z-image-turbo',serverProviderVersion:1}))
 expect(loadSettings().provider).toBe('gitee')
})
