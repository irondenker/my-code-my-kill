# 세션 라이프사이클

MCMK는 실서비스가 아닌 학습/실습용 프로젝트입니다. 따라서 세션과 계정 보호 흐름은 실무 보안 원리를 따르되, 외부 인증 채널 없이도 재현 가능한 흐름으로 설계된 구조입니다.

## 범위

이 문서는 다음 흐름의 세션 관점 동작을 설명합니다.

- 회원가입/로그인/로그아웃
- 로그인 방어(`password_reset_required`, 실패 누적)
- 비밀번호 재설정(`/forgot-password`, `/reset-password`)

## 세션 기본 설정

코드 위치는 `server/src/middlewares/session.middleware.ts`입니다.

- 쿠키 이름은 `SESSION_COOKIE_NAME`입니다.
- 저장소는 기본 `MemoryStore`입니다.
- 운영(`NODE_ENV=production`)에서는 `SESSION_SECRET`이 필수입니다.

## 로그인 성공 시 세션 생성

코드 위치는 `server/src/controllers/auth/auth-login.controller.ts`입니다.

1. 사용자 검증을 수행합니다.
2. `establishAuthSession`으로 세션 ID를 재생성하고 인증 필드를 저장합니다.
3. `LOGIN` 감사로그를 기록합니다.
4. 안전한 `next` 경로로 리다이렉트합니다.

세션에 기록되는 인증 필드는 다음과 같습니다.

- `userId`
- `userRole`
- `username`
- `profileImageUrl`

## 로그인 실패 방어와 세션

로그인 실패는 세션을 생성하지 않습니다. 방어 토글이 켜져 있을 때는 계정 상태만 변경합니다.

- 실패 누적 시 `login_failed_count`를 증가시킵니다.
- 임계치 도달 시 `password_reset_required=true`로 전환합니다.
- 옵션이 켜져 있으면 `login_locked_until`을 설정합니다.
- `password_reset_required=true` 계정은 로그인 성공 세션을 만들지 않습니다.

## 로그아웃 시 세션 파기

코드 위치는 `server/src/controllers/auth/auth-logout.controller.ts`입니다.

1. 로그아웃 감사로그를 기록합니다.
2. `clearAuthSession(req)`로 서버 세션을 파기합니다.
3. `res.clearCookie(SESSION_COOKIE_NAME)`로 쿠키를 정리합니다.
4. 루트(`/`)로 리다이렉트합니다.

## 비밀번호 재설정 플로우와 세션

재설정 플로우는 비로그인 상태에서도 동작합니다.

- `GET /forgot-password`: 요청 화면 렌더링입니다.
- `POST /forgot-password`: 항상 동일 접수 문구를 응답합니다.
- `GET /reset-password`: 토큰 유효성 확인 후 화면 렌더링입니다.
- `POST /reset-password`: 비밀번호 갱신과 보안 상태 초기화 처리입니다.

재설정 성공 시 계정 상태는 다음으로 정리됩니다.

- `password_reset_required=false`
- `login_failed_count=0`
- `login_locked_until=NULL`
- 토큰 해시/만료는 무효화

재설정 성공 직후에도 자동 로그인 세션을 만들지 않는 것이 기준입니다. 사용자는 새 비밀번호로 다시 로그인합니다.

## 관련 코드

- `server/src/utils/session/auth-session.util.ts`
- `server/src/utils/session/session.util.ts`
- `server/src/controllers/auth/auth-login.controller.ts`
- `server/src/controllers/auth/auth-logout.controller.ts`
- `server/src/controllers/auth/auth-password-reset.controller.ts`

## 관련 문서

- [Auth Defense and Rate Limit 동작 원리](./auth-defense-and-rate-limit.md)
- [Security Defense 토글 운영 가이드](../guide/security-defense-toggles.md)
- [Audit Log 운영 가이드](../guide/audit-log-operations-guide.md)

