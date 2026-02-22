# Lab Options Reference (`server/lab-options.json`)

`lab-options.json`은 취약점 실습 토글을 한 곳에서 제어하는 설정 파일입니다.

## 파일/적용 원칙

- 설정 파일: `server/lab-options.json`
- 예시 파일: `server/examples/lab-options.json.example`
- 파서: `server/src/config/lab-options.ts`
- 적용 시점: 서버 시작 시 1회 로드(런타임 hot-reload 없음)

값을 바꾼 뒤에는 서버를 재시작하세요.

- dev: `docker compose -f docker-compose.yml restart server`
- prod: `docker compose -f docker-compose.prod.yml up -d --build server`

## 전체 구조

```json
{
  "debug": {
    "errorRoutes": {
      "enabled": false
    }
  },
  "sqlInjection": {
    "enabled": false,
    "targets": {
      "authLookup": false,
      "authCreate": false,
      "profileLookup": false,
      "profileUpdate": false,
      "boardLookup": false,
      "boardCreate": false,
      "boardUpdate": false,
      "articleLookup": false,
      "articleCreate": false,
      "articleUpdate": false,
      "articleDelete": false
    }
  },
  "ssti": {
    "enabled": false
  },
  "csrf": {
    "enabled": false
  },
  "uploadValidation": {
    "extensionCheck": true,
    "mimeCheck": true,
    "magicNumberCheck": true
  },
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
        "customRules": []
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
        "customRules": []
      }
    }
  }
}
```

## 키별 요약

| 키 | 기본값 | 설명 |
| --- | --- | --- |
| `sqlInjection.enabled` | `false` | SQLi 실습 모드 전체 on/off |
| `sqlInjection.targets.*` | `false` | 로그인/프로필/보드/게시글 단위 공격표면 토글 |
| `ssti.enabled` | `false` | `/labs/ssti` 템플릿 렌더 실습 on/off |
| `csrf.enabled` | `false` | `true`면 CSRF 보호를 비활성화(실습용) |
| `debug.errorRoutes.enabled` | `false` | prod에서 `/occur/ssr/:code` 디버그 라우트 허용 여부 |
| `uploadValidation.*` | `true` | 업로드 검증(extension/mime/magic number) 개별 토글 |
| `xss.stored.enabled` | `false` | stored XSS 실습 토글 |
| `xss.sanitize.clientSide.enabled` | `true` | 클라이언트 sanitize on/off |
| `xss.sanitize.serverSide.enabled` | `true` | 서버 sanitize on/off |
| `xss.sanitize.*.defaultRuleToggles` | 전부 `true` | 기본 escape 규칙별 on/off |
| `xss.sanitize.*.customRules` | `[]` | `{ from, to }` 커스텀 치환 규칙 |

## 파싱 규칙

- boolean은 `true/false` 또는 문자열 `"true"/"false"`를 허용합니다.
- 잘못된 타입/형식은 `console.warn` 후 기본값으로 폴백합니다.
- 일부 레거시 키는 경고 후 무시합니다.
  - `xss.sanitize.<side>.sanitizeEnabled` (대신 `enabled` 사용)
  - `uploadValidation.defaultRuleToggles` (대신 `uploadValidation.<toggle>` 사용)

## 관련 세부 가이드

- SQLi: `docs/guide/lab/sqli-lab-guide.md`
- XSS: `docs/guide/lab/xss-filter-guide.md`
- 업로드 검증: `docs/guide/lab/upload-validation-guide.md`
- SSTI: `docs/guide/lab/ssti-lab-guide.md`
- CSRF: `docs/guide/lab/csrf-lab-guide.md`
- Debug error routes: `docs/guide/lab/debug-error-routes-guide.md`
