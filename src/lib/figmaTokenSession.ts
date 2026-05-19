'use client'

let sessionFigmaToken: string | null = null
const SESSION_STORAGE_KEY = 'figma_pat_session'

export function setSessionFigmaToken(token: string): void {
  const trimmed = token.trim()
  sessionFigmaToken = trimmed.length > 0 ? trimmed : null
  if (typeof window === 'undefined') return
  if (sessionFigmaToken) {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, sessionFigmaToken)
  } else {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
  }
}

export function getSessionFigmaToken(): string | null {
  if (!sessionFigmaToken && typeof window !== 'undefined') {
    const stored = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
    sessionFigmaToken = stored && stored.trim().length > 0 ? stored : null
  }
  return sessionFigmaToken
}

export function clearSessionFigmaToken(): void {
  sessionFigmaToken = null
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
  }
}
