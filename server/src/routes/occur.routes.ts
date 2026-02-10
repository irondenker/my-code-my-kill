import { Router } from "express";
import { getLabOptions } from "../config/lab-options.js";
import { HttpError } from "../utils/http-error.js";

const router = Router();

const SSR_OCCUR_ALLOWED_CODES = new Set([
    401, 403, 404, 405, 409, 410, 422, 500, 501, 503, 504,
]);

function isOccurRouteEnabled(): boolean {
    if (process.env.NODE_ENV !== "production") {
        return true;
    }
    return getLabOptions().debugErrorRoutes;
}

router.get("/occur/ssr/:code", (req, _res, next) => {
    if (!isOccurRouteEnabled()) {
        return next(new HttpError(404, "Not Found"));
    }

    const parsedCode = Number.parseInt(req.params.code, 10);
    if (!Number.isInteger(parsedCode) || !SSR_OCCUR_ALLOWED_CODES.has(parsedCode)) {
        return next(new HttpError(404, "Not Found"));
    }

    return next(new HttpError(parsedCode, `Forced SSR error ${parsedCode}`));
});

export default router;
