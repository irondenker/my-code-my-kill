import { Router } from "express";
import { getUserProfile } from "../controllers/user.controller.ts";

const router = Router();

router.get("/@:username", getUserProfile);

export default router;
