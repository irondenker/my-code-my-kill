/**
 * 게시글(Article) 서비스 facade(배럴) 파일입니다.
 *
 * 목적:
 * - 컨트롤러가 게시글 도메인 기능(query/write/upload)을
 *   단일 import 경로로 사용할 수 있도록 노출합니다.
 */

// Types
export type {
  ArticleRecord,
  ArticleOutline,
  ArticleForShow,
  NeighborPost,
} from '../types/article/article.types.js';

// Article query (articles: count/list/find/exists)
export {
  countArticles,
  countArticlesBySlug,
  listArticleOutlines,
  listArticleOutlinesBySlug,
  findArticleBySlugDisplayId,
  doesArticleExistBySlugDisplayId,
  findArticleForShowBySlugDisplayId,
  findNeighborArticles,
} from './article/article-query.service.js';

// Article write (articles: create/update/delete)
export {
  createArticle,
  updateArticle,
  softDeleteArticleBySlugDisplayIdAsAdmin,
  softDeleteArticleBySlugDisplayId,
  createArticleWithUploads,
  updateArticleWithUploads,
  ArticleUploadError,
} from './article/article-write.service.js';

// Article upload (filesystem)
export {
  storeArticleImage,
  storeArticleAttachment,
  deleteStoredArticleImage,
  deleteStoredArticleAttachment,
} from './article/article-upload.service.js';
