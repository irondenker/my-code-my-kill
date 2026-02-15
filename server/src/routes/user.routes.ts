import { Router } from "express";
import multer from "multer";
import csrf from "csurf";
import { postAvatarDelete, postAvatarUpload } from "../controllers/avatar.controller.js";
import { getProfileEditForm, getUserProfile, postProfileEdit } from "../controllers/user.controller.js";
import { requireAuthRedirect } from "../middlewares/auth.middleware.js";

/**
 * 사용자 라우터입니다.
 *
 * 포함 기능:
 * - 공개 프로필 페이지(`/@:username`)
 * - 프로필 설정 폼 및 업데이트
 * - 아바타 업로드/삭제
 *
 * 주의:
 * - 아바타 업로드는 multipart/form-data 이므로 `multer`가 먼저 요청 바디를 파싱해야 합니다.
 * - CSRF 보호는 multipart 라우트에서 순서가 중요합니다: `multer` -> `csrfProtection` -> controller
 */
const router = Router();

/**
 * 업로드는 메모리로 받고(sharp 변환 후 디스크로 저장),
 * 디스크 저장은 컨트롤러에서 수행합니다.
 */
const upload = multer({ storage: multer.memoryStorage() });
const csrfProtection = csrf();

router.get("/@:username", getUserProfile);
router.get("/setting/profile", requireAuthRedirect, getProfileEditForm);
router.get("/settings/profile", requireAuthRedirect, getProfileEditForm);
router.post("/setting/profile", requireAuthRedirect, postProfileEdit);
router.post("/settings/profile", requireAuthRedirect, postProfileEdit);

/**
 * 아바타 업로드
 * - `avatar` 필드로 파일 1개를 받습니다.
 */
router.post(
    "/users/avatar",
    requireAuthRedirect,
    upload.single("avatar"),
    csrfProtection,
    postAvatarUpload
);

/**
 * 아바타 삭제
 * - urlencoded 폼 요청이며, 전역 CSRF 미들웨어가 적용됩니다(실습 옵션에 따라 다를 수 있음).
 */
router.post("/users/avatar/delete", requireAuthRedirect, postAvatarDelete);

export default router;
