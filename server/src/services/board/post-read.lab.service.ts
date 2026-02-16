import { QueryTypes } from "sequelize";
import { sequelize } from "../../db/index.js";
import type { BoardPostOutline, BoardPostRecord } from "../../types/board.types.js";
import type { BoardPostOutlineRow, BoardPostRecordRow } from "../../types/board-data.types.js";
import { mapBoardPostOutline, mapBoardPostRecord } from "../../utils/board-mapper.util.js";

/**
 * 게시글 조회/존재확인 lab 모드 서비스입니다.
 *
 * 책임:
 * - facade가 lab 경로로 라우팅한 기능을 취약 쿼리로 실행합니다.
 * - 타깃 활성 여부 판정은 facade(`post-read.service.ts`)에서 담당합니다.
 */

/**
 * 전체 활성 게시글 수를 반환합니다.
 */
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

/**
 * 특정 보드(slug)의 활성 게시글 수를 반환합니다.
 */
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

/**
 * 전체 게시글 목록(outline)을 페이지네이션 형태로 조회합니다.
 */
export async function listBoardPostOutlines(params: { offset: number; limit: number }): Promise<BoardPostOutline[]> {
    const { offset, limit } = params;

    const rows = await sequelize.query<BoardPostOutlineRow>(
        `
        SELECT
            b.slug AS board_slug,
            p.display_id,
            p.user_id,
            p.title,
            u.username AS author,
            p.created_at
        FROM posts p
        JOIN boards b ON p.board_id = b.board_id
        JOIN users u ON p.user_id = u.user_id
        WHERE p.use_yn = true
        ORDER BY p.display_id DESC
        LIMIT :limit
        OFFSET :offset
        `,
        { type: QueryTypes.SELECT, replacements: { limit, offset } }
    );

    return rows.map(mapBoardPostOutline);
}

/**
 * 특정 보드(slug)의 게시글 목록(outline)을 페이지네이션 형태로 조회합니다.
 */
export async function listBoardPostOutlinesBySlug(params: {
    slug: string;
    offset: number;
    limit: number;
}): Promise<BoardPostOutline[]> {
    const { slug, offset, limit } = params;

    const rows = await sequelize.query<BoardPostOutlineRow>(
        `
        SELECT
            b.slug AS board_slug,
            p.display_id,
            p.user_id,
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
        { type: QueryTypes.SELECT, replacements: { slug, limit, offset } }
    );

    return rows.map(mapBoardPostOutline);
}

/**
 * 보드 slug + 게시글 displayId로 게시글을 조회합니다.
 * (facade에서 타깃 활성화 시에만 이 lab 구현이 호출됩니다.)
 */
export async function findPostBySlugDisplayId(params: { slug: string; displayId: number }): Promise<BoardPostRecord | null> {
    const { slug, displayId } = params;
    const rows = await sequelize.query<BoardPostRecordRow>(
        `
        SELECT
            p.post_id,
            b.board_id,
            b.slug AS board_slug,
            b.name AS board_name,
            p.display_id,
            p.user_id,
            p.title,
            p.content,
            p.image_url,
            p.file_url
        FROM posts p
        JOIN boards b ON p.board_id = b.board_id
        WHERE b.slug = '${slug}'
          AND p.display_id = ${displayId}
          AND p.use_yn = true
        LIMIT 1
        `,
        { type: QueryTypes.SELECT }
    );

    const row = rows[0];
    return row ? mapBoardPostRecord(row) : null;
}

/**
 * 게시글이 존재하는지 여부를 반환합니다.
 * (삭제/권한 판정에서 404 vs 403을 구분할 때 사용)
 */
export async function doesPostExistBySlugDisplayId(params: { slug: string; displayId: number }): Promise<boolean> {
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
        { type: QueryTypes.SELECT, replacements: { slug, displayId } }
    );

    return Boolean(rows[0]?.exists);
}
