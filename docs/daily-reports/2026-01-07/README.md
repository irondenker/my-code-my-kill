# 일일 보고 (2026-01-07)

## 금일 작업 내용

### 1. Frontend 구조 정리 및 SSR 전환
- 기존 Frontend 소스 구조를 제거하고, Express + EJS 기반 SSR 구조로 전환
- 정적 HTML/CSR 구조 대신 서버 렌더링 기반으로 페이지를 재구성
- 실제 서비스 환경과 유사한 서버 사이드 렌더링 흐름을 실습 환경에 반영

### 2. API 레이어와 View 렌더링 로직 분리
- 순수 JSON API를 반환하는 로직과 `res.render()` 기반 View 렌더링 로직을 분리
- Controller / Service / View-Model 개념을 분리하여 역할을 명확히 함
- 동일한 비즈니스 로직을 API 서버와 SSR 환경에서 재사용 가능하도록 구조 설계

### 3. 게시판 페이지 구조 설계
- `/board` 페이지 구현을 기준으로 다음과 같은 흐름 구성
  - 페이지 파라미터 검증 (`page` query)
  - 전체 게시글 수 조회
  - Pagination 메타 데이터 생성
  - offset / limit 기반 게시글 목록 조회
- SSR 환경에서 API 결과를 View에 주입하는 패턴 정리

### 4. 폴더 및 네이밍 규칙 정리
- 기존 `backend` 폴더 명칭을 `server`로 변경
- 더 이상 사용하지 않는 Frontend 소스는 `_graveyard` 디렉터리로 분리 보관
- constants / types / utils / services 네이밍 규칙을 일관되게 정리

---

## 차후 계획 중인 작업

- 인증/세션 처리 로직 추가
(JWT Token 방식 예상 -> **OAuth 확장 용이**)
- 관리자 페이지 라우팅 분리 및 권한 검증 로직 구현
- 게시판 `/board` -> XSS / Injection 실습 포인트 설계
- 정적 파일 서빙 분리 (Nginx 도입 여부 검토)
- DB 설계 및 Mocks 추가