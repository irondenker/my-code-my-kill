import { QueryTypes } from "sequelize";
import { sequelize } from "../../db/index.js";
import type { PublicUserProfile, UserProfile } from "../../types/auth.types.js";
import type { PublicProfileRow, UserProfileRow } from "../../types/profile-data.types.js";

/**
 * 프로필 관리 lab 모드 서비스입니다.
 *
 * 책임:
 * - facade가 lab 경로로 라우팅한 기능을 취약 쿼리로 실행합니다.
 * - 타깃 활성 여부 판정은 facade(`profile-management.service.ts`)에서 담당합니다.
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
        WHERE username = '${username}'
        LIMIT 1
        `,
        { type: QueryTypes.SELECT }
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
        WHERE user_id = ${userId}
        LIMIT 1
        `,
        { type: QueryTypes.SELECT }
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
        WHERE username = '${username}'
        LIMIT 1
        `,
        { type: QueryTypes.SELECT }
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
        SET display_name = '${params.displayName ?? ""}',
            email = '${params.email ?? ""}',
            phone_number = '${params.phoneNumber ?? ""}',
            bio = '${params.bio ?? ""}',
            updated_at = NOW()
        WHERE user_id = ${params.userId}
        RETURNING user_id
        `,
        { type: QueryTypes.SELECT }
    );

    return rows.length > 0;
}

export async function updateUserProfileImage(params: {
    userId: number;
    profileImageUrl: string | null;
}): Promise<boolean> {
    const rows = await sequelize.query<{ user_id: number }>(
        `
        UPDATE users
        SET profile_image_url = ${params.profileImageUrl ? `'${params.profileImageUrl}'` : "NULL"},
            updated_at = NOW()
        WHERE user_id = ${params.userId}
        RETURNING user_id
        `,
        { type: QueryTypes.SELECT }
    );

    return rows.length > 0;
}
