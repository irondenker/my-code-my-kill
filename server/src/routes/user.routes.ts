import { Router } from "express";
import multer from "multer";
import csrf from "csurf";
import { postAvatarDelete, postAvatarUpload } from "../controllers/avatar.controller.js";
import { getProfileEditForm, getUserProfile, postProfileEdit } from "../controllers/user.controller.js";
import { requireAuthRedirect } from "../middlewares/auth.middleware.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const csrfProtection = csrf();

router.get("/@:username", getUserProfile);
router.get("/settings/profile", requireAuthRedirect, getProfileEditForm);
router.post("/settings/profile", requireAuthRedirect, postProfileEdit);
router.post(
    "/users/avatar",
    requireAuthRedirect,
    upload.single("avatar"),
    csrfProtection,
    postAvatarUpload
);
router.post("/users/avatar/delete", requireAuthRedirect, postAvatarDelete);

export default router;
