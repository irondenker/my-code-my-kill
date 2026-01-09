# 일일 보고 (2026-01-08) 

## 금일 작업 내용

1. **Express 라우팅 구조 리팩토링(기능 단위로 Router 분리) 진행**

   * `app.ts`에 직접 박혀 있던 `/login`, `/register`, `/` 라우팅을 제거하여 아래 파일로 기능 분리(“라우터는 경로만, 컨트롤러는 로직만”)
        - `routes/auth.routes.ts`
        - `routes/root.routes.ts`
        - `controllers/auth.controller.ts`
        - `controllers/root.controller.ts`

   * 에러 처리 미들웨어 `middlewares/error-handler.ts` 추가

2. **`/board` 페이지네이션 UI(EJS) 구현 완료이다**

   * `server/views/partials/sections/board-index.ejs` 페이지네이션 계산 로직 완성
   * 보드 섹션 제목에 `/board` 링크 작업

## 차후 계획 중인 작업

1. **DB 설계 및 작업**
   * `users`, `board` 테이블 제작
   * `users`에 `Admin / User` 권한 분리 반영
   * `board`에 게시물 `postId(DB 내 분류)` 및 `PostNo(외부 조회용)`으로 ID 2개 분류
   * (선택) `users`테이블 `rank` 추가
   (예 - 대표, 과장, 대리, 사원, 인턴 등...)

2. **Backend 기능 구현**
    * `/login`
        - JWT 토큰 (accessToken, refreshToken)
    * `/board`
        - 게시판 권한(Admin 여부 등) 기반 CRUD 제어
            - 내가 쓴 글은 나만 수정 가능
            - 인위적으로 `postID` 노출
            - 취약한 권한 검증 구조 구현(임의의 글 변조 및 삭제 등) 

3. **오픈소스 페이지로 실습 전환 고려**
    - 개발 단계에서 많은 시간이 소요
    - 현재 웹 취약점 분석이 아닌, 개발에 초점이 맞춰짐.
    - 1달 안에 완성이 어려울 것 같으면 오픈소스 게시판 기반으로 실습 진행