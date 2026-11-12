import { Handle, type NodeProps, Position } from '@xyflow/react'
import { Loader2 } from 'lucide-react'
import { memo, useEffect, useRef, useState } from 'react'
import { openai } from '@/lib/api'

export type SingleImageNodeData = {
  prompt: string
  width: number
  height: number
}

async function generateImage(prompt: string, width: number, height: number): Promise<string> {
  const result = await openai.generateImage({ model: 'gpt-image-2.6-sunburst', prompt, size: `${width}x${height}`, n: 1, response_format: 'url' })
  const url = result.data?.[0]?.url
  if (!url) throw new Error('No image returned')
  return url
}

function SingleImageNode({ data }: NodeProps) {
  const { prompt, width, height } = data as SingleImageNodeData
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const generatingRef = useRef(false)

  useEffect(() => {
    // Prevent double execution from React StrictMode
    if (generatingRef.current) return
    generatingRef.current = true

    generateImage(prompt, width, height)
      .then((url) => {
        setImageUrl(url)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [prompt, width, height])

  return (
    <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-xl p-3 shadow-2xl">
      <Handle type="target" position={Position.Top} className="!bg-emerald-500" />

      <div className="w-[256px] h-[256px] rounded-lg overflow-hidden bg-zinc-800">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-zinc-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="w-full h-full flex items-center justify-center p-4">
            <span className="text-red-400 text-xs text-center">{error}</span>
          </div>
        ) : (
          <img src={imageUrl!} alt="Generated" className="w-full h-full object-cover" />
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-zinc-600" />
    </div>
  )
}

export default memo(SingleImageNode)
