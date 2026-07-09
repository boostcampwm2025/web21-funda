---
name: data-flow
description: web21-funda에서 데이터 읽기/쓰기 흐름(서비스 함수, 쿼리 키, useQuery/useMutation, 캐시 무효화)을 추가·수정할 때의 절차 스킬. "쿼리 추가", "데이터 패칭", "useQuery 훅", "뮤테이션", "캐시 무효화", "API 연동" 요청 시 트리거한다. 4단 구조(api.ts→services→queries→컴포넌트)와 staleTime 정책을 강제한다.
---

# Data-Flow — react-query 읽기/쓰기 흐름

web21-funda는 **`api.ts`(fetch 래퍼) → `services/{domain}Service.ts` → `hooks/queries/{domain}Queries.ts` → 컴포넌트** 4단 구조다. 컴포넌트에서 raw `fetch`나 서비스 직접 호출을 하지 않는다.

> 규칙 기준: `CLAUDE.md` §3(데이터 계층). 현황·문제 목록·개선 계획은 `HEADSON.md` §2·§3 — **`api.ts`나 기존 쿼리를 수정하기 전에 해당 Phase(P1~P4)가 이미 이 작업을 계획하고 있는지 확인한다.**

## 읽기(Read) 추가

**① 서비스 함수 — `src/services/{domain}Service.ts`**

```ts
export const fieldService = {
  getFields: () => apiFetch.get<Field[]>('/fields'),
};
```

응답 타입을 제네릭으로 명시한다. `api.ts`가 `{success, code, message, result}` 표준 포맷을 언래핑하므로 서비스는 `result` 타입만 선언한다. BASE_URL이 `/api`이므로 경로에 `/api`를 다시 붙이지 않는다.

**② 쿼리 키 팩토리 — 해당 `{domain}Queries.ts`에 (P2 이후엔 `keys.ts`)**

실제 패턴 — `src/hooks/queries/userQueries.ts`의 `userKeys`:

```ts
export const fieldKeys = {
  all: () => ['fields'] as const,
  units: (slug: string) => ['field-units', slug] as const,
};
```

- **인라인 리터럴 금지** — `useQuery`/`invalidateQueries`/`setQueryData` 전부 팩토리만 쓴다.
- 결과를 실제로 가르는 파라미터(userId, slug, 필터)를 전부 키에 넣는다 — 빠뜨리면 다른 데이터가 같은 캐시 슬롯을 덮어쓴다.

**③ 쿼리 훅**

```ts
export const useFieldUnitsQuery = (slug: string) =>
  useQuery({
    queryKey: fieldKeys.units(slug),
    queryFn: () => fieldService.getFieldUnits(slug),
    staleTime: 5 * 60 * 1000, // 준정적 데이터
    enabled: !!slug,
  });
```

**staleTime 정책 (§3-3)** — `staleTime: 0`을 새로 쓰지 않는다:

| 데이터 성격 | 옵션 |
|---|---|
| 준정적 (fields, units, roadmap, 유닛 개요) | `staleTime: 5 * 60 * 1000` |
| 일반 사용자 데이터 (프로필, 팔로우) | 생략 — 전역 기본값 (P1 이후 30초) |
| 실시간 (리더보드, today-goals) | `staleTime: 30_000` + `refetchInterval: 60_000` (+필요 시 `refetchOnWindowFocus: true`) |

- 조건부 쿼리는 `enabled`로 제어한다 — 수동 `refetch()` 호출로 흐름을 굴리지 않는다.
- 취소는 react-query의 `signal`을 쓴다 — 수동 `AbortController`를 만들지 않는다.

## 쓰기(Write) — 뮤테이션

**캐시 갱신은 한 가지 방법만 (§3-4).** `setQueryData` 수동 패치와 `invalidateQueries({refetchType: 'all'})`를 같은 키에 겹치면 수동 패치가 무의미해지고 요청만 배가된다(HEADSON A-6이 실제 사례).

```ts
export const useFollowMutation = (targetId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => userService.follow(targetId),
    onSuccess: () => {
      // 방법 A: 정확히 패치할 수 있으면 setQueryData + 형제 키는 stale만 표시
      queryClient.setQueryData(userKeys.summary(targetId), prev => /* 정확한 패치 */);
      queryClient.invalidateQueries({ queryKey: userKeys.followers(targetId), refetchType: 'none' });
      // 방법 B(단순): 패치 없이 invalidate만 — 활성 쿼리만 재요청 (refetchType 기본값 'active')
      // queryClient.invalidateQueries({ queryKey: userKeys.summary(targetId) });
    },
  });
};
```

- 무효화 키도 반드시 팩토리로 — 리터럴 `['user', 'summary']`를 타이핑하지 않는다.
- 클라이언트 전역 상태(zustand)와 동기화가 필요하면 `useAuthStore.getState().actions.*` 패턴(기존 `useUpdateEmailSubscriptionMutation` 참조).

## 워터폴 점검 (§3-5)

- `useSuspenseQuery`(현재 `fieldQueries.ts`)를 쓰는 컴포넌트에 일반 쿼리를 추가하면 suspend가 풀린 뒤에야 시작된다. 병렬이 필요하면 라우트 loader에서 `queryClient.prefetchQuery(...)`(await 없이 fire-and-forget — HEADSON P4 패턴) 하거나 쿼리를 상위/형제 컴포넌트로 옮긴다.

## 검증

```bash
pnpm --filter frontend lint && pnpm --filter frontend build
grep -rn "fetch('/api" apps/frontend/src --include="*.ts*" | grep -v "services/api.ts"   # 0건이어야
```

- DevTools Network로: 대상 화면 진입 → 이탈 → 재진입 시 중복 요청이 없는지, 뮤테이션 1회당 후속 GET이 2건 이하인지 확인한다.

## 자가 확인

- [ ] 서비스 함수 → 키 팩토리 → 훅 순서로 만들었는가? 훅 안에 URL 문자열/fetch가 없는가?
- [ ] 데이터를 가르는 모든 파라미터가 키에 들어가 있는가?
- [ ] `staleTime: 0`이 없는가? 정책 표에 따라 신선도를 정했는가?
- [ ] 뮤테이션의 캐시 갱신 경로가 한 가지인가? 무효화 키가 전부 팩토리인가?
- [ ] Suspense 컴포넌트에 형제 쿼리를 넣어 워터폴을 만들지 않았는가?
- [ ] 수정 대상이 HEADSON P1~P4 범위면 해당 Phase 지침과 어긋나지 않는가?
