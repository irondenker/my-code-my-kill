# XSS 필터 가이드

이 프로젝트의 XSS 관련 동작은 `server/lab-options.json`의 `xss` 키로 제어합니다.

## 메인 설정 파일 경로

- `server/lab-options.json`
- 예시 파일: `server/examples/lab-options.json.example`

## 연관 코드 경로

- 설정 파서: `server/src/config/lab-options.ts`
- 커스텀 이스케이퍼: `server/src/utils/xss-escape.util.ts`
- 게시글 렌더링: `server/views/board/show.ejs`
- 클라이언트 전달 스크립트: `server/views/partials/scripts.ejs`
- Bootstrap 동작 제어: `server/public/assets/js/app.js`

## 설정 구조 (`xss`)

입력 JSON 스키마는 아래와 같습니다.

```json
{
  "xss": {
    "stored": {
      "enabled": false
    },
    "sanitize": {
      "clientSide": {
        "enabled": true,
        "defaultRuleToggles": {
          "ampersand": true,
          "lessThan": true,
          "greaterThan": true,
          "doubleQuote": true,
          "singleQuote": true,
          "backtick": true
        },
        "customRules": [
          { "from": "&", "to": "&amp;" }
        ]
      },
      "serverSide": {
        "enabled": true,
        "defaultRuleToggles": {
          "ampersand": true,
          "lessThan": true,
          "greaterThan": true,
          "doubleQuote": true,
          "singleQuote": true,
          "backtick": true
        },
        "customRules": [
          { "from": "<", "to": "&lt;" },
          { "from": ">", "to": "&gt;" }
        ]
      }
    }
  }
}
```

파서 내부에서는 이를 `xssInjection` 형태로 정규화해 사용합니다.

- `xss.stored.enabled` -> `xssInjection.storedXss`
- `xss.sanitize.clientSide.enabled` -> `xssInjection.clientSide.sanitizeEnabled`
- `xss.sanitize.serverSide.enabled` -> `xssInjection.serverSide.sanitizeEnabled`

## 런타임 동작

- 공통 옵션(`xssInjection.storedXss`)
  - `serverSide.sanitizeEnabled = false`일 때만 사용됩니다.
  - `true`: 원문 렌더링(`"<%- post.content %>"`)
  - `false`: 커스텀 이스케이퍼(`escapeForXss`) 적용

- 클라이언트 사이드(`xssInjection.clientSide.sanitizeEnabled`)
  - `true`: Bootstrap 기본 sanitize 유지
  - `false`: tooltip/popover를 `sanitize: false`로 초기화하고 아래 속성을 커스텀 룰로 선처리
    - `title`
    - `data-bs-title`
    - `data-bs-content`

- 서버 사이드(`xssInjection.serverSide.sanitizeEnabled`)
  - `true`: EJS escape 출력(`"<%= post.content %>"`)
  - `false`: stored XSS 실습 모드 + 서버 커스텀 룰 기반 처리

`clientSide.sanitizeEnabled`와 `serverSide.sanitizeEnabled`가 모두 `true`이면 방어 강도가 가장 높습니다.

## 적용 방법

`lab-options.json`은 서버 시작 시 1회 로드됩니다. 값을 바꾼 뒤 서버를 재시작하세요.

- dev: `docker compose -f docker-compose.yml restart server`
- prod: `docker compose -f docker-compose.prod.yml up -d --build server`

## 참고사항

- `customRules`에서 `from`이 중복되면 마지막 규칙이 우선합니다.
- 기본 규칙과 `customRules`가 같은 `from`을 가지면 `customRules`가 기본 규칙을 덮어씁니다.
- `from`이 빈 문자열인 규칙은 무시됩니다.
- JSON은 주석을 지원하지 않습니다.
