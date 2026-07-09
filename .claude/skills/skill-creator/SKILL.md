---
name: skill-creator
description: web21-funda 프로젝트용 새 스킬을 만드는 메타 스킬. "스킬 만들어줘", "skill 생성", "새 스킬 추가", "스킬 크리에이터" 요청 시 트리거한다. CLAUDE.md를 단일 출처로 참조하는 SKILL.md를 생성한다.
---

# Skill-Creator

`.claude/skills/{name}/SKILL.md`를 일관된 형식으로 작성한다.
web21-funda 프론트엔드 스택(React 19 + Vite + react-router 7 + Emotion + zustand + TanStack Query 5 + react-three-fiber) 기준으로만 만든다. Next.js·FSD·Panda CSS·Supabase·Tailwind 같은 다른 스택 가정(특히 chaen 레포에서 복사해온 가정)을 넣지 않는다.

## 핵심 원칙

- **컨벤션은 복제하지 않는다.** 단일 출처는 루트 `CLAUDE.md`(§1~§10)다. 스킬은 규칙 표를 옮겨 적지 않고 `> 규칙 기준: CLAUDE.md §N({섹션명})`으로 참조한다.
- 스킬은 **절차·예시 코드·체크리스트**만 자체 보유한다.
- 성능 작업 관련 스킬이면 `HEADSON.md`의 해당 Phase를 참조 지점으로 연결한다.

## Step 1: 정보 확인

| 항목     | 규칙                                              |
| -------- | ------------------------------------------------- |
| 이름     | kebab-case (예: `code-quality`)                   |
| 위치     | `.claude/skills/{name}/SKILL.md`                  |
| 트리거   | 사용자가 부를 자연어 문구 3개 이상                 |
| 참조     | 의존하는 `CLAUDE.md` 섹션(§N) 목록                 |

`name`은 frontmatter와 디렉토리명이 반드시 일치한다.

## Step 2: frontmatter

```markdown
---
name: {name}
description: {한 줄 역할}. "{문구1}", "{문구2}", "{문구3}" 요청 시 트리거한다. {하지 않는 일}(→ 담당 스킬/에이전트).
---
```

- 한국어로 쓴다. 트리거 문구를 따옴표로 나열한다(자동 선택 근거).
- 트리거하지 않는 경우/하지 않는 일을 명시하고, 그 일을 담당하는 스킬·에이전트를 화살표로 연결한다.

## Step 3: 본문

한국어 명령형(`~한다`), 구조는 표·`Step N`·예시 코드(fenced)·체크리스트.

- 첫 문단에 스킬 범위를 적는다.
- 예시는 추상 코드 대신 **이 레포의 실제 파일 패턴**을 인용한다 (예: `src/components/Button.tsx`의 css prop 배열 조합, `src/hooks/queries/userQueries.ts`의 `userKeys` 팩토리).
- 검증 명령은 실제 스크립트만 쓴다: `pnpm --filter frontend lint` / `build` / `test` / `test:storybook` / `test:e2e`. (frontend에 `check-types` 스크립트는 없다 — 타입 체크는 `build`.)
- 마지막에 `## 자가 확인` 체크리스트로 결과를 스스로 검증하게 한다.

## Step 4: 일관성 점검

기존 스킬(`code-quality`, `data-flow`, `component`, `gltf-pipeline`)과 형식이 어긋나지 않는지 확인한다. 절차 스킬은 컨벤션을 복제하지 말고 `CLAUDE.md` 섹션을 참조하되, **실제 파일 템플릿·단계**는 자체 보유한다(`data-flow`의 읽기 3단계처럼).

## 자가 확인

- [ ] `name`이 디렉토리명과 일치하는가?
- [ ] `description`에 트리거 문구가 3개 이상 있는가?
- [ ] 컨벤션을 복제하지 않고 `CLAUDE.md` §N을 참조했는가?
- [ ] 예시가 실제 web21-funda 코드 패턴을 인용하는가(chaen 스택 가정 없음)?
- [ ] 검증 명령이 이 레포에 실존하는 스크립트인가?
- [ ] 자가 확인 체크리스트가 있는가?
