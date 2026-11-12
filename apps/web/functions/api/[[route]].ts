import handler from '../../../api/src/index'
import type { DeploymentEnv } from '../../../api/src/deployment'
export const onRequest: PagesFunction<DeploymentEnv> = context => {
 const url = new URL(context.request.url); url.pathname = url.pathname.replace(/^\/api/, '') || '/'
 return handler.fetch(new Request(url, context.request), context.env, context)
}
