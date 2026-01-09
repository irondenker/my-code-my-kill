# 일일 보고 (2026-01-09) 

## 금일 작업 내용

1. **DB 초기 설정 및 기초 테이블 생성**

   * `PostgreSQL` 세팅
        - `Docker` 위에서 실행(localhost, 54921:5432)
        - `sequelize-cil`로 DB 및 테이블 생성(ORM)
   * `Sequelize` ORM 제어 세팅
         - 추후 DB 제어: `sequelize` 우선, 필요 시 SQL 쿼리 직접 작성
         - 테이블 생성: `users`,`boards`,`posts` 등
   * Minor Fixes
         - 관련 `.ejs` 템플릿, `/server` 로직 리팩터링

2. **`/board` 기능 고도화**
   * 실습 조건 충족 목적으로 게시판 분리
      - `/board/general`: 
         - `Create` - 누구나
         - `Read` - 누구나
         - `Update` - 글쓴이 본인만
         - `Delete` - 글쓴이 본인, Admin
      - `/board/announcement`: 
         - `Create` - Admin
         - `Read` - 누구나
         - `Update` - Admin
         - `Delete` - Admin

3. **`users` 테이블 권한 설정**
   * `users` 권한 설정
      - `admin` - 어드민, 모든 권한
      - `user` - 일반 사용자, 제한된 권한
      - 세부 설정 사항은 금일 Commit 기록 참고

4. **로고 추가**
   * `My Code, My Kill` 로고 생성
      - `svg` 확장자
      - 정방형 디자인
      - 기존 `Bootstrap` 로고를 전부 대체
      - Copyright 문구 수정

## 차후 계획 중인 작업

1. **로그인 기능 구현**
   * `username`, `password` 기반
   * `JWT token` -> `accessToken`, `refreshToken` 기반

2. **DB scheme 문서 생성**
   * 정확한 DB 정보 가시화 및 전달 필요성 느낌

3. **오픈소스 페이지로 실습 전환 고려**
   - 속도를 올리기 위해, 생성형 AI를 적극적으로 이용 중이며, 그 결과 생산성 증가함.
   - `2026-01-12(월)` 기준으로, 실습 가능한 수준으로 산출물이 나오지 않으면 오픈소스 게시판 기반으로 실습 진행