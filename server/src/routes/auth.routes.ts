import { Router } from "express";
import { getLoginPage, getRegisterPage } from "../controllers/auth.controller.ts";

const router = Router();

/* 로그인 관련 Router */
router.get('/login', getLoginPage);

/* 회원가입 관련 Router */
router.get('/register', getRegisterPage);

export default router;