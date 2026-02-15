# SQLi Lab Guide (`sqlInjection`)

이 문서는 `lab-options.json`에서 SQL Injection(의도적 취약점) 실습 옵션을 켜고, 어떤 입력 지점이 공격표면이 되는지 정리합니다.

## 주의

- 이 옵션은 **의도적으로 안전장치(바인딩/파라미터 치환)를 제거**하여 SQLi가 가능하도록 만듭니다.
- 실서비스/인터넷 노출 환경에서는 켜지 마세요. (특히 `targets`를 넓게 켜면 DB 전체가 위험해집니다.)

## 설정 파일 위치

- 설정 파일: `server/lab-options.json`
- 예시 파일: `server/examples/lab-options.json.example`
- 적용: 서버 시작 시 1회 로드되므로 변경 후 서버 재시작이 필요합니다.
  - dev: `docker compose -f docker-compose.yml restart server`
  - prod: `docker compose -f docker-compose.prod.yml up -d --build server`

## 기본 구조

```json
{
  "sqlInjection": {
    "enabled": false,
    "targets": {
      "loginUsername": false,
      "registerUsernameLookup": false,
      "registerCreateUser": false,
      "adminUserUsernameLookup": false,
      "adminUserCreate": false,
      "profileLookupByUsername": false,
      "profileUpdate": false,
      "boardLookupBySlug": false,
      "boardCreate": false,
      "boardUpdate": false,
      "postLookup": false,
      "postCreate": false,
      "postUpdate": false
    }
  }
}
```

- `sqlInjection.enabled`: 마스터 스위치
  - `false`면 모든 SQLi 실습 비활성화 (targets 값 무시)
  - `true`면 `targets`에서 켠 항목만 취약 분기 사용
- `sqlInjection.targets.*`: 기능(공격표면)별 세부 스위치

## targets 상세(공격표면 매핑)

아래 항목들은 모두 “사용자 입력이 들어간 SQL 문자열을 직접 이어붙이는 형태”로 바뀌는 지점입니다.

- `loginUsername`
  - 로그인 시 username으로 사용자 조회가 취약해집니다.
  - 입력 지점: `/login` 폼의 `username`

- `registerUsernameLookup`
  - 회원가입 시 “username 중복 체크(조회)”가 취약해집니다.
  - 입력 지점: `/register` 폼의 `username`

- `registerCreateUser`
  - 회원가입 시 “사용자 생성(INSERT)”이 취약해집니다.
  - 입력 지점: `/register` 폼의 `username` (및 내부적으로 `passwordHash` 등)

- `adminUserUsernameLookup`
  - 어드민에서 사용자 생성 전 “username 중복 체크(조회)”가 취약해집니다.
  - 입력 지점: `/admin/users`의 Create account 폼 `username`

- `adminUserCreate`
  - 어드민에서 “사용자 생성(INSERT)”이 취약해집니다.
  - 입력 지점: `/admin/users`의 Create account 폼

- `profileLookupByUsername`
  - 공개 프로필 조회가 취약해집니다.
  - 입력 지점: `GET /@:username`의 path param `username`

- `profileUpdate`
  - 프로필 수정(UPDATE)이 취약해집니다.
  - 입력 지점: `/settings/profile` 폼의 `displayName`, `email`, `phoneNumber`, `bio`

- `boardLookupBySlug`
  - 보드 slug 기반 조회가 취약해집니다.
  - 입력 지점: `/board/:slug` 등 path param `slug`

- `boardCreate`
  - 어드민 보드 생성(INSERT)이 취약해집니다.
  - 입력 지점: `/admin/boards`의 Create board 폼(`slug`, `name`, `description`, ...)

- `boardUpdate`
  - 어드민 보드 수정(UPDATE)이 취약해집니다.
  - 입력 지점: `/admin/boards/:boardId/edit` 폼

- `postLookup`
  - 게시글 상세 조회가 취약해집니다.
  - 입력 지점: `/board/:slug/:displayId`의 `slug`, `displayId`

- `postCreate`
  - 글쓰기(INSERT)가 취약해집니다.
  - 입력 지점: `/board/:slug/new`의 `title`, `content`

- `postUpdate`
  - 글수정(UPDATE)이 취약해집니다.
  - 입력 지점: `/board/:slug/:displayId/edit`의 `title`, `content`

## 추천 설정 예시

### 1) 로그인 username만(가장 안전한 범위)

```json
{
  "sqlInjection": {
    "enabled": true,
    "targets": {
      "loginUsername": true
    }
  }
}
```

### 2) “입력 가능한 곳 대부분”을 공격표면으로 확장(고위험)

```json
{
  "sqlInjection": {
    "enabled": true,
    "targets": {
      "loginUsername": true,
      "registerUsernameLookup": true,
      "registerCreateUser": true,
      "adminUserUsernameLookup": true,
      "adminUserCreate": true,
      "profileLookupByUsername": true,
      "profileUpdate": true,
      "boardLookupBySlug": true,
      "boardCreate": true,
      "boardUpdate": true,
      "postLookup": true,
      "postCreate": true,
      "postUpdate": true
    }
  }
}
```

## 동작 확인 팁

- SQL 로그를 보려면 `server/.env`에서 `DB_LOGGING=true`로 켜면 `[SQL] ...` 로그가 출력됩니다.
- 감사로그 콘솔 출력은 `AUDIT_CLI_LOG_LEVEL`로 별도 제어됩니다. (SQLi 옵션과 무관)
