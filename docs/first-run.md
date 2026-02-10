# VM 첫 실행 가이드

이 문서는 VM에서 `my-code-my-kill`을 처음 실행할 때 필요한 초기 설정 순서를 정리합니다.

## 1) `.example` 파일을 실제 설정 파일로 복사

초기값은 반드시 `.example` 파일을 기준으로 시작하는 것을 권장합니다.

`server/` 디렉터리에서 아래 파일들을 복사해 사용하세요.

- `.env.example` -> `.env`
- `.env.production.example` -> `.env.production`
- `lab-options.json.example` -> `lab-options.json`

예시:

PowerShell (Windows)

```powershell
Copy-Item server/.env.example server/.env
Copy-Item server/.env.production.example server/.env.production
Copy-Item server/lab-options.json.example server/lab-options.json
```

Bash (Linux/macOS)

```bash
cp server/.env.example server/.env
cp server/.env.production.example server/.env.production
cp server/lab-options.json.example server/lab-options.json
```

이미 파일이 있다면, 덮어쓸지 유지할지 먼저 결정하고 진행하세요.

## 2) Docker 볼륨 준비

`docker-compose.yml`과 `docker-compose.prod.yml` 모두 `postgresql` 볼륨을 사용합니다.

PowerShell (Windows)

```powershell
docker volume create postgresql
```

Bash (Linux/macOS)

```bash
docker volume create postgresql
```

완전 초기화가 필요하면 볼륨을 삭제 후 다시 생성하세요.

PowerShell (Windows)

```powershell
docker volume rm postgresql
docker volume create postgresql
```

Bash (Linux/macOS)

```bash
docker volume rm postgresql
docker volume create postgresql
```

## 3) dev 컨테이너에서 DB 초기화 + 마이그레이션 + 시드

`sequelize-cli`는 dev 컨테이너에서 실행합니다.

PowerShell (Windows)

```powershell
docker compose -f docker-compose.yml up -d

docker compose -f docker-compose.yml exec server npx sequelize-cli db:create --config config/config.cjs
docker compose -f docker-compose.yml exec server npx sequelize-cli db:migrate --config config/config.cjs
docker compose -f docker-compose.yml exec server npx sequelize-cli db:seed:all --config config/config.cjs
```

Bash (Linux/macOS)

```bash
docker compose -f docker-compose.yml up -d

docker compose -f docker-compose.yml exec server npx sequelize-cli db:create --config config/config.cjs
docker compose -f docker-compose.yml exec server npx sequelize-cli db:migrate --config config/config.cjs
docker compose -f docker-compose.yml exec server npx sequelize-cli db:seed:all --config config/config.cjs
```

## 4) prod 실행

PowerShell (Windows)

```powershell
docker compose -f docker-compose.yml down
docker compose -f docker-compose.prod.yml up -d --build
```

Bash (Linux/macOS)

```bash
docker compose -f docker-compose.yml down
docker compose -f docker-compose.prod.yml up -d --build
```

## 참고

- baseline 마이그레이션은 `server/migrations` 기준입니다.
- 기존 체인을 써야 하면 `server/migrations/old`와 `--migrations-path` 옵션을 사용하세요.
- prod 컨테이너에는 `sequelize-cli`가 없으므로 마이그레이션/시드는 dev 컨테이너에서 수행하세요.
