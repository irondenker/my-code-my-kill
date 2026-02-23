# Lab Options Reference (`server/lab-options.json`)

MCMK는 실서비스가 아닌 학습/실습용 프로젝트입니다. `lab-options.json`은 취약점 실습 시나리오를 켜고 끄는 학습용 설정 파일입니다.

## 범위

이 문서는 `lab-options.json` 스키마와 적용 방식을 설명합니다.

- 파일: `server/lab-options.json`
- 예시: `server/examples/lab-options.json.example`
- 로더: `server/src/config/lab-options.ts`
- 적용 시점: 서버 시작 시 1회 로드입니다.

## 핵심 항목

- `sqlInjection.enabled`
- `sqlInjection.targets.*`
- `ssti.enabled`
- `csrf.enabled`
- `uploadValidation.*`
- `xss.stored.enabled`
- `xss.sanitize.clientSide.*`
- `xss.sanitize.serverSide.*`

## 파싱 규칙

- boolean은 `true/false` 또는 문자열 `"true"/"false"`를 허용합니다.
- 잘못된 타입은 경고 후 기본값으로 복구합니다.
- 알 수 없는 키는 무시합니다.

## SECURITY_DEFENSE와의 경계

`lab-options.json`과 `SECURITY_DEFENSE_*`는 목적이 다릅니다.

- `lab-options.json`: 취약점 실습 토글입니다.
- `SECURITY_DEFENSE_*`: 계정 보호/비밀번호 재설정/방어 기능 토글입니다.

즉, 비밀번호 재설정(`/forgot-password`, `/reset-password`)과 계정 잠금 동작은 `lab-options.json`이 아니라 환경변수로 제어합니다.

## 관련 문서

- [Security Defense 토글 운영 가이드](../security-defense-toggles.md)
- [Auth Defense and Rate Limit 동작 원리](../../learn/auth-defense-and-rate-limit.md)
- [SQLi 실습 설정 가이드](./sqli-lab-guide.md)
- [XSS 실습 설정 가이드](./xss-filter-guide.md)
- [업로드 검증 실습 가이드](./upload-validation-guide.md)
- [SSTI 실습 설정 가이드](./ssti-lab-guide.md)
- [CSRF 실습 토글 가이드](./csrf-lab-guide.md)

