import { Router } from "express";
import multer from "multer";
import csrf from "csurf";
import { postAvatarDelete, postAvatarUpload } from "../controllers/avatar.controller.ts";
import { getUserProfile } from "../controllers/user.controller.ts";
import { requireAuthRedirect } from "../middlewares/auth.middleware.ts";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const csrfProtection = csrf();

router.get("/@:username", getUserProfile);
router.post(
    "/users/avatar",
    requireAuthRedirect,
    upload.single("avatar"),
    csrfProtection,
    postAvatarUpload
);
router.post("/users/avatar/delete", requireAuthRedirect, postAvatarDelete);

export default router;
