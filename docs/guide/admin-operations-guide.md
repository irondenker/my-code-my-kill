# Admin 운영 가이드

이 문서는 관리자 화면의 핵심 유즈케이스(대시보드, 사용자 관리, 보드 관리)와 운영 정책을 정리합니다.

## 연관 코드

- 라우트: `server/src/routes/admin.routes.ts`
- 접근 제어: `server/src/middlewares/auth.middleware.ts`
- 유저 관리 컨트롤러: `server/src/controllers/admin/admin-users.controller.ts`
- 보드 관리 컨트롤러: `server/src/controllers/admin/admin-boards.controller.ts`
- 정책 유틸: `server/src/utils/admin/admin-user.policy.util.ts`

## 라우트 요약

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| `GET` | `/admin` | 대시보드 통계 |
| `GET` | `/admin/users` | 사용자 목록/상태/권한 관리 |
| `POST` | `/admin/users/:userId/status` | 사용자 활성/비활성 변경 |
| `POST` | `/admin/users/:userId/role` | 사용자 권한(user/admin) 변경 |
| `GET` | `/admin/boards` | 보드 목록 + 생성 폼 |
| `POST` | `/admin/boards` | 보드 생성 |
| `GET` | `/admin/boards/:boardId/edit` | 보드 수정 폼 |
| `POST` | `/admin/boards/:boardId/edit` | 보드 수정 |

모든 라우트는 `requireAdminRedirect`를 통과해야 합니다.

## 접근 제어 동작

`requireAdminRedirect` 기준:

- 비로그인: 로그인 페이지로 리다이렉트(`next` 포함)
- 로그인 + non-admin: 403
- admin: 통과

관리자 페이지 접근 시도는 결과(`allowed`, `redirect_login`, `forbidden`)와 함께 감사로그에 기록됩니다.

## 사용자 관리 정책

상태 변경(`status`) 정책:

- 자기 자신(admin) 비활성화 금지
- admin 계정 비활성화 금지
- 변경값이 기존값과 같으면 no-op 처리

권한 변경(`role`) 정책:

- 자기 자신의 admin 회수 금지
- admin -> user 변경 시 "최소 1명 admin 유지" 강제
- 변경값이 기존값과 같으면 no-op 처리

성공 시:

- 플래시 메시지(`adminUsersFlashMessage`)를 세팅하고 `/admin/users`로 리다이렉트

## 보드 관리 정책

생성/수정 공통 검증:

- `slug`, `name` 필수
- `slug`: 2~50자, 소문자/숫자/하이픈만 허용
- `name`: 최대 100자
- `description`: 최대 255자
- `readAccess`: `public | auth | admin | owner_or_admin`
- `createAccess`: `auth | admin`

추가 검증:

- 생성: slug 중복 금지
- 수정: slug 변경 시 다른 보드와 충돌 금지

성공 시:

- 플래시 메시지(`adminBoardsFlashMessage`)를 세팅하고 `/admin/boards`로 리다이렉트

## 운영 체크포인트

- admin 계정 최소 1개가 항상 남는지 확인
- 사용자 비활성화/권한변경 후 감사로그(`ADMIN_GRANTED`, `ADMIN_REVOKED`, `ACCOUNT_*`)가 남는지 확인
- 보드 slug 변경 시 기존 링크 영향(북마크/문서)을 같이 검토
