---
name: gltf-pipeline
description: Fundy 캐릭터 GLB·텍스처를 수정·최적화할 때 지켜야 할 이름 조회 제약, gltf-transform 금지 목록, 로딩 경로 규칙을 다루는 스킬. "GLB 최적화", "모델 압축", "텍스처 최적화", "3D 에셋 수정", "캐릭터 모델 교체" 요청 시 트리거한다. 씬 컴포넌트 구현 자체(카메라·조명·애니메이션 배선)는 다루지 않는다.
---

# Gltf-Pipeline — Fundy GLB/텍스처 수정 안전 규칙

런타임(`src/features/fundy/`)은 GLB 안의 클립/노드/모프 타깃을 **정확한 이름 문자열로 조회**한다. gltf-transform 같은 도구는 기본 설정에서 노드를 병합·리네임하므로, 절차를 따르지 않으면 **빌드는 성공하는데 런타임에서 조용히 캐릭터가 깨진다**(재질 누락, 애니메이션 미동작, 표정 소실).

> 규칙 기준: `CLAUDE.md` §4(3D). 에셋 스펙·측정치·목표는 `HEADSON.md` §4·§5(Phase D0~D4)가 실행 계획이다 — 최적화 작업 전 반드시 해당 Phase를 읽는다.

## Step 1: 이름 의존 목록부터 확인한다

수정 대상 GLB가 아래 이름을 전부 보존해야 한다. 작업 전 실제 소비 코드를 grep으로 재확인한다:

```bash
grep -rn "hello_action\|trophy_action\|muffler\|neutral_bone" apps/frontend/src/features/fundy/
```

현재 알려진 이름 조회 지점 (HEADSON §5 D0-3):

- **애니메이션 클립 5개**: `hello_action`, `peek_action`, `fall_action`, `battle_action`, `trophy_action` — `Model.tsx:64-68`
- **노드/메시 이름**: `body`, `muffler`, `tail`, `muffler_tail`, `trophy`, `trophy_handle`, `tag`, `cap`, `cap_taile`, `Sphere001`, `Sphere001_1`, `Sphere003`, `Sphere003_1`, `eyelash`, `head`, `eyebrow`, `teeth`, `tongue`, `tail_1`, `muff`, `neutral_bone` 및 `DEF-*` 본 전체 — `Model.tsx:236-346`, `useMorphAnimation.ts:140-159`
- **모프 타깃(shape key) 이름/개수 전부** — 표정 시스템(`useMorphAnimation.ts`의 EXPRESSION_CONFIGS)이 의존

**이 목록에 없는 새 이름 의존을 발견하면, 먼저 이 목록에 추가한 뒤 다음 단계로 간다.**

## Step 2: 절대 금지 함수 (모든 GLB 공통)

노드 병합/리네임을 일으키므로 쓰지 않는다:

- `flatten()` — 이름 있는 중간 노드 소실
- `join()` — 메시 병합으로 개별 이름 소멸
- `palette()` — 개별 머티리얼 참조 파괴
- `instance()` — 노드 구조 변경
- `simplify()` — 메시 분리/병합 발생 가능
- **사전 정의 `optimize` 프리셋 전체** (CLI `gltf-transform optimize` 포함) — 위 함수들을 내부에서 묶어 실행

반드시 개별 함수를 명시적으로 나열해 파이프라인을 구성한다.

## Step 3: 캐릭터(스킨드 메시) 추가 금지 + 허용 파이프라인

Fundy는 스켈레톤 애니메이션 + 모프 타깃이 있으므로 추가로:

- `weld()` — 모프 타깃 seam 버텍스 병합으로 블렌드셰이프가 뭉개짐
- 단독 `quantize()` — WEIGHTS 양자화로 스키닝 뒤틀림

**허용 파이프라인** (HEADSON D0-5, chaen 검증 완료 구성):

```
dedup() → prune({ keepAttributes: true }) → resample() → sparse()
→ textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 90, resize: [1024, 1024] })
→ meshopt({ encoder: MeshoptEncoder, level: 'medium' })
```

- 텍스처는 WebP q90, 얼굴/몸 1024², 소품 512². KTX2는 툰 그라데이션 밴딩 위험으로 배제. 색 텍스처는 sRGB 유지.
- **Draco 금지, Meshopt 채택** — meshopt 디코더는 three에 내장되어 외부 CDN 요청이 없다.
- 죽은 클립(`[Action Stash]`~`[Action Stash].004`)은 제거 대상이다 — 실사용 5개 클립만 남긴다.

## Step 4: 변환 후 검증

```bash
npx @gltf-transform/cli inspect apps/frontend/public/character/model.v2.glb
```

- [ ] 클립 5개 이름 일치 (Step 1 목록)
- [ ] 노드/메시 이름 전부 보존
- [ ] 모프 타깃 개수가 원본과 일치
- [ ] `extensionsUsed`에 `EXT_meshopt_compression` (+베이크 에셋이면 `KHR_materials_unlit`)
- [ ] 총 크기가 목표(≤3MB) 이내
- 변환 전/후 inspect 출력을 나란히 비교한다 — 이 검증 전까지 "완료"를 선언하지 않는다(CLAUDE.md M-8).

## Step 5: 파일명 버저닝 + 참조 갱신

원본을 덮어쓰지 않는다. 내용이 바뀌면 `model.glb` → `model.v2.glb`처럼 접미사를 올린다. `public/` 정적 파일은 Vite가 해싱하지 않으므로, immutable 캐시 헤더(HEADSON D4) 아래에서는 이 버전 접미사가 유일한 무효화 수단이다. **경로를 참조하는 모든 지점(`Model.tsx`의 `useGLTF(...)`, preload 위치)을 함께 갱신한다** — 파일만 바꾸면 이전 버전이 계속 서빙된다.

## Step 6: 로딩 경로 규칙 (에셋과 무관하게 항상)

- **모듈 최상위 `useGLTF.preload(...)`/`useTexture.preload(...)` 금지** — import되는 순간 다운로드가 발사되어 3D 미사용 페이지까지 오염시킨다(HEADSON B-1). preload는 그것을 쓰는 lazy 청크 내부에만 둔다.
- three/fiber/drei를 import하는 컴포넌트를 eager 라우트 체인에 연결하지 않는다 — Canvas 소비처는 lazy 래퍼(HEADSON D1의 `FundyPreviewCanvasLazy` 패턴)를 쓴다.

## Step 7: 육안 회귀 (모든 3D 변경 공통)

마운트 지점 5곳(로그인 / AuthCheck / 퀴즈 인터미션 / 퀴즈 결과 / 배틀 로비) + `/fundy` 플레이그라운드에서 hello/peek/fall/battle/trophy 액션과 표정/깜빡임/시선 추적을 확인한다. 확인하지 못했으면 "미확인"으로 보고한다.

## 자가 확인

- [ ] Step 1의 이름 의존 목록을 grep으로 재확인했는가? 새 이름을 발견했다면 목록에 추가했는가?
- [ ] `flatten`/`join`/`palette`/`instance`/`simplify`/`optimize` 프리셋을 쓰지 않았는가? 스킨드 메시에 `weld`/단독 `quantize`를 쓰지 않았는가?
- [ ] 변환 후 inspect로 이름·클립·모프 보존을 확인했는가?
- [ ] `.vN` 접미사로 새 파일을 만들고 참조 경로를 전부 갱신했는가?
- [ ] 모듈 최상위 preload를 추가하지 않았는가?
- [ ] 마운트 지점 5곳 육안 회귀를 했는가(못 했으면 "미확인" 보고)?
