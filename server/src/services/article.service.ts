/**
 * 게시글(Article) 서비스 facade(배럴) 파일입니다.
 *
 * 목적:
 * - 컨트롤러가 게시글 도메인 기능(read/write/show/upload)을
 *   단일 import 경로로 사용할 수 있도록 노출합니다.
 */

// Types
export type {
    ArticleRecord,
    ArticleOutline,
    ArticleForShow,
    NeighborPost,
} from "../types/article.types.js";

// Article read (articles: count/list/find/exists)
export {
    countArticles,
    countArticlesBySlug,
    listArticleOutlines,
    listArticleOutlinesBySlug,
    findArticleBySlugDisplayId,
    doesArticleExistBySlugDisplayId,
} from "./article/article-read.service.js";

// Article write (articles: create/update/delete)
export {
    createBoardArticle,
    updateBoardArticle,
    softDeleteArticleBySlugDisplayIdAsAdmin,
    softDeleteArticleBySlugDisplayId,
} from "./article/article-write.service.js";

// Article show (view model data: article detail + neighbors)
export {
    findBoardArticleForShowBySlugDisplayId,
    findNeighborArticles,
} from "./article/article-show.service.js";

// Article upload (filesystem)
export {
    storeArticleImage,
    storeArticleAttachment,
    deleteStoredArticleImage,
    deleteStoredArticleAttachment,
} from "./article/article-upload.service.js";
