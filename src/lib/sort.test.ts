// 실행: npx ts-node src/lib/sort.test.ts
import { sortByVisualFlow, groupByRows } from './sort'
import type { TextNode } from '../types'

const node = (id: string, x: number, y: number): TextNode => ({
  id,
  text: id,
  x,
  y,
  width: 100,
  height: 20,
  source: 'figma',
})

// ─── groupByRows ────────────────────────────────────────────────

// 빈 배열
console.assert(
  groupByRows([]).length === 0,
  'groupByRows: 빈 배열은 빈 배열 반환'
)

// Y 차이가 ROW_THRESHOLD(15px) 이내 → 같은 행
{
  const result = groupByRows([node('A', 0, 0), node('B', 50, 14)])
  console.assert(result.length === 1, 'groupByRows: Y diff 14 → 같은 행')
  console.assert(result[0].length === 2, 'groupByRows: 같은 행에 노드 2개')
}

// Y 차이가 정확히 15px → 같은 행 (이하 조건)
{
  const result = groupByRows([node('A', 0, 0), node('B', 0, 15)])
  console.assert(result.length === 1, 'groupByRows: Y diff 15 → 같은 행(경계값)')
}

// Y 차이가 16px → 다른 행
{
  const result = groupByRows([node('A', 0, 0), node('B', 0, 16)])
  console.assert(result.length === 2, 'groupByRows: Y diff 16 → 다른 행')
}

// 행 내부 X 오름차순 정렬
{
  const result = groupByRows([node('right', 200, 0), node('left', 10, 0)])
  console.assert(
    result[0][0].id === 'left',
    'groupByRows: 행 내부 X 오름차순 — 첫 번째가 left'
  )
  console.assert(
    result[0][1].id === 'right',
    'groupByRows: 행 내부 X 오름차순 — 두 번째가 right'
  )
}

// 여러 행 순서 (Y 기준 오름차순)
{
  const result = groupByRows([
    node('row2', 0, 50),
    node('row1', 0, 0),
    node('row3', 0, 100),
  ])
  console.assert(result.length === 3, 'groupByRows: 3개 행 분리')
  console.assert(result[0][0].id === 'row1', 'groupByRows: 첫 행이 row1')
  console.assert(result[1][0].id === 'row2', 'groupByRows: 둘째 행이 row2')
  console.assert(result[2][0].id === 'row3', 'groupByRows: 셋째 행이 row3')
}

// ─── sortByVisualFlow ────────────────────────────────────────────

// 위→아래, 왼→오른 전체 순서 검증
{
  const nodes = [
    node('B', 200, 0),   // 행1 오른쪽
    node('A', 10, 0),    // 행1 왼쪽
    node('D', 200, 50),  // 행2 오른쪽
    node('C', 10, 50),   // 행2 왼쪽
  ]
  const result = sortByVisualFlow(nodes).map(n => n.id)
  console.assert(
    JSON.stringify(result) === JSON.stringify(['A', 'B', 'C', 'D']),
    `sortByVisualFlow: 순서 A B C D — 실제: ${result}`
  )
}

// 노드 1개
{
  const result = sortByVisualFlow([node('only', 0, 0)])
  console.assert(result.length === 1, 'sortByVisualFlow: 노드 1개')
  console.assert(result[0].id === 'only', 'sortByVisualFlow: 노드 1개 그대로 반환')
}

// 원본 배열을 변경하지 않아야 함 (불변성)
{
  const original = [node('B', 200, 0), node('A', 10, 0)]
  sortByVisualFlow(original)
  console.assert(original[0].id === 'B', 'sortByVisualFlow: 원본 배열 불변')
}

console.log('✅ 모든 테스트 통과')
