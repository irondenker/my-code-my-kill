import { Router } from "express";
import { getRootPage } from "../controllers/root.controller.js";

const router = Router();

router.get("/healthz", (_req, res) => {
    return res.status(200).type("text").send("ok");
});

router.get("/", getRootPage);

export default router;
