import { compareTwoStrings } from 'string-similarity'
import { diffChars } from 'diff'
import type { DiffChar, TextNode } from '@/types'

export type PairStatus = 'pass' | 'needs_edit' | 'figma_only' | 'web_only'

export interface ComparePair {
  figmaText: string | null
  webText: string | null
  status: PairStatus
  similarity?: number
  diffs?: DiffChar[]  // needs_edit일 때만 존재
  figmaNode?: { x: number; y: number; width: number; height: number }
  webNode?: { x: number; y: number; width: number; height: number }
}

// 짝 허용 최소 유사도 (이 값 미만이면 매칭 안 함)
const SIMILARITY_NEEDS_EDIT = 0.8

function normalizeForPairing(s: string): string {
  return s.replace(/[\u200B\u200C\u200D\uFEFF]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

// Pass 판정용 — 제로폭 문자 제거 후 줄바꿈/연속 공백을 단일 공백으로 정규화
function normalizeForPass(s: string): string {
  return s
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
    .replace(/\s*[\n\r]+\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildComparePairs(figmaNodes: TextNode[], webNodes: TextNode[]): ComparePair[] {
  const figmaForPairing = figmaNodes.map(n => normalizeForPairing(n.text))
  const webForPairing = webNodes.map(n => normalizeForPairing(n.text))

  // 각 Figma 항목에 대해 최고 유사도인 Web 후보를 모두 수집
  // (동일 텍스트가 여러 개일 때 동점 후보를 전부 포함해야 1:1 분산 매칭이 가능)
  const candidates: Array<{ fi: number; wi: number; sim: number }> = []
  for (let fi = 0; fi < figmaNodes.length; fi++) {
    if (!figmaForPairing[fi]) continue
    // 1차: 최고 유사도 탐색
    let bestSim = -1
    for (let wi = 0; wi < webNodes.length; wi++) {
      if (!webForPairing[wi]) continue
      const sim = compareTwoStrings(figmaForPairing[fi], webForPairing[wi])
      if (sim > bestSim) bestSim = sim
    }
    if (bestSim < 0) continue
    // 2차: 최고 유사도와 동점인 wi 전부 추가
    for (let wi = 0; wi < webNodes.length; wi++) {
      if (!webForPairing[wi]) continue
      const sim = compareTwoStrings(figmaForPairing[fi], webForPairing[wi])
      if (Math.abs(sim - bestSim) < 1e-9) {
        candidates.push({ fi, wi, sim })
      }
    }
  }

  // 유사도 내림차순 정렬 후 1:1 매칭 확정
  candidates.sort((a, b) => b.sim - a.sim)

  const figmaToWeb = new Map<number, { wi: number; sim: number }>()
  const figmaUsed = new Set<number>()
  const webUsed = new Set<number>()

  for (const { fi, wi, sim } of candidates) {
    if (figmaUsed.has(fi) || webUsed.has(wi)) continue
    if (sim < SIMILARITY_NEEDS_EDIT) continue

    figmaUsed.add(fi)
    webUsed.add(wi)
    figmaToWeb.set(fi, { wi, sim })
  }

  // Figma 노드 시각적 순서 그대로 출력 (figma_only도 위치 순서 유지)
  const pairs: ComparePair[] = []

  for (let fi = 0; fi < figmaNodes.length; fi++) {
    if (!figmaForPairing[fi]) continue

    const figmaNode = figmaNodes[fi]
    const match = figmaToWeb.get(fi)

    if (match !== undefined) {
      const webNode = webNodes[match.wi]
      const figmaOriginal = figmaNode.text
      const webOriginal = webNode.text
      const status = normalizeForPass(figmaOriginal) === normalizeForPass(webOriginal) ? 'pass' : 'needs_edit'

      let diffs: DiffChar[] | undefined
      if (status === 'needs_edit') {
        diffs = diffChars(normalizeForPass(figmaOriginal), normalizeForPass(webOriginal))
          .map(d => ({ value: d.value, added: d.added, removed: d.removed }))
      }

      pairs.push({
        figmaText: figmaOriginal,
        webText: webOriginal,
        status,
        similarity: match.sim,
        diffs,
        figmaNode: { x: figmaNode.x, y: figmaNode.y, width: figmaNode.width, height: figmaNode.height },
        webNode: { x: webNode.x, y: webNode.y, width: webNode.width, height: webNode.height },
      })
    } else {
      // figma_only — Figma 시각적 순서 그대로 유지
      pairs.push({
        figmaText: figmaNode.text,
        webText: null,
        status: 'figma_only',
        figmaNode: { x: figmaNode.x, y: figmaNode.y, width: figmaNode.width, height: figmaNode.height },
      })
    }
  }

  // 매칭 안 된 Web → web_only (뒤에 추가)
  for (let wi = 0; wi < webNodes.length; wi++) {
    if (!webUsed.has(wi) && webForPairing[wi]) {
      const webNode = webNodes[wi]
      pairs.push({
        figmaText: null,
        webText: webNode.text,
        status: 'web_only',
        webNode: { x: webNode.x, y: webNode.y, width: webNode.width, height: webNode.height },
      })
    }
  }

  return pairs
}
