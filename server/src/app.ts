import express from "express";
import session from "express-session";
import csrf from "csurf";
import boardRouter from "./routes/board.routes.js";
import authRouter from "./routes/auth.routes.js";
import userRouter from "./routes/user.routes.js";
import rootRouter from "./routes/root.routes.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { renderError } from "./utils/render-error.util.js";

const isProd = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET ?? "dev-only-change-me";
if (isProd && sessionSecret === "dev-only-change-me") {
    throw new Error("Missing SESSION_SECRET in production.");
}
const trustProxy = process.env.TRUST_PROXY === "true" || isProd;
const cookieSecure: boolean | "auto" = isProd ? "auto" : false;

export function createApp() {
    const app = express();
    if (trustProxy) {
        app.set("trust proxy", 1);
    }

    app.set("view engine", "ejs");
    app.use(express.static("public"));

    app.use(express.urlencoded({ extended: false }));
    app.use(express.json());

    app.use(
        session({
            name: "mcmk.sid",
            secret: sessionSecret,
            resave: false,
            saveUninitialized: false,
            cookie: {
                httpOnly: true,
                secure: cookieSecure,
                sameSite: "lax",
                maxAge: 1000 * 60 * 60 * 2,
            },
        })
    );

    const csrfProtection = csrf();
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

    app.use((req, res, next) => {
        res.locals.csrfToken = typeof req.csrfToken === "function" ? req.csrfToken() : null;
        res.locals.sessionUser = req.session.userId ?? null;
        res.locals.sessionUsername = req.session.username ?? null;
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
    app.use(boardRouter);

    app.use("/", rootRouter);

    app.use((_req, res) => {
        return res.status(404).render("errors/404", {
            message: "The requested resource was not found.",
        });
    });

    app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
        if (err?.code === "EBADCSRFTOKEN") {
            return renderError(res, 403, "Invalid CSRF token");
        }
        return next(err);
    });

    app.use(errorHandler);

    return app;
}
