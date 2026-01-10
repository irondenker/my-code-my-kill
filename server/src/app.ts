import express from "express";
import session from "express-session";
import csrf from "csurf";
import boardRouter from "./routes/board.routes.ts";
import authRouter from "./routes/auth.routes.ts";
import userRouter from "./routes/user.routes.ts";
import rootRouter from "./routes/root.routes.ts";
import { errorHandler } from "./middlewares/error-handler.ts";

const isProd = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET ?? "dev-only-change-me";
if (isProd && sessionSecret === "dev-only-change-me") {
    throw new Error("Missing SESSION_SECRET in production.");
}

export function createApp() {
    const app = express();

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
                secure: isProd,
                sameSite: "lax",
                maxAge: 1000 * 60 * 60 * 2,
            },
        })
    );

    app.use(csrf());

    app.use((req, res, next) => {
        res.locals.csrfToken = req.csrfToken();
        res.locals.sessionUser = req.session.userId ?? null;
        res.locals.sessionUsername = req.session.username ?? null;
        next();
    });

    app.get("/healthz", (_req, res) => {
        res.status(200).send("ok");
    });

    app.use(authRouter);
    app.use(userRouter);
    app.use(boardRouter);

    app.use("/", rootRouter);

    app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
        if (err?.code === "EBADCSRFTOKEN") {
            return res.status(403).send("Invalid CSRF token");
        }
        return next(err);
    });

    app.use(errorHandler);

    return app;
}
