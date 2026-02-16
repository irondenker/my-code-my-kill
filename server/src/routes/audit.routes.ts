import { Router } from "express";
import { getAuditLogsPage } from "../controllers/audit.controller.js";
import { requireAdminRedirect } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/admin/audit-logs", requireAdminRedirect, getAuditLogsPage);

export default router;
