import { QueryTypes } from "sequelize";
import { sequelize } from "../../db/index.js";
import type { PublicUserProfile, UserProfile } from "../../types/auth/auth.types.js";
import type { PublicProfileRow, UserProfileRow } from "../../types/profile/profile-data.types.js";

/**
 * 프로필 관리 정상 모드 서비스입니다.
 *
 * 정책:
 * - SQLi lab 비활성화 상태에서 사용하는 구현입니다.
 * - 모든 DB 접근은 안전한 바인딩 쿼리를 사용합니다.
 */

/**
 * userId로 사용자 프로필(사적 정보 포함)을 조회합니다.
 */
export async function findUserProfileById(userId: number): Promise<UserProfile | null> {
    const rows = await sequelize.query<UserProfileRow>(
        `
        SELECT
            user_id,
            username,
            email,
            phone_number,
            display_name,
            profile_image_url,
            bio,
            created_at
        FROM users
        WHERE user_id = :userId
        LIMIT 1
        `,
        { type: QueryTypes.SELECT, replacements: { userId } }
    );

    const row = rows[0];
    return row
        ? {
              userId: Number(row.user_id),
              username: row.username,
              email: row.email ?? null,
              phoneNumber: row.phone_number ?? null,
              displayName: row.display_name ?? null,
              profileImageUrl: row.profile_image_url ?? null,
              bio: row.bio ?? null,
              createdAt: row.created_at,
          }
        : null;
}

/**
 * username으로 사용자 프로필(사적 정보 포함)을 안전하게 조회합니다.
 */
export async function findPrivateProfileByUsername(username: string): Promise<UserProfile | null> {
    const rows = await sequelize.query<UserProfileRow>(
        `
        SELECT
            user_id,
            username,
            email,
            phone_number,
            display_name,
            profile_image_url,
            bio,
            created_at
        FROM users
        WHERE username = :username
        LIMIT 1
        `,
        { type: QueryTypes.SELECT, replacements: { username } }
    );

    const row = rows[0];
    return row
        ? {
              userId: Number(row.user_id),
              username: row.username,
              email: row.email ?? null,
              phoneNumber: row.phone_number ?? null,
              displayName: row.display_name ?? null,
              profileImageUrl: row.profile_image_url ?? null,
              bio: row.bio ?? null,
              createdAt: row.created_at,
          }
        : null;
}

/**
 * username으로 공개 프로필을 조회합니다.
 * (실제 노출 여부는 컨트롤러에서 제한합니다.)
 */
export async function findPublicProfileByUsername(username: string): Promise<PublicUserProfile | null> {
    const rows = await sequelize.query<PublicProfileRow>(
        `
        SELECT
            username,
            email,
            phone_number,
            display_name,
            profile_image_url,
            bio,
            created_at
        FROM users
        WHERE username = :username
        LIMIT 1
        `,
        { type: QueryTypes.SELECT, replacements: { username } }
    );

    const row = rows[0];
    if (!row) {
        return null;
    }

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

/**
 * 사용자 프로필을 업데이트합니다.
 */
export async function updateUserProfile(params: {
    userId: number;
    displayName: string | null;
    email: string | null;
    phoneNumber: string | null;
    bio: string | null;
}): Promise<boolean> {
    const rows = await sequelize.query<{ user_id: number }>(
        `
        UPDATE users
        SET display_name = :displayName,
            email = :email,
            phone_number = :phoneNumber,
            bio = :bio,
            updated_at = NOW()
        WHERE user_id = :userId
        RETURNING user_id
        `,
        {
            type: QueryTypes.SELECT,
            replacements: {
                userId: params.userId,
                displayName: params.displayName,
                email: params.email,
                phoneNumber: params.phoneNumber,
                bio: params.bio,
            },
        }
    );

    return rows.length > 0;
}

/**
 * 사용자 프로필 이미지 경로(파일명)를 업데이트합니다.
 */
export async function updateUserProfileImage(params: {
    userId: number;
    profileImageUrl: string | null;
}): Promise<boolean> {
    const rows = await sequelize.query<{ user_id: number }>(
        `
        UPDATE users
        SET profile_image_url = :profileImageUrl,
            updated_at = NOW()
        WHERE user_id = :userId
        RETURNING user_id
        `,
        { type: QueryTypes.SELECT, replacements: { userId: params.userId, profileImageUrl: params.profileImageUrl } }
    );

    return rows.length > 0;
}
