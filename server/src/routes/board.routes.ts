import { Router } from "express";
import { deleteBoardPost, getBoardBySlug, getBoardIndex, getBoardShow } from "../controllers/board.controller.ts";
import { requireAuth } from "../middlewares/auth.middleware.ts";

const router = Router();

router.get("/board/:slug/:displayId", getBoardShow);
router.delete("/board/:slug/:displayId", requireAuth, deleteBoardPost);
router.get("/board/:slug", getBoardBySlug);
router.get("/board", getBoardIndex);

export default router;
