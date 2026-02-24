# Security Defense 토글 운영 가이드

MCMK는 실서비스가 아닌 학습/실습용 프로젝트입니다. 따라서 본 가이드는 실무 보안 개념을 학습 가능한 수준으로 단순화한 운영 기준을 제공합니다. 실무에서는 별도 비밀관리, 관측, 계정복구 채널이 필수임을 전제로 보아야 합니다.

## 개요

이 문서는 `lab-options.json`의 `securityDefense` 토글과 운영 기준을 정리합니다.
우선순위는 `lab-options.json` > 코드 기본값입니다.

## 토글 전체 목록

현재 방어 토글 키는 다음과 같습니다.

| 키 경로 | 기본값 | 설명 |
| --- | --- | --- |
| `securityDefense.accountLockout.enabled` | `false` | 로그인 실패 누적/락아웃 흐름 활성화입니다. |
| `securityDefense.accountLockout.maxFailures` | `5` | reset_required 전환 임계 실패 횟수입니다. |
| `securityDefense.accountLockout.lockMinutes` | `10` | 임시 잠금(`login_locked_until`) 기간(분)입니다. |
| `securityDefense.accountLockout.useLoginLockUntil` | `true` | 임시 잠금 컬럼 사용 여부입니다. |
| `securityDefense.passwordReset.tokenTtlMinutes` | `20` | 재설정 토큰 만료 시간(분)입니다. |
| `securityDefense.rateLimit.enabled` | `false` | 애플리케이션 2차 레이트리밋 전체 활성화입니다. |
| `securityDefense.rateLimit.maxRequests` | `20` | 로그인/게시글 변경 2차 레이트리밋 윈도우 내 허용 요청 수입니다. |
| `securityDefense.rateLimit.windowSeconds` | `60` | 로그인/게시글 변경 2차 레이트리밋 윈도우(초)입니다. |
| `securityDefense.simpleCaptcha.enabled` | `false` | 간이 캡챠 전체 활성화입니다. |
| `securityDefense.simpleCaptcha.login.enabled` | `true`(상위 ON 시) | 로그인 간이 캡챠 활성화입니다. |
| `securityDefense.simpleCaptcha.login.afterFailures` | `3` | 같은 세션에서 이 횟수 이상 로그인 실패 시 캡챠를 요구합니다. |

## 로컬에서 켜는 방법

`server/lab-options.json` 예시는 다음과 같습니다.

```json
{
  "securityDefense": {
    "accountLockout": {
      "enabled": true,
      "maxFailures": 5,
      "lockMinutes": 10,
      "useLoginLockUntil": true
    },
    "passwordReset": {
      "tokenTtlMinutes": 20
    },
    "rateLimit": {
      "enabled": true,
      "maxRequests": 20,
      "windowSeconds": 60
    },
    "simpleCaptcha": {
      "enabled": true,
      "login": {
        "enabled": true,
        "afterFailures": 3
      }
    }
  }
}
```

적용 후에는 서버를 재시작해야 합니다.

## 추천 프리셋

### 실습용 프리셋

- 목적: 학습/데모에서 방어 토글을 일괄 확인하는 용도입니다.
- 권장값:
  - `securityDefense.accountLockout.enabled=true`
  - `securityDefense.passwordReset.tokenTtlMinutes=20`
  - `securityDefense.rateLimit.enabled=true`
  - `securityDefense.simpleCaptcha.enabled=true`

### 공격시나리오 재현용 프리셋 (일부 OFF)

- 목적: 방어 전후 비교 테스트(브루트포스 재현, 열거 리스크 재현) 용도입니다.
- 권장값 예시:
  - `securityDefense.accountLockout.enabled=false`
  - `securityDefense.passwordReset.tokenTtlMinutes=20`
  - `securityDefense.rateLimit.enabled=false`
  - `securityDefense.simpleCaptcha.enabled=false`

## 429가 너무 자주 뜰 때 조정 포인트

2계층 제한 구조에서는 아래 순서로 조정하는 것이 기준입니다.

1. Nginx 1차 제한부터 확인합니다.
2. 요청이 프록시를 거치면 실제 클라이언트 IP가 올바르게 전달되는지 확인합니다.
3. Nginx burst/nodelay, zone rate를 사용 시나리오에 맞게 완화합니다.
4. Express 2차 제한이 있으면 사용자 키/리소스 키/윈도우를 분리 조정합니다.
5. `securityDefense.rateLimit.maxRequests`, `securityDefense.rateLimit.windowSeconds`를 트래픽 패턴에 맞게 조정합니다.

## 관련 문서

- [Auth Defense and Rate Limit 동작 원리](../learn/auth-defense-and-rate-limit.md)
- [환경변수/실행모드 매트릭스](./env-mode-matrix.md)
- [Audit Log 운영 가이드](./audit-log-operations-guide.md)
- [Lab Options 레퍼런스](./lab/lab-options-reference.md)
