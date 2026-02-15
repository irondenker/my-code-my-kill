/**
 * 프로필 서비스 배럴 파일입니다.
 *
 * 목적:
 * - 컨트롤러 import 경로를 단순화(`../services/profile.service.js`)합니다.
 * - 실제 구현은 `services/profile/` 하위로 이동해도 외부 API는 유지합니다.
 */

export {
    findUserProfileById,
    findUserProfileByUsername,
    findPublicProfileByUsername,
    updateUserProfile,
    updateUserProfileImage,
} from "./profile/profile-management.service.js";
