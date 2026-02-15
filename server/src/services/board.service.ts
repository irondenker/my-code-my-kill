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
} from "./board/board-meta.service.js";

// Post read (posts: count/list/find/exists)
export {
    countBoardPosts,
    countBoardPostsBySlug,
    listBoardPostOutlines,
    listBoardPostOutlinesBySlug,
    findPostBySlugDisplayId,
    doesPostExistBySlugDisplayId,
} from "./board/post-read.service.js";

// Post write (posts: create/update/delete)
export {
    createBoardPost,
    updateBoardPost,
    softDeletePostBySlugDisplayIdAsAdmin,
    softDeletePostBySlugDisplayId,
} from "./board/post-write.service.js";

// Post show (view model data: post detail + neighbors)
export {
    findBoardPostForShowBySlugDisplayId,
    findNeighborPosts,
} from "./board/board-read.service.js";

// Post upload (filesystem)
export {
    storePostImage,
    storePostAttachment,
    deleteStoredPostImage,
    deleteStoredPostAttachment,
} from "./board/post-upload.service.js";
