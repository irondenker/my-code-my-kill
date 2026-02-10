# VM 첫 실행 가이드

이 문서는 `my-code-my-kill`을 VM 환경에서 처음 구동할 때 필요한 최소한의 절차를 정리한 문서입니다.

해당 문서는 모두 `Ubuntu Server`의 `LTS` 버전을 기반으로 과정을 설명합니다.

`Debian`, `SUSE` 등의 운영체제에서 적용하시는 경우, 추후 등장하는 모든 명령어에 대해 호환성을 고려하시어 적절하게 변형 후 적용하십시오.

코드 수정 및 로컬 환경(Windows, MacOS, Linux 등)에서 Docker 기반으로 구동을 원한다면, first-run-docker.md 문서를 확인하시기 바랍니다.

## 0) 시작 전 체크 (Ubuntu CLI)

1. VM 생성
    - `VMWare`, `VirtualBox` 등 선호하는 가상화 프로그램 이용
    - 권장 사양
        - RAM: 4GB 이상
        - Disk: 30GB 이상

2. Docker 설치(권장: Docker 공식 apt 저장소 사용)

   ```bash
   sudo apt-get update
   sudo apt-get install -y ca-certificates curl gnupg
   sudo install -m 0755 -d /etc/apt/keyrings
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
   sudo chmod a+r /etc/apt/keyrings/docker.gpg
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
   sudo apt-get update
   sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
   ```

3. 현재 사용자를 `docker` 그룹에 추가

   ```bash
   sudo usermod -aG docker $USER
   newgrp docker
   ```

4. 설치 확인

   ```bash
   docker --version
   docker compose version
   ```

5. 저장소 다운로드(`git clone` 이용)

6. 프로젝트 루트로 이동
   - 예: `.../my-code-my-kill` 또는 `.../my-code-my-kill-main`

## 1) 설정 파일 준비 (`.example` -> 실제 설정 파일)

`server/` 디렉터리에서 아래 파일을 준비합니다.

- `.env.example` -> `.env`
- `.env.production.example` -> `.env.production`
- `lab-options.json.example` -> `lab-options.json`

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

## 4) 실행 모드 선택 (prod)

```bash
docker compose -f docker-compose.yml down
docker compose -f docker-compose.prod.yml up -d --build
```

## 5) prod 실행 확인

1. 브라우저 접속: `http://localhost` (80)
2. 필요 시 아래 명령어를 통해 로그 확인

```bash
docker compose -f docker-compose.prod.yml logs -f server
docker compose -f docker-compose.prod.yml logs -f nginx
```

## 참고

- 기본 마이그레이션 경로는 `server/migrations`입니다.
- 기존 체인이 필요하면 `server/migrations/old`와 `--migrations-path` 옵션을 사용하세요.
- prod 컨테이너에는 `sequelize-cli`가 없으므로 마이그레이션/시드는 dev에서 처리해야 합니다.
