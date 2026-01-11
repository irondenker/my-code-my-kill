import { Router } from "express";
import { getRootPage } from "../controllers/root.controller.js";

const router = Router();

router.get('/', getRootPage);

export default router;
