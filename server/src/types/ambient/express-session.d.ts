import "express-session";
import type { UserRole } from "../user/user-role.types.js";

declare module "express-session" {
    interface SessionData {
        userId?: number;
        userRole?: UserRole;
        username?: string;
        profileImageUrl?: string | null;
        boardFlashMessage?: string;
        adminUsersFlashMessage?: string;
        adminBoardsFlashMessage?: string;
    }
}
