import express from "express";
import path from "node:path";
import csrf from "csurf";
import boardRouter from "./routes/board.routes.js";
import authRouter from "./routes/auth.routes.js";
import userRouter from "./routes/user.routes.js";
import adminRouter from "./routes/admin.routes.js";
import rootRouter from "./routes/root.routes.js";
import apiDocsRouter from "./routes/api-docs.routes.js";
import occurRouter from "./routes/occur.routes.js";
import labSstiRouter from "./routes/lab-ssti.routes.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { createSessionMiddleware } from "./middlewares/session.middleware.js";
import { HttpError } from "./utils/http-error.js";
import { getLabOptions } from "./config/lab-options.js";
import { createXssEscaper } from "./utils/xss-escape.util.js";
import { writeAdminAuditLog } from "./services/admin-audit.service.js";

const isProd = process.env.NODE_ENV === "production";
const labOptions = getLabOptions();
const clientSideSanitizeEnabled = labOptions.xssInjection.clientSide.sanitizeEnabled;
const serverSideSanitizeEnabled = labOptions.xssInjection.serverSide.sanitizeEnabled;
const labStoredXssEnabled = labOptions.xssInjection.storedXss;
const csrfLabEnabled = labOptions.csrf.enabled;
const escapeForXss = createXssEscaper(labOptions.xssInjection.serverSide);
const trustProxy = process.env.TRUST_PROXY === "true" || isProd;

/**
 * 요청 IP를 문자열로 정규화합니다.
 *
 * @param req Express 요청 객체
 * @returns 공백 제거된 IP 문자열 또는 null
 */
function getRequestIp(req: express.Request): string | null {
    const value = typeof req.ip === "string" ? req.ip.trim() : "";
    return value || null;
}

/**
 * 요청 User-Agent를 문자열로 정규화합니다.
 *
 * @param req Express 요청 객체
 * @returns 공백 제거된 User-Agent 문자열 또는 null
 */
function getRequestUserAgent(req: express.Request): string | null {
    const value = req.get("user-agent");
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed || null;
}

export function createApp() {
    const app = express();
    if (isProd && !serverSideSanitizeEnabled && labStoredXssEnabled) {
        console.warn("[SECURITY_LAB] Stored XSS lab mode is enabled in production.");
    }
    if (isProd && csrfLabEnabled) {
        console.warn("[SECURITY_LAB] CSRF protection is disabled in production.");
    }

    if (trustProxy) {
        app.set("trust proxy", 1);
    }

    app.set("view engine", "ejs");
    const publicDir = path.join(process.cwd(), "public");
    const postFileUploadDir = path.join(publicDir, "uploads", "posts", "files");
    app.use(
        express.static(publicDir, {
            setHeaders(res, filePath) {
                // Helps prevent content-type sniffing attacks against uploaded files.
                res.setHeader("X-Content-Type-Options", "nosniff");

                // Force attachments to download instead of rendering inline in the browser.
                if (filePath.startsWith(postFileUploadDir + path.sep)) {
                    const filename = path.basename(filePath);
                    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
                }
            },
        })
    );
    const errorStaticRoot = path.join(process.cwd(), "views", "errors");
    app.use(
        "/errors/common",
        express.static(path.join(errorStaticRoot, "common"), {
            setHeaders(res) {
                res.setHeader("X-Content-Type-Options", "nosniff");
            },
        })
    );


    app.use(express.urlencoded({ extended: false }));
    app.use(express.json());

    app.use(createSessionMiddleware());

    const csrfProtection = csrf();
    if (!csrfLabEnabled) {
        app.use((req, res, next) => {
            const isMultipartPost =
                req.method === "POST" &&
                (req.path === "/users/avatar" ||
                    /^\/board\/[^/]+$/.test(req.path) ||
                    /^\/board\/[^/]+\/\d+\/edit$/.test(req.path));

            if (isMultipartPost) {
                return next();
            }

            return csrfProtection(req, res, next);
        });
    }

    app.use((req, res, next) => {
        res.locals.csrfToken = typeof req.csrfToken === "function" ? req.csrfToken() : null;
        res.locals.sessionUser = req.session.userId ?? null;
        res.locals.sessionUsername = req.session.username ?? null;
        res.locals.sessionUserRole = req.session.userRole ?? null;
        res.locals.labStoredXssEnabled = labStoredXssEnabled;
        res.locals.clientSideSanitizeEnabled = clientSideSanitizeEnabled;
        res.locals.serverSideSanitizeEnabled = serverSideSanitizeEnabled;
        res.locals.xssClientSideOptions = labOptions.xssInjection.clientSide;
        res.locals.escapeForXss = escapeForXss;
        const profileImageUrl = req.session.profileImageUrl;
        res.locals.sessionProfileImageUrl =
            profileImageUrl && !profileImageUrl.startsWith("/")
                ? `/uploads/avatars/${profileImageUrl}`
                : profileImageUrl ?? null;
        next();
    });

    app.get("/healthz", (_req, res) => {
        res.status(200).send("ok");
    });

    app.use(authRouter);
    app.use(userRouter);
    app.use(adminRouter);
    app.use(boardRouter);
    app.use(apiDocsRouter);
    app.use(occurRouter);
    app.use(labSstiRouter);

    app.use("/", rootRouter);

    app.use((_req, _res, next) => {
        return next(new HttpError(404, "Not Found"));
    });

    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
        if (err?.code === "EBADCSRFTOKEN") {
            void writeAdminAuditLog({
                action: "CSRF_INVALID",
                actorUserId: typeof req.session.userId === "number" ? req.session.userId : null,
                actorUsername: typeof req.session.username === "string" ? req.session.username : null,
                targetUserId: null,
                targetUsername: null,
                details: {
                    method: req.method,
                    path: req.originalUrl,
                    reason: "invalid_csrf_token",
                },
                ipAddress: getRequestIp(req),
                userAgent: getRequestUserAgent(req),
            }).catch((logErr) => {
                console.error("[AUDIT_LOG_ERROR]", logErr);
            });
            res.locals.securityEventLogged = true;
            return next(new HttpError(403, "Invalid CSRF token"));
        }
        return next(err);
    });

    app.use(errorHandler);

    return app;
}
