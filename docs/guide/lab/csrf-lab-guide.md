# CSRF Lab Guide (`csrf.enabled`)

이 문서는 `server/lab-options.json`의 `csrf.enabled` 토글과 전역 CSRF 체인 동작을 정리합니다.

## 연관 코드

- 설정 파서: `server/src/config/lab-options.ts`
- 앱 등록: `server/src/app.ts`
- 전역 CSRF 체인: `server/src/middlewares/csrf.middleware.ts`

## 설정

```json
{
  "csrf": {
    "enabled": true
  }
}
```

## 중요 의미

- `csrf.enabled=true`는 "CSRF 보호 비활성화(실습 모드)"입니다.
- `csrf.enabled=false`일 때 `csurf` 검증이 활성화됩니다.

## 동작 요약

- 공통 URL-encoded 요청은 전역 `csurf` 검증 대상입니다.
- multipart/form-data 경로는 전역에서 `multer -> csurf` 순서를 보장합니다.
- 실습 모드(`csrf.enabled=true`)여도 multipart pre-parser는 유지됩니다.
  - 업로드 검증(크기/타입/시그니처)을 계속 수행해야 하기 때문입니다.

## 영향 경로 예시

- `POST /users/avatar`
- `POST /board/:slug`
- `POST /board/:slug/:displayId/edit`
- 일반 form POST (`/login`, `/register`, `/settings/profile`, `/admin/...`)

## 반영 방법

`lab-options.json`은 서버 시작 시 1회 로드됩니다.

- dev: `docker compose -f docker-compose.yml restart server`
- prod: `docker compose -f docker-compose.prod.yml up -d --build server`

## 빠른 확인

- 토글 변경 후 form POST의 `_csrf` 요구 동작이 예상대로 바뀌는지 확인
