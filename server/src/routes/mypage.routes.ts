import { Router } from "express";
import { getMypage } from "../controllers/mypage.controller.ts";

const router = Router();

router.get('/mypage', getMypage);

export default router;