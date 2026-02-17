# 세션 라이프사이클 정리

현재 코드 기준으로 로그인 세션이 생성/재생성/파기되는 흐름을 정리한 문서입니다.

## 1) 세션 기본 설정

코드 위치: `server/src/middlewares/session.middleware.ts`

- 쿠키 이름: `mcmk.sid`
- 저장소: `express-session` 기본 `MemoryStore`
- 주요 옵션
  - `resave: false`
  - `saveUninitialized: false`
  - `cookie.httpOnly: true`
  - `cookie.sameSite: "lax"`
  - `cookie.maxAge: 1000 * 60 * 30` (30분)
  - `cookie.secure: production에서 "auto", 그 외 false`

운영(`NODE_ENV=production`)에서는 `SESSION_SECRET`이 없으면 서버가 부팅되지 않습니다.

## 2) 세션에 저장되는 인증 정보

로그인 성공 시 아래 값이 세션에 저장됩니다.

- `userId`
- `userRole`
- `username`
- `profileImageUrl`

코드 위치:

- `server/src/controllers/auth.controller.ts`
- `server/src/types/express-session.d.ts`

## 3) 생성/재생성/저장/파기 흐름

### 회원가입 성공

코드 위치: `server/src/controllers/auth.controller.ts` (`postRegister`)

1. 계정 생성
2. `regenerateSession(req)`로 세션 ID 재발급
3. 인증 필드 세션에 기록
4. `saveSession(req)`로 저장
5. `/board`로 리다이렉트

### 로그인 성공

코드 위치: `server/src/controllers/auth.controller.ts` (`postLogin`)

1. 사용자 검증(비밀번호/활성 상태 포함)
2. `regenerateSession(req)`로 세션 ID 재발급
3. 인증 필드 세션에 기록
4. `saveSession(req)`로 저장
5. 안전한 `next` 경로로 리다이렉트

### 로그아웃

코드 위치: `server/src/controllers/auth.controller.ts` (`postLogout`)

1. 필요 메타를 캡처해 감사로그 기록
2. `req.session.destroy(...)`로 서버 세션 파기
3. `res.clearCookie("mcmk.sid")`로 쿠키 제거
4. `/`로 리다이렉트

## 4) 세션 유틸

코드 위치: `server/src/utils/session.util.ts`

- `regenerateSession(req)`
  - 콜백 API(`req.session.regenerate`)를 Promise 래핑
- `saveSession(req)`
  - 콜백 API(`req.session.save`)를 Promise 래핑

목적은 컨트롤러에서 `async/await`로 세션 처리 순서를 명확히 보장하는 것입니다.

## 5) 인증/권한 미들웨어와 세션 사용

코드 위치: `server/src/middlewares/auth.middleware.ts`

- `requireAuth`
  - `req.session.userId` 없으면 `401 Unauthorized`
- `requireAuthRedirect`
  - `req.session.userId` 없으면 안전한 `next`를 붙여 `/login`으로 `302`
- `requireAdminRedirect`
  - 비로그인: `/login` 리다이렉트
  - 로그인 + 비관리자: `403 Forbidden`
  - 관리자: 통과

## 6) 운영 시 주의사항

- 현재는 기본 `MemoryStore`이므로 프로세스 재시작 시 세션이 사라집니다.
- 다중 인스턴스 운영이 필요하면 Redis 같은 외부 session store로 교체가 필요합니다.
