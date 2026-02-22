# Audit Log 운영 가이드

이 문서는 관리자 감사로그의 저장/조회 구조와 운영 시 확인 포인트를 정리합니다.

## 연관 코드

- 라우트: `server/src/routes/audit.routes.ts`
- 컨트롤러: `server/src/controllers/audit.controller.ts`
- 조회 서비스: `server/src/services/audit/audit-read.service.ts`
- 쓰기 서비스: `server/src/services/audit/audit-write.service.ts`
- 이벤트 매퍼: `server/src/utils/audit/audit-event-mapper.util.ts`

## 조회 화면

- 페이지: `GET /admin/audit-logs` (admin 전용)
- `limit` 쿼리: 기본 `200`, 최솟값 `1`, 최댓값 `500`
- 정렬: `created_at DESC, audit_log_id DESC`

## 저장 모델

테이블: `audit_logs`

주요 컬럼:

- `action`
- `actor_user_id`, `actor_username`
- `target_user_id`, `target_username`
- `details` (`jsonb`)
- `ip_address`, `user_agent`
- `created_at`

## 액션 목록

허용 액션(`AUDIT_ACTIONS`):

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

현재 코드 경로 기준으로 자주 보이는 액션:

- 로그인/로그아웃: `LOGIN`, `LOGIN_FAILED`, `LOGOUT`
- 관리자 접근/인가: `ADMIN_PAGE_ACCESS_ATTEMPT`, `AUTHZ_DENIED`
- 보안 이벤트: `CSRF_INVALID`
- 관리자 계정 변경: `ACCOUNT_ACTIVATED`, `ACCOUNT_DEACTIVATED`, `ADMIN_GRANTED`, `ADMIN_REVOKED`

## `details` 필드 예시

- `LOGIN_FAILED`: `loginResult`, `reason`, `attemptedUsername`
- `LOGIN`: `loginResult`, `userRole`
- `LOGOUT`: `logoutResult`, `userRole`
- `ADMIN_PAGE_ACCESS_ATTEMPT`: `result`, `reason`, `method`, `path`
- `AUTHZ_DENIED`: `method`, `path`, `reason`
- `CSRF_INVALID`: `method`, `path`, `reason=invalid_csrf_token`
- `ACCOUNT_*`: `previousStatus`, `currentStatus`
- `ADMIN_*`: `previousRole`, `currentRole`

## 콘솔 출력 레벨 (`AUDIT_CLI_LOG_LEVEL`)

- `none`(기본): 콘솔 출력 없음
- `errors`: 실패 로그만 출력
- `all`: 성공/실패 모두 출력

설정 위치:

- dev: `server/.env`
- prod: `server/.env.production`
- compose override: `docker-compose.yml`, `docker-compose.prod.yml`

## 장애 대응 메모

- 감사로그 기록 실패가 인증/인가 흐름을 깨면 안 되는 경로는 `writeAuditLogSafely` 래퍼를 사용합니다.
- 안전 래퍼는 예외를 삼키고 `[AUDIT_LOG_ERROR]` 1줄 요약만 남깁니다.
- 조회 시 알 수 없는 `action`은 스킵하고 경고 로그를 남깁니다.
