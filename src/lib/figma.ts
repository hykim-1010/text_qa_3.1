import axios from 'axios'
import { TextNode } from '@/types'

// Figma API 응답의 노드 구조 (재귀)
interface FigmaNode {
  id: string
  name: string
  type: string
  characters?: string
  absoluteBoundingBox?: {
    x: number
    y: number
    width: number
    height: number
  } | null
  children?: FigmaNode[]
}

interface FigmaNodesResponse {
  nodes: {
    [nodeId: string]: {
      document: FigmaNode
    }
  }
}

// DFS로 TEXT 노드 탐색
function collectTextNodes(node: FigmaNode, result: TextNode[]): void {
  if (
    node.type === 'TEXT' &&
    node.absoluteBoundingBox != null &&
    typeof node.characters === 'string'
  ) {
    const { x, y, width, height } = node.absoluteBoundingBox
    result.push({
      id: node.id,
      text: node.characters,
      x,
      y,
      width,
      height,
      source: 'figma',
    })
  }

  if (node.children) {
    for (const child of node.children) {
      collectTextNodes(child, result)
    }
  }
}

export type FrameBounds = { x: number; y: number; width: number; height: number }

export async function fetchFigmaTextNodes(
  fileKey: string,
  nodeId: string
): Promise<{ nodes: TextNode[]; frameBounds: FrameBounds | null }> {
  const token = process.env.FIGMA_ACCESS_TOKEN
  if (!token) {
    throw new Error('FIGMA_ACCESS_TOKEN 환경변수가 설정되지 않았습니다.')
  }

  const url = `https://api.figma.com/v1/files/${fileKey}/nodes`
  const response = await axios.get<FigmaNodesResponse>(url, {
    headers: { 'X-Figma-Token': token },
    params: { ids: nodeId },
  })

  const nodeData = response.data.nodes[nodeId]
  if (!nodeData) {
    throw new Error(`nodeId "${nodeId}"에 해당하는 노드를 찾을 수 없습니다.`)
  }

  const result: TextNode[] = []
  collectTextNodes(nodeData.document, result)

  // 루트 프레임의 절대 좌표 → 오버레이 좌표 계산 기준
  const frameBounds = nodeData.document.absoluteBoundingBox ?? null
  return { nodes: result, frameBounds }
}

interface FigmaImagesResponse {
  images: { [nodeId: string]: string | null }
}

// Figma Image Export API로 스크린샷 CDN URL 반환
// 실패해도 null을 반환해 텍스트 비교에 영향 없도록 처리
export async function fetchFigmaScreenshotUrl(
  fileKey: string,
  nodeId: string
): Promise<string | null> {
  const token = process.env.FIGMA_ACCESS_TOKEN
  if (!token) return null

  try {
    const url = `https://api.figma.com/v1/images/${fileKey}`
    const response = await axios.get<FigmaImagesResponse>(url, {
      headers: { 'X-Figma-Token': token },
      params: { ids: nodeId, format: 'png', scale: 2 },
    })
    return response.data.images[nodeId] ?? null
  } catch {
    return null
  }
}
