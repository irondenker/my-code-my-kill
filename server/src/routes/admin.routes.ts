import { Router } from "express";
import {
    getAdminBoardEditPage,
    getAdminBoardsPage,
    getAdminDashboard,
    getAdminUsersPage,
    postAdminBoardCreate,
    postAdminBoardEdit,
    postAdminUserRole,
    postAdminUserStatus,
} from "../controllers/admin.controller.js";
import { requireAdminRedirect } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/admin", requireAdminRedirect, getAdminDashboard);
router.get("/admin/users", requireAdminRedirect, getAdminUsersPage);
router.post("/admin/users/:userId/status", requireAdminRedirect, postAdminUserStatus);
router.post("/admin/users/:userId/role", requireAdminRedirect, postAdminUserRole);
router.get("/admin/boards", requireAdminRedirect, getAdminBoardsPage);
router.post("/admin/boards", requireAdminRedirect, postAdminBoardCreate);
router.get("/admin/boards/:boardId/edit", requireAdminRedirect, getAdminBoardEditPage);
router.post("/admin/boards/:boardId/edit", requireAdminRedirect, postAdminBoardEdit);

export default router;
