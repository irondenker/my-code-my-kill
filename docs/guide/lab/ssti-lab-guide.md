# SSTI Lab Guide (`ssti.enabled`)

이 문서는 `server/lab-options.json`의 `ssti.enabled` 토글 운영 방식을 정리합니다.

## 연관 코드

- 설정 파서: `server/src/config/lab-options.ts`
- 라우트: `server/src/routes/lab-ssti.routes.ts`

## 설정

```json
{
  "ssti": {
    "enabled": true
  }
}
```

## 동작

- 실습 페이지:
  - `GET /labs`
  - `GET /labs/ssti`
  - `POST /labs/ssti`
- `enabled=false`:
  - 페이지는 렌더되지만 `SSTI lab is disabled.` 메시지를 출력
- `enabled=true`:
  - `POST /labs/ssti`에서 입력 템플릿을 `ejs.render(...)`로 렌더

## 운영 주의

- SSTI 재현용 기능이므로 운영(prod)에서는 `enabled=false`를 권장합니다.

## 반영 방법

`lab-options.json`은 서버 시작 시 1회 로드됩니다.

- dev: `docker compose -f docker-compose.yml restart server`
- prod: `docker compose -f docker-compose.prod.yml up -d --build server`

## 빠른 확인

- `GET /labs/ssti` 접근 후 안내 문구가 토글 상태와 일치하는지 확인
