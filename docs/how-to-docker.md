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

### db는 유지한 채 server만 내려서 다시 올리기

```bash
docker compose stop server
docker compose up -d --build server
```
