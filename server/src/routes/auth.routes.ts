import { Router } from "express";
import {
    getLoginPage,
    getRegisterPage,
    postLogin,
    postRegister,
    postLogout,
} from "../controllers/auth.controller.ts";

const router = Router();

router.get("/login", getLoginPage);
router.post("/login", postLogin);
router.get("/register", getRegisterPage);
router.post("/register", postRegister);
router.post("/logout", postLogout);

export default router;
