# VM 첫 실행 가이드

이 문서는 VM에서 `my-code-my-kill`을 처음 실행할 때 필요한 절차를 정리합니다.

## 1) 환경 파일 준비

`server/` 아래에 아래 두 파일을 준비합니다.

- `server/.env`
- `server/.env.production`

## 2) Docker 볼륨 준비

`docker-compose.yml`과 `docker-compose.prod.yml` 모두 `postgresql` 외부 볼륨을 씁니다.

```powershell
docker volume create postgresql
```

완전 초기화가 필요하면 아래처럼 볼륨을 제거한 뒤 다시 생성합니다.

```powershell
docker volume rm postgresql
docker volume create postgresql
```

## 3) dev로 DB 초기화 + 마이그레이션 + 시더

dev 컨테이너에는 `sequelize-cli`가 설치되어 있으므로 그 안에서 실행합니다.

```powershell
docker compose -f docker-compose.yml up -d

docker compose -f docker-compose.yml exec server npx sequelize-cli db:create --config config/config.cjs
docker compose -f docker-compose.yml exec server npx sequelize-cli db:migrate --config config/config.cjs
docker compose -f docker-compose.yml exec server npx sequelize-cli db:seed:all --config config/config.cjs
```

현재 baseline은 `server/migrations`에 있습니다. 따라서 기본 `db:migrate`만 실행하면 됩니다.

## 4) dev 내리고 prod 실행

```powershell
docker compose -f docker-compose.yml down
docker compose -f docker-compose.prod.yml up -d --build
```

## 참고

- 기존 마이그레이션 체인은 `server/migrations/old`에 있습니다.
- 예전 체인을 롤백하려면 `--migrations-path migrations/old` 옵션이 필요합니다.
- prod 컨테이너에는 `sequelize-cli`가 없으므로, 마이그레이션/시더는 dev 컨테이너에서 수행하는 흐름이 안전합니다.
