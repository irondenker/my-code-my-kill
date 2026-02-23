# Docs Index

문서 접근의 단일 진입점이다. 기능 문서와 운영 문서를 함께 연결하는 인덱스이다.

## 시작하기

| 문서 | 설명 |
| --- | --- |
| [`guide/first-run/first-run-docker.md`](./guide/first-run/first-run-docker.md) | 로컬 Docker 첫 실행 가이드이다. |
| [`guide/first-run/first-run-vm.md`](./guide/first-run/first-run-vm.md) | VM 첫 실행 가이드이다. |
| [`guide/first-run/quality-gates.md`](./guide/first-run/quality-gates.md) | 품질 게이트 초기 설정 가이드이다. |

## Guide

| 문서 | 설명 |
| --- | --- |
| [`guide/env-mode-matrix.md`](./guide/env-mode-matrix.md) | 환경변수와 실행 모드 매트릭스이다. |
| [`guide/security-defense-toggles.md`](./guide/security-defense-toggles.md) | `SECURITY_DEFENSE` 토글 운영 가이드이다. |
| [`guide/audit-log-operations-guide.md`](./guide/audit-log-operations-guide.md) | 감사로그 저장/조회/운영 가이드이다. |
| [`guide/admin-operations-guide.md`](./guide/admin-operations-guide.md) | 관리자 기능 운영 가이드이다. |
| [`guide/profile-avatar-lifecycle-guide.md`](./guide/profile-avatar-lifecycle-guide.md) | 프로필/아바타 라이프사이클 가이드이다. |
| [`guide/lab/lab-options-reference.md`](./guide/lab/lab-options-reference.md) | `lab-options.json` 레퍼런스이다. |
| [`guide/lab/sqli-lab-guide.md`](./guide/lab/sqli-lab-guide.md) | SQLi 실습 설정 가이드이다. |
| [`guide/lab/xss-filter-guide.md`](./guide/lab/xss-filter-guide.md) | XSS 실습 설정 가이드이다. |
| [`guide/lab/upload-validation-guide.md`](./guide/lab/upload-validation-guide.md) | 업로드 검증 실습 가이드이다. |
| [`guide/lab/ssti-lab-guide.md`](./guide/lab/ssti-lab-guide.md) | SSTI 실습 설정 가이드이다. |
| [`guide/lab/csrf-lab-guide.md`](./guide/lab/csrf-lab-guide.md) | CSRF 실습 토글 가이드이다. |
| [`guide/lab/debug-error-routes-guide.md`](./guide/lab/debug-error-routes-guide.md) | 디버그 에러 라우트 가이드이다. |

## Learn

| 문서 | 설명 |
| --- | --- |
| [`learn/structure-model.md`](./learn/structure-model.md) | 프로젝트 보안 구조 모델이다. |
| [`learn/session-lifecycle.md`](./learn/session-lifecycle.md) | 로그인/재설정 포함 세션 라이프사이클 문서이다. |
| [`learn/auth-defense-and-rate-limit.md`](./learn/auth-defense-and-rate-limit.md) | 로그인 방어/비밀번호 재설정/레이트리밋 동작 원리 문서이다. |
| [`learn/csp.md`](./learn/csp.md) | CSP 개념 정리 문서이다. |
| [`learn/how-to-apply-csp.md`](./learn/how-to-apply-csp.md) | CSP 적용 실무 문서이다. |
| [`learn/nodenext-import-extension.md`](./learn/nodenext-import-extension.md) | NodeNext import 규칙 문서이다. |

## Flowmap

| 문서 | 설명 |
| --- | --- |
| [`flowmap/README.md`](./flowmap/README.md) | Flowmap 라우트 인덱스이다. |
| [`flowmap/session-access.mmd`](./flowmap/session-access.mmd) | Session Access 맵이다. |

## API / Reports / Legal

| 문서 | 설명 |
| --- | --- |
| [`api-docs/README.MD`](./api-docs/README.MD) | Swagger 기반 API 문서이다. |
| [`daily-reports/README.md`](./daily-reports/README.md) | 일일 보고서 인덱스이다. |
| [`legal/THIRD_PARTY_NOTICE_ENTRY_TEMPLATE.md`](./legal/THIRD_PARTY_NOTICE_ENTRY_TEMPLATE.md) | 서드파티 고지 템플릿이다. |

## 문서 운영 규칙

- 신규 문서 추가 시 이 인덱스에 링크를 등록하는 것이 기준이다.
- `docs/flowmap/**` 산출물은 스크립트 생성 결과물이며 수동 수정하지 않는 것이 기준이다.
- 토글/엔드포인트/감사로그 변경 시 `guide`와 `learn` 문서를 함께 갱신하는 것이 기준이다.
