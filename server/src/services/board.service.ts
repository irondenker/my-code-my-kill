import { QueryTypes } from "sequelize";
import { sequelize } from "../db/index.ts";

export async function countBoardPosts(): Promise<number> {
    const rows = await sequelize.query<{ total_count: string }>(
        `
        SELECT COUNT(*) AS total_count
        FROM posts
        WHERE use_yn = true
        `,
        { type: QueryTypes.SELECT }
    );

    return Number(rows[0]?.total_count ?? 0);
}

export async function countBoardPostsBySlug(slug: string): Promise<number> {
    const rows = await sequelize.query<{ total_count: string }>(
        `
        SELECT COUNT(*) AS total_count
        FROM posts p
        JOIN boards b ON p.board_id = b.board_id
        WHERE p.use_yn = true
          AND b.slug = :slug
        `,
        {
            type: QueryTypes.SELECT,
            replacements: { slug },
        }
    );

    return Number(rows[0]?.total_count ?? 0);
}

export async function listBoardPostOutlines(params: {
    offset: number,
    limit: number
}) {
    const { offset, limit } = params;

    const rows = await sequelize.query<{
        board_slug: string;
        display_id: number;
        title: string;
        author: string;
        created_at: Date;
    }>(
        `
        SELECT
            b.slug AS board_slug,
            p.display_id,
            p.title,
            u.username AS author,
            p.created_at
        FROM posts p
        JOIN boards b ON p.board_id = b.board_id
        JOIN users u ON p.user_id = u.user_id
        WHERE p.use_yn = true
        ORDER BY p.created_at DESC
        LIMIT :limit
        OFFSET :offset
        `,
        {
            type: QueryTypes.SELECT,
            replacements: { limit, offset },
        }
    );

    return rows.map((row) => ({
        boardSlug: row.board_slug,
        displayId: Number(row.display_id),
        title: row.title,
        author: row.author,
        createdAt: new Date(row.created_at),
    }));
}

export async function listBoardPostOutlinesBySlug(params: {
    slug: string,
    offset: number,
    limit: number
}) {
    const { slug, offset, limit } = params;

    const rows = await sequelize.query<{
        board_slug: string;
        display_id: number;
        title: string;
        author: string;
        created_at: Date;
    }>(
        `
        SELECT
            b.slug AS board_slug,
            p.display_id,
            p.title,
            u.username AS author,
            p.created_at
        FROM posts p
        JOIN boards b ON p.board_id = b.board_id
        JOIN users u ON p.user_id = u.user_id
        WHERE p.use_yn = true
          AND b.slug = :slug
        ORDER BY p.created_at DESC
        LIMIT :limit
        OFFSET :offset
        `,
        {
            type: QueryTypes.SELECT,
            replacements: { slug, limit, offset },
        }
    );

    return rows.map((row) => ({
        boardSlug: row.board_slug,
        displayId: Number(row.display_id),
        title: row.title,
        author: row.author,
        createdAt: new Date(row.created_at),
    }));
}

export async function doesPostExistBySlugDisplayId(params: {
    slug: string;
    displayId: number;
}): Promise<boolean> {
    const { slug, displayId } = params;
    const rows = await sequelize.query<{ exists: boolean }>(
        `
        SELECT EXISTS (
            SELECT 1
            FROM posts p
            JOIN boards b ON p.board_id = b.board_id
            WHERE b.slug = :slug
              AND p.display_id = :displayId
              AND p.use_yn = true
        ) AS exists
        `,
        {
            type: QueryTypes.SELECT,
            replacements: { slug, displayId },
        }
    );

    return Boolean(rows[0]?.exists);
}

export async function softDeletePostBySlugDisplayId(params: {
    slug: string;
    displayId: number;
    requestUserId: number;
}): Promise<boolean> {
    const { slug, displayId, requestUserId } = params;
    const rows = await sequelize.query<{ post_id: number }>(
        `
        WITH updated AS (
            UPDATE posts p
            SET use_yn = false,
                updated_at = NOW()
            FROM boards b, users u
            WHERE p.board_id = b.board_id
              AND b.slug = :slug
              AND p.display_id = :displayId
              AND p.use_yn = true
              AND u.user_id = :requestUserId
              AND (u.user_role = 'admin' OR p.user_id = u.user_id)
            RETURNING p.post_id
        )
        SELECT post_id FROM updated
        `,
        {
            type: QueryTypes.SELECT,
            replacements: { slug, displayId, requestUserId },
        }
    );

    return rows.length > 0;
}
