# Debug Error Routes Guide (`debug.errorRoutes.enabled`)

이 문서는 `server/lab-options.json`의 `debug.errorRoutes.enabled` 토글과 디버그 에러 라우트 동작을 정리합니다.

## 연관 코드

- 설정 파서: `server/src/config/lab-options.ts`
- 라우트: `server/src/routes/occur.routes.ts`

## 설정

```json
{
  "debug": {
    "errorRoutes": {
      "enabled": true
    }
  }
}
```

## 동작

- 라우트: `GET /occur/ssr/:code`
- 허용 코드:
  - `401, 403, 404, 405, 409, 410, 422, 500, 501, 503, 504`
- 비허용 코드/포맷 오류는 404 처리

## 환경별 정책

- `NODE_ENV !== "production"`: 항상 활성
- `NODE_ENV === "production"`: `debug.errorRoutes.enabled=true`일 때만 활성

## 반영 방법

`lab-options.json`은 서버 시작 시 1회 로드됩니다.

- dev: `docker compose -f docker-compose.yml restart server`
- prod: `docker compose -f docker-compose.prod.yml up -d --build server`

## 빠른 확인

- `GET /occur/ssr/500` 요청 시 환경/토글 조건대로 동작하는지 확인
