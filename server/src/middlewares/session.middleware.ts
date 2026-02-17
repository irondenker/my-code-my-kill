import session from "express-session";
import { SESSION_COOKIE_NAME } from "../constants/session.constants.js";

const isProd = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET ?? "dev-only-change-me";
const cookieSecure: boolean | "auto" = isProd ? "auto" : false;

if (isProd && sessionSecret === "dev-only-change-me") {
    throw new Error("Missing SESSION_SECRET in production.");
}

export function createSessionMiddleware() {
    return session({
        name: SESSION_COOKIE_NAME,
        secret: sessionSecret,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: cookieSecure,
            sameSite: "lax",
            maxAge: 1000 * 60 * 30, // 30분
        },
    });
}
