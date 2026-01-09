import { Router } from "express";
import { getBoardIndex, getBoardShow } from '../controllers/board.controller.ts';

const router = Router();

// 단일 조회 (id는 숫자만)
router.get("/board/:slug/:displayId", getBoardShow);

router.get('/board', getBoardIndex);


export default router;
