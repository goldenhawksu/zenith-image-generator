import handler from '../../../api/src/index'
import type { DeploymentEnv } from '../../../api/src/deployment'
export const onRequest: PagesFunction<DeploymentEnv> = context => handler.fetch(context.request, context.env, context)
