/**
 * 보드(게시판) 서비스 배럴 파일입니다.
 *
 * 목적:
 * - 기존 import 경로(`../services/board.service.js`)를 유지하면서,
 *   내부 구현은 책임 단위로 분리된 모듈로 위임합니다.
 */

// Types
export type {
    BoardReadAccess,
    BoardCreateAccess,
    BoardMeta,
    BoardPostRecord,
} from "../types/board.types.js";

// Board meta (boards)
export {
    listBoards,
    findBoardBySlug,
    findBoardById,
    createBoard,
    updateBoard,
} from "./board-meta.service.js";

// Post read (posts: count/list/find/exists)
export {
    countBoardPosts,
    countBoardPostsBySlug,
    listBoardPostOutlines,
    listBoardPostOutlinesBySlug,
    findPostBySlugDisplayId,
    doesPostExistBySlugDisplayId,
} from "./post-read.service.js";

// Post write (posts: create/update/delete)
export {
    createBoardPost,
    updateBoardPost,
    softDeletePostBySlugDisplayIdAsAdmin,
    softDeletePostBySlugDisplayId,
} from "./post-write.service.js";

