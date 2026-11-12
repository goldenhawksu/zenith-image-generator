import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { useImageGenerator } from '../useImageGenerator'
import AIResultNode from '../../components/flow/AIResultNode'
import { getModelsByProvider, PROVIDER_CONFIGS, PROVIDER_OPTIONS } from '../../lib/constants'

vi.mock('@/lib/crypto', () => ({ loadAllTokens: async () => ({}), loadTokensArray: async () => [], encryptAndStoreToken: vi.fn() }))
vi.mock('@/lib/historyStore', () => ({ saveToHistory: vi.fn(async () => 'test-history') }))
vi.mock('@xyflow/react', () => ({ Handle: () => null, Position: { Top: 'top', Bottom: 'bottom' } }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
const containers: Array<{ root: ReturnType<typeof createRoot>; element: HTMLElement }> = []
function mount(component: React.ReactNode) {
 const element = document.createElement('div'); document.body.append(element)
 const root = createRoot(element); containers.push({ root, element }); root.render(component)
}
afterEach(async () => {
 await act(async () => { for (const { root, element } of containers.splice(0)) { root.unmount(); element.remove() } })
 localStorage.clear(); vi.unstubAllGlobals()
})
function settings() {
 localStorage.setItem('zenith-settings', JSON.stringify({ provider: 'gitee', model: 'z-image-turbo', prompt: 'cat', serverProviderVersion: 1 }))
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
 const fetch = vi.fn(async () => Response.json({ data: [{ url: 'https://images.test/cat.png' }] })); vi.stubGlobal('fetch', fetch)
 return fetch
}
it('offers shared GPT 2.5 and clearly labels Gitee server authentication', () => {
 expect(getModelsByProvider('sub2api').map(m => m.id)).toContain('gpt-image-2.5-sunburst')
 expect(PROVIDER_CONFIGS.gitee).toMatchObject({ requiresAuth: false, name: 'Gitee AI (server: Z-Image Turbo only)' })
 expect(PROVIDER_OPTIONS.find(p => p.value === 'gitee')).toMatchObject({ requiresAuth: false, label: 'Gitee AI (server: Z-Image Turbo only)' })
})
it('limits the Gitee server model picker to the verified model', () => {
 expect(getModelsByProvider('gitee').map(m => m.id)).toEqual(['z-image-turbo'])
})
it('home generation submits selected Gitee model with an empty browser token', async () => {
 const fetch = settings(); let hook!: ReturnType<typeof useImageGenerator>
 function Harness() { hook = useImageGenerator(); return null }
 await act(async () => { mount(createElement(Harness)) })
 await act(async () => { await hook.handleGenerate() })
 expect(fetch).toHaveBeenCalledOnce()
 const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
 expect(url).toBe('/v1/images/generations')
 expect(JSON.parse(init.body as string).model).toBe('gitee/z-image-turbo')
 expect(new Headers(init.headers).has('Authorization')).toBe(false)
})
it('active Flow result generation submits selected Gitee model with an empty browser token', async () => {
 const fetch = settings()
 await act(async () => { mount(createElement(AIResultNode, { id: 'test-node', data: { prompt: 'cat', width: 1024, height: 1024 } } as any)) })
 expect(fetch).toHaveBeenCalledOnce()
 const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
 expect(JSON.parse(init.body as string).model).toBe('gitee/z-image-turbo')
 expect(new Headers(init.headers).has('Authorization')).toBe(false)
})
