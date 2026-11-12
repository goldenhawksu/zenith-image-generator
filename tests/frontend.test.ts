import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const source = (path: string) => readFileSync(`apps/web/src/${path}`, 'utf8')
test('home and every flow generation path use server session without browser key requirements', () => {
  for (const path of ['hooks/useImageGenerator.ts', 'components/flow/SingleImageNode.tsx', 'components/flow/ImageGridNode.tsx', 'components/flow/AIResultNode.tsx']) {
    const text = source(path)
    assert.doesNotMatch(text, /X-API-Key|No API Key|Please configure your API Key|decryptFromStore/)
    assert.match(text, /generateImage|\/api\/generate/)
  }
  for (const path of ['components/feature/ApiConfigAccordion.tsx', 'pages/FlowPage.tsx', 'components/flow/FloatingInput.tsx']) {
    assert.match(source(path), /gpt-image-2.6-sunburst/)
    assert.doesNotMatch(source(path), /Gitee AI|Gitee API Key/)
  }
})
