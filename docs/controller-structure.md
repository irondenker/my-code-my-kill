# Controller Structure Guide

이 문서는 컨트롤러 파일 분할 기준을 고정하기 위한 운영 기준입니다.
목표는 다음 3가지입니다.

- 변경 충돌 감소
- 코드 탐색 비용 최소화
- 리뷰 기준 일관화

## 1) 핵심 원칙

1. 분할 기준은 "파일 개수"가 아니라 "책임 경계"로 판단한다.
2. 1차 분할 축은 "유즈케이스"다. (예: users/boards/dashboard)
3. 2차 분할 축은 "HTTP 외 보조 로직"이다. (guard/input/presenter/helper)
4. 기존 import 경로를 깨지 않도록 배럴 파일을 유지한다.

## 2) 표준 패턴

### 패턴 A: 단일 컨트롤러 (기본)

적용 조건(모두 충족):

- 파일 길이 300줄 이하
- export 핸들러 6개 이하
- 유즈케이스 2개 이하

형태:

- `xxx.controller.ts`

### 패턴 B: 컨트롤러 + 헬퍼 (2분할)

적용 조건(하나 이상 충족):

- req/res/session 의존 보조 로직이 반복됨
- 입력 정규화/권한 판정/렌더 모델 조립을 단위 테스트하고 싶음
- 컨트롤러 본문에서 정책 계산 코드가 핸들러 흐름을 가림

형태:

- `xxx.controller.ts`
- `xxx.controller.helpers.ts`

### 패턴 C: 유즈케이스 분할 + 배럴 (3+분할)

적용 조건(하나 이상 충족):

- 단일 컨트롤러가 450줄 초과
- 유즈케이스 3개 이상
- 서로 다른 기능이 같은 파일에서 동시에 자주 수정됨

형태:

- `xxx.controller.ts` (배럴)
- `xxx/<domain>-<usecase>.controller.ts` (예: `admin-users`, `admin-boards`, `admin-dashboard`)

## 3) 파일명/경로 규칙

- 배럴: `server/src/controllers/<domain>.controller.ts`
- 유즈케이스: `server/src/controllers/<domain>/<domain>-<usecase>.controller.ts`
- 헬퍼: `server/src/controllers/<domain>.controller.helpers.ts`

주의:

- 기존 라우트 import 경로는 가능한 유지한다.
- 라우트 파일에서 내부 유즈케이스 파일을 직접 import하지 않는다.

## 4) 분할 시 필수 체크리스트

1. `npm run build` 통과
2. `npm test` 통과
3. 필요 시 `npm run check:openapi-drift` 통과
4. `git grep`으로 기존 import 경로 깨짐 여부 확인
5. 동작 동일성 검증 (리다이렉트/상태코드/플래시 메시지)

## 5) 현재 코드베이스 적용

- `article`: 패턴 B (2분할)
  - 이유: create/edit/show/delete는 하나의 흐름으로 묶여 있고, 보조 로직(권한/입력/렌더)만 분리하는 편이 탐색 비용이 낮음.
- `admin`: 패턴 C (유즈케이스 분할)
  - 이유: users/boards/dashboard가 독립 유즈케이스이며, 단일 파일 규모가 커서 변경 충돌과 리뷰 비용이 높음.

## 6) 운영 규칙

- 새 컨트롤러 추가 시 기본은 패턴 A로 시작한다.
- 임계치(2절 조건)를 넘으면 패턴 B 또는 C로 승격한다.
- 승격 시 이 문서의 체크리스트를 PR 본문에 함께 기록한다.
