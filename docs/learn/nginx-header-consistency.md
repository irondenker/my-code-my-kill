# nginx 직접 응답 경로 헤더 일관화

nginx가 직접 응답하는 경로에서 보안 헤더를 일관되게 적용하는 이유와 설계 포인트를 정리한 문서입니다.

## 적용 내용

- 배경:
  Express 전역 헤더는 Express가 응답할 때만 적용됩니다. nginx가 직접 응답하면 Express 헤더는 적용되지 않습니다.
- 조치:
  nginx `location /errors/`, `location /uploads/`에 CSP와 `nosniff`를 별도 추가해 정책을 일관화했습니다.
- 코드 위치:
  `nginx/conf.d/default.conf`

---

## 추가 학습 A: static 301 리다이렉트와 헤더 불일치

`express.static` 기본값(`redirect: true`)에서는 `/assets/css -> /assets/css/` 301 응답이 내부적으로 생성됩니다.
이 경로는 보안 헤더 제어가 제한되어 정책 불일치(스캐너 노이즈 포함)가 생길 수 있어 `redirect: false`를 사용했습니다.

관련 코드: `server/src/middlewares/static.middleware.ts`

## 추가 학습 B: "응답 주체" 기준으로 보안 헤더를 설계해야 하는 이유

- nginx가 응답하면 nginx 헤더 정책이 적용
- Express가 응답하면 Express 헤더 정책이 적용

즉 "어디서 응답했는지"가 헤더 적용 결과를 결정하므로, 앱/프록시 양쪽을 함께 설계해야 합니다.

---

## 운영 체크리스트

- HTML/템플릿에 CDN URL이 남아 있지 않은가?
- `unsafe-inline`, `unsafe-eval`이 불필요하게 열려 있지 않은가?
- `/errors`, `/uploads`처럼 nginx가 직접 응답하는 경로에도 CSP/`nosniff`가 있는가?
- 301/404 같은 비정상 응답에서도 헤더 정책이 일관적인가?
