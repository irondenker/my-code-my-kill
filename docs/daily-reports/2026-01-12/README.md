# 일일 보고 (2026-01-12)

## 금일 작업 내용

1. **에러 페이지 전면 개편**
    * **개편 대상 Status**: `403`, `404`, `500`, `503`, `504`
    * 정적(HTML/CSS/JS) 파일 **그대로 제공**
        * `nginx`의 `error_page`
        * `server`의 `errors`
        * 사유: `nginx`와 `server`가 서로 다른 UI / response 형태를 가질 경우, 공격자에게 유리한 정보로 제공할 수도 있을 것이라 판단.
    * **에러 페이지 없는 Status**: `400`, `413`, `422` 등
        * 이 응답은 `render`,`alert()` 등의 기능으로 처리(단순 Client 응답 오류)

    * **`middlewares`로 에러 처리 중앙화**
        * HTTP 에러 `utils` 모듈 분리

2. **`Docker` 구성 재정비**
    * `Docker-Compose` 설정 정돈 및 운영 흐름 개선
    * `Docker` 사용 가이드 문서 추가

3. **`controllers` 리팩터링**
    * **대상:** `auth`, `avatar`, `boards`, `users` 등
    * **수행:** `utils`, `services` 등으로 모듈화(기능 분리) 수행

## 차후 계획 중인 작업

1. **VM을 통한 모의 배포 환경 구축 완료**
2. **모의 해킹 구성 준비**
    * **대상**: `http://<VM 주소>` (80 포트)
    * **사용 도구**:
        * `Burp Suite`, `sqlmap`, `OWASP ZAP`, `nmap` 등
    * **보고 방법:**
        * 보고서 작성(추후 양식 제작 예정)
3. **모의 해킹 이후 취약점 보완 계획 수립**
    * **강화:** `xssFilter` 보완, `preparedStatement` 설정 등
    * **약화:** 세션 검증 로직 약화,
    * 참고: **'약화'** 의 경우 실습 포인트를 늘리기 위한 **의도적인 취약점 생성**
