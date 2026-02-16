/**
 * 프로필 서비스 facade(배럴) 파일입니다.
 *
 * 목적:
 * - 컨트롤러 import 경로를 단순화(`../services/profile.service.js`)합니다.
 * - 실제 구현은 `services/profile/` 하위 모드별(normal/lab) 서비스로 위임합니다.
 */

export {
    findUserProfileById,
    findPrivateProfileByUsername,
    findPublicProfileByUsername,
    updateUserProfile,
    updateUserProfileImage,
} from "./profile/profile-management.service.js";
