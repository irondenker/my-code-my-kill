# Flowmap Index

Generated at: 2026-02-21T10:04:21.313Z

## admin.routes.ts

- [GET /admin](flows/GET__admin.mmd) — sinks: RENDER
- [GET /admin/boards](flows/GET__admin_boards.mmd) — sinks: none
- [POST /admin/boards](flows/POST__admin_boards.mmd) — sinks: REDIRECT
- [GET /admin/boards/:boardId/edit](flows/GET__admin_boards_boardId_edit.mmd) — sinks: RENDER
- [POST /admin/boards/:boardId/edit](flows/POST__admin_boards_boardId_edit.mmd) — sinks: RENDER, REDIRECT
- [GET /admin/users](flows/GET__admin_users.mmd) — sinks: none
- [POST /admin/users/:userId/role](flows/POST__admin_users_userId_role.mmd) — sinks: REDIRECT
- [POST /admin/users/:userId/status](flows/POST__admin_users_userId_status.mmd) — sinks: REDIRECT

## api-docs.routes.ts

- [GET /api-docs](flows/GET__api_docs.mmd) — sinks: SEND

## audit.routes.ts

- [GET /admin/audit-logs](flows/GET__admin_audit_logs.mmd) — sinks: RENDER

## auth.routes.ts

- [GET /login](flows/GET__login.mmd) — sinks: none
- [POST /login](flows/POST__login.mmd) — sinks: RENDER, REDIRECT
- [POST /logout](flows/POST__logout.mmd) — sinks: REDIRECT, SESSION
- [GET /register](flows/GET__register.mmd) — sinks: none
- [POST /register](flows/POST__register.mmd) — sinks: RENDER, REDIRECT

## board.routes.ts

- [GET /board](flows/GET__board.mmd) — sinks: RENDER
- [GET /board/:slug](flows/GET__board_slug.mmd) — sinks: RENDER, SESSION
- [POST /board/:slug](flows/POST__board_slug.mmd) — sinks: REDIRECT
- [GET /board/:slug/:displayId](flows/GET__board_slug_displayId.mmd) — sinks: RENDER
- [DELETE /board/:slug/:displayId](flows/DELETE__board_slug_displayId.mmd) — sinks: SEND, REDIRECT
- [POST /board/:slug/:displayId/delete](flows/POST__board_slug_displayId_delete.mmd) — sinks: SEND, REDIRECT
- [GET /board/:slug/:displayId/edit](flows/GET__board_slug_displayId_edit.mmd) — sinks: none
- [POST /board/:slug/:displayId/edit](flows/POST__board_slug_displayId_edit.mmd) — sinks: REDIRECT
- [GET /board/:slug/new](flows/GET__board_slug_new.mmd) — sinks: none

## lab-ssti.routes.ts

- [GET /labs](flows/GET__labs.mmd) — sinks: RENDER
- [GET /labs/ssti](flows/GET__labs_ssti.mmd) — sinks: RENDER
- [POST /labs/ssti](flows/POST__labs_ssti.mmd) — sinks: RENDER, SESSION

## occur.routes.ts

- [GET /occur/ssr/:code](flows/GET__occur_ssr_code.mmd) — sinks: none

## root.routes.ts

- [GET /](flows/GET__root.mmd) — sinks: RENDER
- [GET /healthz](flows/GET__healthz.mmd) — sinks: SEND

## user.routes.ts

- [GET /@:username](flows/GET__username.mmd) — sinks: RENDER, SESSION
- [GET /setting/profile](flows/GET__setting_profile.mmd) — sinks: RENDER, REDIRECT, SESSION
- [POST /setting/profile](flows/POST__setting_profile.mmd) — sinks: RENDER, REDIRECT, SESSION
- [GET /settings/profile](flows/GET__settings_profile.mmd) — sinks: RENDER, REDIRECT, SESSION
- [POST /settings/profile](flows/POST__settings_profile.mmd) — sinks: RENDER, REDIRECT, SESSION
- [POST /users/avatar](flows/POST__users_avatar.mmd) — sinks: REDIRECT, SESSION, UPLOAD, IMAGE
- [POST /users/avatar/delete](flows/POST__users_avatar_delete.mmd) — sinks: REDIRECT, SESSION
