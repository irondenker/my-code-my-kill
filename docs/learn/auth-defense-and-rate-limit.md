# Auth Defense and Rate Limit 동작 원리

MCMK는 실서비스가 아닌 학습/실습용 프로젝트이다. 따라서 본 문서의 방어 흐름은 실무 보안 원칙을 따르되, 본인확인 채널(이메일 발송, SMS 발송) 없이도 재현 가능한 구조를 기준으로 설명하는 문서이다.

## 문서 범위

- 로그인 실패 누적과 `password_reset_required` 전환 원리를 설명한다.
- 비밀번호 재설정 토큰의 해시 저장, 만료, 재사용 방지 원리를 설명한다.
- Nginx 1차 제한과 Express 2차 제한의 책임 분리를 설명한다.
- 게시글 CRUD의 유저 단위 제한과 리소스 병렬 수정 충돌(409) 원리를 설명한다.
- 사용자 열거 방지 UX 선택을 설명한다.

## 로그인 실패 누적과 reset_required 전환

로그인 방어 토글이 켜진 상태(`SECURITY_DEFENSE_ENABLED=true`, `SECURITY_DEFENSE_ACCOUNT_LOCKOUT_ENABLED=true`)에서는 로그인 실패 시 다음 순서로 처리한다.

1. 사용자 존재 여부와 무관하게 로그인 실패 응답 문구는 동일하게 유지한다.
2. 사용자가 존재할 때만 `login_failed_count`를 증가시킨다.
3. 누적 실패 횟수가 임계치(`SECURITY_DEFENSE_ACCOUNT_LOCKOUT_MAX_FAILURES`, 기본 5)에 도달하면 `password_reset_required=true`로 전환한다.
4. 옵션이 켜져 있으면 `login_locked_until`을 짧은 기간으로 설정한다.
5. `password_reset_required=true` 계정은 비밀번호 재설정 완료 전까지 로그인에 성공할 수 없다.
6. 정상 로그인에 성공한 계정은 `login_failed_count=0`, `login_locked_until=NULL`로 초기화한다.

## 비밀번호 재설정 토큰 원리

비밀번호 재설정은 `/forgot-password`, `/reset-password` 두 엔드포인트로 동작한다.

- 토큰 생성: 32바이트 난수 기반 64-hex 원문 토큰을 생성한다.
- 토큰 저장: DB에는 원문이 아니라 SHA-256 해시(`password_reset_token_hash`)만 저장한다.
- 만료: `SECURITY_DEFENSE_PASSWORD_RESET_TOKEN_TTL_MINUTES`(기본 20분)로 만료 시각을 저장한다.
- 검증: 입력 토큰 해시가 일치하고, 만료되지 않았고, 미사용(`password_reset_used_at IS NULL`)일 때만 유효하다.
- 성공 처리:
  - `password_hash` 갱신
  - `password_reset_required=false`
  - `login_failed_count=0`
  - `login_locked_until=NULL`
  - `password_reset_used_at=NOW()`
  - `password_reset_token_hash=NULL`
  - `password_reset_token_expires_at=NULL`
- 결과: 토큰은 1회 사용 후 재사용 불가 상태가 된다.

## 사용자 열거 방지 UX 선택

forgot-password 요청(`POST /forgot-password`)은 계정 존재 여부, pseudo verification 통과 여부, 토큰 발급 여부와 무관하게 항상 동일한 접수 문구를 반환한다.

- 외부 응답: 항상 동일 문구이다.
- 내부 상태: 감사로그와 DB 상태로만 구분한다.
- 로그인 실패 응답: `password_reset_required` 상태여도 기존 실패 문구와 동일하게 처리한다.

이 방식은 학습 환경에서 사용자 열거(User Enumeration)를 줄이는 기본 UX 선택이다.

## Dev/Lab 대체 본인확인

MCMK는 실서비스가 아니므로 실전 채널 발송을 강제하지 않는다. 대신 다음 대체 모드를 사용한다.

- `devRevealToken` 모드: reset 링크/토큰을 forgot-password 화면에 표시한다.
- `pseudoVerify` 모드: 프로필에 저장된 email/phone과 입력값이 일치할 때만 토큰을 발급한다.

두 모드는 환경변수 토글로 독립 제어가 가능하다.

## Nginx 1차 제한과 Express 2차 제한 역할 분담

2계층 제한의 기본 원칙은 다음과 같다.

- Nginx는 IP/엣지 기준의 1차 트래픽 컷오프를 담당한다.
- Express는 사용자 ID, 세션, 리소스 키 기준의 2차 애플리케이션 제어를 담당한다.

현재 리포지토리의 `nginx/conf.d/default.conf`는 프록시 및 에러 페이지 처리는 설정되어 있으나 `limit_req` 계열 선언은 아직 없는 상태이다. 따라서 Nginx 레이트리밋 적용 범위는 문서 기준으로 다음 엔드포인트부터 시작하는 것이 기준이다.

- 인증 경로: `POST /login`, `POST /forgot-password`, `POST /reset-password`
- 게시글 변경 경로: `POST /board/:slug`, `POST /board/:slug/:displayId/edit`, `POST /board/:slug/:displayId/delete`, `DELETE /board/:slug/:displayId`

## 게시글 CRUD: 유저 단위 제한과 병렬 수정 충돌 방지

게시글 변경 API는 애플리케이션 레벨에서 다음 두 축으로 방어하는 구조가 적합하다.

- 유저 단위 레이트리밋: 동일 사용자 기준으로 짧은 윈도우 요청량을 제한한다.
- 리소스 병렬 수정 충돌 방지: 동일 글에 대한 동시 수정/삭제 충돌은 409로 거절한다.

핵심은 “과도한 시도 차단(429)”과 “동시 상태 충돌 차단(409)”을 분리해 다루는 것이다.

## 작업 로그 발췌

아래 항목은 기능 구현 단계에서 확인된 흐름/검증 결과 중 구조 이해에 직접 도움이 되는 요약 발췌이다.

> 로그인 컨트롤러 흐름 요약
> 1) 방어 토글 ON이면 `password_reset_required`/`login_locked_until`을 먼저 검사한다.
> 2) 비밀번호 실패 시 사용자 존재 계정만 실패 카운트를 증가시킨다.
> 3) 임계치 도달 시 `password_reset_required=true` 전환 및 감사로그를 남긴다.
> 4) 로그인 성공 시 실패 카운트/잠금 상태를 초기화한다.

> 검증 요약
> - `npm run build` 통과
> - `npm test` 통과
> - `npm run test:db` 통과

## 관련 문서

- [Security Defense 토글 운영 가이드](../guide/security-defense-toggles.md)
- [세션 라이프사이클](./session-lifecycle.md)
- [감사로그 운영 가이드](../guide/audit-log-operations-guide.md)
- [Lab Options 레퍼런스](../guide/lab/lab-options-reference.md)
