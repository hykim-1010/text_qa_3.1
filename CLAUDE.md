# Visual Text Auditor — Project Brain

## 프로젝트 개요
Figma 기획서/디자인과 실제 웹페이지의 텍스트를 자동으로 비교해주는 검수 도구.
기획자가 피그마를 켜놓고 눈으로 대조하는 작업을 없애는 것이 목표.

## 비교 모드
- **Mode A (Figma → Figma)**: 기획서 프레임 vs 디자인 시안 프레임
- **Mode B (Figma → Web)**: 디자인 시안 vs 실서비스 URL

## 기술 스택
- **Framework**: Next.js 14 (App Router)
- **UI**: shadcn/ui + Tailwind CSS
- **스크래핑**: Playwright (headless Chromium)
- **텍스트 비교**: `diff` 패키지 (diffChars)
- **HTTP**: axios
- **타입**: TypeScript strict mode

## 핵심 타입 정의 (src/types/index.ts 기준)

```typescript
type TextNode = {
  id: string
  text: string
  x: number
  y: number
  width: number
  height: number
  source: 'figma' | 'web'
}

type MatchStatus = 'match' | 'mismatch' | 'missing' | 'added'

type CompareResult = {
  id: string
  sourceNode: TextNode | null
  targetNode: TextNode | null
  status: MatchStatus
  diff?: DiffChar[]  // mismatch일 때만 존재
}

type DiffChar = {
  value: string
  added?: boolean
  removed?: boolean
}
```

## 색상 시스템 (상태별 고정 컬러)
| 상태 | 의미 | Tailwind 클래스 |
|------|------|----------------|
| match | 완전 일치 | `bg-green-50 border-green-200 text-green-800` |
| mismatch | 내용 다름 | `bg-orange-50 border-orange-200 text-orange-800` |
| missing | 소스에만 존재 | `bg-red-50 border-red-200 text-red-800` |
| added | 타겟에만 존재 | `bg-blue-50 border-blue-200 text-blue-800` |

## 정렬 알고리즘 규칙 (절대 변경 금지)
```
Y축 우선 정렬 → Y 차이가 ROW_THRESHOLD(15px) 이하이면 같은 행으로 판단 → X축 정렬
```
- `ROW_THRESHOLD`는 상수로 분리해서 `src/lib/sort.ts` 상단에 선언
- 이 값을 바꾸면 전체 그룹화 결과가 달라지므로 반드시 주석으로 이유 명시

## 디렉토리 구조
```
src/
  app/
    page.tsx              # 모드 선택 홈
    compare/page.tsx      # 결과 뷰어
    api/
      figma/route.ts      # Figma REST API 래퍼
      scrape/route.ts     # Playwright 스크래핑
      compare/route.ts    # 비교 로직 실행
  components/
    ModeSelector.tsx      # 모드 선택 UI
    UrlInputForm.tsx       # URL 입력 폼
    ResultViewer.tsx       # 2열 비교 결과
    StatusBadge.tsx        # 상태 뱃지
    DiffHighlight.tsx      # 문자 단위 하이라이트
  lib/
    sort.ts               # 정렬 + 그룹화 (핵심 로직)
    compare.ts            # Diff 비교 로직
    figma.ts              # Figma API 클라이언트
  types/
    index.ts              # 전체 타입 정의
```

## 환경변수 (.env.local)
```
FIGMA_ACCESS_TOKEN=      # Figma Personal Access Token
```

## 자주 쓰는 명령어
```bash
npm run dev              # 개발 서버 (localhost:3000)
npm run build            # 프로덕션 빌드
npm run lint             # ESLint 검사
npm run type-check       # tsc --noEmit
```

## 코드 스타일 규칙
- 컴포넌트는 모두 **함수형 + 화살표 함수**로 작성
- `async/await` 사용, Promise chain 금지
- API route는 반드시 try/catch + 의미있는 에러 메시지 반환
- 타입 단언(`as`) 최소화, unknown 먼저 받고 좁히기
- 컴포넌트 props는 반드시 interface로 정의

## 개발 단계 (Phase)
각 Phase는 독립된 Claude Code 세션으로 진행할 것.
세션 시작 전 반드시 /clear 로 컨텍스트 초기화.

| Phase | 내용 | 예상 소요 |
|-------|------|----------|
| 0 | 프로젝트 초기화 + 타입 정의 | 15분 |
| 1 | 모드 선택 UI + URL 입력 폼 | 30분 |
| 2A | Figma API 추출 로직 | 40분 |
| 2B | Playwright 스크래핑 | 40분 |
| 3 | 정렬 엔진 (sort.ts) | 30분 |
| 4 | Diff 비교 로직 (compare.ts) | 30분 |
| 5 | 결과 뷰어 UI | 45분 |
| 6 | 내보내기 + 통합 테스트 | 30분 |

## 기기 간 동기화 루틴
이 프로젝트는 여러 기기에서 작업한다. Claude Code는 항상 로컬 클론 폴더에서 실행.

```bash
# 작업 시작 전 (어느 기기든 무조건)
git pull

# 작업 끝날 때
git add .
git commit -m "feat: 작업 내용 요약"
git push
```

**컨텍스트 복원**: 새 기기에서 Claude Code를 열면 CLAUDE.md가 자동으로 로드됨.
긴 세션 중간에 기기를 바꿔야 할 경우, 전환 전에 아래 명령을 실행할 것:
```
지금까지 작업한 내용과 다음에 할 일을 CLAUDE.md의 "## 현재 진행 상황" 섹션에 업데이트해줘.
```
그러면 다른 기기에서 `git pull` 후 Claude Code를 열었을 때 바로 이어서 작업 가능.

## 주의사항
- Playwright는 서버 컴포넌트에서만 실행 (클라이언트 번들에 포함되면 안 됨)
- Figma API 응답은 재귀 구조이므로 DFS로 탐색
- absoluteBoundingBox 가 null인 노드는 스킵
- HTML 스크래핑 시 script, style, noscript 태그 내부 텍스트 제외
