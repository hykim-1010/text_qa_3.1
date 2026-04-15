'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'

type TextSource = 'figma' | 'figma1' | 'figma2' | 'web'

interface CopyableTextProps {
  text: string
  source: TextSource
}

const TOAST_LABEL: Record<TextSource, string> = {
  figma:  'Figma 텍스트 복사완료',
  figma1: 'Figma1 텍스트 복사완료',
  figma2: 'Figma2 텍스트 복사완료',
  web:    'WEB 텍스트 복사완료',
}

const CopyableText = ({ text, source }: CopyableTextProps) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard API 미지원 환경 무시
    }
  }

  return (
    <>
      <button
        onClick={handleCopy}
        title="클릭하여 복사"
        className="w-full text-left group"
      >
        <span className="font-mono text-base text-gray-700 break-all whitespace-pre-wrap leading-[1.4] transition-colors group-hover:text-[#5e6ad2] group-hover:underline group-hover:underline-offset-2 cursor-copy">
          {text}
        </span>
      </button>

      {copied && typeof document !== 'undefined' && createPortal(
        <div className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg bg-gray-900 border border-gray-700 shadow-xl text-sm font-medium text-white pointer-events-none animate-fade-in">
          {TOAST_LABEL[source]}
        </div>,
        document.body,
      )}
    </>
  )
}

export default CopyableText
