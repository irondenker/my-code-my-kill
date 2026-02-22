# Quality Gates (First-Run)

이 문서는 로컬 개발 환경에서 최초로 품질 게이트를 활성화할 때 필요한 최소 정보만 정리합니다.

## 1) 개요

핵심은 로컬 hook으로 빠르게 막고, 최종 머지 기준은 GitHub Actions로 검증하는 구조입니다.

## 2) 로컬 hook 활성화

프로젝트 루트에서 1회 설정:

```bash
git config core.hooksPath .githooks
```

실행되는 기본 검증:

- `pre-commit`: `(cd server && npm run test)`
- `pre-push`: `(cd server && npm run test && npm run build && npm run check:openapi-drift && npm run flowmap:check)`
- DB 통합 테스트는 `RUN_DB_TESTS=1`일 때만 pre-push에서 실행됩니다.

## 3) GitHub Actions와의 관계

- CI 워크플로: `.github/workflows/server-ci.yml`
- `server`/`server-db` job으로 동일 계열 검증을 수행합니다.
- `workflow_dispatch` 수동 실행 시 `run_db_tests=false`면 `server-db`가 생략됩니다.
- `push`/`pull_request`에서는 `server-db`가 실행됩니다.

## 4) 상세 문서

동작 원리, Docker hook 모드, 제어 변수, Solo Dev 운영 가이드는 아래 문서를 참고하세요.

- [`docs/guide/qa-gate-and-ci.md`](../qa-gate-and-ci.md)

