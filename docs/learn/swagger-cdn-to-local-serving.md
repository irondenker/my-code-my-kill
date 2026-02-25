# Swagger CDN -> 로컬 정적 서빙

Swagger UI 정적 리소스를 외부 CDN 의존에서 로컬 서빙으로 전환한 이유와 적용 지점을 정리한 문서입니다.

## 적용 내용

- 배경:
  외부 CDN 장애/변조/차단 시 문서 UI가 깨질 수 있고, CSP에 외부 도메인 예외를 열어야 해서 정책이 약해집니다.
- 조치:
  `swagger-ui-dist`를 프로젝트 의존성으로 고정하고 `/assets/vendor/swagger-ui/*`로 직접 서빙하도록 변경했습니다.
- 코드 위치:
  `server/package.json`, `server/src/app.ts`, `server/src/routes/api-docs.routes.ts`
