# Security Defense 토글 운영 가이드

MCMK는 실서비스가 아닌 학습/실습용 프로젝트입니다. 따라서 본 가이드는 실무 보안 개념을 학습 가능한 수준으로 단순화한 토글 운영 기준을 제공하는 문서입니다. 실무에서는 별도 비밀관리, 관측, 계정복구 채널이 필수임을 전제로 보아야 합니다.

## 개요

이 문서는 `SECURITY_DEFENSE_*` 환경변수의 현재 구현 목록과 운영 기준을 정리합니다.

## 토글 전체 목록

현재 리포지토리에 선언된 `SECURITY_DEFENSE` 키는 다음과 같습니다.

| 키 | 기본값 | 설명 |
| --- | --- | --- |
| `SECURITY_DEFENSE_ENABLED` | `false` | 보안 방어 기능의 최상위 ON/OFF입니다. |
| `SECURITY_DEFENSE_ACCOUNT_LOCKOUT_ENABLED` | `false` | 로그인 실패 누적/락아웃 흐름 활성화입니다. |
| `SECURITY_DEFENSE_ACCOUNT_LOCKOUT_MAX_FAILURES` | `5` | reset_required 전환 임계 실패 횟수입니다. |
| `SECURITY_DEFENSE_ACCOUNT_LOCKOUT_LOCK_MINUTES` | `10` | 임시 잠금(`login_locked_until`) 기간(분)입니다. |
| `SECURITY_DEFENSE_ACCOUNT_LOCKOUT_USE_LOGIN_LOCK_UNTIL` | `true` | 임시 잠금 컬럼 사용 여부입니다. |
| `SECURITY_DEFENSE_PASSWORD_RESET_ENABLED` | `false` | `/forgot-password`, `/reset-password` 플로우 활성화입니다. |
| `SECURITY_DEFENSE_PASSWORD_RESET_TOKEN_TTL_MINUTES` | `20` | 재설정 토큰 만료 시간(분)입니다. |
| `SECURITY_DEFENSE_PASSWORD_RESET_DEV_REVEAL_TOKEN_ENABLED` | `false` | Dev/Lab 토큰 노출(페이지 표시) 활성화입니다. |
| `SECURITY_DEFENSE_PASSWORD_RESET_PSEUDO_VERIFY_ENABLED` | `false` | profile email/phone 일치 기반 pseudo verification 활성화입니다. |

## 로컬에서 켜는 방법

`server/.env` 예시는 다음과 같습니다.

```env
SECURITY_DEFENSE_ENABLED=true
SECURITY_DEFENSE_ACCOUNT_LOCKOUT_ENABLED=true
SECURITY_DEFENSE_ACCOUNT_LOCKOUT_MAX_FAILURES=5
SECURITY_DEFENSE_ACCOUNT_LOCKOUT_LOCK_MINUTES=10
SECURITY_DEFENSE_ACCOUNT_LOCKOUT_USE_LOGIN_LOCK_UNTIL=true
SECURITY_DEFENSE_PASSWORD_RESET_ENABLED=true
SECURITY_DEFENSE_PASSWORD_RESET_TOKEN_TTL_MINUTES=20
SECURITY_DEFENSE_PASSWORD_RESET_DEV_REVEAL_TOKEN_ENABLED=true
SECURITY_DEFENSE_PASSWORD_RESET_PSEUDO_VERIFY_ENABLED=false
```

적용 후에는 서버를 재시작해야 합니다.

## 추천 프리셋

### 실습용 프리셋 (토큰 노출 ON)

- 목적: 학습/데모에서 재설정 토큰 흐름을 빠르게 확인하는 용도입니다.
- 권장값:
  - `SECURITY_DEFENSE_ENABLED=true`
  - `SECURITY_DEFENSE_ACCOUNT_LOCKOUT_ENABLED=true`
  - `SECURITY_DEFENSE_PASSWORD_RESET_ENABLED=true`
  - `SECURITY_DEFENSE_PASSWORD_RESET_DEV_REVEAL_TOKEN_ENABLED=true`
  - `SECURITY_DEFENSE_PASSWORD_RESET_PSEUDO_VERIFY_ENABLED=false`

### 준운영용 프리셋 (토큰 노출 OFF)

- 목적: 실서비스는 아니지만 운영 유사 환경에서 열거/노출을 줄이는 용도입니다.
- 권장값:
  - `SECURITY_DEFENSE_ENABLED=true`
  - `SECURITY_DEFENSE_ACCOUNT_LOCKOUT_ENABLED=true`
  - `SECURITY_DEFENSE_PASSWORD_RESET_ENABLED=true`
  - `SECURITY_DEFENSE_PASSWORD_RESET_DEV_REVEAL_TOKEN_ENABLED=false`
  - `SECURITY_DEFENSE_PASSWORD_RESET_PSEUDO_VERIFY_ENABLED=true`

### 공격시나리오 재현용 프리셋 (일부 OFF)

- 목적: 방어 전후 비교 테스트(브루트포스 재현, 열거 리스크 재현) 용도입니다.
- 권장값 예시:
  - `SECURITY_DEFENSE_ENABLED=true`
  - `SECURITY_DEFENSE_ACCOUNT_LOCKOUT_ENABLED=false`
  - `SECURITY_DEFENSE_PASSWORD_RESET_ENABLED=false`

## 429가 너무 자주 뜰 때 조정 포인트

2계층 제한 구조에서는 아래 순서로 조정하는 것이 기준입니다.

1. Nginx 1차 제한부터 확인합니다.
2. 요청이 프록시를 거치면 실제 클라이언트 IP가 올바르게 전달되는지 확인합니다.
3. Nginx burst/nodelay, zone rate를 사용 시나리오에 맞게 완화합니다.
4. Express 2차 제한이 있으면 사용자 키/리소스 키/윈도우를 분리 조정합니다.
5. 로그인, 비밀번호 재설정, 게시글 변경 경로를 동일 강도로 묶지 않고 경로별로 분리합니다.

## 작업 로그 발췌

> 재현 시나리오 발췌
> - 정상 로그인 후 카운터 초기화 확인
> - 5회 실패 후 `password_reset_required=true` 전환 확인
> - 재설정 성공 후 `login_failed_count=0`, `login_locked_until=NULL` 확인

## 관련 문서

- [Auth Defense and Rate Limit 동작 원리](../learn/auth-defense-and-rate-limit.md)
- [환경변수/실행모드 매트릭스](./env-mode-matrix.md)
- [Audit Log 운영 가이드](./audit-log-operations-guide.md)
- [Lab Options 레퍼런스](./lab/lab-options-reference.md)

