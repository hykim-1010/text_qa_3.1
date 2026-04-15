'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { DiffChar } from '@/types'

interface DiffHighlightProps {
  diffs: DiffChar[]
  side: 'source' | 'target'
  copyText: string
  toastLabel: string
}

const DiffHighlight = ({ diffs, side, copyText, toastLabel }: DiffHighlightProps) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard API 미지원 환경 무시
    }
  }

  return (
    <>
      <button onClick={handleCopy} title="클릭하여 복사" className="w-full text-left group">
        <span className="font-mono text-base leading-[1.4] break-all whitespace-pre-wrap transition-opacity group-hover:opacity-80 cursor-copy">
          {diffs.map((part, i) => {
            // source(Figma) 쪽: removed 강조, added는 숨김
            // target(Web) 쪽: added 강조, removed는 숨김
            if (side === 'source') {
              if (part.added) return null
              if (part.removed) {
                return (
                  <mark key={i} className="bg-red-100 text-red-700 rounded-[2px] px-[1px] not-italic">
                    {part.value}
                  </mark>
                )
              }
            } else {
              if (part.removed) return null
              if (part.added) {
                return (
                  <mark key={i} className="bg-green-100 text-green-700 rounded-[2px] px-[1px] not-italic">
                    {part.value}
                  </mark>
                )
              }
            }
            return <span key={i} className="text-gray-800">{part.value}</span>
          })}
        </span>
      </button>

      {copied && typeof document !== 'undefined' && createPortal(
        <div className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg bg-gray-900 border border-gray-700 shadow-xl text-sm font-medium text-white pointer-events-none animate-fade-in">
          {toastLabel}
        </div>,
        document.body,
      )}
    </>
  )
}

export default DiffHighlight
