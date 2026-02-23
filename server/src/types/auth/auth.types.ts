import type { UserRole } from "../user/user-role.types.js";

/**
 * 로그인 실패 사유 코드입니다.
 * 감사로그(details.reason)로 저장되어 분석/필터링에 사용됩니다.
 */
export type LoginFailedReason =
    | "missing_credentials"
    | "invalid_credentials"
    | "inactive_account"
    | "password_reset_required"
    | "account_locked"
    | "captcha_failed";

export type AuthUserSecurityState = {
    loginFailedCount: number;
    loginLockedUntil: Date | null;
    passwordResetRequired: boolean;
    passwordResetTokenHash: string | null;
    passwordResetTokenExpiresAt: Date | null;
    passwordResetRequestedAt: Date | null;
    passwordResetUsedAt: Date | null;
};

/**
 * 인증/인가에 사용하는 사용자 엔티티(민감 정보 포함)입니다.
 * 주로 로그인 검증/세션 구성에 사용됩니다.
 */
export type AuthUser = {
    userId: number;
    userRole: UserRole;
    username: string;
    passwordHash: string;
    isActive: boolean;
} & AuthUserSecurityState;

/**
 * 외부로 노출 가능한 사용자 엔티티입니다.
 * (passwordHash 제거)
 */
export type AuthUserPublic = Pick<AuthUser, "userId" | "userRole" | "username" | "isActive">;

/**
 * 사용자 프로필(사적 정보 포함)입니다.
 * 본인/관리자만 일부 필드를 볼 수 있도록 컨트롤러에서 제어합니다.
 */
export type UserProfile = {
    userId: number;
    username: string;
    email: string | null;
    phoneNumber: string | null;
    displayName: string | null;
    profileImageUrl: string | null;
    bio: string | null;
    createdAt: Date;
};

/**
 * 공개 프로필(공개 가능한 필드만)입니다.
 */
export type PublicUserProfile = Omit<UserProfile, "userId">;

/**
 * 어드민 유저 목록 화면에 사용하는 요약 정보입니다.
 */
export type AdminUserSummary = {
    userId: number;
    username: string;
    userRole: UserRole;
    isActive: boolean;
    createdAt: Date;
};

/**
 * 어드민 유저 정책 판단/변경에 필요한 최소 메타 정보입니다.
 */
export type AdminUserMeta = Omit<AdminUserSummary, "createdAt">;
