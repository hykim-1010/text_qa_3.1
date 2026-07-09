'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, Suspense } from 'react'
import type { ComparePair } from '@/lib/compare'
import type { TextNode } from '@/types'
import ResultViewer from '@/components/ResultViewer'
import { getSessionFigmaToken } from '@/lib/figmaTokenSession'

interface Summary {
  total: number
  pass: number
  needs_edit: number
  figma_only: number
  web_only: number
}

type Bounds = { x: number; y: number; width: number; height: number }

type State =
  | { phase: 'loading'; message: string }
  | { phase: 'error'; message: string }
  | {
      phase: 'done'
      pairs: ComparePair[]
      summary: Summary
      sourceScreenshot: string | null
      targetScreenshot: string | null
      sourceBounds: Bounds | null
      targetBounds: Bounds | null
    }

async function fetchFigmaNodes(figmaUrl: string, figmaToken: string): Promise<{ nodes: TextNode[]; screenshotUrl: string | null; frameBounds: Bounds | null }> {
  const res = await fetch('/api/figma', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: figmaUrl, figmaToken }),
  })
  const data: unknown = await res.json()
  if (!res.ok) {
    const msg =
      typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error: unknown }).error)
        : 'Figma 텍스트를 가져오지 못했습니다.'
    throw new Error(msg)
  }
  const d = data as { nodes: TextNode[]; screenshotUrl?: string | null; frameBounds?: Bounds | null }
  return { nodes: d.nodes, screenshotUrl: d.screenshotUrl ?? null, frameBounds: d.frameBounds ?? null }
}

async function fetchWebNodes(webUrl: string, forceExpand: boolean): Promise<{ nodes: TextNode[]; screenshotBase64: string | null; pageWidth: number | null; pageHeight: number | null }> {
  const res = await fetch('/api/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webUrl, forceExpand }),
  })
  const data: unknown = await res.json()
  if (!res.ok) {
    const msg =
      typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error: unknown }).error)
        : '웹페이지 스크래핑에 실패했습니다.'
    throw new Error(msg)
  }
  const d = data as { nodes: TextNode[]; screenshotBase64?: string | null; pageWidth?: number | null; pageHeight?: number | null }
  return { nodes: d.nodes, screenshotBase64: d.screenshotBase64 ?? null, pageWidth: d.pageWidth ?? null, pageHeight: d.pageHeight ?? null }
}

async function runCompare(
  figmaNodes: TextNode[],
  webNodes: TextNode[],
): Promise<{ pairs: ComparePair[]; summary: Summary }> {
  const res = await fetch('/api/compare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ figmaNodes, webNodes }),
  })
  const data: unknown = await res.json()
  if (!res.ok) {
    const msg =
      typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error: unknown }).error)
        : '비교에 실패했습니다.'
    throw new Error(msg)
  }
  return data as { pairs: ComparePair[]; summary: Summary }
}

function CompareContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [state, setState] = useState<State>({ phase: 'loading', message: '초기화 중...' })
  const [showTop, setShowTop] = useState(false)
  const startedRequestKeyRef = useRef<string | null>(null)

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 300)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const mode = searchParams.get('mode') as 'A' | 'B' | null
  const src = searchParams.get('src') ?? ''
  const tgt = searchParams.get('tgt') ?? ''
  const web = searchParams.get('web') ?? ''
  const forceExpand = searchParams.get('fex') === 'true'

  const sourceLabel = mode === 'A' ? 'Figma 기획안' : 'Figma 시안'
  const targetLabel = mode === 'A' ? 'Figma 시안' : '웹페이지'

  useEffect(() => {
    if (!mode || !src) {
      setState({ phase: 'error', message: '잘못된 요청입니다. 홈으로 돌아가 다시 시도해 주세요.' })
      return
    }

    const requestKey = JSON.stringify({ mode, src, tgt, web, forceExpand })
    if (startedRequestKeyRef.current === requestKey) {
      return
    }
    startedRequestKeyRef.current = requestKey

    const run = async () => {
      try {
        const figmaToken = getSessionFigmaToken()
        if (!figmaToken) {
          setState({ phase: 'error', message: 'Figma 토큰이 없습니다. 이전 화면에서 다시 입력해 주세요.' })
          return
        }

        setState({ phase: 'loading', message: 'Figma 소스 텍스트 추출 중...' })
        const figmaResult = await fetchFigmaNodes(src, figmaToken)

        let webNodes: TextNode[]
        let targetScreenshot: string | null = null
        const sourceBounds: Bounds | null = figmaResult.frameBounds
        let targetBounds: Bounds | null = null

        if (mode === 'A') {
          setState({ phase: 'loading', message: 'Figma 타깃 텍스트 추출 중...' })
          const tgtResult = await fetchFigmaNodes(tgt, figmaToken)
          webNodes = tgtResult.nodes
          targetScreenshot = tgtResult.screenshotUrl
          targetBounds = tgtResult.frameBounds
        } else {
          setState({ phase: 'loading', message: '웹페이지 스크래핑 중...' })
          const webResult = await fetchWebNodes(web, forceExpand)
          webNodes = webResult.nodes
          targetScreenshot = webResult.screenshotBase64
          if (webResult.pageWidth !== null && webResult.pageHeight !== null) {
            targetBounds = { x: 0, y: 0, width: webResult.pageWidth, height: webResult.pageHeight }
          }
        }

        setState({ phase: 'loading', message: '텍스트 비교 중...' })
        const { pairs, summary } = await runCompare(figmaResult.nodes, webNodes)

        setState({
          phase: 'done',
          pairs,
          summary,
          sourceScreenshot: figmaResult.screenshotUrl,
          targetScreenshot,
          sourceBounds,
          targetBounds,
        })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.'
        startedRequestKeyRef.current = null
        setState({ phase: 'error', message: msg })
      }
    }

    run()
  }, [mode, src, tgt, web, forceExpand])

  return (
    <div className="flex flex-col w-full min-h-screen bg-gray-50">
      <header className="flex items-center gap-3 px-6 h-12 border-b border-gray-100 bg-white flex-shrink-0">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="flex items-center gap-1.5 text-gray-400 hover:text-gray-700 transition-colors duration-100 focus:outline-none"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M8 2.5 4.5 6.5 8 10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-sm">뒤로</span>
        </button>
      </header>

      <main className="flex-1 px-8 py-8 pb-24 max-w-7xl mx-auto w-full">
        {state.phase === 'loading' && (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <svg width="20" height="20" viewBox="0 0 20 20" className="animate-spin text-[#5e6ad2]" fill="none">
              <circle cx="10" cy="10" r="8" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
              <path d="M10 2a8 8 0 0 1 8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <p className="text-base text-gray-500">{state.message}</p>
          </div>
        )}

        {state.phase === 'error' && (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-red-50 border border-red-200 max-w-lg text-center">
              <p className="text-base text-red-600">{state.message}</p>
            </div>
            <button type="button" onClick={() => router.push('/')} className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
              홈으로 이동
            </button>
          </div>
        )}

        {state.phase === 'done' && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl font-semibold text-gray-900 tracking-tight">비교 결과</h1>
              <p className="text-base text-gray-500 leading-[1.4]">{sourceLabel} vs {targetLabel}</p>
            </div>
            <ResultViewer
              pairs={state.pairs}
              summary={state.summary}
              sourceLabel={sourceLabel}
              targetLabel={targetLabel}
              mode={mode ?? undefined}
              sourceScreenshot={state.sourceScreenshot}
              targetScreenshot={state.targetScreenshot}
              sourceBounds={state.sourceBounds}
              targetBounds={state.targetBounds}
            />
          </div>
        )}
      </main>

      <button
        type="button"
        onClick={() => router.push('/')}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-6 py-3 rounded-full border border-gray-200 bg-white text-base text-gray-500 hover:text-gray-800 hover:border-gray-300 hover:bg-gray-50 shadow-md transition-all duration-150"
      >
        다른 페이지 검수하기
      </button>

      {showTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-40 w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 hover:text-gray-700 hover:border-gray-300 shadow-md transition-all duration-150"
          aria-label="맨 위로"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2.5 8.5 6.5 5l4 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  )
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-gray-400">로딩 중...</div>}>
      <CompareContent />
    </Suspense>
  )
}

