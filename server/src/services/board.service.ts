/**
 * 보드(게시판) 서비스 facade(배럴) 파일입니다.
 *
 * 목적:
 * - 기존 import 경로(`../services/board.service.js`)를 유지하면서,
 *   내부 구현은 책임 단위 + 모드별(normal/lab)로 분리된 모듈로 위임합니다.
 */

// Types
export type {
    BoardReadAccess,
    BoardCreateAccess,
    BoardMeta,
    ArticleRecord,
} from "../types/board.types.js";

// Board management (boards)
export {
    listBoards,
    findBoardBySlug,
    findBoardById,
} from "./board/board-management.service.js";

// Article read (articles: count/list/find/exists)
export {
    countBoardArticles,
    countBoardArticlesBySlug,
    listBoardArticleOutlines,
    listBoardArticleOutlinesBySlug,
    findArticleBySlugDisplayId,
    doesArticleExistBySlugDisplayId,
} from "./board/article-read.service.js";

// Article write (articles: create/update/delete)
export {
    createBoardArticle,
    updateBoardArticle,
    softDeleteArticleBySlugDisplayIdAsAdmin,
    softDeleteArticleBySlugDisplayId,
} from "./board/article-write.service.js";

// Article show (view model data: article detail + neighbors)
export {
    findBoardArticleForShowBySlugDisplayId,
    findNeighborArticles,
} from "./board/article-show.service.js";

// Article upload (filesystem)
export {
    storeArticleImage,
    storeArticleAttachment,
    deleteStoredArticleImage,
    deleteStoredArticleAttachment,
} from "./board/article-upload.service.js";
