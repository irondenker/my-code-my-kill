# 환경변수 / 실행모드 매트릭스

MCMK는 실서비스가 아닌 학습/실습용 프로젝트이다. 이 문서는 실무 유사 운영을 위한 설정 위치를 정리하는 문서이며, 실무 배포 시에는 비밀관리 시스템과 별도 운영 정책이 추가되어야 한다.

## 기준 파일

- dev 예시: `server/examples/.env.example`
- prod 예시: `server/examples/.env.production.example`
- dev compose: `docker-compose.yml`
- prod compose: `docker-compose.prod.yml`
- DB 로더: `server/src/db/env.ts`

## 공통 필수 변수

| 변수 | 설명 |
| --- | --- |
| `NODE_ENV` | 실행 모드(`development`, `production`)이다. |
| `PORT` | 서버 포트이다. |
| `SESSION_SECRET` | 세션 서명 키이다. |
| `DB_HOST` | DB 호스트이다. |
| `DB_PORT` | DB 포트이다. |
| `DB_NAME` | DB 이름이다. |
| `DB_USER` | DB 사용자이다. |
| `DB_PASSWORD` | DB 비밀번호이다. |
| `DB_LOGGING` | Sequelize SQL 로깅 여부이다. |
| `AUDIT_CLI_LOG_LEVEL` | 감사로그 콘솔 출력 레벨이다. |

## SECURITY_DEFENSE 변수

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `SECURITY_DEFENSE_ENABLED` | `false` | 보안 방어 기능 전체 토글이다. |
| `SECURITY_DEFENSE_ACCOUNT_LOCKOUT_ENABLED` | `false` | 로그인 실패 누적 방어 토글이다. |
| `SECURITY_DEFENSE_ACCOUNT_LOCKOUT_MAX_FAILURES` | `5` | 실패 임계치이다. |
| `SECURITY_DEFENSE_ACCOUNT_LOCKOUT_LOCK_MINUTES` | `10` | 임시잠금 기간(분)이다. |
| `SECURITY_DEFENSE_ACCOUNT_LOCKOUT_USE_LOGIN_LOCK_UNTIL` | `true` | `login_locked_until` 사용 여부이다. |
| `SECURITY_DEFENSE_PASSWORD_RESET_ENABLED` | `false` | 비밀번호 재설정 플로우 활성화이다. |
| `SECURITY_DEFENSE_PASSWORD_RESET_TOKEN_TTL_MINUTES` | `20` | 재설정 토큰 TTL(분)이다. |
| `SECURITY_DEFENSE_PASSWORD_RESET_DEV_REVEAL_TOKEN_ENABLED` | `false` | Dev/Lab 토큰 노출 여부이다. |
| `SECURITY_DEFENSE_PASSWORD_RESET_PSEUDO_VERIFY_ENABLED` | `false` | profile email/phone 기반 pseudo verification 여부이다. |

## 모드별 체크 포인트

- 로컬 dev는 `.env` 기반 실행이 기준이다.
- Docker dev/prod는 compose `environment`가 `.env`를 override할 수 있다.
- 운영 모드에서는 `SESSION_SECRET` 누락 시 서버가 부팅되지 않는 것이 기준이다.

## Nginx/Express 레이트리밋 범위 메모

- Nginx는 1차(엣지/IP) 제한 계층으로 운영하는 것이 기준이다.
- Express는 2차(사용자/리소스) 제한 계층으로 운영하는 것이 기준이다.
- 현재 `nginx/conf.d/default.conf`에는 `limit_req` 선언이 없으므로, 적용 시 다음 경로를 우선 범위로 잡는 것이 기준이다.
  - `POST /login`
  - `POST /forgot-password`
  - `POST /reset-password`
  - 게시글 변경 경로(`POST/DELETE /board/*`)

## Lab Options와의 관계

- `lab-options.json`은 취약점 실습 토글이다.
- `SECURITY_DEFENSE_*`는 방어 기능 토글이다.
- 두 축은 분리해서 운영하는 것이 기준이다.

## 관련 문서

- [Security Defense 토글 운영 가이드](./security-defense-toggles.md)
- [Auth Defense and Rate Limit 동작 원리](../learn/auth-defense-and-rate-limit.md)
- [Lab Options 레퍼런스](./lab/lab-options-reference.md)
