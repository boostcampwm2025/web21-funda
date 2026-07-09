# CLAUDE.md — web21-funda 프론트엔드 운영 매뉴얼

이 문서는 이 레포에서 **프론트엔드(`apps/frontend`)** 작업을 할 때 지켜야 할 규칙의 단일 출처다.
`.claude/skills/`와 `.claude/agents/`는 이 문서의 섹션 번호(§N)를 참조하고, 규칙을 복제하지 않는다.
백엔드(`apps/backend`, NestJS+TypeORM)는 이 문서의 범위 밖이다 — 백엔드 작업 요청이 오면 이 문서를 기준으로 삼지 말 것.

성능 개선 작업(API 캐싱, 3D 최적화)은 `HEADSON.md`가 실행 계획서다. 관련 파일(`src/services/api.ts`, `src/hooks/queries/*`, `src/features/fundy/*`, `src/router/index.tsx`)을 건드리기 전에 해당 Phase를 먼저 읽는다.

---

## §0. 레포 구조와 명령어

pnpm workspace + Turborepo 모노레포. 프론트엔드 명령은 항상 `--filter frontend`로:

```bash
pnpm --filter frontend dev              # Vite dev 서버 (:5173)
pnpm --filter frontend lint             # eslint (simple-import-sort 포함)
pnpm --filter frontend build            # tsc -b + vite build — 타입 체크는 이걸로
pnpm --filter frontend test             # vitest unit 프로젝트 (jsdom)
pnpm --filter frontend test:storybook   # vitest storybook 프로젝트 (chromium)
pnpm --filter frontend test:e2e         # playwright (e2e/, dev 서버 자동 기동)
pnpm --filter frontend storybook        # storybook dev (:6006)
```

**주의**: `apps/frontend`에는 `check-types` 스크립트가 없다. 루트의 `pnpm check-types`(turbo)는 프론트엔드를 건너뛴다. **타입 검증은 `pnpm --filter frontend build`(또는 `pnpm --filter frontend exec tsc -b`)로 한다.**

Git 훅(husky): `pre-commit`은 lint-staged(prettier+eslint --fix), `pre-push`는 lint → check-types → build를 순차 실행. **실패 시 `--no-verify`로 우회하지 않는다** (§10-5).

## §1. 프론트엔드 레이어 구조

스택: React 19 + Vite 7 + TS / react-router-dom 7(`createBrowserRouter`) / @tanstack/react-query 5(서버 상태) / zustand 5(클라이언트 상태) / Emotion(css prop) / three + @react-three/fiber + drei(3D) / socket.io-client / MSW(mock).

```
src/
  components/        전역 재사용 원자 UI (Button, Modal, Toast …)
    story/           그 컴포넌트들의 Storybook 스토리
    test/            그 컴포넌트들의 vitest 테스트
  features/{domain}/ 도메인 기능 (components/, hooks/, types.ts, utils/)
  pages/             라우트 진입 컨테이너 (화면 조립만)
  layouts/           공용 레이아웃
  router/            createBrowserRouter 정의 + loaders/
  services/          api.ts(fetch 래퍼) + 도메인 서비스 ({domain}Service.ts)
  hooks/queries/     react-query 훅 ({domain}Queries.ts) + 쿼리 키 팩토리
  hooks/             범용 훅 (useSocket, useStorage …) + test/
  store/             zustand 스토어 ({name}Store.tsx, actions 객체 패턴)
  styles/            token.ts(palette→시맨틱 컬러) / theme.ts(light/dark) / typography.ts
  mocks/             MSW handlers
  tests/             페이지 단위 통합 테스트
e2e/                 Playwright 스펙 (*.spec.ts)
```

**의존 방향** (역방향 import는 구조 위반):

- `pages → features → components`, 누구나 → `hooks`/`store`/`styles`/`utils`
- 데이터: `components/features/pages → hooks/queries → services → api.ts`. **컴포넌트가 services를 직접 import하지 않는다** (mutation 포함 — 반드시 쿼리 훅 경유).
- `components/`(전역 원자)는 `features/`를 import하지 않는다.
- `services/`는 React를 import하지 않는다 (순수 함수만).

**경로 별칭** (구체적인 것부터 매칭): `@/comp` → `src/components`, `@/feat` → `src/features`, `@` → `src`. 상대 경로는 같은 폴더(`./`) 안에서만.

**라우팅**: `src/router/index.tsx`의 라우트는 lazy가 기본. eager import는 현재 `Login`/`AuthCheck` 2곳뿐이며 이것도 HEADSON D1에서 제거 대상 — **새 라우트를 eager로 추가하지 않는다.**

## §2. 코드·스타일 컨벤션

- 함수는 `const` 화살표 함수 + named export. 컴포넌트 파일은 PascalCase, 훅은 `use*.ts`.
- import 정렬은 eslint(simple-import-sort)가 강제한다 — 수동 정렬하지 말고 `eslint --fix`에 맡긴다.
- 주석·JSDoc·커밋·PR은 한국어.

**스타일(Emotion)** — 기준 예시: [Button.tsx](apps/frontend/src/components/Button.tsx)

- `css` prop 사용, styled-components 스타일의 신규 도입 금지. 스타일 함수는 컴포넌트 **파일 하단**에 `` const xStyle = (theme: Theme) => css`...` ``로 정의.
- 조합은 배열: `css={[baseStyle(theme), variantStyle(theme), props.disabled && disabledStyle, customCss]}`.
- 외부 스타일 확장 통로는 `css?: CSSObject` prop 하나.
- **색상 hex 하드코딩 금지** — `useTheme()`의 `theme.colors.*`(시맨틱, light/dark 자동) 또는 `token.ts`의 `palette`/`colors`만. 새 색이 필요하면 token.ts에 먼저 추가.
- 타이포는 `theme.typography['16Medium']` 계열, radius는 `theme.borderRadius.*`. (간격/크기 px 직접 지정은 허용 — spacing 토큰이 없다.)
- 테마 대응: 시맨틱 토큰(`theme.colors.text.default` 등)을 쓰면 자동. `palette`를 직접 쓰면 다크 모드에서 그대로 고정되므로 의도된 경우에만.

**zustand**: 스토어는 `store/{name}Store.tsx`, 상태와 `actions` 객체 분리 패턴(`useAuthStore.getState().actions.setUser(...)`). React 밖에서 읽을 땐 `getState()`.

## §3. 데이터 계층 (react-query) — 이 레포에서 가장 사고가 잦은 곳

4단 구조를 절대 우회하지 않는다: `api.ts(apiFetch) → services/{domain}Service.ts → hooks/queries/{domain}Queries.ts → 컴포넌트`.

1. **raw `fetch` 금지.** 컴포넌트·프로바이더·이펙트에서 `fetch('/api/...')`를 직접 부르지 않는다. 서버 호출이 필요하면 서비스 함수를 추가하고 쿼리/뮤테이션 훅으로 감싼다. (현존 위반 2곳은 HEADSON P3의 제거 대상이다 — 따라 하지 말 것.)
2. **쿼리 키는 팩토리에서만.** `userKeys.summary(id)`처럼 `as const` 팩토리를 export하고, `useQuery`/`invalidateQueries`/`setQueryData` 전부 그 팩토리만 쓴다. `['user', 'summary']` 리터럴을 무효화에 직접 쓰면 키 변경 시 조용히 무효화가 누락된다. 팩토리가 없는 도메인이면 만들고 나서 쓴다 (HEADSON P2가 `keys.ts` 통합 예정).
3. **`staleTime: 0`을 새로 쓰지 않는다.** "항상 최신"이 필요하면 `refetchInterval`(폴링) 또는 무효화로 해결하고 이유를 주석으로 남긴다. 신선도 기준: 준정적 데이터(fields/units/roadmap)는 `5 * 60 * 1000`, 일반 사용자 데이터는 전역 기본값(P1 이후 30초), 리더보드류는 `staleTime: 30초 + refetchInterval: 60초`.
4. **캐시 갱신은 한 가지 방법만.** 뮤테이션 후 `setQueryData` 수동 패치와 `invalidateQueries({refetchType: 'all'})` 전량 재요청을 같은 키에 겹치지 않는다. 정확히 패치할 수 있으면 setQueryData + 형제 키만 stale 처리, 아니면 invalidate만.
5. **Suspense 워터폴 주의.** `useSuspenseQuery`를 쓰는 컴포넌트에 일반 쿼리를 추가하면 그 쿼리는 suspend가 풀린 뒤에야 시작된다. 병렬이 필요하면 라우트 loader에서 `queryClient.prefetchQuery`(await 없이) 하거나 쿼리를 상위/형제로 옮긴다.
6. **에러 처리**: `api.ts`의 응답 언래핑이 `{success, code, message, result}` 표준 포맷을 처리한다. P1 이후에는 `ApiError`(status/code 보존)로 throw되므로 4xx/5xx 분기는 `error instanceof ApiError`로.

## §4. 3D (Fundy 캐릭터)

`src/features/fundy/` + `public/character/`. 마운트 지점 5곳(로그인, AuthCheck, 퀴즈 인터미션, 퀴즈 결과, 배틀 로비) + `/fundy` 플레이그라운드.

- **런타임은 GLB 내부 이름 문자열에 의존한다**: 애니메이션 클립 5개(`hello_action`, `peek_action`, `fall_action`, `battle_action`, `trophy_action`), `Model.tsx:236-346`·`useMorphAnimation.ts`가 참조하는 노드/본 이름, 표정용 모프 타깃 전부. **GLB를 수정·최적화하면 이 이름들이 보존됐는지 `gltf-transform inspect`로 검증하기 전까지 완료가 아니다.** 절차는 `gltf-pipeline` 스킬.
- **모듈 최상위 `useGLTF.preload(...)`/`useTexture.preload(...)` 금지** — import되는 순간 15MB 다운로드가 발사된다. preload는 그것을 실제로 쓰는 lazy 청크 내부에만.
- three/fiber/drei를 import하는 컴포넌트를 eager 라우트 체인에 넣지 않는다 (초기 번들 오염).
- GLB/텍스처 파일은 내용이 바뀌면 덮어쓰지 말고 `model.v2.glb`처럼 파일명 버전을 올리고 참조 경로를 전부 갱신한다 (immutable 캐시 전제).
- 3D 코드 변경 후에는 마운트 지점 5곳 + 액션 5종 + 표정/깜빡임을 육안 회귀 확인한다.

## §5. 테스트

버킷 3개 — 판별과 서술 규칙은 `test-strategy` 스킬 참조:

| 버킷 | 대상 | 위치 | 명령 |
|---|---|---|---|
| unit (vitest, jsdom) | 훅·유틸·컴포넌트 렌더/이벤트 | `src/components/test/`, `src/hooks/test/`, `src/tests/`, 도메인 인접 `*.test.ts(x)` | `pnpm --filter frontend test` |
| storybook (vitest browser) | `src/components/story/*.stories.tsx` 렌더+a11y | 스토리 파일 자체 | `test:storybook` |
| e2e (playwright) | 사용자 플로우 (로그인 학습, 퀴즈, 리더보드 …) | `e2e/*.spec.ts` | `test:e2e` |

- 테스트 설명은 계약 기반: **"[조건]일 때, [주체]는 [기대 결과]해야 한다."** `"works"`/`"렌더링된다"` 금지.
- 셀렉터는 `getByRole` → `getByLabelText` → 화면 텍스트 순. `data-testid`는 role/label이 불가능한 곳(3D 캔버스 등)만.
- API mock은 `src/mocks/handlers.ts`(MSW). 테스트에서 fetch를 직접 스텁하지 않는다.

## §6. 워크플로우 (커밋·브랜치·PR)

- **커밋**: `type: 한국어 요약` — 허용 타입(이모지 없음, `.husky/commit-msg`가 검사): `feat` `fix` `refactor` `style` `docs` `chore` `rename` `remove` `test` `ci` `lint`. 예: `fix: 6번째 스텝에서 헤더 하트 미표시 수정`. 한 커밋 = 한 논리 단위.
- **브랜치**: `type/topic` (예: `refactor/ranking-evaluation`). base는 `develop`.
- **PR**: `.github/pull_request_template.md`의 섹션(소요 시간 / 작업 요약 / 작업 내용 / 주요 고민 및 해결 과정 / 참고 문서·ADR / 리뷰 요구사항)을 전부 한국어로 채운다. 검증 결과는 실제 실행한 명령·결과만 적는다. 절차는 `pr-workflow` 스킬.

## §7. 접근성

- 클릭 가능한 것은 `button`/`a`로. `div`+`onClick` 금지.
- 포커스 아웃라인 제거 금지(제거 시 대체 포커스 스타일 필수). 모달은 Escape 닫기 + 포커스 복귀.
- 아이콘 전용 버튼 `aria-label`, 비동기 상태 변화(Toast 등)는 `aria-live`.
- Storybook에 addon-a11y가 있다 — 공용 컴포넌트는 스토리에서 a11y 위반 0을 기준으로.

## §8. 약한 모델이 이 레포에서 저지르는 실수 — 이름과 방지 규칙

| # | 실수 (이름) | 방지 규칙 |
|---|---|---|
| M-1 | **staleTime 0 반사작용** — "최신 데이터"가 걱정돼 `staleTime: 0`을 붙임 | §3-3. 새 쿼리에 `staleTime: 0` 금지. 실시간은 `refetchInterval`+주석 |
| M-2 | **인라인 키 리터럴** — 무효화할 때 `['user','summary']`를 그 자리에서 타이핑 | §3-2. 키는 팩토리 import만. 팩토리가 없으면 먼저 만든다 |
| M-3 | **raw fetch 지름길** — "한 번만 부르는 거니까" 컴포넌트에서 `fetch('/api/…')` | §3-1. 예외 없음. 서비스 함수 + 훅 |
| M-4 | **이중 캐시 갱신** — setQueryData로 패치하고 같은 키를 invalidate(all)로 또 재요청 | §3-4. 한 가지 방법만 선택 |
| M-5 | **eager 오염** — 라우트를 lazy 없이 추가하거나, eager 체인에 three 의존 컴포넌트 import | §1 라우팅, §4. 새 라우트는 `lazy()`, three 의존은 lazy 청크로 |
| M-6 | **모듈 최상위 사이드이펙트** — `useGLTF.preload` 등을 파일 톱레벨에 배치 | §4. preload는 소비 청크 내부에만 |
| M-7 | **hex 하드코딩** — `#6559EA`를 스타일에 직접 씀 (light 테마에서만 확인) | §2. `theme.colors.*`/`token.ts` 경유. light+dark 모두 확인 |
| M-8 | **GLB 이름 파괴** — `gltf-transform optimize`를 돌려 빌드는 성공하는데 런타임에서 캐릭터가 깨짐 | §4 + `gltf-pipeline` 스킬. inspect로 이름·클립·모프 검증 전 완료 선언 금지 |
| M-9 | **Suspense 워터폴 추가** — suspend되는 컴포넌트에 형제 쿼리를 넣어 직렬화 | §3-5. loader prefetch 또는 쿼리 위치 이동 |
| M-10 | **레이어 역주행** — 컴포넌트에서 서비스 직접 호출, `components/`가 `features/` import | §1 의존 방향 |
| M-11 | **커밋 형식 이탈** — 이모지 프리픽스(`✨ feat:`)나 영어 커밋 메시지 | §6. `type: 한국어 요약`, 이모지 없음 |
| M-12 | **훅 우회** — pre-push 실패에 `--no-verify` | §0. 금지. 원인을 고치거나 보고 (§10-5) |
| M-13 | **완료 허풍** — 시각 결과(스타일/3D)를 확인 없이 "동일하게 유지됨"이라고 보고 | §9, §10-3. 실제 확인한 것만 확인했다고 말한다 |

## §9. 품질 기준 — 산출물별 체크 가능 조건

"잘 했다"는 형용사가 아니라 아래 조건 충족이다. 어느 하나라도 미충족이면 완료 보고에 그 사실을 명시한다.

**모든 코드 변경 (공통)**
- [ ] `pnpm --filter frontend lint` 에러 0
- [ ] `pnpm --filter frontend build` 성공 (= 타입 체크 통과)
- [ ] 변경 영역의 기존 테스트 통과 (`pnpm --filter frontend test`)

**전역 컴포넌트 (`src/components/`)**
- [ ] `story/`에 스토리, `test/`에 테스트 파일 동반
- [ ] 색상·타이포·radius 전부 토큰 경유 (파일 내 hex 0건)
- [ ] 키보드로 조작 가능 (Tab 도달 + Enter/Space 동작), 포커스 표시 유지
- [ ] light/dark 두 테마에서 확인

**쿼리/뮤테이션 훅 (`src/hooks/queries/`)**
- [ ] 키가 팩토리로 export되고, 파일 내 인라인 키 리터럴 0건
- [ ] `staleTime: 0` 없음 (있어야 하면 주석으로 근거)
- [ ] 뮤테이션의 캐시 갱신 경로가 한 가지 (setQueryData 또는 invalidate)
- [ ] 서비스 함수 경유 (훅 안에 fetch/URL 문자열 없음)

**3D 변경 (`src/features/fundy/`, `public/character/`)**
- [ ] GLB 교체 시: `npx @gltf-transform/cli inspect`로 클립 5개·노드·모프 타깃 이름/개수 보존 확인
- [ ] 마운트 지점 5곳 + 액션 5종 육안 회귀
- [ ] 3D 미사용 페이지(`/learn` 등)에서 Network에 `.glb` 요청 없음 (D1 이후)
- [ ] 모듈 최상위 preload 추가 0건

**PR**
- [ ] 템플릿 6개 섹션 전부 채움 (빈 섹션 없음), 한국어
- [ ] 검증 결과 = 실제 실행한 명령과 출력. 미실행이면 "미실행" 명기

## §10. 불확실할 때 — 에스컬레이션 규칙

1. **컨벤션 충돌**: 두 파일이 서로 다른 패턴을 쓰면(예: 키 팩토리 vs 리터럴), 이 문서 §1–§7이 정한 쪽을 따른다. 이 문서에 없는 충돌이면 최근 커밋된 파일 쪽을 따르되, 응답에 "X와 Y가 충돌해서 Y를 따랐다"를 반드시 명시한다.
2. **API 계약 불명**: 응답 형태를 모르면 지어내지 않는다. 순서대로 확인: ① `services/*.ts`의 타입 정의 ② `src/mocks/handlers.ts` ③ 그래도 불명이면 **작업을 멈추고 사용자에게 실제 응답 예시를 요청**한다. 백엔드 코드를 뒤져 추론하지 않는다.
3. **시각 결과가 바뀔 수 있는 변경** (스타일 리팩터, 3D 재질/라이팅, 테마): 실행해서 눈으로 확인하기 전까지 "동일함"을 선언하지 않는다. 확인 수단이 없으면 "미확인 — 확인 필요"로 보고하고 확인 방법(스토리북/dev 서버 경로)을 제시한다.
4. **파급 범위가 큰 변경**: `router/index.tsx`, `providers.tsx`, `services/api.ts`, 삭제·이동 5파일 초과 — 구현 전에 계획(수정 파일 목록 + 이유)을 먼저 보고하고 승인받는다.
5. **훅/빌드 실패**: 우회 금지. 에러 출력 전문과 함께 보고하고, 원인이 내 변경이면 고치고, 기존 코드면 사용자 판단에 맡긴다.
6. **HEADSON.md와 지시가 충돌**: HEADSON이 합의된 실행 계획임을 알리고 어느 쪽을 따를지 확인받는다.
7. **위 규칙으로 판단이 안 서면**: 가장 그럴듯한 해석 하나로 진행하되, 응답 첫머리에 그 가정을 명시한다. 가정이 2개 이상 쌓이면 진행을 멈추고 질문한다.
