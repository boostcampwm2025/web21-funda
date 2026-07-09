---
name: component
description: web21-funda에서 새 UI 컴포넌트·화면을 구현할 때의 절차 스킬. "컴포넌트 만들어줘", "화면 구현", "UI 추가", "페이지 만들어줘", "버튼/카드/모달 컴포넌트" 요청 시 트리거한다. 레이어 배치·Emotion 토큰·접근성을 강제한다. 데이터 패칭 절차는 다루지 않는다(→ data-flow).
---

# Component — UI 컴포넌트·화면 구현

컴포넌트를 만들 때의 배치·구조·스타일·접근성 절차. 데이터 패칭이 필요하면 **`data-flow` 스킬**과 함께 쓴다.

> 규칙 기준: `CLAUDE.md` §1(레이어), §2(스타일), §7(접근성), §9(컴포넌트 품질 기준). 여기선 **구현 순서와 패턴**만 다룬다.

## Step 1: 위치 결정

새 UI를 어디 둘지는 "누가 이걸 소유하는가"로 정한다.

| 대상 | 위치 |
|---|---|
| 전역 재사용 원자 UI(버튼·모달·토스트·드롭다운) | `src/components/{Name}.tsx` + `story/{Name}.stories.tsx` + `test/{Name}.test.tsx` |
| 한 도메인의 기능 UI | `src/features/{domain}/components/{Name}.tsx` |
| 도메인 상태 로직 | `src/features/{domain}/hooks/use{X}.ts` |
| 라우트 진입 컨테이너(화면 조립) | `src/pages/**/{Name}.tsx` — 조립만, 로직은 features로 |
| 여러 화면 공용 레이아웃 | `src/layouts/` |

- 처음부터 `src/components/`에 넣지 않는다 — **두 번째 도메인이 실제로 쓰게 될 때 승격**한다. 승격 시 스토리+테스트를 함께 만든다(§9 기준).
- 라우트가 새로 생기면 `src/router/index.tsx`에 **반드시 `lazy()`로** 추가한다.

## Step 2: 스타일 — Emotion css prop + 토큰

기준 예시: `src/components/Button.tsx`.

```tsx
import { css, type CSSObject, useTheme } from '@emotion/react';
import type { Theme } from '@/styles/theme';

interface CardProps {
  active?: boolean;
  css?: CSSObject; // 외부 확장 통로는 이것 하나
}

export const Card = ({ active, css: customCss, children }: PropsWithChildren<CardProps>) => {
  const theme = useTheme();
  return <section css={[baseStyle(theme), active && activeStyle(theme), customCss]}>{children}</section>;
};

// 스타일 함수는 파일 하단에
const baseStyle = (theme: Theme) => css`
  border-radius: ${theme.borderRadius.medium};
  background: ${theme.colors.background.default};
  font-size: ${theme.typography['16Medium'].fontSize};
`;
```

- 색상 hex 하드코딩 금지 — `theme.colors.*`(light/dark 자동 대응). 새 색은 `src/styles/token.ts`에 먼저 추가.
- `palette` 직접 참조는 다크 모드에서 고정되므로 의도된 경우에만(예: primary 버튼 위 흰 텍스트).
- styled-components 방식(`styled.div`)을 새로 도입하지 않는다.
- 간격/크기 px은 허용(spacing 토큰 없음).

## Step 3: 접근성·마크업 (§7)

- 불필요한 `div` 금지 — 의미 요소(`section`/`nav`/`ul`/`button`/`a`) 우선, 묶음만 필요하면 Fragment.
- 모든 인터랙티브 요소는 키보드(Tab/Enter/Space)로 조작 가능해야 한다. `div`+`onClick` 금지.
- 포커스 아웃라인을 제거하지 않는다(제거 시 `:focus-visible` 대체 스타일 필수).
- 동적 상태 변화는 `aria-live`, 아이콘 전용 버튼은 `aria-label`, 장식 이미지는 `alt=""`.
- 모달류는 `src/components/Modal.tsx`를 재사용한다 — 포커스 관리를 새로 구현하지 않는다.

## Step 4: 3D가 섞이는 화면일 때

Fundy 캐릭터를 넣는 화면이면 `CLAUDE.md` §4를 먼저 읽는다 — three 의존 컴포넌트를 eager 체인에 연결하지 않고, 모듈 최상위 preload를 추가하지 않는다.

## Step 5: 검증

```bash
pnpm --filter frontend lint
pnpm --filter frontend build
pnpm --filter frontend test          # 테스트를 동반했다면
pnpm --filter frontend storybook     # 전역 컴포넌트면 스토리 육안 + addon-a11y 확인
```

light/dark 두 테마에서 확인한다(themeStore 토글).

## 자가 확인

- [ ] 위치가 Step 1 표를 따르는가? 한 도메인용인데 `src/components/`에 넣지 않았는가?
- [ ] 전역 컴포넌트면 story+test를 동반했는가?
- [ ] hex 하드코딩 0건인가? light/dark 모두 확인했는가?
- [ ] `button`/`a`·키보드 접근성·포커스 아웃라인을 지켰는가?
- [ ] 새 라우트를 `lazy()`로 추가했는가?
- [ ] 불필요한 추상화 없이(재사용 2곳 미만은 도메인 안에) 작게 만들었는가?
