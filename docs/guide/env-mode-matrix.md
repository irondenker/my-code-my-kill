# 환경변수 / 실행모드 매트릭스

이 문서는 dev/prod/CI/로컬 hook에서 사용하는 핵심 환경변수를 한 번에 확인하기 위한 레퍼런스입니다.

## 기준 파일

- dev 예시: `server/examples/.env.example`
- prod 예시: `server/examples/.env.production.example`
- dev compose: `docker-compose.yml`
- prod compose: `docker-compose.prod.yml`
- CI: `.github/workflows/server-ci.yml`
- DB 런타임 파서: `server/src/db/env.ts`

## 공통 핵심 변수

| 변수 | 설명 | 기본/예시 |
| --- | --- | --- |
| `NODE_ENV` | 실행 모드 | dev=`development`, prod=`production` |
| `PORT` | 서버 리슨 포트 | `3000` |
| `SESSION_SECRET` | 세션 서명 키 | 운영에서는 필수 |
| `DB_HOST` | DB 호스트 | dev 로컬 `.env`는 `localhost`, compose 내부는 `db` |
| `DB_PORT` | DB 포트 | 로컬 매핑 `54973`, compose 내부 `5432` |
| `DB_NAME` | DB 이름 | `mcmk` |
| `DB_USER` | DB 계정 | `mcmk_app` |
| `DB_PASSWORD` | DB 비밀번호 | `1234`(예시) |
| `DB_LOGGING` | Sequelize 로깅 | `false` |
| `AUDIT_CLI_LOG_LEVEL` | 감사로그 콘솔 출력 레벨 | `none/errors/all` |

## 모드별 값 소스

| 컨텍스트 | 설정 소스 | 비고 |
| --- | --- | --- |
| 로컬 dev 서버 | `server/.env` | `npm run dev`, `npm run build/test` |
| Docker dev | `docker-compose.yml` + `server/.env` | compose `environment`가 일부 값 override |
| Docker prod | `docker-compose.prod.yml` + `server/.env.production` | `NODE_ENV=production`, `DB_HOST=db` override |
| GitHub Actions `server-db` | `.github/workflows/server-ci.yml` `env` | `DB_NAME_TEST=mcmk` 명시 |

## CI/테스트 전용 변수

| 변수 | 사용 위치 | 설명 |
| --- | --- | --- |
| `DB_NAME_TEST` | `server/config/config.cjs` | sequelize-cli test DB 이름 오버라이드 |
| `RUN_DB_TESTS` | `.githooks/pre-push` | `1`일 때 `npm run test:db` 실행 |
| `USE_DOCKER_HOOKS` | `.githooks/pre-commit`, `.githooks/pre-push` | hook 명령을 컨테이너에서 실행 |
| `DOCKER_COMPOSE_FILE` | `.githooks/pre-commit`, `.githooks/pre-push` | Docker hook용 compose 파일 선택 |

## Lab 옵션 관련 주의

- `lab-options`는 환경변수가 아니라 `server/lab-options.json` 파일로 제어합니다.
- 파일 수정 후 서버 재시작/재빌드가 필요합니다.

## 운영 체크리스트

- prod에서 `SESSION_SECRET`이 기본값인지 확인
- `DB_HOST/DB_PORT`가 실행 위치(호스트 vs 컨테이너 네트워크)와 맞는지 확인
- `AUDIT_CLI_LOG_LEVEL`을 로그 정책에 맞춰 설정했는지 확인
- CI에서 DB 테스트가 필요하면 `workflow_dispatch` 시 `run_db_tests=true`로 실행
