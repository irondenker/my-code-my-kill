import { Router } from "express";
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
 * - 아바타 업로드는 multipart/form-data 이며, `app.ts`에서 해당 경로에 한해 `multer`를 먼저 적용합니다.
 * - 그 다음 전역 CSRF 미들웨어가 동일한 방식으로 검증합니다(실습 옵션에 따라 비활성화될 수 있음).
 */
const router = Router();

router.get("/@:username", getUserProfile);
router.get("/setting/profile", requireAuthRedirect, getProfileEditForm);
router.get("/settings/profile", requireAuthRedirect, getProfileEditForm);
router.post("/setting/profile", requireAuthRedirect, postProfileEdit);
router.post("/settings/profile", requireAuthRedirect, postProfileEdit);

/**
 * 아바타 업로드
 * - `avatar` 필드로 파일 1개를 받습니다.
 */
router.post("/users/avatar", requireAuthRedirect, postAvatarUpload);

/**
 * 아바타 삭제
 * - urlencoded 폼 요청이며, 전역 CSRF 미들웨어가 적용됩니다(실습 옵션에 따라 다를 수 있음).
 */
router.post("/users/avatar/delete", requireAuthRedirect, postAvatarDelete);

export default router;
