import path from "node:path";
import { QueryTypes } from "sequelize";
import { sequelize } from "../db/index.js";
import { getLabOptions } from "../config/lab-options.js";
import { buildPostFileUrl, buildPostImageUrl } from "../utils/post-media-url.util.js";
import type { BoardPostForShow, NeighborPost } from "../types/board.types.js";

/**
 * 보드 "조회 전용" DB 쿼리를 제공하는 서비스입니다.
 *
 * 목적:
 * - 컨트롤러에서 raw SQL/Sequelize 의존을 제거하고, HTTP 흐름만 남깁니다.
 * - 게시글 상세 페이지에서 필요한 join/neighbor 조회를 캡슐화합니다.
 *
 * 주의:
 * - SQLi 실습 옵션이 켜진 경우 일부 쿼리는 의도적으로 취약한 형태로 동작할 수 있습니다.
 */

const sqlInjectionOptions = getLabOptions().sqlInjection;

/**
 * 게시글 상세 조회 쿼리의 원시 결과 타입입니다(DB 컬럼 스네이크 케이스 기준).
 */
type BoardPostRowForShow = {
    board_id: number;
    board_name: string;
    board_slug: string;
    display_id: number; // (board 내 증가값) 
    user_id: number; // (작성자 ID)
    title: string;
    username: string;
    content: string;
    image_url: string | null;
    file_url: string | null;
    created_at: Date;
    updated_at: Date | null;
};

export type { BoardPostForShow, NeighborPost } from "../types/board.types.js";

/**
 * DB 조회 결과(BoardPostRowForShow)를 뷰에서 사용하는 타입(BoardPostForShow)으로 매핑합니다.
 *
 * @param row DB 행
 */
function mapBoardPostForShow(row: BoardPostRowForShow): BoardPostForShow {
    return {
        board_slug: row.board_slug,
        display_id: Number(row.display_id),
        title: row.title,
        username: row.username,
        content: row.content,
        image_url: buildPostImageUrl(row.image_url),
        file_url: buildPostFileUrl(row.file_url),
        file_name: row.file_url ? path.basename(row.file_url) : null,
        created_at: new Date(row.created_at).toISOString(),
        updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
        user_id: Number(row.user_id),
        board_name: row.board_name,
        board_id: Number(row.board_id),
    };
}

/**
 * 게시글 상세 화면에서 필요한 데이터를 조회합니다.
 *
 * @param params slug/displayId
 * @returns 게시글 + boardId
 */
export async function findBoardPostForShowBySlugDisplayId(params: {
    slug: string;
    displayId: number;
}): Promise<BoardPostForShow | null> {
    const { slug, displayId } = params;

    if (sqlInjectionOptions.enabled && sqlInjectionOptions.targets.postLookup) {
        const rows = await sequelize.query<BoardPostRowForShow>(
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
        if (!row) {
            return null;
        }

        return mapBoardPostForShow(row);
    }

    const rows = await sequelize.query<BoardPostRowForShow>(
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
        WHERE b.slug = :slug
          AND p.display_id = :displayId
          AND p.use_yn = true
        LIMIT 1
        `,
        { type: QueryTypes.SELECT, replacements: { slug, displayId } }
    );

    const row = rows[0];
    if (!row) {
        return null;
    }

    return mapBoardPostForShow(row);
}

/**
 * 게시글 상세 화면에서 이전/다음 게시글 링크를 조회합니다.
 *
 * @param params boardId/displayId + (옵션) viewerUserId 제한
 */
export async function findNeighborPosts(params: {
    boardId: number;
    displayId: number;
    viewerUserId?: number;
}): Promise<{ prevPost: NeighborPost; nextPost: NeighborPost }> {
    // owner_or_admin 보드에서 일반 유저에게는 "본인 글" 기준으로만 이전/다음을 보여주기 위해
    // viewerUserId 조건을 선택적으로 붙입니다.
    const predicate = typeof params.viewerUserId === "number" ? " AND user_id = :viewerUserId" : "";
    const replacements =
        typeof params.viewerUserId === "number"
            ? { boardId: params.boardId, displayId: params.displayId, viewerUserId: params.viewerUserId }
            : { boardId: params.boardId, displayId: params.displayId };

    // prev/next는 서로 독립이므로 병렬 실행하여 응답 시간을 줄입니다.
    const [prevRows, nextRows] = await Promise.all([
        sequelize.query<{ display_id: number; title: string }>(
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
        sequelize.query<{ display_id: number; title: string }>(
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

    // 쿼리 결과(최대 1행)를 NeighborPost 타입으로 정규화합니다.
    const prevPost: NeighborPost = prevRows[0] ? { display_id: Number(prevRows[0].display_id), title: prevRows[0].title } : null;
    const nextPost: NeighborPost = nextRows[0] ? { display_id: Number(nextRows[0].display_id), title: nextRows[0].title } : null;

    return { prevPost, nextPost };
}
