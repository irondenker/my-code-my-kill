import { loginRequestBodyOpenApiSchema } from "../schemas/auth.schema.js";

export const openApiDocument = {
    openapi: "3.0.3",
    info: {
        title: "My Code, My Kill - HTTP API",
        version: "1.0.0",
        description:
            "SSR + form-based routes documentation. Responses are mostly HTML pages or redirects.",
    },
    servers: [{ url: "/" }],
    tags: [
        { name: "Root" },
        { name: "Health" },
        { name: "Docs" },
        { name: "Auth" },
        { name: "Board" },
        { name: "User" },
        { name: "Admin" },
        { name: "Labs" },
        { name: "Occur" },
    ],
    components: {
        securitySchemes: {
            sessionCookie: {
                type: "apiKey",
                in: "cookie",
                name: "mcmk.sid",
            },
        },
        parameters: {
            slug: {
                name: "slug",
                in: "path",
                required: true,
                schema: { type: "string" },
            },
            displayId: {
                name: "displayId",
                in: "path",
                required: true,
                schema: { type: "integer", minimum: 1 },
            },
            userId: {
                name: "userId",
                in: "path",
                required: true,
                schema: { type: "integer", minimum: 1 },
            },
            boardId: {
                name: "boardId",
                in: "path",
                required: true,
                schema: { type: "integer", minimum: 1 },
            },
        },
        responses: {
            HtmlOk: {
                description: "HTML document",
                content: { "text/html": { schema: { type: "string" } } },
            },
            Redirect: {
                description: "Redirect",
                headers: {
                    Location: {
                        description: "Redirect target",
                        schema: { type: "string" },
                    },
                },
            },
        },
    },
    paths: {
        "/": {
            get: {
                tags: ["Root"],
                summary: "Root page",
                responses: { 200: { $ref: "#/components/responses/HtmlOk" } },
            },
        },
        "/healthz": {
            get: {
                tags: ["Health"],
                summary: "Health check",
                responses: {
                    200: {
                        description: "OK",
                        content: { "text/plain": { schema: { type: "string", example: "ok" } } },
                    },
                },
            },
        },
        "/api-docs": {
            get: {
                tags: ["Docs"],
                summary: "Swagger UI",
                responses: { 200: { $ref: "#/components/responses/HtmlOk" } },
            },
        },
        "/login": {
            get: {
                tags: ["Auth"],
                summary: "Sign-in page",
                parameters: [
                    {
                        name: "next",
                        in: "query",
                        required: false,
                        schema: { type: "string" },
                    },
                ],
                responses: { 200: { $ref: "#/components/responses/HtmlOk" } },
            },
            post: {
                tags: ["Auth"],
                summary: "Sign in",
                requestBody: {
                    required: true,
                    content: {
                        "application/x-www-form-urlencoded": {
                            schema: loginRequestBodyOpenApiSchema,
                        },
                    },
                },
                responses: {
                    302: { $ref: "#/components/responses/Redirect" },
                    400: { $ref: "#/components/responses/HtmlOk" },
                    401: { $ref: "#/components/responses/HtmlOk" },
                    403: { $ref: "#/components/responses/HtmlOk" },
                },
            },
        },
        "/register": {
            get: {
                tags: ["Auth"],
                summary: "Registration page",
                responses: { 200: { $ref: "#/components/responses/HtmlOk" } },
            },
            post: {
                tags: ["Auth"],
                summary: "Register account",
                requestBody: {
                    required: true,
                    content: {
                        "application/x-www-form-urlencoded": {
                            schema: {
                                type: "object",
                                required: ["username", "password"],
                                properties: {
                                    username: { type: "string" },
                                    password: { type: "string" },
                                    _csrf: { type: "string" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    302: { $ref: "#/components/responses/Redirect" },
                    400: { $ref: "#/components/responses/HtmlOk" },
                    409: { $ref: "#/components/responses/HtmlOk" },
                    422: { $ref: "#/components/responses/HtmlOk" },
                },
            },
        },
        "/logout": {
            post: {
                tags: ["Auth"],
                summary: "Sign out",
                security: [{ sessionCookie: [] }],
                requestBody: {
                    required: false,
                    content: {
                        "application/x-www-form-urlencoded": {
                            schema: {
                                type: "object",
                                properties: {
                                    _csrf: { type: "string" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    302: { $ref: "#/components/responses/Redirect" },
                },
            },
        },
        "/board": {
            get: {
                tags: ["Board"],
                summary: "Board directory",
                responses: { 200: { $ref: "#/components/responses/HtmlOk" } },
            },
        },
        "/board/{slug}": {
            get: {
                tags: ["Board"],
                summary: "Board post list",
                parameters: [
                    { $ref: "#/components/parameters/slug" },
                    {
                        name: "page",
                        in: "query",
                        required: false,
                        schema: { type: "integer", minimum: 1, default: 1 },
                    },
                ],
                responses: {
                    200: { $ref: "#/components/responses/HtmlOk" },
                    401: { $ref: "#/components/responses/HtmlOk" },
                    403: { $ref: "#/components/responses/HtmlOk" },
                    404: { $ref: "#/components/responses/HtmlOk" },
                },
            },
            post: {
                tags: ["Board"],
                summary: "Create post",
                security: [{ sessionCookie: [] }],
                parameters: [{ $ref: "#/components/parameters/slug" }],
                requestBody: {
                    required: true,
                    content: {
                        "multipart/form-data": {
                            schema: {
                                type: "object",
                                required: ["title", "content"],
                                properties: {
                                    title: { type: "string" },
                                    content: { type: "string" },
                                    image: { type: "string", format: "binary" },
                                    attachment: { type: "string", format: "binary" },
                                    _csrf: { type: "string" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    302: { $ref: "#/components/responses/Redirect" },
                    400: { $ref: "#/components/responses/HtmlOk" },
                    401: { $ref: "#/components/responses/Redirect" },
                    403: { $ref: "#/components/responses/HtmlOk" },
                    404: { $ref: "#/components/responses/HtmlOk" },
                    422: { $ref: "#/components/responses/HtmlOk" },
                },
            },
        },
        "/board/{slug}/new": {
            get: {
                tags: ["Board"],
                summary: "Create post form",
                security: [{ sessionCookie: [] }],
                parameters: [{ $ref: "#/components/parameters/slug" }],
                responses: {
                    200: { $ref: "#/components/responses/HtmlOk" },
                    302: { $ref: "#/components/responses/Redirect" },
                    403: { $ref: "#/components/responses/HtmlOk" },
                    404: { $ref: "#/components/responses/HtmlOk" },
                },
            },
        },
        "/board/{slug}/{displayId}": {
            get: {
                tags: ["Board"],
                summary: "Post detail page",
                parameters: [
                    { $ref: "#/components/parameters/slug" },
                    { $ref: "#/components/parameters/displayId" },
                ],
                responses: {
                    200: { $ref: "#/components/responses/HtmlOk" },
                    401: { $ref: "#/components/responses/HtmlOk" },
                    403: { $ref: "#/components/responses/HtmlOk" },
                    404: { $ref: "#/components/responses/HtmlOk" },
                },
            },
            delete: {
                tags: ["Board"],
                summary: "Delete post (API style)",
                security: [{ sessionCookie: [] }],
                parameters: [
                    { $ref: "#/components/parameters/slug" },
                    { $ref: "#/components/parameters/displayId" },
                ],
                responses: {
                    204: { description: "Deleted" },
                    401: { $ref: "#/components/responses/HtmlOk" },
                    403: { $ref: "#/components/responses/HtmlOk" },
                    404: { $ref: "#/components/responses/HtmlOk" },
                },
            },
        },
        "/board/{slug}/{displayId}/edit": {
            get: {
                tags: ["Board"],
                summary: "Edit post form",
                security: [{ sessionCookie: [] }],
                parameters: [
                    { $ref: "#/components/parameters/slug" },
                    { $ref: "#/components/parameters/displayId" },
                ],
                responses: {
                    200: { $ref: "#/components/responses/HtmlOk" },
                    403: { $ref: "#/components/responses/HtmlOk" },
                    404: { $ref: "#/components/responses/HtmlOk" },
                },
            },
            post: {
                tags: ["Board"],
                summary: "Update post",
                security: [{ sessionCookie: [] }],
                parameters: [
                    { $ref: "#/components/parameters/slug" },
                    { $ref: "#/components/parameters/displayId" },
                ],
                requestBody: {
                    required: true,
                    content: {
                        "multipart/form-data": {
                            schema: {
                                type: "object",
                                required: ["title", "content"],
                                properties: {
                                    title: { type: "string" },
                                    content: { type: "string" },
                                    image: { type: "string", format: "binary" },
                                    attachment: { type: "string", format: "binary" },
                                    _csrf: { type: "string" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    302: { $ref: "#/components/responses/Redirect" },
                    400: { $ref: "#/components/responses/HtmlOk" },
                    403: { $ref: "#/components/responses/HtmlOk" },
                    404: { $ref: "#/components/responses/HtmlOk" },
                    422: { $ref: "#/components/responses/HtmlOk" },
                },
            },
        },
        "/board/{slug}/{displayId}/delete": {
            post: {
                tags: ["Board"],
                summary: "Delete post (form submit)",
                security: [{ sessionCookie: [] }],
                parameters: [
                    { $ref: "#/components/parameters/slug" },
                    { $ref: "#/components/parameters/displayId" },
                ],
                requestBody: {
                    required: false,
                    content: {
                        "application/x-www-form-urlencoded": {
                            schema: {
                                type: "object",
                                properties: {
                                    _csrf: { type: "string" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    302: { $ref: "#/components/responses/Redirect" },
                    401: { $ref: "#/components/responses/HtmlOk" },
                    403: { $ref: "#/components/responses/HtmlOk" },
                    404: { $ref: "#/components/responses/HtmlOk" },
                },
            },
        },
        "/@:username": {
            get: {
                tags: ["User"],
                summary: "User profile page",
                parameters: [
                    {
                        name: "username",
                        in: "path",
                        required: true,
                        schema: { type: "string" },
                    },
                ],
                responses: {
                    200: { $ref: "#/components/responses/HtmlOk" },
                    400: { $ref: "#/components/responses/HtmlOk" },
                    404: { $ref: "#/components/responses/HtmlOk" },
                },
            },
        },
        "/settings/profile": {
            get: {
                tags: ["User"],
                summary: "Profile settings page",
                security: [{ sessionCookie: [] }],
                responses: {
                    200: { $ref: "#/components/responses/HtmlOk" },
                    302: { $ref: "#/components/responses/Redirect" },
                },
            },
            post: {
                tags: ["User"],
                summary: "Update profile",
                security: [{ sessionCookie: [] }],
                requestBody: {
                    required: true,
                    content: {
                        "application/x-www-form-urlencoded": {
                            schema: {
                                type: "object",
                                properties: {
                                    displayName: { type: "string" },
                                    email: { type: "string" },
                                    phoneNumber: { type: "string" },
                                    bio: { type: "string" },
                                    _csrf: { type: "string" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    302: { $ref: "#/components/responses/Redirect" },
                    401: { $ref: "#/components/responses/Redirect" },
                    422: { $ref: "#/components/responses/HtmlOk" },
                },
            },
        },
        "/setting/profile": {
            get: {
                tags: ["User"],
                summary: "Profile settings page (alias)",
                security: [{ sessionCookie: [] }],
                responses: {
                    200: { $ref: "#/components/responses/HtmlOk" },
                    302: { $ref: "#/components/responses/Redirect" },
                },
            },
            post: {
                tags: ["User"],
                summary: "Update profile (alias)",
                security: [{ sessionCookie: [] }],
                requestBody: {
                    required: true,
                    content: {
                        "application/x-www-form-urlencoded": {
                            schema: {
                                type: "object",
                                properties: {
                                    displayName: { type: "string" },
                                    email: { type: "string" },
                                    phoneNumber: { type: "string" },
                                    bio: { type: "string" },
                                    _csrf: { type: "string" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    302: { $ref: "#/components/responses/Redirect" },
                    401: { $ref: "#/components/responses/Redirect" },
                    422: { $ref: "#/components/responses/HtmlOk" },
                },
            },
        },
        "/users/avatar": {
            post: {
                tags: ["User"],
                summary: "Upload avatar image",
                security: [{ sessionCookie: [] }],
                requestBody: {
                    required: true,
                    content: {
                        "multipart/form-data": {
                            schema: {
                                type: "object",
                                required: ["avatar"],
                                properties: {
                                    avatar: { type: "string", format: "binary" },
                                    _csrf: { type: "string" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    302: { $ref: "#/components/responses/Redirect" },
                    400: { $ref: "#/components/responses/HtmlOk" },
                    401: { $ref: "#/components/responses/HtmlOk" },
                    413: { $ref: "#/components/responses/HtmlOk" },
                    422: { $ref: "#/components/responses/HtmlOk" },
                },
            },
        },
        "/users/avatar/delete": {
            post: {
                tags: ["User"],
                summary: "Delete avatar",
                security: [{ sessionCookie: [] }],
                requestBody: {
                    required: false,
                    content: {
                        "application/x-www-form-urlencoded": {
                            schema: { type: "object", properties: { _csrf: { type: "string" } } },
                        },
                    },
                },
                responses: {
                    302: { $ref: "#/components/responses/Redirect" },
                    401: { $ref: "#/components/responses/HtmlOk" },
                },
            },
        },
        "/admin": {
            get: {
                tags: ["Admin"],
                summary: "Admin dashboard",
                security: [{ sessionCookie: [] }],
                responses: {
                    200: { $ref: "#/components/responses/HtmlOk" },
                    302: { $ref: "#/components/responses/Redirect" },
                },
            },
        },
        "/admin/users": {
            get: {
                tags: ["Admin"],
                summary: "Admin users page",
                security: [{ sessionCookie: [] }],
                responses: {
                    200: { $ref: "#/components/responses/HtmlOk" },
                    302: { $ref: "#/components/responses/Redirect" },
                },
            },
        },
        "/admin/boards": {
            get: {
                tags: ["Admin"],
                summary: "Admin boards page",
                security: [{ sessionCookie: [] }],
                responses: { 200: { $ref: "#/components/responses/HtmlOk" } },
            },
            post: {
                tags: ["Admin"],
                summary: "Create board (admin)",
                security: [{ sessionCookie: [] }],
                requestBody: {
                    required: true,
                    content: {
                        "application/x-www-form-urlencoded": {
                            schema: {
                                type: "object",
                                required: ["slug", "name", "readAccess", "createAccess"],
                                properties: {
                                    slug: { type: "string" },
                                    name: { type: "string" },
                                    description: { type: "string" },
                                    readAccess: {
                                        type: "string",
                                        enum: ["public", "auth", "admin", "owner_or_admin"],
                                    },
                                    createAccess: {
                                        type: "string",
                                        enum: ["auth", "admin"],
                                    },
                                    _csrf: { type: "string" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    302: { $ref: "#/components/responses/Redirect" },
                    400: { $ref: "#/components/responses/HtmlOk" },
                    409: { $ref: "#/components/responses/HtmlOk" },
                    422: { $ref: "#/components/responses/HtmlOk" },
                },
            },
        },
        "/admin/audit-logs": {
            get: {
                tags: ["Admin"],
                summary: "Admin audit logs page",
                security: [{ sessionCookie: [] }],
                parameters: [
                    {
                        name: "limit",
                        in: "query",
                        required: false,
                        schema: { type: "integer", minimum: 1, maximum: 500 },
                    },
                ],
                responses: { 200: { $ref: "#/components/responses/HtmlOk" } },
            },
        },
        "/admin/users/{userId}/status": {
            post: {
                tags: ["Admin"],
                summary: "Change user status (admin)",
                security: [{ sessionCookie: [] }],
                parameters: [{ $ref: "#/components/parameters/userId" }],
                requestBody: {
                    required: true,
                    content: {
                        "application/x-www-form-urlencoded": {
                            schema: {
                                type: "object",
                                required: ["status"],
                                properties: {
                                    status: { type: "string", enum: ["active", "inactive"] },
                                    _csrf: { type: "string" },
                                },
                            },
                        },
                    },
                },
                responses: { 302: { $ref: "#/components/responses/Redirect" } },
            },
        },
        "/admin/users/{userId}/role": {
            post: {
                tags: ["Admin"],
                summary: "Change user role (admin)",
                security: [{ sessionCookie: [] }],
                parameters: [{ $ref: "#/components/parameters/userId" }],
                requestBody: {
                    required: true,
                    content: {
                        "application/x-www-form-urlencoded": {
                            schema: {
                                type: "object",
                                required: ["role"],
                                properties: {
                                    role: { type: "string", enum: ["user", "admin"] },
                                    _csrf: { type: "string" },
                                },
                            },
                        },
                    },
                },
                responses: { 302: { $ref: "#/components/responses/Redirect" } },
            },
        },
        "/admin/boards/{boardId}/edit": {
            get: {
                tags: ["Admin"],
                summary: "Board edit form (admin)",
                security: [{ sessionCookie: [] }],
                parameters: [{ $ref: "#/components/parameters/boardId" }],
                responses: { 200: { $ref: "#/components/responses/HtmlOk" } },
            },
            post: {
                tags: ["Admin"],
                summary: "Update board (admin)",
                security: [{ sessionCookie: [] }],
                parameters: [{ $ref: "#/components/parameters/boardId" }],
                requestBody: {
                    required: true,
                    content: {
                        "application/x-www-form-urlencoded": {
                            schema: {
                                type: "object",
                                required: ["slug", "name", "readAccess", "createAccess"],
                                properties: {
                                    slug: { type: "string" },
                                    name: { type: "string" },
                                    description: { type: "string" },
                                    readAccess: {
                                        type: "string",
                                        enum: ["public", "auth", "admin", "owner_or_admin"],
                                    },
                                    createAccess: {
                                        type: "string",
                                        enum: ["auth", "admin"],
                                    },
                                    _csrf: { type: "string" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    302: { $ref: "#/components/responses/Redirect" },
                    422: { $ref: "#/components/responses/HtmlOk" },
                },
            },
        },
        "/labs": {
            get: {
                tags: ["Labs"],
                summary: "Labs index page",
                responses: { 200: { $ref: "#/components/responses/HtmlOk" } },
            },
        },
        "/labs/ssti": {
            get: {
                tags: ["Labs"],
                summary: "SSTI lab page",
                responses: { 200: { $ref: "#/components/responses/HtmlOk" } },
            },
            post: {
                tags: ["Labs"],
                summary: "Render SSTI template (lab)",
                requestBody: {
                    required: true,
                    content: {
                        "application/x-www-form-urlencoded": {
                            schema: {
                                type: "object",
                                properties: {
                                    title: { type: "string" },
                                    template: { type: "string" },
                                    _csrf: { type: "string" },
                                },
                            },
                        },
                    },
                },
                responses: { 200: { $ref: "#/components/responses/HtmlOk" } },
            },
        },
        "/occur/ssr/{code}": {
            get: {
                tags: ["Occur"],
                summary: "Force SSR error by status code (debug/lab)",
                parameters: [
                    {
                        name: "code",
                        in: "path",
                        required: true,
                        schema: {
                            type: "integer",
                            enum: [401, 403, 404, 405, 409, 410, 422, 500, 501, 503, 504],
                        },
                    },
                ],
                responses: {
                    200: { $ref: "#/components/responses/HtmlOk" },
                    401: { $ref: "#/components/responses/HtmlOk" },
                    403: { $ref: "#/components/responses/HtmlOk" },
                    404: { $ref: "#/components/responses/HtmlOk" },
                    405: { $ref: "#/components/responses/HtmlOk" },
                    409: { $ref: "#/components/responses/HtmlOk" },
                    410: { $ref: "#/components/responses/HtmlOk" },
                    422: { $ref: "#/components/responses/HtmlOk" },
                    500: { $ref: "#/components/responses/HtmlOk" },
                    501: { $ref: "#/components/responses/HtmlOk" },
                    503: { $ref: "#/components/responses/HtmlOk" },
                    504: { $ref: "#/components/responses/HtmlOk" },
                },
            },
        },
    },
} as const;
