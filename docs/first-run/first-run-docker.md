# 로컬 환경에서 Docker 첫 실행 가이드

이 문서는 `my-code-my-kill`을 작업자의 로컬 등에서 Docker로 처음 구동할 때 필요한 최소한의 절차를 정리한 문서입니다.

모의해킹 환경과 유사하게 설정하여 `VM` 설정하여 침투 테스트를 진행하고 싶은 경우, [first-run-vm.md](./first-run-vm.md) 문서를 확인하시기 바랍니다.

## 0) 시작 전 체크

1. [Docker Desktop](https://www.docker.com/) 설치 및 실행
2. 저장소 다운로드(`git clone` 또는 ZIP)
3. 프로젝트 루트로 이동
   - 예: `.../my-code-my-kill` 또는 `.../my-code-my-kill-main`

## 1) 설정 파일 준비 (`.example` -> 실제 설정 파일)

`server/examples/` 디렉터리에 있는 예시 파일을 `server/`로 복사하여 아래 파일을 준비합니다.

- `server/examples/.env.example` -> `server/.env`
- `server/examples/.env.production.example` -> `server/.env.production`
- `server/examples/lab-options.json.example` -> `server/lab-options.json`

해당 작업은 GUI로 진행하는 것이 가장 빠르나, CLI 기반으로 처리를 원하는 경우 아래의 명령어를 참고하시기 바랍니다.

PowerShell (Windows)

```powershell
Copy-Item server/examples/.env.example server/.env
Copy-Item server/examples/.env.production.example server/.env.production
Copy-Item server/examples/lab-options.json.example server/lab-options.json
```

Bash (Linux/macOS)

```bash
cp server/examples/.env.example server/.env
cp server/examples/.env.production.example server/.env.production
cp server/examples/lab-options.json.example server/lab-options.json
```

이미 파일이 있으면 덮어쓰기 전에 값을 백업하거나 비교하세요.

## 2) DB 볼륨 준비

dev/prod 모두 외부 볼륨 `postgresql`을 사용합니다.

```bash
docker volume create postgresql
```

완전 초기화가 필요할 때만 아래를 실행하세요.

```bash
docker volume rm postgresql
docker volume create postgresql
```

## 3) dev 컨테이너 기동 후 DB 초기화

`sequelize-cli`는 dev 컨테이너에서 실행합니다.

```bash
docker compose -f docker-compose.yml up -d --build
docker compose -f docker-compose.yml exec server npx sequelize-cli db:create --config config/config.cjs
docker compose -f docker-compose.yml exec server npx sequelize-cli db:migrate --config config/config.cjs
docker compose -f docker-compose.yml exec server npx sequelize-cli db:seed:all --config config/config.cjs
```

DB가 막 뜨는 타이밍이면 `db:create`가 실패할 수 있습니다. 이 경우 5~10초 후 다시 실행하세요.

## 4) 실행 모드 선택 (prod 또는 dev)

prod 실행

```bash
docker compose -f docker-compose.yml down
docker compose -f docker-compose.prod.yml up -d --build
```

dev 계속 실행

```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.yml up -d --build
```

## 5) 실행 확인 (prod/dev 공통)

1. 브라우저 접속
   - prod: `http://localhost` (80)
   - dev: `http://localhost:3000`
2. 필요 시 실행 모드에 맞는 로그 확인

prod 로그

```bash
docker compose -f docker-compose.prod.yml logs -f server
docker compose -f docker-compose.prod.yml logs -f nginx
```

dev 로그

```bash
docker compose -f docker-compose.yml logs -f server
docker compose -f docker-compose.yml logs -f nginx
```

## 참고

- 기본 마이그레이션 경로는 `server/migrations`입니다.
- 기존 체인이 필요하면 `server/migrations/old`와 `--migrations-path` 옵션을 사용하세요.
- prod 컨테이너에는 `sequelize-cli`가 없으므로 마이그레이션/시드는 dev에서 처리해야 합니다.

## 감사로그 콘솔 출력 설정 (`AUDIT_CLI_LOG_LEVEL`)

감사로그는 기본적으로 DB(`admin_audit_logs`)에 저장되며, Node 콘솔 출력은 아래 환경변수로 제어합니다.

- `none` (기본): 감사로그 콘솔 출력 안 함
- `errors`: 감사로그 저장 실패 등 오류만 1줄 요약 출력
- `all`: 감사로그 성공/실패 모두 출력

설정 위치

- dev: `server/.env`
- prod: `server/.env.production`
- Docker compose 오버라이드: `docker-compose.yml`, `docker-compose.prod.yml`

적용 방법

```bash
docker compose -f docker-compose.yml restart server
docker compose -f docker-compose.prod.yml up -d --build server
```
