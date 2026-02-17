# QA Gate & CI 운영 가이드

이 문서는 로컬 git hook과 GitHub Actions 품질 게이트를 어떻게 제어하는지 정리합니다.

## 1) 로컬 hook 활성화

```bash
git config core.hooksPath .githooks
```

- `pre-commit`: `npm run test`
- `pre-push`: `npm run test && npm run build && npm run check:openapi-drift`
- `RUN_DB_TESTS=1`일 때만 `pre-push`에서 `npm run test:db`를 실행

## 2) hook 실행 제어 변수

### `RUN_DB_TESTS`

- `RUN_DB_TESTS=1`: 브랜치와 무관하게 DB 테스트 강제 실행
- `RUN_DB_TESTS=0`: 브랜치와 무관하게 DB 테스트 강제 생략
- 미지정: 기본값 `0`으로 동작(자동 생략)

예시:

```bash
RUN_DB_TESTS=1 git push
RUN_DB_TESTS=0 git push
```

DB 테스트를 실행할 때만 DB를 먼저 기동합니다.

```bash
docker compose -f docker-compose.yml up -d db
```

### `USE_DOCKER_HOOKS`, `DOCKER_COMPOSE_FILE`

- `USE_DOCKER_HOOKS=1`: hook 명령을 로컬 프로세스 대신 Docker 컨테이너에서 실행
- `DOCKER_COMPOSE_FILE`: 기본값 `docker-compose.yml`, 다른 compose 파일 사용 시 지정

예시:

```bash
USE_DOCKER_HOOKS=1 git commit
USE_DOCKER_HOOKS=1 RUN_DB_TESTS=1 git push
USE_DOCKER_HOOKS=1 DOCKER_COMPOSE_FILE=docker-compose.prod.yml git commit
```

주의:

- Docker hook 모드에서는 `server` 컨테이너가 이미 실행 중이어야 합니다.
- Docker hook 모드에서 DB 테스트를 실행할 때(`RUN_DB_TESTS=1`)는 `db` 컨테이너도 실행 중이어야 합니다.
- Docker daemon이 내려가 있으면 hook이 실패합니다.

## 3) GitHub Actions 품질 게이트

워크플로 파일: `.github/workflows/server-ci.yml`

- 트리거: `push`, `pull_request`, `workflow_dispatch`
- 변경 파일이 아래 경로에만 해당하면 `server`, `server-db` job은 자동 생략
  - `docs/**`
  - `third-party/**`
  - `.gitattributes`
  - `.gitignore`
  - `LICENSE`
  - `README.md`
- `server` job
  - `npm ci`
  - `npm run build`
  - `npm run test`
  - `npm run fix:openapi-drift`
  - `npm run check:openapi-drift`
- `server-db` job
  - postgres service 기동
  - `npm run db:migrate`
  - `npm run test:db`

`workflow_dispatch` 입력:

- `run_db_tests` (boolean, 기본 `false`)
- 수동 실행 시 `run_db_tests=false`면 `server-db` job은 생략됩니다.

OpenAPI 드리프트 처리:

- PR 이벤트: `fix:openapi-drift` 결과로 `server/src/docs/openapi.ts` 변경이 생기면 CI를 실패시켜 수동 커밋을 요구합니다.
- push 이벤트: 동일 변경이 생기면 `github-actions[bot]`이 자동 커밋으로 문서를 동기화합니다.

## 4) DB 마이그레이션 관련 주의점

CI에서 `NODE_ENV=test`일 때 `sequelize-cli`는 기본적으로 테스트 DB 이름을 사용합니다.
이 저장소 워크플로는 `DB_NAME_TEST=mcmk`를 명시해 postgres service DB(`mcmk`)와 맞춥니다.

`DB_NAME_TEST`가 없으면 `mcmk_test` 같은 별도 DB를 찾다가 마이그레이션이 실패할 수 있습니다.
