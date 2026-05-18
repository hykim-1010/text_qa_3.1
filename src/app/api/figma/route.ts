import { NextRequest, NextResponse } from 'next/server'
import { fetchFigmaTextNodes, fetchFigmaScreenshotUrl } from '@/lib/figma'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('url' in body) ||
    typeof (body as { url: unknown }).url !== 'string' ||
    !('figmaToken' in body) ||
    typeof (body as { figmaToken: unknown }).figmaToken !== 'string'
  ) {
    return NextResponse.json({ error: 'Both url and figmaToken are required.' }, { status: 400 })
  }

  const figmaUrl = (body as { url: string }).url
  const figmaToken = (body as { figmaToken: string }).figmaToken.trim()

  if (!figmaToken) {
    return NextResponse.json({ error: 'figmaToken must not be empty.' }, { status: 400 })
  }

  const fileKeyMatch = figmaUrl.match(/(?:figma\.com)\/(?:file|design)\/([a-zA-Z0-9]+)/i)
  if (!fileKeyMatch) {
    return NextResponse.json({ error: 'Invalid Figma URL.' }, { status: 400 })
  }
  const fileKey = fileKeyMatch[1]

  const nodeIdMatch = figmaUrl.match(/[?&]node-id=([\d\-]+)/i)
  const nodeId = nodeIdMatch ? nodeIdMatch[1].replace(/-/g, ':') : null

  if (!nodeId) {
    return NextResponse.json(
      { error: 'Figma URL must include node-id. Please copy link from a selected frame.' },
      { status: 400 },
    )
  }

  try {
    const [figmaResult, screenshotUrl] = await Promise.all([
      fetchFigmaTextNodes(fileKey, nodeId, figmaToken),
      fetchFigmaScreenshotUrl(fileKey, nodeId, figmaToken),
    ])
    return NextResponse.json({ nodes: figmaResult.nodes, screenshotUrl, frameBounds: figmaResult.frameBounds })
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'response' in err &&
      typeof (err as { response?: { status?: unknown } }).response?.status === 'number'
    ) {
      const status = (err as { response: { status: number } }).response.status
      if (status === 429) {
        return NextResponse.json(
          { error: 'Figma API rate limit exceeded. Please try again shortly.' },
          { status: 429 },
        )
      }
      if (status === 403) {
        return NextResponse.json(
          { error: 'Access denied. Check Figma token and file permissions.' },
          { status: 403 },
        )
      }
      if (status === 404) {
        return NextResponse.json(
          { error: 'Figma file or node not found. Please verify the URL.' },
          { status: 404 },
        )
      }
    }

    const message = err instanceof Error ? err.message : 'Unknown error occurred.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
