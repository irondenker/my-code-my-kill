# Audit Log 운영 가이드

MCMK는 실서비스가 아닌 학습/실습용 프로젝트이다. 따라서 감사로그는 보안 이벤트 추적의 학습 목적을 우선하며, 실무에서 요구되는 SIEM 연동이나 장기 보관 정책은 별도 확장이 필요한 구조이다.

## 관련 코드

- 라우트: `server/src/routes/audit.routes.ts`
- 컨트롤러: `server/src/controllers/audit.controller.ts`
- 조회 서비스: `server/src/services/audit/audit-read.service.ts`
- 기록 서비스: `server/src/services/audit/audit-write.service.ts`
- 이벤트 매퍼: `server/src/utils/audit/audit-event-mapper.util.ts`

## 조회 화면

- 페이지: `GET /admin/audit-logs` (admin 전용)
- `limit` 쿼리: 기본 `200`, 최소 `1`, 최대 `500`
- 정렬: `created_at DESC, audit_log_id DESC`

## 데이터 모델

테이블은 `audit_logs`이다. 핵심 컬럼은 다음과 같다.

- `action`
- `actor_user_id`, `actor_username`
- `target_user_id`, `target_username`
- `details` (`jsonb`)
- `ip_address`, `user_agent`
- `created_at`

## 액션 목록

허용 액션(`AUDIT_ACTIONS`)은 다음과 같다.

- `LOGIN`
- `LOGIN_FAILED`
- `LOGOUT`
- `ACCOUNT_CREATED`
- `ACCOUNT_ACTIVATED`
- `ACCOUNT_DEACTIVATED`
- `ADMIN_GRANTED`
- `ADMIN_REVOKED`
- `AUTHZ_DENIED`
- `CSRF_INVALID`
- `ADMIN_PAGE_ACCESS_ATTEMPT`
- `PASSWORD_RESET_REQUESTED`
- `PASSWORD_RESET_COMPLETED`
- `ACCOUNT_LOCKED`
- `RATE_LIMITED`

## 신규 보안 이벤트 해석

- `PASSWORD_RESET_REQUESTED`: forgot-password 요청 처리 이벤트이다.
- `PASSWORD_RESET_COMPLETED`: reset-password 성공 완료 이벤트이다.
- `ACCOUNT_LOCKED`: 실패 누적 임계치 도달 이벤트이다.
- `RATE_LIMITED`: 레이트리밋 차단 이벤트(공용)이다.

## details 필드 예시

- `LOGIN_FAILED`: `reason`, `attemptedUsername`, `failedCount`, `passwordResetRequired`, `lockedUntil`
- `PASSWORD_RESET_REQUESTED`: `requestedUsername`, `issued`, `pseudoVerifyEnabled`, `pseudoVerified`, `tokenExpiresAt`
- `PASSWORD_RESET_COMPLETED`: `result=success`
- `ACCOUNT_LOCKED`: `failedCount`, `lockMinutes`, `passwordResetRequired`

## 콘솔 출력 레벨

`AUDIT_CLI_LOG_LEVEL`은 다음 값을 사용한다.

- `none`: 콘솔 출력 없음
- `errors`: 실패 로그만 출력
- `all`: 성공/실패 모두 출력

## 운영 메모

- 인증/인가 흐름은 `writeAuditLogSafely` 경로를 사용해 감사로그 실패가 사용자 요청을 중단시키지 않게 설계되어 있다.
- 알 수 없는 `action`은 조회 시 필터링되어 무시된다.

## 관련 문서

- [Auth Defense and Rate Limit 동작 원리](../learn/auth-defense-and-rate-limit.md)
- [Security Defense 토글 운영 가이드](./security-defense-toggles.md)
