# Docs Index

문서 접근의 단일 진입점입니다. 먼저 이 문서를 보고 필요한 세부 문서로 이동하세요.

## 1) 시작하기

| 문서 | 설명 |
| --- | --- |
| [`guide/first-run/first-run-docker.md`](./guide/first-run/first-run-docker.md) | 로컬 Docker 첫 실행 가이드 |
| [`guide/first-run/first-run-vm.md`](./guide/first-run/first-run-vm.md) | VM 첫 실행 가이드 |
| [`guide/first-run/quality-gates.md`](./guide/first-run/quality-gates.md) | 품질 게이트 초기 설정(pre-commit, pre-push, CI) |

## 2) api-docs

| 문서 | 설명 |
| --- | --- |
| [`api-docs/README.MD`](./api-docs/README.MD) | Swagger를 통해 정리한 API 문서 정보 |

## 3) daily-report

| 문서 | 설명 |
| --- | --- |
| [`daily-reports/README.md`](./daily-reports/README.md) | 일일 보고서 인덱스 |

## 4) guide

| 문서 | 설명 |
| --- | --- |
| [`guide/qa-gate-and-ci.md`](./guide/qa-gate-and-ci.md) | 개발/운영 품질 게이트(pre-commit, pre-push, CI) |
| [`guide/how-to-docker.md`](./guide/how-to-docker.md) | Docker 개발/운영 명령 모음 |
| [`guide/flowmap-guide.md`](./guide/flowmap-guide.md) | Flowmap 생성/검증/리뷰 운영 가이드 |
| [`flowmap/README.md`](./flowmap/README.md) | Flowmap 빠른 조회(엔드포인트 인덱스) |
| [`flowmap/session-access.mmd`](./flowmap/session-access.mmd) | Flowmap 빠른 조회(Session Access 맵) |
| [`guide/lab/xss-filter-guide.md`](./guide/lab/xss-filter-guide.md) | XSS 실습 설정 가이드 |
| [`guide/lab/sqli-lab-guide.md`](./guide/lab/sqli-lab-guide.md) | SQLi 실습 설정 가이드 |
| [`guide/lab/upload-validation-guide.md`](./guide/lab/upload-validation-guide.md) | 업로드 검증 실습 설정 가이드 |
| [`guide/controller-structure.md`](./guide/controller-structure.md) | 컨트롤러 레이어 구조 정리 |
| [`guide/commit-emoji-guide.md`](./guide/commit-emoji-guide.md) | 커밋 이모지 작성 규칙 |

## 5) learn

| 문서 | 설명 |
| --- | --- |
| [`learn/structure-model.md`](./learn/structure-model.md) | 프로젝트 구조 모델 정리 |
| [`learn/session-lifecycle.md`](./learn/session-lifecycle.md) | 로그인 세션 생성/재생성/파기 흐름 |
| [`learn/csp.md`](./learn/csp.md) | CSP 정책 정리 |
| [`learn/how-to-apply-csp.md`](./learn/how-to-apply-csp.md) | CSP 적용 절차 |
| [`learn/nodenext-import-extension.md`](./learn/nodenext-import-extension.md) | 트러블슈팅 학습 로그 |

## 6) legal

| 문서 | 설명 |
| --- | --- |
| [`legal/THIRD_PARTY_NOTICE_ENTRY_TEMPLATE.md`](./legal/THIRD_PARTY_NOTICE_ENTRY_TEMPLATE.md) | 라이선스/의존성 고지 템플릿 |

## 문서 운영 규칙

- 문서 추가 시 이 인덱스(`docs/README.md`)에 반드시 링크를 등록합니다.
- 자동 생성 산출물(`docs/flowmap/**`)은 수동 편집하지 않습니다.
- 운영 규칙/프로세스는 `guide/qa-gate-and-ci.md`에, 사용 절차는 해당 기능 가이드 문서에 둡니다.
- 파일명은 가능하면 `kebab-case.md`를 사용해 일관성을 유지합니다.
