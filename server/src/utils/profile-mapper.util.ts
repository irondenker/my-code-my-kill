import type { PublicUserProfile, UserProfile } from "../types/auth.types.js";
import type { PublicProfileRow, UserProfileRow } from "../types/profile-data.types.js";

/**
 * DB 조회 결과(UserProfileRow)를 애플리케이션 타입(UserProfile)으로 매핑합니다.
 */
export function mapUserProfile(row: UserProfileRow): UserProfile {
    return {
        userId: Number(row.user_id),
        username: row.username,
        email: row.email ?? null,
        phoneNumber: row.phone_number ?? null,
        displayName: row.display_name ?? null,
        profileImageUrl: row.profile_image_url ?? null,
        bio: row.bio ?? null,
        createdAt: row.created_at,
    };
}

/**
 * DB 조회 결과(PublicProfileRow)를 애플리케이션 타입(PublicUserProfile)으로 매핑합니다.
 */
export function mapPublicUserProfile(row: PublicProfileRow): PublicUserProfile {
    return {
        username: row.username,
        email: row.email ?? null,
        phoneNumber: row.phone_number ?? null,
        displayName: row.display_name ?? null,
        profileImageUrl: row.profile_image_url ?? null,
        bio: row.bio ?? null,
        createdAt: row.created_at,
    };
}
