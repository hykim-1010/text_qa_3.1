export type TextNode = {
  id: string
  text: string
  x: number
  y: number
  width: number
  height: number
  source: 'figma' | 'web'
}

export type MatchStatus = 'match' | 'mismatch' | 'missing' | 'added'

export type DiffChar = {
  value: string
  added?: boolean
  removed?: boolean
}

export type CompareResult = {
  id: string
  sourceNode: TextNode | null
  targetNode: TextNode | null
  status: MatchStatus
  diff?: DiffChar[]
}
