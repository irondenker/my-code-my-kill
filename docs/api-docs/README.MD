# API Docs

- Swagger UI: `/api-docs`
- OpenAPI JSON: `/api-docs/openapi.json`

## Notes

- This project is SSR-first. Many endpoints return `text/html` or `302` redirects.
- Form routes use `application/x-www-form-urlencoded` or `multipart/form-data`.
- Some POST routes require `_csrf` token in form payload.
