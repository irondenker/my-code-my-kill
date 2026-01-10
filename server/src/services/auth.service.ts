import { QueryTypes } from "sequelize";
import { sequelize } from "../db/index.ts";

type UserRow = {
    user_id: number;
    user_role: string;
    username: string;
    password_hash: string;
};

type UserProfileRow = {
    user_id: number;
    username: string;
    email: string | null;
    phone_number: string | null;
    display_name: string | null;
    profile_image_url: string | null;
    bio: string | null;
    created_at: Date;
};

type PublicProfileRow = {
    username: string;
    email: string | null;
    phone_number: string | null;
    display_name: string | null;
    profile_image_url: string | null;
    bio: string | null;
    created_at: Date;
};

export type AuthUser = {
    userId: number;
    userRole: "admin" | "user";
    username: string;
    passwordHash: string;
};

export type AuthUserPublic = Omit<AuthUser, "passwordHash">;

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

export type PublicUserProfile = {
    username: string;
    email: string | null;
    phoneNumber: string | null;
    displayName: string | null;
    profileImageUrl: string | null;
    bio: string | null;
    createdAt: Date;
};

export async function findUserByUsername(username: string): Promise<AuthUser | null> {
    const rows = await sequelize.query<UserRow>(
        `
        SELECT
            user_id,
            user_role,
            username,
            password_hash
        FROM users
        WHERE username = :username
        LIMIT 1
        `,
        {
            type: QueryTypes.SELECT,
            replacements: { username },
        }
    );

    const row = rows[0];
    if (!row) {
        return null;
    }

    return {
        userId: Number(row.user_id),
        userRole: row.user_role as AuthUser["userRole"],
        username: row.username,
        passwordHash: row.password_hash,
    };
}

export async function createUser(params: {
    username: string;
    passwordHash: string;
    userRole?: AuthUser["userRole"];
}): Promise<AuthUserPublic> {
    const userRole = params.userRole ?? "user";

    const rows = await sequelize.query<{
        user_id: number;
        user_role: string;
        username: string;
    }>(
        `
        INSERT INTO users (
            user_role,
            username,
            password_hash,
            created_at,
            updated_at
        )
        VALUES (
            :userRole,
            :username,
            :passwordHash,
            NOW(),
            NOW()
        )
        RETURNING user_id, user_role, username
        `,
        {
            type: QueryTypes.SELECT,
            replacements: {
                userRole,
                username: params.username,
                passwordHash: params.passwordHash,
            },
        }
    );

    const row = rows[0];
    if (!row) {
        throw new Error("Failed to create user");
    }

    return {
        userId: Number(row.user_id),
        userRole: row.user_role as AuthUser["userRole"],
        username: row.username,
    };
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
        WHERE user_id = :userId
        LIMIT 1
        `,
        {
            type: QueryTypes.SELECT,
            replacements: { userId },
        }
    );

    const row = rows[0];
    if (!row) {
        return null;
    }

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

export async function findUserProfileByUsername(username: string): Promise<UserProfile | null> {
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
        {
            type: QueryTypes.SELECT,
            replacements: { username },
        }
    );

    const row = rows[0];
    if (!row) {
        return null;
    }

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
        {
            type: QueryTypes.SELECT,
            replacements: { username },
        }
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
        {
            type: QueryTypes.SELECT,
            replacements: {
                userId: params.userId,
                profileImageUrl: params.profileImageUrl,
            },
        }
    );

    return rows.length > 0;
}
