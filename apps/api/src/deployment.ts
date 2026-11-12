import { authenticated, privateHeaders, type AuthEnv } from './auth'

export interface DeploymentEnv extends AuthEnv {
  IMAGE_API_KEY?: string
  IMAGE_API_BASE_URL?: string
  IMAGE_MODEL?: string
  CORS_ORIGINS?: string
}
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: privateHeaders })

/** Deployment boundary, shared by Pages and Workers; never trusts a browser key. */
export async function deploymentResponse(request: Request, env: DeploymentEnv): Promise<Response | null> {
  if (!await authenticated(request, env)) return json({ error: { message: 'Authentication required' } }, 401)
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers.get('Origin') && request.headers.get('Origin') !== new URL(request.url).origin) return json({ error: { message: 'Invalid origin' } }, 403)
  const path = new URL(request.url).pathname.replace(/^\/api(?=\/|$)/, '')
  if (path !== '/v1/images/generations' || request.method !== 'POST') return null
  if (Number(request.headers.get('Content-Length') || 0) > 51200) return json({ error: { message: 'Body too large' } }, 413)
  let body: Record<string, unknown>
  try {
    const text = await request.clone().text()
    if (text.length > 51200) return json({ error: { message: 'Body too large' } }, 413)
    body = JSON.parse(text)
    if (!body || typeof body !== 'object') throw new Error()
  } catch { return json({ error: { message: 'Invalid JSON' } }, 400) }
  // Explicit alternative providers continue through upstream's channel machinery.
  const model = typeof body.model === 'string' ? body.model : ''
  if (/^(gitee|ms|hf|a4f|custom)\//.test(model) || ['z-image-turbo','qwen-image-fast','ovis-image','flux-1-schnell'].includes(model)) return null
  if (!env.IMAGE_API_KEY || !env.IMAGE_API_BASE_URL) return json({ error: { message: 'Image provider is not configured' } }, 503)
  if (typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > 32000 || (body.n !== undefined && body.n !== 1)) return json({ error: { message: 'Invalid prompt or image count' } }, 400)
  const match = typeof body.size === 'string' ? /^(\d+)x(\d+)$/.exec(body.size) : null
  if (body.size !== undefined && !match) return json({ error: { message: 'Invalid size' } }, 400)
  const width = match ? Number(match[1]) : 1024, height = match ? Number(match[2]) : 1024
  if (width < 1 || height < 1 || width > 8192 || height > 8192) return json({ error: { message: 'Invalid size' } }, 400)
  const size = width === height ? '1024x1024' : width > height ? '1536x1024' : '1024x1536'
  try {
    const base = new URL(env.IMAGE_API_BASE_URL)
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw new Error()
    let url = base.href.replace(/\/$/, '')
    if (!url.endsWith('/v1')) url += '/v1'
    const upstream = await fetch(`${url}/images/generations`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(180000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.IMAGE_API_KEY}` },
      body: JSON.stringify({ model: env.IMAGE_MODEL || 'gpt-image-2.6-sunburst', prompt: body.prompt, size, n: 1, response_format: 'b64_json' }),
    })
    if (!upstream.ok) return json({ error: { message: 'Image provider request failed' } }, 502)
    const result = await upstream.json() as { data?: Array<{ url?: string; b64_json?: string }> }
    const data = result.data?.map(item => ({ url: item.b64_json ? `data:image/png;base64,${item.b64_json}` : item.url })).filter(item => item.url)
    if (!data?.length || data.some(item => item.url!.includes(env.IMAGE_API_KEY!))) throw new Error()
    return json({ created: Math.floor(Date.now() / 1000), data })
  } catch { return json({ error: { message: 'Image provider request failed' } }, 502) }
}
