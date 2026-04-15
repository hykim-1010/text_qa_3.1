import type { TextNode } from '@/types'

// ROW_THRESHOLD: 두 노드의 Y 좌표 차이가 이 값(px) 이하이면 같은 행으로 판단한다.
// 이 값을 바꾸면 전체 그룹화 결과가 달라지므로, 변경 시 반드시 이유를 주석으로 명시할 것.
// 현재 값(15px)은 일반적인 줄간격(line-height) 절반 수준으로, 인접 행 오버랩을 허용하기 위해 설정됨.
const ROW_THRESHOLD = 15

/**
 * 노드 배열을 시각적 읽기 순서(위→아래, 왼→오른)로 정렬한다.
 * 1. 전체를 Y 오름차순으로 정렬
 * 2. ROW_THRESHOLD 이내의 노드를 같은 행으로 묶음
 * 3. 각 행 내부는 X 오름차순으로 정렬
 * 4. 행 순서대로 평탄화하여 반환
 */
export const sortByVisualFlow = (nodes: TextNode[]): TextNode[] => {
  const rows = groupByRows(nodes)
  return rows.flat()
}

/**
 * 노드 배열을 행(row) 단위로 그룹화한다.
 * Y 좌표를 기준으로 오름차순 정렬한 뒤,
 * 이전 행의 기준 Y값과의 차이가 ROW_THRESHOLD 이하이면 같은 행에 포함한다.
 * 각 행 내부는 X 오름차순으로 정렬된다.
 */
export const groupByRows = (nodes: TextNode[]): TextNode[][] => {
  if (nodes.length === 0) return []

  const sorted = [...nodes].sort((a, b) => a.y - b.y)

  const rows: TextNode[][] = []
  let currentRow: TextNode[] = [sorted[0]]
  let rowBaseY = sorted[0].y

  for (let i = 1; i < sorted.length; i++) {
    const node = sorted[i]
    if (node.y - rowBaseY <= ROW_THRESHOLD) {
      currentRow.push(node)
    } else {
      rows.push(currentRow.sort((a, b) => a.x - b.x))
      currentRow = [node]
      rowBaseY = node.y
    }
  }

  rows.push(currentRow.sort((a, b) => a.x - b.x))

  return rows
}
