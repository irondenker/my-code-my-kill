# how-to-docker

## 🌐 Prod

### 빌드 + 실행 (prod)

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 중지 (prod)

```bash
docker compose -f docker-compose.prod.yml down
```

### 스위치 (dev → prod)

```bash
docker compose down
docker compose -f docker-compose.prod.yml up -d --build
```

### server만 재기동 (prod)

```bash
docker compose -f docker-compose.prod.yml restart server
```

### nginx만 재기동

```bash
docker compose -f docker-compose.prod.yml restart nginx
```

### server만 내려서 다시 올리기

```bash
docker compose -f docker-compose.prod.yml stop server
docker compose -f docker-compose.prod.yml up -d --build server
```

## 💻 Dev

### 커밋/푸시 전 필수 (DB 먼저 기동)

```bash
docker compose -f docker-compose.yml up -d db
```

### 빌드 + 실행 (dev)

``` bash
docker compose up -d --build
```

### 중지 (dev)

```bash
docker compose down
```

### 스위치 (prod → dev)

```bash
docker compose -f docker-compose.prod.yml down
docker compose up -d --build
```

### server만 재기동 (dev)

```bash
docker compose restart server
```

`docker-compose.yml`의 dev server는 시작 시 `npm install`을 먼저 실행해 의존성을 동기화합니다.

### db는 유지한 채 server만 내려서 다시 올리기

```bash
docker compose stop server
docker compose up -d --build server
```

### 테스트 실행 (dev server 컨테이너 내부)

```bash
docker compose exec -T server npm run test
docker compose exec -T server npm run build
docker compose exec -T server npm run check:openapi-drift
docker compose exec -T server npm run test:db
```

### git hook을 Docker 컨테이너에서 실행

```bash
USE_DOCKER_HOOKS=1 git commit
USE_DOCKER_HOOKS=1 RUN_DB_TESTS=1 git push
```

- 기본 compose 파일은 `docker-compose.yml`입니다.
- 다른 compose 파일을 사용하면 `DOCKER_COMPOSE_FILE`로 지정할 수 있습니다.
- 상세 제어 방식은 [`docs/qa-gate-and-ci.md`](./qa-gate-and-ci.md)를 참고하세요.
