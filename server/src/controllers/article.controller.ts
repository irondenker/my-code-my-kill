/**
 * Article 컨트롤러 배럴 파일입니다.
 *
 * 분할 원칙:
 * - 유즈케이스(create/edit/show/delete) 단위로 컨트롤러를 분리합니다.
 * - 라우트 import 경로 호환성을 위해 기존 경로(`controllers/article.controller`)에서 재노출합니다.
 */

export { getArticleCreateForm, postArticleCreate } from './article/article-create.controller.js';
export { getArticleEditForm, postArticleEdit } from './article/article-edit.controller.js';
export { deleteArticle } from './article/article-delete.controller.js';
export { getArticleShow } from './article/article-show.controller.js';
