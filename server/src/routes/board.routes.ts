import { Router } from "express";
import {
    deleteBoardPost,
    getBoardBySlug,
    getBoardCreateForm,
    getBoardEditForm,
    getBoardIndex,
    getBoardShow,
    postBoardCreate,
    postBoardEdit,
} from "../controllers/board.controller.ts";
import { requireAuth, requireAuthRedirect } from "../middlewares/auth.middleware.ts";

const router = Router();

router.get("/board/:slug/new", requireAuthRedirect, getBoardCreateForm);
router.post("/board/:slug", requireAuthRedirect, postBoardCreate);
router.get("/board/:slug/:displayId/edit", requireAuthRedirect, getBoardEditForm);
router.post("/board/:slug/:displayId/edit", requireAuthRedirect, postBoardEdit);
router.post("/board/:slug/:displayId/delete", requireAuthRedirect, deleteBoardPost);
router.get("/board/:slug/:displayId", getBoardShow);
router.delete("/board/:slug/:displayId", requireAuth, deleteBoardPost);
router.get("/board/:slug", getBoardBySlug);
router.get("/board", getBoardIndex);

export default router;
