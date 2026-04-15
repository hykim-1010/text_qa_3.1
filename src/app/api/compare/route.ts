import { NextRequest, NextResponse } from 'next/server'
import { buildComparePairs } from '@/lib/compare'
import { sortByVisualFlow } from '@/lib/sort'
import type { TextNode } from '@/types'

function isTextNode(v: unknown): v is TextNode {
  return (
    typeof v === 'object' && v !== null &&
    typeof (v as TextNode).id === 'string' &&
    typeof (v as TextNode).text === 'string' &&
    typeof (v as TextNode).x === 'number' &&
    typeof (v as TextNode).y === 'number'
  )
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '요청 본문이 유효한 JSON이 아닙니다.' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: '요청 본문이 객체여야 합니다.' }, { status: 400 })
  }

  const { figmaNodes, webNodes } = body as { figmaNodes?: unknown; webNodes?: unknown }

  if (!Array.isArray(figmaNodes) || !figmaNodes.every(isTextNode)) {
    return NextResponse.json({ error: 'figmaNodes 필드가 TextNode[] 이어야 합니다.' }, { status: 400 })
  }

  if (!Array.isArray(webNodes) || !webNodes.every(isTextNode)) {
    return NextResponse.json({ error: 'webNodes 필드가 TextNode[] 이어야 합니다.' }, { status: 400 })
  }

  try {
    // 각 배열을 시각적 순서(위→아래, 좌→우)로 정렬 후 비교
    const sortedFigmaNodes = sortByVisualFlow(figmaNodes as TextNode[])
    const sortedWebNodes = sortByVisualFlow(webNodes as TextNode[])
    const pairs = buildComparePairs(sortedFigmaNodes, sortedWebNodes)

    const summary = {
      total:      pairs.length,
      pass:       pairs.filter((p) => p.status === 'pass').length,
      needs_edit: pairs.filter((p) => p.status === 'needs_edit').length,
      figma_only: pairs.filter((p) => p.status === 'figma_only').length,
      web_only:   pairs.filter((p) => p.status === 'web_only').length,
    }

    return NextResponse.json({ pairs, summary })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
