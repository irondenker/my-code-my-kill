import { QueryTypes } from "sequelize";
import { sequelize } from "../../db/index.js";
import type { ArticleForShow, ArticleOutline, ArticleRecord, NeighborPost } from "../../types/article/article.types.js";
import type { ArticleOutlineRow, ArticleRecordRow, ArticleShowRow, NeighborPostRow } from "../../types/article/article-data.types.js";
import { mapArticleForShow, mapArticleOutline, mapArticleRecord, mapNeighborArticle } from "../../utils/article/article-mapper.util.js";

/**
 * 게시글 조회/존재확인 lab 모드 서비스입니다.
 *
 * 책임:
 * - facade가 lab 경로로 라우팅한 기능을 취약 쿼리로 실행합니다.
 * - 타깃 활성 여부 판정은 facade(`article-query.service.ts`)에서 담당합니다.
 */

/**
 * 특정 보드(slug)의 활성 게시글 수를 반환합니다.
 */
export async function countArticlesBySlug(slug: string): Promise<number> {
    const rows = await sequelize.query<{ total_count: string }>(
        `
        SELECT COUNT(*) AS total_count
        FROM posts p
        JOIN boards b ON p.board_id = b.board_id
        WHERE p.use_yn = true
          AND b.slug = '${slug}'
        `,
        { type: QueryTypes.SELECT }
    );

    return Number(rows[0]?.total_count ?? 0);
}

/**
 * 전체 게시글 목록(outline)을 페이지네이션 형태로 조회합니다.
 */
export async function listArticleOutlines(params: { offset: number; limit: number }): Promise<ArticleOutline[]> {
    const { offset, limit } = params;

    const rows = await sequelize.query<ArticleOutlineRow>(
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
        LIMIT ${limit}
        OFFSET ${offset}
        `,
        { type: QueryTypes.SELECT }
    );

    return rows.map(mapArticleOutline);
}

/**
 * 특정 보드(slug)의 게시글 목록(outline)을 페이지네이션 형태로 조회합니다.
 */
export async function listArticleOutlinesBySlug(params: {
    slug: string;
    offset: number;
    limit: number;
}): Promise<ArticleOutline[]> {
    const { slug, offset, limit } = params;

    const rows = await sequelize.query<ArticleOutlineRow>(
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
          AND b.slug = '${slug}'
        ORDER BY p.created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
        `,
        { type: QueryTypes.SELECT }
    );

    return rows.map(mapArticleOutline);
}

/**
 * 보드 slug + 게시글 displayId로 게시글을 조회합니다.
 * (facade에서 타깃 활성화 시에만 이 lab 구현이 호출됩니다.)
 */
export async function findArticleBySlugDisplayId(params: { slug: string; displayId: number }): Promise<ArticleRecord | null> {
    const { slug, displayId } = params;
    const rows = await sequelize.query<ArticleRecordRow>(
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
    return row ? mapArticleRecord(row) : null;
}

/**
 * 게시글이 존재하는지 여부를 반환합니다.
 * (삭제/권한 판정에서 404 vs 403을 구분할 때 사용)
 */
export async function doesArticleExistBySlugDisplayId(params: { slug: string; displayId: number }): Promise<boolean> {
    const { slug, displayId } = params;
    const rows = await sequelize.query<{ exists: boolean }>(
        `
        SELECT EXISTS (
            SELECT 1
            FROM posts p
            JOIN boards b ON p.board_id = b.board_id
            WHERE b.slug = '${slug}'
              AND p.display_id = ${displayId}
              AND p.use_yn = true
        ) AS exists
        `,
        { type: QueryTypes.SELECT }
    );

    return Boolean(rows[0]?.exists);
}

/**
 * 게시글 상세 화면에서 필요한 데이터를 조회합니다.
 * (facade에서 타깃 활성화 시에만 이 lab 구현이 호출됩니다.)
 */
export async function findArticleForShowBySlugDisplayId(params: {
    slug: string;
    displayId: number;
}): Promise<ArticleForShow | null> {
    const { slug, displayId } = params;

    const rows = await sequelize.query<ArticleShowRow>(
        `
        SELECT
            b.board_id,
            b.name AS board_name,
            b.slug AS board_slug,
            p.display_id,
            p.user_id,
            p.title,
            u.username,
            p.content,
            p.image_url,
            p.file_url,
            p.created_at,
            p.updated_at
        FROM posts p
        JOIN boards b ON p.board_id = b.board_id
        JOIN users u ON p.user_id = u.user_id
        WHERE b.slug = '${slug}'
          AND p.display_id = ${displayId}
          AND p.use_yn = true
        LIMIT 1
        `,
        { type: QueryTypes.SELECT }
    );

    const row = rows[0];
    return row ? mapArticleForShow(row) : null;
}

/**
 * 게시글 상세 화면에서 이전/다음 게시글 링크를 조회합니다.
 */
export async function findNeighborArticles(params: {
    boardId: number;
    displayId: number;
    viewerUserId?: number;
}): Promise<{ prevPost: NeighborPost; nextPost: NeighborPost }> {
    const predicate = typeof params.viewerUserId === "number" ? ` AND user_id = ${params.viewerUserId}` : "";

    const [prevRows, nextRows] = await Promise.all([
        sequelize.query<NeighborPostRow>(
            `
            SELECT display_id, title
            FROM posts
            WHERE board_id = ${params.boardId}
              AND use_yn = true
              AND display_id < ${params.displayId}
              ${predicate}
            ORDER BY display_id DESC
            LIMIT 1
            `,
            { type: QueryTypes.SELECT }
        ),
        sequelize.query<NeighborPostRow>(
            `
            SELECT display_id, title
            FROM posts
            WHERE board_id = ${params.boardId}
              AND use_yn = true
              AND display_id > ${params.displayId}
              ${predicate}
            ORDER BY display_id ASC
            LIMIT 1
            `,
            { type: QueryTypes.SELECT }
        ),
    ]);

    const prevPost: NeighborPost = mapNeighborArticle(prevRows[0]);
    const nextPost: NeighborPost = mapNeighborArticle(nextRows[0]);

    return { prevPost, nextPost };
}
