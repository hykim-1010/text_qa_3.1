'use client'

let sessionFigmaToken: string | null = null

export function setSessionFigmaToken(token: string): void {
  const trimmed = token.trim()
  sessionFigmaToken = trimmed.length > 0 ? trimmed : null
}

export function getSessionFigmaToken(): string | null {
  return sessionFigmaToken
}

export function clearSessionFigmaToken(): void {
  sessionFigmaToken = null
}
