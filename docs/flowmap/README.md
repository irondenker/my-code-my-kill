# Flowmap

Flowmap은 서버 엔드포인트 중심으로 요청 흐름을 빠르게 파악하기 위한 문서입니다.
각 문서는 Entry -> Middleware -> Handler -> Sink/Exit 순서로 유스케이스 단위 흐름을 요약합니다.

## Shared

- [Global Middlewares](global-middlewares.mmd)
- [Session Access](session-access.mmd)

## admin.routes.ts

- Session Read Keys: session.adminBoardsFlashMessage, session.adminUsersFlashMessage, session.userId, session.username
- Session Write Keys: session.adminBoardsFlashMessage, session.adminUsersFlashMessage

- [GET /admin](flows/GET__admin.mmd) — sinks: none
- [GET /admin/boards](flows/GET__admin_boards.mmd) — sinks: req.session.read(), req.session.write()
- [POST /admin/boards](flows/POST__admin_boards.mmd) — sinks: req.session.read(), req.session.write()
- [GET /admin/boards/:boardId/edit](flows/GET__admin_boards_boardId_edit.mmd) — sinks: none
- [POST /admin/boards/:boardId/edit](flows/POST__admin_boards_boardId_edit.mmd) — sinks: req.session.write()
- [GET /admin/users](flows/GET__admin_users.mmd) — sinks: req.session.read(), req.session.write()
- [POST /admin/users/:userId/role](flows/POST__admin_users_userId_role.mmd) — sinks: req.session.read(), req.session.write()
- [POST /admin/users/:userId/status](flows/POST__admin_users_userId_status.mmd) — sinks: req.session.read(), req.session.write()

## api-docs.routes.ts

- Session Read Keys: none
- Session Write Keys: none

- [GET /api-docs](flows/GET__api_docs.mmd) — sinks: none

## audit.routes.ts

- Session Read Keys: none
- Session Write Keys: none

- [GET /admin/audit-logs](flows/GET__admin_audit_logs.mmd) — sinks: none

## auth.routes.ts

- Session Read Keys: session.userId, session.username, session.userRole
- Session Write Keys: session (root), session.profileImageUrl, session.userId, session.username, session.userRole

- [GET /login](flows/GET__login.mmd) — sinks: none
- [POST /login](flows/POST__login.mmd) — sinks: req.session.write()
- [POST /logout](flows/POST__logout.mmd) — sinks: req.session.read(), req.session.write()
- [GET /register](flows/GET__register.mmd) — sinks: none
- [POST /register](flows/POST__register.mmd) — sinks: req.session.write()

## board.routes.ts

- Session Read Keys: session.boardFlashMessage, session.userId, session.userRole
- Session Write Keys: session.boardFlashMessage

- [GET /board](flows/GET__board.mmd) — sinks: req.session.read()
- [GET /board/:slug](flows/GET__board_slug.mmd) — sinks: req.session.read(), req.session.write()
- [POST /board/:slug](flows/POST__board_slug.mmd) — sinks: req.session.read()
- [GET /board/:slug/:displayId](flows/GET__board_slug_displayId.mmd) — sinks: req.session.read()
- [DELETE /board/:slug/:displayId](flows/DELETE__board_slug_displayId.mmd) — sinks: req.session.read(), req.session.write()
- [POST /board/:slug/:displayId/delete](flows/POST__board_slug_displayId_delete.mmd) — sinks: req.session.read(), req.session.write()
- [GET /board/:slug/:displayId/edit](flows/GET__board_slug_displayId_edit.mmd) — sinks: req.session.read()
- [POST /board/:slug/:displayId/edit](flows/POST__board_slug_displayId_edit.mmd) — sinks: req.session.read()
- [GET /board/:slug/new](flows/GET__board_slug_new.mmd) — sinks: req.session.read()

## lab-ssti.routes.ts

- Session Read Keys: session.username
- Session Write Keys: none

- [GET /labs](flows/GET__labs.mmd) — sinks: none
- [GET /labs/ssti](flows/GET__labs_ssti.mmd) — sinks: none
- [POST /labs/ssti](flows/POST__labs_ssti.mmd) — sinks: req.session.read()

## occur.routes.ts

- Session Read Keys: none
- Session Write Keys: none

- [GET /occur/ssr/:code](flows/GET__occur_ssr_code.mmd) — sinks: none

## root.routes.ts

- Session Read Keys: none
- Session Write Keys: none

- [GET /](flows/GET__root.mmd) — sinks: none
- [GET /healthz](flows/GET__healthz.mmd) — sinks: none

## user.routes.ts

- Session Read Keys: session.userId, session.username, session.userRole
- Session Write Keys: session.profileImageUrl

- [GET /@:username](flows/GET__username.mmd) — sinks: req.session.read()
- [GET /setting/profile](flows/GET__setting_profile.mmd) — sinks: req.session.read()
- [POST /setting/profile](flows/POST__setting_profile.mmd) — sinks: req.session.read()
- [GET /settings/profile](flows/GET__settings_profile.mmd) — sinks: req.session.read()
- [POST /settings/profile](flows/POST__settings_profile.mmd) — sinks: req.session.read()
- [POST /users/avatar](flows/POST__users_avatar.mmd) — sinks: File Upload, Image Upload, req.session.read(), req.session.write()
- [POST /users/avatar/delete](flows/POST__users_avatar_delete.mmd) — sinks: req.session.read(), req.session.write()
