import { type NextFunction, type Request, type Response, Router } from "express";
import multer from "multer";
import csrf from "csurf";
import { getLabOptions } from "../config/lab-options.js";
import {
    deleteBoardPost,
    getBoardBySlug,
    getBoardCreateForm,
    getBoardEditForm,
    getBoardIndex,
    getBoardShow,
    postBoardCreate,
    postBoardEdit,
} from "../controllers/board.controller.js";
import { requireAuth, requireAuthRedirect } from "../middlewares/auth.middleware.js";

const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
});
const csrfProtection = csrf();
const csrfLabEnabled = getLabOptions().csrf.enabled;
const maybeCsrfProtection = csrfLabEnabled
    ? (_req: Request, _res: Response, next: NextFunction) => next()
    : csrfProtection;

router.get("/board/:slug/new", requireAuthRedirect, getBoardCreateForm);
router.post(
    "/board/:slug",
    requireAuthRedirect,
    upload.fields([
        { name: "image", maxCount: 1 },
        { name: "attachment", maxCount: 1 },
    ]),
    maybeCsrfProtection,
    postBoardCreate
);
router.get("/board/:slug/:displayId/edit", requireAuthRedirect, getBoardEditForm);
router.post(
    "/board/:slug/:displayId/edit",
    requireAuthRedirect,
    upload.fields([
        { name: "image", maxCount: 1 },
        { name: "attachment", maxCount: 1 },
    ]),
    maybeCsrfProtection,
    postBoardEdit
);
router.post("/board/:slug/:displayId/delete", requireAuthRedirect, deleteBoardPost);
router.get("/board/:slug/:displayId", getBoardShow);
router.delete("/board/:slug/:displayId", requireAuth, deleteBoardPost);
router.get("/board/:slug", getBoardBySlug);
router.get("/board", getBoardIndex);

export default router;
