# Docs Index

문서 접근의 단일 진입점입니다. 기능 문서와 운영 문서를 함께 연결하는 인덱스입니다.

## 시작하기

| 문서 | 설명 |
| --- | --- |
| [`guide/first-run/first-run-docker.md`](./guide/first-run/first-run-docker.md) | 로컬 Docker 첫 실행 가이드 |
| [`guide/first-run/first-run-vm.md`](./guide/first-run/first-run-vm.md) | VM 첫 실행 가이드 |
| [`guide/first-run/quality-gates.md`](./guide/first-run/quality-gates.md) | 품질 게이트 초기 설정 가이드 |

## Guide

| 문서 | 설명 |
| --- | --- |
| [`guide/env-mode-matrix.md`](./guide/env-mode-matrix.md) | 환경변수와 실행 모드 매트릭스 |
| [`guide/security-defense-toggles.md`](./guide/security-defense-toggles.md) | `SECURITY_DEFENSE` 토글 운영 가이드 |
| [`guide/audit-log-operations-guide.md`](./guide/audit-log-operations-guide.md) | 감사로그 저장/조회/운영 가이드 |
| [`guide/admin-operations-guide.md`](./guide/admin-operations-guide.md) | 관리자 기능 운영 가이드 |
| [`guide/profile-avatar-lifecycle-guide.md`](./guide/profile-avatar-lifecycle-guide.md) | 프로필/아바타 라이프사이클 가이드 |
| [`guide/seed-assets-prep.md`](./guide/seed-assets-prep.md) | Seeder용 raw 에셋 준비 가이드 |
| [`guide/lab/lab-options-reference.md`](./guide/lab/lab-options-reference.md) | `lab-options.json` 레퍼런스 |
| [`guide/lab/sqli-lab-guide.md`](./guide/lab/sqli-lab-guide.md) | SQLi 실습 설정 가이드 |
| [`guide/lab/xss-filter-guide.md`](./guide/lab/xss-filter-guide.md) | XSS 실습 설정 가이드 |
| [`guide/lab/upload-validation-guide.md`](./guide/lab/upload-validation-guide.md) | 업로드 검증 실습 가이드 |
| [`guide/lab/ssti-lab-guide.md`](./guide/lab/ssti-lab-guide.md) | SSTI 실습 설정 가이드 |
| [`guide/lab/csrf-lab-guide.md`](./guide/lab/csrf-lab-guide.md) | CSRF 실습 토글 가이드 |
| [`guide/lab/debug-error-routes-guide.md`](./guide/lab/debug-error-routes-guide.md) | 디버그 에러 라우트 가이드 |

## Learn

| 문서 | 설명 |
| --- | --- |
| [`learn/structure-model.md`](./learn/structure-model.md) | 프로젝트 보안 구조 모델 |
| [`learn/session-lifecycle.md`](./learn/session-lifecycle.md) | 로그인/재설정 포함 세션 라이프사이클 문서 |
| [`learn/auth-defense-and-rate-limit.md`](./learn/auth-defense-and-rate-limit.md) | 로그인 방어/비밀번호 재설정/레이트리밋 동작 원리 문서 |
| [`learn/csp.md`](./learn/csp.md) | CSP 개념 정리 문서 |
| [`learn/how-to-apply-csp.md`](./learn/how-to-apply-csp.md) | CSP 적용 실무 문서 |
| [`learn/swagger-cdn-to-local-serving.md`](./learn/swagger-cdn-to-local-serving.md) | Swagger CDN 의존 제거 및 로컬 서빙 전환 정리 |
| [`learn/csp-inline-eval-hardening.md`](./learn/csp-inline-eval-hardening.md) | 인라인 코드 제거와 `unsafe-inline`/`unsafe-eval` 하드닝 |
| [`learn/nosniff-mime-sniffing.md`](./learn/nosniff-mime-sniffing.md) | `nosniff` 적용, MIME 스니핑 위험, 한계 정리 |
| [`learn/appendix-sri-integrity.md`](./learn/appendix-sri-integrity.md) | SRI 검증 절차, 운영 포인트, 공급망 위협 정리 |
| [`learn/nginx-header-consistency.md`](./learn/nginx-header-consistency.md) | nginx 직접 응답 경로의 보안 헤더 일관화 정리 |
| [`learn/nodenext-import-extension.md`](./learn/nodenext-import-extension.md) | NodeNext import 규칙 문서 |

## Flowmap

| 문서 | 설명 |
| --- | --- |
| [`flowmap/README.md`](./flowmap/README.md) | Flowmap 라우트 인덱스 |
| [`flowmap/session-access.mmd`](./flowmap/session-access.mmd) | Session Access 맵 |

## API / Reports / Legal

| 문서 | 설명 |
| --- | --- |
| [`api-docs/README.MD`](./api-docs/README.MD) | Swagger 기반 API 문서 |
| [`daily-reports/README.md`](./daily-reports/README.md) | 일일 보고서 인덱스 |
| [`legal/THIRD_PARTY_NOTICE_ENTRY_TEMPLATE.md`](./legal/THIRD_PARTY_NOTICE_ENTRY_TEMPLATE.md) | 서드파티 고지 템플릿 |

## 문서 운영 규칙

- 신규 문서를 추가할 때는 이 인덱스에 링크를 등록하는 것을 기준으로 합니다.
- `docs/flowmap/**` 산출물은 스크립트 생성 결과물이므로 수동으로 수정하지 않는 것을 기준으로 합니다.
- 토글/엔드포인트/감사로그를 변경할 때는 `guide`와 `learn` 문서를 함께 갱신하는 것을 기준으로 합니다.
