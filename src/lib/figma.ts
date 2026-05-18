import axios from 'axios'
import { TextNode } from '@/types'

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
  nodeId: string,
  figmaToken: string,
): Promise<{ nodes: TextNode[]; frameBounds: FrameBounds | null }> {
  const token = figmaToken.trim()
  if (!token) {
    throw new Error('Figma token is required.')
  }

  const url = `https://api.figma.com/v1/files/${fileKey}/nodes`
  const response = await axios.get<FigmaNodesResponse>(url, {
    headers: { 'X-Figma-Token': token },
    params: { ids: nodeId },
  })

  const nodeData = response.data.nodes[nodeId]
  if (!nodeData) {
    throw new Error(`Node not found for nodeId "${nodeId}".`)
  }

  const result: TextNode[] = []
  collectTextNodes(nodeData.document, result)

  const frameBounds = nodeData.document.absoluteBoundingBox ?? null
  return { nodes: result, frameBounds }
}

interface FigmaImagesResponse {
  images: { [nodeId: string]: string | null }
}

export async function fetchFigmaScreenshotUrl(
  fileKey: string,
  nodeId: string,
  figmaToken: string,
): Promise<string | null> {
  const token = figmaToken.trim()
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
