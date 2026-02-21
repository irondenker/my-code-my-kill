# Flowmap Index

Generated at: 2026-02-21T14:12:52.883Z

## Shared

- [Global Middlewares](global-middlewares.mmd)

## admin.routes.ts

- [GET /admin](flows/GET__admin.mmd) — sinks: none
- [GET /admin/boards](flows/GET__admin_boards.mmd) — sinks: none
- [POST /admin/boards](flows/POST__admin_boards.mmd) — sinks: none
- [GET /admin/boards/:boardId/edit](flows/GET__admin_boards_boardId_edit.mmd) — sinks: none
- [POST /admin/boards/:boardId/edit](flows/POST__admin_boards_boardId_edit.mmd) — sinks: none
- [GET /admin/users](flows/GET__admin_users.mmd) — sinks: none
- [POST /admin/users/:userId/role](flows/POST__admin_users_userId_role.mmd) — sinks: none
- [POST /admin/users/:userId/status](flows/POST__admin_users_userId_status.mmd) — sinks: none

## api-docs.routes.ts

- [GET /api-docs](flows/GET__api_docs.mmd) — sinks: none

## audit.routes.ts

- [GET /admin/audit-logs](flows/GET__admin_audit_logs.mmd) — sinks: none

## auth.routes.ts

- [GET /login](flows/GET__login.mmd) — sinks: none
- [POST /login](flows/POST__login.mmd) — sinks: none
- [POST /logout](flows/POST__logout.mmd) — sinks: req.session()
- [GET /register](flows/GET__register.mmd) — sinks: none
- [POST /register](flows/POST__register.mmd) — sinks: none

## board.routes.ts

- [GET /board](flows/GET__board.mmd) — sinks: none
- [GET /board/:slug](flows/GET__board_slug.mmd) — sinks: req.session()
- [POST /board/:slug](flows/POST__board_slug.mmd) — sinks: none
- [GET /board/:slug/:displayId](flows/GET__board_slug_displayId.mmd) — sinks: none
- [DELETE /board/:slug/:displayId](flows/DELETE__board_slug_displayId.mmd) — sinks: none
- [POST /board/:slug/:displayId/delete](flows/POST__board_slug_displayId_delete.mmd) — sinks: none
- [GET /board/:slug/:displayId/edit](flows/GET__board_slug_displayId_edit.mmd) — sinks: none
- [POST /board/:slug/:displayId/edit](flows/POST__board_slug_displayId_edit.mmd) — sinks: none
- [GET /board/:slug/new](flows/GET__board_slug_new.mmd) — sinks: none

## lab-ssti.routes.ts

- [GET /labs](flows/GET__labs.mmd) — sinks: none
- [GET /labs/ssti](flows/GET__labs_ssti.mmd) — sinks: none
- [POST /labs/ssti](flows/POST__labs_ssti.mmd) — sinks: req.session()

## occur.routes.ts

- [GET /occur/ssr/:code](flows/GET__occur_ssr_code.mmd) — sinks: none

## root.routes.ts

- [GET /](flows/GET__root.mmd) — sinks: none
- [GET /healthz](flows/GET__healthz.mmd) — sinks: none

## user.routes.ts

- [GET /@:username](flows/GET__username.mmd) — sinks: req.session()
- [GET /setting/profile](flows/GET__setting_profile.mmd) — sinks: req.session()
- [POST /setting/profile](flows/POST__setting_profile.mmd) — sinks: req.session()
- [GET /settings/profile](flows/GET__settings_profile.mmd) — sinks: req.session()
- [POST /settings/profile](flows/POST__settings_profile.mmd) — sinks: req.session()
- [POST /users/avatar](flows/POST__users_avatar.mmd) — sinks: req.session(), File Upload, Image Upload
- [POST /users/avatar/delete](flows/POST__users_avatar_delete.mmd) — sinks: req.session()
