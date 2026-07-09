---
name: test-strategy
description: web21-funda에서 테스트를 어느 버킷(unit/storybook/e2e)에 넣을지 정하고, 테스트 설명·셀렉터를 계약 기반으로 쓰는 절차 스킬. "테스트 작성", "테스트 추가", "이거 어느 버킷에", "테스트 리뷰해줘" 요청 시 트리거한다. 버킷 선택 근거와 계약 기반 문장 규칙만 다루고, 컴포넌트/데이터 구현 절차는 다루지 않는다.
---

# Test-Strategy — 버킷 선택 + 계약 기반 테스트 작성

새/변경 코드에 테스트를 추가할 때 **어느 버킷에 넣을지**와 **테스트 설명·셀렉터를 어떻게 쓸지** 정하는 절차.

> 규칙 기준: `CLAUDE.md` §5(테스트). 컴포넌트 구현은 `component` 스킬, 데이터 흐름은 `data-flow` 스킬 참조.

## Step 1: 버킷 판별

파일 하나를 놓고 위에서부터 순서대로 묻는다. 먼저 참인 조건이 그 파일의 버킷이다.

1. **순수 로직/훅/컴포넌트 렌더·이벤트를 jsdom으로 검증할 수 있는가?** → `unit` 버킷 (vitest, jsdom, `src/**/*.test.{ts,tsx}`). **대부분의 새 테스트는 여기로 간다.**
   - 위치: 전역 컴포넌트 → `src/components/test/`, 범용 훅 → `src/hooks/test/`, 페이지 통합 → `src/tests/`, 도메인 코드 → 대상 인접.
2. **전역 컴포넌트의 시각 상태·a11y를 실제 브라우저에서 검증해야 하는가?** → `storybook` 버킷 — 스토리(`src/components/story/*.stories.tsx`)에 play 함수/상태를 추가한다. 별도 테스트 파일을 만들지 않는다.
3. **실제 라우팅·API 왕복·여러 화면에 걸친 사용자 플로우인가?** (또는 jsdom이 재현 못 하는 실제 스크롤/포커스/WebGL) → `e2e/{flow-name}.spec.ts` Playwright 스펙. 기존 이름 관례: `guest-learning-flow.spec.ts`, `quiz-result-navigation.spec.ts`처럼 사용자 대면 플로우 이름.

```bash
pnpm --filter frontend test              # unit
pnpm --filter frontend test:storybook    # storybook (chromium headless)
pnpm --filter frontend test:e2e          # playwright — dev 서버 자동 기동(:5173)
```

버킷은 **검증 수단 단위**지 폴더 위치가 아니다 — "features에 있으니 e2e"가 아니라 위 판별 순서를 그대로 따른다.

## Step 2: 계약 기반 테스트 설명

형식: **"[조건/맥락]일 때, [주체]는 [기대 동작/상태 변화]해야 한다."**

- 나쁜 예: `"저장이 된다"`, `"버튼 클릭 시 동작"`, `"정상적으로 렌더된다"` — 조건과 결과가 한 문장에 없다.
- 좋은 예: `"하트가 0개일 때 학습 시작 버튼을 누르면, 하트 부족 모달이 열려야 한다."`
- `"works"`/`"handles click"`류의 모호한 라벨은 그 자체로 리젝 사유다.

## Step 3: 셀렉터 규율

우선순위: `getByRole` → `getByLabelText` → 화면에 보이는 텍스트. `data-testid`는 다음 경우에만:

- 접근성 트리에 의미 있는 role/label이 없는 구조적 이음새(예: 3D 캔버스 mock 컨테이너).
- 이 외에는 Emotion이 생성한 클래스명(`css-xxxx`)이나 우연한 DOM 중첩 구조를 assert하지 않는다 — 스타일 구현 세부사항을 테스트가 얼려버린다.

## Step 4: mock 규율

- **API는 `src/mocks/handlers.ts`(MSW)로** — 테스트 안에서 `fetch`/`apiFetch`를 직접 스텁하지 않는다. 필요한 핸들러가 없으면 handlers에 추가한다.
- 소켓은 `@mswjs/socket.io-binding` 기존 패턴을 따른다.
- **3D(Fundy)**: jsdom에 WebGL이 없으므로 Canvas 하위는 통째로 mock하고, 캔버스 밖 계약(마운트 props, 로딩 fallback)만 unit으로 검증한다. 캐릭터 렌더 자체는 육안 회귀(CLAUDE.md §9)의 몫 — 억지로 자동화하지 않는다.
- 시간 의존(카운트다운, 스트릭)은 `vi.useFakeTimers()`로 고정한다.

## Step 5: e2e 작성 시

- `e2e/helpers.ts`의 기존 헬퍼(로그인/시드 등)를 먼저 확인하고 재사용한다.
- 스펙 하나 = 사용자 플로우 하나. 여러 무관한 검증을 한 스펙에 몰지 않는다.

## 자가 확인

- [ ] 버킷 판별을 Step 1의 순서(unit → storybook → e2e)대로 했는가?
- [ ] 파일 위치가 기존 관례(components/test, hooks/test, src/tests, e2e/)를 따르는가?
- [ ] 모든 테스트 설명이 "[조건]일 때 [주체]는 [기대 결과]해야 한다" 형식인가?
- [ ] `getByRole`/`getByLabelText`/텍스트를 우선했고, `data-testid`는 접근성 트리에 의미가 없는 경우로 한정했는가?
- [ ] Emotion 클래스명이나 우연한 DOM 구조를 assert하지 않았는가?
- [ ] API mock이 MSW handlers 경유인가(개별 fetch 스텁 없음)?
