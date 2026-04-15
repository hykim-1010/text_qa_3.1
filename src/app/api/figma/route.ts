import { NextRequest, NextResponse } from 'next/server'
import { fetchFigmaTextNodes, fetchFigmaScreenshotUrl } from '@/lib/figma'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '요청 본문이 유효한 JSON이 아닙니다.' }, { status: 400 })
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('url' in body) ||
    typeof (body as { url: unknown }).url !== 'string'
  ) {
    return NextResponse.json({ error: 'url 필드가 필요합니다.' }, { status: 400 })
  }

  const figmaUrl = (body as { url: string }).url

  // fileKey 추출: /file/{key}/ 또는 /design/{key}/
  const fileKeyMatch = figmaUrl.match(/(?:figma\.com)\/(?:file|design)\/([a-zA-Z0-9]+)/i)
  if (!fileKeyMatch) {
    return NextResponse.json({ error: '유효한 Figma URL이 아닙니다.' }, { status: 400 })
  }
  const fileKey = fileKeyMatch[1]

  // node-id 추출 (필수), '-' → ':' 치환
  const nodeIdMatch = figmaUrl.match(/[?&]node-id=([\d\-]+)/i)
  const nodeId = nodeIdMatch ? nodeIdMatch[1].replace(/-/g, ':') : null

  if (!nodeId) {
    return NextResponse.json(
      { error: 'Figma URL에 node-id가 없습니다. 특정 프레임을 선택한 후 링크를 복사해주세요.' },
      { status: 400 },
    )
  }

  if (!process.env.FIGMA_ACCESS_TOKEN) {
    return NextResponse.json({ error: 'FIGMA_ACCESS_TOKEN 환경변수가 설정되지 않았습니다.' }, { status: 500 })
  }

  try {
    const [figmaResult, screenshotUrl] = await Promise.all([
      fetchFigmaTextNodes(fileKey, nodeId),
      fetchFigmaScreenshotUrl(fileKey, nodeId),
    ])
    return NextResponse.json({ nodes: figmaResult.nodes, screenshotUrl, frameBounds: figmaResult.frameBounds })
  } catch (err: unknown) {
    // axios 에러인 경우 HTTP 상태별 명확한 메시지 반환
    if (
      typeof err === 'object' &&
      err !== null &&
      'response' in err &&
      typeof (err as { response?: { status?: unknown } }).response?.status === 'number'
    ) {
      const status = (err as { response: { status: number } }).response.status
      if (status === 429) {
        return NextResponse.json(
          { error: 'Figma API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.' },
          { status: 429 },
        )
      }
      if (status === 403) {
        return NextResponse.json(
          { error: 'Figma 접근 권한이 없습니다. Access Token 또는 파일 공유 설정을 확인해주세요.' },
          { status: 403 },
        )
      }
      if (status === 404) {
        return NextResponse.json(
          { error: 'Figma 파일 또는 노드를 찾을 수 없습니다. URL을 다시 확인해주세요.' },
          { status: 404 },
        )
      }
    }
    const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
