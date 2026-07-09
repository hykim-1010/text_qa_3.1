import axios, { type AxiosRequestConfig } from 'axios'
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

const MAX_RETRIES = 2
const BASE_RETRY_DELAY_MS = 1200

function isAxiosRateLimitError(error: unknown): error is { response: { status: number; headers?: Record<string, string | string[] | undefined> } } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: { status?: unknown } }).response?.status === 'number' &&
    (error as { response: { status: number } }).response.status === 429
  )
}

function getRetryDelayMs(error: { response: { headers?: Record<string, string | string[] | undefined> } }, attempt: number): number {
  const retryAfter = error.response.headers?.['retry-after']
  const retryAfterValue = Array.isArray(retryAfter) ? retryAfter[0] : retryAfter
  const retryAfterSeconds = Number(retryAfterValue)

  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000
  }

  return BASE_RETRY_DELAY_MS * attempt
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function getWithRateLimitRetry<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const response = await axios.get<T>(url, config)
      return response.data
    } catch (error: unknown) {
      lastError = error

      if (!isAxiosRateLimitError(error) || attempt > MAX_RETRIES) {
        throw error
      }

      await sleep(getRetryDelayMs(error, attempt))
    }
  }

  throw lastError
}

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
  const data = await getWithRateLimitRetry<FigmaNodesResponse>(url, {
    headers: { 'X-Figma-Token': token },
    params: { ids: nodeId },
  })

  const nodeData = data.nodes[nodeId]
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
    const data = await getWithRateLimitRetry<FigmaImagesResponse>(url, {
      headers: { 'X-Figma-Token': token },
      params: { ids: nodeId, format: 'png', scale: 2 },
    })
    return data.images[nodeId] ?? null
  } catch {
    return null
  }
}
