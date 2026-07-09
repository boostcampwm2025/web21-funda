---
name: code-quality
description: web21-funda 프론트엔드 코드를 컨벤션 기준으로 점검하고 개선하는 스킬. "코드 개선", "리팩터", "리뷰해줘", "정리해줘", "컨벤션 점검" 요청 시 트리거한다. CLAUDE.md §1~§3을 기준으로 검토 후 고친다. 백엔드 코드는 다루지 않는다.
---

# Code-Quality — 프론트엔드 코드 점검·개선

변경된 코드가 컨벤션을 지키는지 점검하고, 위반은 `파일:라인`으로 보고한 뒤 고친다.

> 규칙 기준: `CLAUDE.md` §1(레이어), §2(코드·스타일), §3(데이터 계층), §8(실수 목록)
> 데이터 흐름·컴포넌트 구현 절차는 `data-flow`·`component` 스킬 참조.

## Step 1: 변경 파일 확인

```bash
git diff --name-only develop...HEAD -- apps/frontend
```

각 파일을 읽고 아래 체크리스트로 점검한다.

## Step 2: 체크리스트 (CLAUDE.md quick-reference)

**레이어 배치 (§1)**
- [ ] 전역 원자 UI는 `src/components/`, 도메인 기능은 `src/features/{domain}/`, 라우트 컨테이너는 `src/pages/`에 있는가?
- [ ] `components/`가 `@/feat`를 import하지 않는가? 컴포넌트/페이지가 `@/services`를 직접 import하지 않는가(쿼리 훅 경유)?
- [ ] `services/`에 React import가 없는가?
- [ ] 새 라우트가 `lazy()`로 추가됐는가? eager 체인에 three/fundy 의존이 새로 연결되지 않았는가?

**개발 표준 (§2)**
- [ ] 함수 선언이 `const` 화살표 함수 + named export인가?
- [ ] 경로 별칭(`@/comp`/`@/feat`/`@`)만 쓰는가(폴더 경계 넘는 `../../` 없음)?
- [ ] 미사용 export·죽은 코드·임시 `console.log`가 없는가?
- [ ] 주석이 한국어인가?

**스타일 (Emotion, §2)** — 기준: `src/components/Button.tsx`
- [ ] `css` prop + 파일 하단 스타일 함수 패턴인가?
- [ ] **hex 하드코딩 0건**인가 — `theme.colors.*`(시맨틱) 또는 `token.ts` 경유인가?
- [ ] 타이포는 `theme.typography[...]`, radius는 `theme.borderRadius.*`인가?
- [ ] 외부 확장 통로가 `css?: CSSObject` prop 하나인가?
- [ ] `palette` 직접 사용이 다크 모드에서도 의도된 것인가?

**데이터 계층 (§3)**
- [ ] raw `fetch('/api/…')`가 없는가(services 경유)?
- [ ] 쿼리 키가 팩토리인가(인라인 리터럴 무효화 없음)?
- [ ] 새 `staleTime: 0`이 없는가(있으면 근거 주석)?
- [ ] 뮤테이션의 캐시 갱신 경로가 한 가지인가(setQueryData ⊕ invalidate 중복 없음)?

**접근성 최소선 (§7)**
- [ ] 클릭 가능한 것이 `button`/`a`인가? 포커스 아웃라인 제거 없음? 아이콘 버튼 `aria-label`?

**중복**
- [ ] 같은 패턴이 3회 이상/거의 동일하면 공통화했는가? (그 전엔 인라인 유지 — 이른 추상화 금지)

## Step 3: 검증 명령

```bash
pnpm --filter frontend lint
pnpm --filter frontend build     # tsc -b 포함 — 타입 체크는 이걸로
pnpm --filter frontend test      # 변경 영역에 테스트가 있으면
```

실패 시 에러 메시지 전체를 보고에 포함한다.

## Step 4: 수정

점검에서 나온 위반을 컨벤션에 맞게 고친다. import 정렬은 손대지 말고 `eslint --fix`에 맡긴다. 범위가 커지면 무리하지 말고 분리(다음 작업)를 제안한다.

## 자가 확인

- [ ] 모든 지적에 `파일:라인`을 명시했는가?
- [ ] `pnpm --filter frontend lint`·`build`를 실행하고 결과를 포함했는가?
- [ ] 수정이 레이어 배치·토큰·데이터 계층 기준(§1~§3)을 따르는가?
