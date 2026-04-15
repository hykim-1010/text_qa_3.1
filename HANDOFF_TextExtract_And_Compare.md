# 텍스트 추출·비교 로직 전달 문서 (Claude Code / 타 프로젝트 이식용)

이 문서는 **Text QA Sync** 프로젝트의 **(1) 웹페이지 텍스트 추출**, **(2) Figma 텍스트 추출**, **(3) Figma vs Web 1:1 매칭·상태 분류** 로직을 다른 코드베이스에 옮길 때 참고하도록 정리한 것이다.  
원본 구현 파일 경로는 각 섹션에 명시한다.

---

## 0. 한 줄 요약

| 구분 | 역할 | 산출물 |
|------|------|--------|
| Web API | Cheerio로 HTML 파싱, 본문 위주 블록 단위 텍스트 배열 | `string[]` |
| Figma API | Figma REST `GET /v1/files/:key` JSON에서 TEXT 노드 수집 | `string[]` |
| 매칭 모듈 | `string-similarity`로 1:1 짝 + 4가지 상태 | `ComparePair[]` |

**UI Diff 하이라이트**는 별도: `diff` 패키지의 `diffWordsWithSpace`로 원문 쌍을 비교해 표시한다. (로직은 `app/page.tsx` 참고)

---

## 1. 의존성 (npm)

```json
"cheerio": "^1.x",
"string-similarity": "^4.x"
```

- Web 추출: **Cheerio** (서버에서 HTML 문자열 파싱)
- 매칭: **string-similarity** (`compareTwoStrings`)

(선택) 프론트에서 차이 하이라이트: **`diff`** 패키지


---

## 3. 웹페이지 텍스트 추출 로직

**파일:** `app/api/web/route.ts`  
**엔드포인트:** `POST /api/web`  
**요청 본문:** `{ "url": "https://..." }`  
**성공 응답:** `{ "texts": string[] }`

### 3.1 전처리 (DOM에서 제거)

1. `body` 기준으로 로드 후, 아래 셀렉터 **전체 제거**:
   - **비콘텐츠:** `script, style, noscript, iframe, object, embed, svg, template, [hidden]`
   - **헤더/푸터/내비 등:**  
     `header, footer, nav, aside`,  
     `[role='banner'], [role='contentinfo'], [role='navigation']`,  
     `.header, .footer, #header, #footer`,  
     `.nav, .navbar, .navigation, .gnb, .lnb`
   - **시각적으로 숨김(블라인드 등):**  
     `[aria-hidden='true']`,  
     `.blind, .sr-only, .screen-reader-only, .visually-hidden, .visuallyhidden`,  
     `.a11y-hidden, .accessibility-hidden, .skip, .offscreen, .off-screen`

### 3.2 스캔 루트

- `body` 안에 **`main`이 있으면** 첫 번째 `main`의 **직계 자식**만 순회
- 없으면 **`body`의 직계 자식**만 순회

### 3.3 블록 단위 수집 (`collectChunks`)

- **리프 블록 태그** (`p, li, h1~h6, blockquote, figcaption, td, th`): 해당 노드의 `text()`를 한 덩어리로 정규화 후 배열에 push
- **컨테이너 블록** (`div, section, article, main, aside, ul, ol, table, thead, tbody, tr`):
  - 자식에 또 블록이 있으면 → 자식에 대해 재귀
  - 블록 자식이 없으면:
    - 내부에 **`a`가 여러 개**면: `a`를 제거한 나머지 텍스트 1덩어리 + **각 `a`의 텍스트를 각각** push (여러 링크를 한 줄로 합치지 않음)
    - 아니면 컨테이너 전체 `text()` 1덩어리
- **`a` 단독**: 링크 텍스트 1덩어리
- 그 외 인라인 등: 자식 있으면 자식 순회, 없으면 텍스트만

### 3.4 정규화

- `normalizeChunk(s)`: 연속 공백/줄바꿈을 단일 공백으로 치환 후 `trim`

### 3.5 HTTP

- `fetch(url)`, User-Agent 설정, **15초 타임아웃**
- `content-type`에 `text/html` 없으면 거부
- 404/5xx/타임아웃 등은 JSON `{ error }` + 적절한 status

---

## 4. Figma 텍스트 추출 로직

**파일:** `app/api/figma/route.ts`  
**엔드포인트:** `POST /api/figma`  
**요청 본문:** `{ "url": "https://www.figma.com/file/..." }` 또는 `.../design/...`  
**성공 응답:** `{ "texts": string[] }`

### 4.1 URL 파싱

- 정규식으로 **file key** 추출:  
  `/(?:figma\.com)\/(?:file|design)\/([a-zA-Z0-9]+)/i`
- 선택적 **node-id** 쿼리:  
  `/[?&]node-id=([\d\-]+)/i` → Figma API 형식으로 `-`를 `:`로 치환

### 4.2 API 호출

- `GET https://api.figma.com/v1/files/{fileKey}`
- 헤더: `X-Figma-Token: {FIGMA_ACCESS_TOKEN}`

### 4.3 문서에서 텍스트 수집 (`collectTextNodes`)

- JSON 루트 `document`에서 시작 (또는 `node-id`로 찾은 서브트리)
- 재귀 순회:
  - `visible === false`인 노드는 **자손 포함 스킵** (부모 가시성과 AND)
  - `type === "TEXT"` 이고 `characters`가 문자열이면 `trim` 후 비어 있지 않을 때만 `out`에 push
  - `children` 배열이 있으면 각 자식에 대해 동일 처리

### 4.4 에러 처리

- 토큰 없음 / 403 / 404 / 기타 Figma 오류는 JSON `{ error }` 반환

---

## 5. Figma vs Web 비교·매칭 로직

**파일:** `lib/smartMatch.ts`  
**함수:** `buildComparePairs(figmaTexts: string[], webTexts: string[]): ComparePair[]`

### 5.1 타입

```ts
type PairStatus = "pass" | "needs_edit" | "web_only" | "figma_only";

interface ComparePair {
  figmaText: string | null;
  webText: string | null;
  status: PairStatus;
  similarity?: number;
}
```

### 5.2 짝 찾기용 전처리 (`normalizeForPairing`)

- 소문자 변환
- `\s+` → 단일 공백, `trim`
- **유사도 계산에는 이 문자열만 사용**

### 5.3 통과(Pass) 판정용 — Figma만 (`normalizeFigmaForPass`)

- 정규식: `/\s*[\n\r]+\s*/g` → 공백 **한 칸**으로 치환 (줄바꿈 주변 잡다한 공백을 한 칸으로 묶음)
- **Web 원문은 전처리하지 않음**
- `normalizeFigmaForPass(figmaOriginal) === webOriginal` 이면 **`pass`**, 아니면 **`needs_edit`**

### 5.4 1:1 매칭 알고리즘 (요약)

1. 각 Figma 인덱스 `fi`에 대해, 모든 Web 인덱스 `wi`와 `compareTwoStrings(figmaForPairing[fi], webForPairing[wi])`로 유사도 계산 → **가장 높은 wi**를 후보로 `(fi, wi, sim)` 저장
2. 후보들을 **유사도 내림차순** 정렬
3. 순서대로 순회하며:
   - 이미 사용된 `fi` 또는 `wi`면 스킵
   - `sim < 0.8` 이면 스킵
   - 그렇지 않으면 짝 확정, `figmaUsed`/`webUsed`에 표시  
     - 상태: 위 Pass 규칙으로 `pass` vs `needs_edit`
4. 매칭 안 된 Figma 항목 → `figma_only` (`webText: null`)
5. 매칭 안 된 Web 항목 → `web_only` (`figmaText: null`)
6. 빈 문자열(짝 찾기 전처리 후)인 항목은 후보/미매칭 처리에서 제외하는 방식과 동일하게 구현됨 (원본 코드 참고)

### 5.5 상수

- **최소 유사도(짝 허용):** `0.8` (`SIMILARITY_NEEDS_EDIT`)

---

## 6. 이 프로젝트에서 파일 복사 시 체크리스트

- [ ] `app/api/web/route.ts` → 동일 스택(Next Route Handler)이면 그대로, 아니면 로직만 이식
- [ ] `app/api/figma/route.ts` + `FIGMA_ACCESS_TOKEN`
- [ ] `lib/smartMatch.ts` + `npm i string-similarity`
- [ ] Web 라우트에 `cheerio` 설치
- [ ] 프론트: `POST`로 `url` 전달, 응답 `texts`로 `buildComparePairs(figmaTexts, webTexts)` 호출

---

## 7. Claude Code에게 줄 때 한 줄 프롬프트 예시

> 아래 `HANDOFF_TextExtract_And_Compare.md` 스펙대로, (A) Cheerio 기반 웹 텍스트 추출 API, (B) Figma Files API 텍스트 추출 API, (C) `string-similarity` 기반 `buildComparePairs` 모듈을 현재 프로젝트 구조에 맞게 구현해 줘. 원본 알고리즘(제거 셀렉터, main 우선, a 태그 분리, 유사도 0.8, Figma 줄바꿈 정규화 후 Pass)은 문서와 동일하게 유지해.

---

## 8. 알려진 한계 (이식 시 참고)

- **Figma가 여러 TEXT 노드로 쪼개지고 Web은 한 덩어리**인 경우, 유사도가 0.8 미만이면 짝이 안 맺어 `figma_only` / `web_only`로 갈라질 수 있음 (별도 “블록 병합” 휴리스틱은 없음).
- **웹 `fetch`는 대상 사이트의 CORS/봇 차단에 영향**받음. 서버 사이드에서만 호출하는 현재 방식이 일반적이다.

---

*문서 생성 기준: 저장소 내 `app/api/web/route.ts`, `app/api/figma/route.ts`, `lib/smartMatch.ts`*
