import { QueryTypes } from "sequelize";
import { sequelize } from "../../db/index.js";
import type { BoardPostForShow, NeighborPost } from "../../types/board.types.js";
import type { BoardPostShowRow, NeighborPostRow } from "../../types/board-data.types.js";
import { mapBoardPostForShow, mapNeighborPost } from "../../utils/board-mapper.util.js";

/**
 * 게시글 상세/이웃 조회 lab 모드 서비스입니다.
 *
 * 책임:
 * - facade가 lab 경로로 라우팅한 기능을 취약 쿼리로 실행합니다.
 * - 타깃 활성 여부 판정은 facade(`post-show.service.ts`)에서 담당합니다.
 */

/**
 * 게시글 상세 화면에서 필요한 데이터를 조회합니다.
 * (facade에서 타깃 활성화 시에만 이 lab 구현이 호출됩니다.)
 */
export async function findBoardPostForShowBySlugDisplayId(params: {
    slug: string;
    displayId: number;
}): Promise<BoardPostForShow | null> {
    const { slug, displayId } = params;

    const rows = await sequelize.query<BoardPostShowRow>(
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
    return row ? mapBoardPostForShow(row) : null;
}

/**
 * 게시글 상세 화면에서 이전/다음 게시글 링크를 조회합니다.
 */
export async function findNeighborPosts(params: {
    boardId: number;
    displayId: number;
    viewerUserId?: number;
}): Promise<{ prevPost: NeighborPost; nextPost: NeighborPost }> {
    const predicate = typeof params.viewerUserId === "number" ? " AND user_id = :viewerUserId" : "";
    const replacements =
        typeof params.viewerUserId === "number"
            ? { boardId: params.boardId, displayId: params.displayId, viewerUserId: params.viewerUserId }
            : { boardId: params.boardId, displayId: params.displayId };

    const [prevRows, nextRows] = await Promise.all([
        sequelize.query<NeighborPostRow>(
            `
            SELECT display_id, title
            FROM posts
            WHERE board_id = :boardId
              AND use_yn = true
              AND display_id < :displayId
              ${predicate}
            ORDER BY display_id DESC
            LIMIT 1
            `,
            { type: QueryTypes.SELECT, replacements }
        ),
        sequelize.query<NeighborPostRow>(
            `
            SELECT display_id, title
            FROM posts
            WHERE board_id = :boardId
              AND use_yn = true
              AND display_id > :displayId
              ${predicate}
            ORDER BY display_id ASC
            LIMIT 1
            `,
            { type: QueryTypes.SELECT, replacements }
        ),
    ]);

    const prevPost: NeighborPost = mapNeighborPost(prevRows[0]);
    const nextPost: NeighborPost = mapNeighborPost(nextRows[0]);

    return { prevPost, nextPost };
}
