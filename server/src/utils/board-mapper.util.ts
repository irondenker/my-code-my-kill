import path from "node:path";
import type { BoardMeta, BoardPostForShow, BoardPostOutline, BoardPostRecord, NeighborPost } from "../types/board.types.js";
import type {
    BoardMetaRow,
    BoardPostOutlineRow,
    BoardPostRecordRow,
    BoardPostShowRow,
    NeighborPostRow,
} from "../types/board-data.types.js";
import { POST_ATTACHMENT_PUBLIC_BASE_PATH, POST_IMAGE_PUBLIC_BASE_PATH } from "../constants/upload-post.constants.js";
import { buildPostMediaUrl } from "./post-media-url.util.js";

/**
 * DB 조회 결과(BoardMetaRow)를 애플리케이션 타입(BoardMeta)으로 매핑합니다.
 */
export function mapBoardMeta(row: BoardMetaRow): BoardMeta {
    return {
        boardId: Number(row.board_id),
        slug: row.slug,
        name: row.name,
        description: row.description ?? null,
        readAccess: row.read_access as BoardMeta["readAccess"],
        createAccess: row.create_access as BoardMeta["createAccess"],
    };
}

/**
 * DB 조회 결과(BoardPostOutlineRow)를 애플리케이션 타입(BoardPostOutline)으로 매핑합니다.
 */
export function mapBoardPostOutline(row: BoardPostOutlineRow): BoardPostOutline {
    return {
        boardSlug: row.board_slug,
        displayId: Number(row.display_id),
        userId: Number(row.user_id),
        title: row.title,
        author: row.author,
        createdAt: new Date(row.created_at),
    };
}

/**
 * DB 조회 결과(BoardPostRecordRow)를 애플리케이션 타입(BoardPostRecord)으로 매핑합니다.
 */
export function mapBoardPostRecord(row: BoardPostRecordRow): BoardPostRecord {
    return {
        postId: Number(row.post_id),
        boardId: Number(row.board_id),
        boardSlug: row.board_slug,
        boardName: row.board_name,
        displayId: Number(row.display_id),
        userId: Number(row.user_id),
        title: row.title,
        content: row.content,
        imageUrl: row.image_url ?? null,
        fileUrl: row.file_url ?? null,
    };
}

/**
 * DB 조회 결과(BoardPostShowRow)를 뷰 타입(BoardPostForShow)으로 매핑합니다.
 */
export function mapBoardPostForShow(row: BoardPostShowRow): BoardPostForShow {
    return {
        board_slug: row.board_slug,
        display_id: Number(row.display_id),
        title: row.title,
        username: row.username,
        content: row.content,
        image_url: buildPostMediaUrl(row.image_url, POST_IMAGE_PUBLIC_BASE_PATH),
        file_url: buildPostMediaUrl(row.file_url, POST_ATTACHMENT_PUBLIC_BASE_PATH),
        file_name: row.file_url ? path.basename(row.file_url) : null,
        created_at: new Date(row.created_at).toISOString(),
        updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
        user_id: Number(row.user_id),
        board_name: row.board_name,
        board_id: Number(row.board_id),
    };
}

/**
 * DB 이웃 게시글 행(최대 1행)을 NeighborPost로 매핑합니다.
 */
export function mapNeighborPost(row: NeighborPostRow | undefined): NeighborPost {
    return row ? { display_id: Number(row.display_id), title: row.title } : null;
}
