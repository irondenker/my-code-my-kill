/**
 * 로그인 실패 사유 코드입니다.
 * 감사로그(details.reason)로 저장되어 분석/필터링에 사용됩니다.
 */
export type LoginFailedReason = "missing_credentials" | "invalid_credentials" | "inactive_account";

/**
 * 인증/인가에 사용하는 사용자 엔티티(민감 정보 포함)입니다.
 * 주로 로그인 검증/세션 구성에 사용됩니다.
 */
export type AuthUser = {
    userId: number;
    userRole: "admin" | "user";
    username: string;
    passwordHash: string;
    isActive: boolean;
};

/**
 * 외부로 노출 가능한 사용자 엔티티입니다.
 * (passwordHash 제거)
 */
export type AuthUserPublic = Omit<AuthUser, "passwordHash">;

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
export type PublicUserProfile = {
    username: string;
    email: string | null;
    phoneNumber: string | null;
    displayName: string | null;
    profileImageUrl: string | null;
    bio: string | null;
    createdAt: Date;
};

/**
 * 어드민 유저 목록 화면에 사용하는 요약 정보입니다.
 */
export type AdminUserSummary = {
    userId: number;
    username: string;
    userRole: "admin" | "user";
    isActive: boolean;
    createdAt: Date;
};

/**
 * 어드민 유저 정책 판단/변경에 필요한 최소 메타 정보입니다.
 */
export type AdminUserMeta = {
    userId: number;
    username: string;
    userRole: "admin" | "user";
    isActive: boolean;
};
