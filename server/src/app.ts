import express from "express";
import path from "node:path";
import boardRouter from "./routes/board.routes.js";
import authRouter from "./routes/auth.routes.js";
import userRouter from "./routes/user.routes.js";
import adminRouter from "./routes/admin.routes.js";
import auditRouter from "./routes/audit.routes.js";
import rootRouter from "./routes/root.routes.js";
import apiDocsRouter from "./routes/api-docs.routes.js";
import occurRouter from "./routes/occur.routes.js";
import labSstiRouter from "./routes/lab-ssti.routes.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { createSessionMiddleware } from "./middlewares/session.middleware.js";
import { createRequestLogger } from "./middlewares/request-logger.middleware.js";
import { createGlobalCsrfMiddlewares } from "./middlewares/csrf.middleware.js";
import { createViewLocalsMiddleware } from "./middlewares/view-locals.middleware.js";
import { csrfErrorMiddleware } from "./middlewares/csrf-error.middleware.js";
import { createErrorCommonStaticMiddleware, createPublicStaticMiddleware } from "./middlewares/static.middleware.js";
import { HttpError } from "./utils/http/http-error.js";
import { getLabOptions } from "./config/lab-options.js";
import { createXssEscaper } from "./utils/xss-escape.util.js";
import { createCspMiddleware } from "./middlewares/csp.js";

/**
 * 앱 전역 설정은 프로세스 시작 시 1회 로드한 스냅샷으로 사용합니다.
 * 런타임에 `lab-options.json`을 수정해도 재로딩되지 않습니다.
 */
const labOptions = getLabOptions();

/**
 * CSRF 실습 옵션입니다.
 * - enabled=true: CSRF 보호 비활성화(실습용)
 * - enabled=false: CSRF 보호 활성화
 */
const csrfLabEnabled = labOptions.csrf.enabled;
const cspEnabled = labOptions.csp.enabled;

/**
 * 서버 사이드(XSS) escape 함수입니다.
 * 요청마다 정규식/룰을 재생성하지 않도록, 부팅 시 1회 계산해 미들웨어에 주입합니다.
 */
const escapeForXss = createXssEscaper(labOptions.xssInjection.serverSide);

/**
 * Express 앱 인스턴스를 생성합니다.
 *
 * 구성 순서(요약):
 * 1) static / body parser / session / logger
 * 2) (옵션) CSRF 보호(multipart 포함)
 * 3) view locals 주입(EJS)
 * 4) routers
 * 5) 404 fallback -> csrf error 변환 -> 공통 error handler
 */
export function createApp() {
    const app = express();

    // `x-powered-by = Express` 출력 방지
    app.disable("x-powered-by");

    // CSP 설정
    if (cspEnabled) {
        app.use(createCspMiddleware({ reportOnly: false }));
    }

    // 운영 환경에서 reverse proxy(nginx 등) 뒤에 있을 수 있으므로 trust proxy를 활성화합니다.
    app.set("trust proxy", 1);

    app.set("view engine", "ejs");
    const publicDir = path.join(process.cwd(), "public");
    const swaggerUiDistDir = path.join(process.cwd(), "node_modules", "swagger-ui-dist");
    const errorStaticRoot = path.join(process.cwd(), "views", "errors");
    app.use(createPublicStaticMiddleware({ publicDir }));


    app.use(
        // 조치 1. swagger 모듈의 css/js 파일이 cdn을 통해 다운로드 받지 않도록 설정
        // 미리 정적 파일을 다운로드 받은 후, 해당 경로를 로컬에서 서빙 
        "/assets/vendor/swagger-ui",
        express.static(swaggerUiDistDir, {
            redirect: false,
            setHeaders(res) {
                res.setHeader("X-Content-Type-Options", "nosniff");
            },
        })
    );
    app.use("/errors/common", createErrorCommonStaticMiddleware({ errorStaticRoot }));

    // Body parser (주의: multipart는 별도 처리)
    app.use(express.urlencoded({ extended: false }));

    // Session은 CSRF/인증/뷰 locals에서 사용되므로 먼저 등록합니다.
    app.use(createSessionMiddleware());
    app.use(createRequestLogger());

    // CSRF 보호는 일반 요청 + 특정 multipart 요청(선행 multer 파싱 포함)을 함께 처리합니다.
    const globalCsrfMiddlewares = createGlobalCsrfMiddlewares({ csrfLabEnabled });
    if (globalCsrfMiddlewares.length > 0) {
        app.use(...globalCsrfMiddlewares);
    }

    // EJS 템플릿에서 공통으로 사용할 locals를 주입합니다.
    app.use(
        createViewLocalsMiddleware({
            labOptions,
            escapeForXss,
        })
    );

    app.use(authRouter);
    app.use(userRouter);
    app.use(adminRouter);
    app.use(auditRouter);
    app.use(boardRouter);
    app.use(apiDocsRouter);
    app.use(occurRouter);
    app.use(labSstiRouter);

    app.use("/", rootRouter);

    // 라우팅 실패(매칭 없음)는 404 에러로 통일해 errorHandler 흐름으로 보냅니다.
    app.use((req, _res, next) => {
        const notFoundError = new HttpError(404, "Not Found");
        if (labOptions.xssInjection.reflected404) {
            (notFoundError as HttpError & { path?: string }).path = req.originalUrl;
        }
        return next(notFoundError);
    });

    // csurf의 EBADCSRFTOKEN을 403으로 변환하고, 감사 로그를 남깁니다.
    app.use(csrfErrorMiddleware);

    // 최종 에러 핸들러(공통 에러 페이지/리다이렉트 정책)
    app.use(errorHandler);

    return app;
}
