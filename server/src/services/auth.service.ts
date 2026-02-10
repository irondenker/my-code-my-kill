import { QueryTypes } from "sequelize";
import { sequelize } from "../db/index.js";

function parseBooleanEnv(value: string | undefined, key: string): boolean {
    if (typeof value !== "string") {
        return false;
    }

    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
        return true;
    }
    if (normalized === "false") {
        return false;
    }

    console.warn(`[CONFIG] Invalid ${key}="${value}". Using false.`);
    return false;
}

const labSqliEnabled = parseBooleanEnv(process.env.LAB_SQLI, "LAB_SQLI");

type UserRow = {
    user_id: number;
    user_role: string;
    username: string;
    password_hash: string;
    is_active: boolean;
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
    isActive: boolean;
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

export type AdminUserSummary = {
    userId: number;
    username: string;
    userRole: "admin" | "user";
    isActive: boolean;
    createdAt: Date;
};

export type AdminUserMeta = {
    userId: number;
    username: string;
    userRole: "admin" | "user";
    isActive: boolean;
};

function mapAuthUser(row: UserRow): AuthUser {
    return {
        userId: Number(row.user_id),
        userRole: row.user_role as AuthUser["userRole"],
        username: row.username,
        passwordHash: row.password_hash,
        isActive: Boolean(row.is_active),
    };
}

async function findUserByUsernameInsecureForLab(params: {
    username: string;
    passwordHash: string;
}): Promise<AuthUser | null> {
    const query = `
        SELECT
            user_id,
            user_role,
            username,
            password_hash,
            is_active
        FROM users
        WHERE username = '${params.username}'
          AND password_hash = '${params.passwordHash}'
        LIMIT 1
    `;

    const rows = await sequelize.query<UserRow>(query, {
        type: QueryTypes.SELECT,
    });

    const row = rows[0];
    return row ? mapAuthUser(row) : null;
}

export function isLabSqliEnabled(): boolean {
    return labSqliEnabled;
}

export async function findUserForLogin(params: {
    username: string;
    passwordHash: string;
}): Promise<AuthUser | null> {
    if (labSqliEnabled) {
        return findUserByUsernameInsecureForLab(params);
    }

    return findUserByUsername(params.username);
}

export async function findUserByUsername(username: string): Promise<AuthUser | null> {
    const rows = await sequelize.query<UserRow>(
        `
        SELECT
            user_id,
            user_role,
            username,
            password_hash,
            is_active
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

    return mapAuthUser(row);
}

export async function createUser(params: {
    username: string;
    passwordHash: string;
    userRole?: AuthUser["userRole"];
    isActive?: boolean;
}): Promise<AuthUserPublic> {
    const userRole = params.userRole ?? "user";
    const isActive = params.isActive ?? true;

    const rows = await sequelize.query<{
        user_id: number;
        user_role: string;
        username: string;
        is_active: boolean;
    }>(
        `
        INSERT INTO users (
            user_role,
            username,
            password_hash,
            is_active,
            created_at,
            updated_at
        )
        VALUES (
            :userRole,
            :username,
            :passwordHash,
            :isActive,
            NOW(),
            NOW()
        )
        RETURNING user_id, user_role, username, is_active
        `,
        {
            type: QueryTypes.SELECT,
            replacements: {
                userRole,
                username: params.username,
                passwordHash: params.passwordHash,
                isActive,
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
        isActive: Boolean(row.is_active),
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

export async function listUsersForAdmin(): Promise<AdminUserSummary[]> {
    const rows = await sequelize.query<{
        user_id: number;
        username: string;
        user_role: string;
        is_active: boolean;
        created_at: Date;
    }>(
        `
        SELECT
            user_id,
            username,
            user_role,
            is_active,
            created_at
        FROM users
        ORDER BY user_id ASC
        `,
        {
            type: QueryTypes.SELECT,
        }
    );

    return rows.map((row) => ({
        userId: Number(row.user_id),
        username: row.username,
        userRole: row.user_role as AdminUserSummary["userRole"],
        isActive: Boolean(row.is_active),
        createdAt: row.created_at,
    }));
}

export async function updateUserActiveStatus(params: {
    userId: number;
    isActive: boolean;
}): Promise<boolean> {
    const rows = await sequelize.query<{ user_id: number }>(
        `
        UPDATE users
        SET is_active = :isActive,
            updated_at = NOW()
        WHERE user_id = :userId
        RETURNING user_id
        `,
        {
            type: QueryTypes.SELECT,
            replacements: {
                userId: params.userId,
                isActive: params.isActive,
            },
        }
    );

    return rows.length > 0;
}

export async function findUserMetaForAdminById(userId: number): Promise<AdminUserMeta | null> {
    const rows = await sequelize.query<{
        user_id: number;
        username: string;
        user_role: string;
        is_active: boolean;
    }>(
        `
        SELECT
            user_id,
            username,
            user_role,
            is_active
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
        userRole: row.user_role as AdminUserMeta["userRole"],
        isActive: Boolean(row.is_active),
    };
}

export async function countAdminUsers(): Promise<number> {
    const rows = await sequelize.query<{ total_count: string }>(
        `
        SELECT COUNT(*) AS total_count
        FROM users
        WHERE user_role = 'admin'
        `,
        {
            type: QueryTypes.SELECT,
        }
    );

    return Number(rows[0]?.total_count ?? 0);
}

export async function updateUserRole(params: {
    userId: number;
    userRole: "admin" | "user";
}): Promise<boolean> {
    const rows = await sequelize.query<{ user_id: number }>(
        `
        UPDATE users
        SET user_role = :userRole,
            updated_at = NOW()
        WHERE user_id = :userId
        RETURNING user_id
        `,
        {
            type: QueryTypes.SELECT,
            replacements: {
                userId: params.userId,
                userRole: params.userRole,
            },
        }
    );

    return rows.length > 0;
}

export type DeleteUserForAdminResult = "deleted" | "not_found" | "has_posts";

export async function deleteUserForAdmin(userId: number): Promise<DeleteUserForAdminResult> {
    const deletedRows = await sequelize.query<{ user_id: number }>(
        `
        DELETE FROM users
        WHERE user_id = :userId
          AND NOT EXISTS (
            SELECT 1
            FROM posts
            WHERE user_id = :userId
          )
        RETURNING user_id
        `,
        {
            type: QueryTypes.SELECT,
            replacements: { userId },
        }
    );

    if (deletedRows.length > 0) {
        return "deleted";
    }

    const existingRows = await sequelize.query<{ user_id: number }>(
        `
        SELECT user_id
        FROM users
        WHERE user_id = :userId
        LIMIT 1
        `,
        {
            type: QueryTypes.SELECT,
            replacements: { userId },
        }
    );

    if (existingRows.length === 0) {
        return "not_found";
    }

    return "has_posts";
}
