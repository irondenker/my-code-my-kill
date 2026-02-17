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
