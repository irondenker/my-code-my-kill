import { Router } from "express";
import { getBoardIndex } from '../controllers/board.controller.ts';

const router = Router();

router.get('/board', getBoardIndex);

export default router;