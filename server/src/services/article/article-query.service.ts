import { isSqlInjectionTargetEnabled } from '../lab/sql-injection-control.service.js';
import * as labImplementation from './article-query.lab.service.js';
import * as normalImplementation from './article-query.normal.service.js';
import type {
  ArticleForShow,
  ArticleOutline,
  ArticleRecord,
  NeighborPost,
} from '../../types/article/article.types.js';
import { normalizeBoardSlug } from '../../utils/board/board-slug.util.js';

type BoardListSort = 'display_id';
type BoardListOrder = 'asc' | 'desc';

/**
 * 게시글 조회/존재확인 서비스 facade입니다.
 *
 * 모드:
 * - 타깃별 SQLi가 활성화된 기능만 `article-query.lab.service`를 사용합니다.
 * - 그 외 기능은 `article-query.normal.service`를 사용합니다.
 */

/**
 * 전체 활성 게시글 수를 반환합니다.
 */
export async function countArticles(): Promise<number> {
  return normalImplementation.countArticles();
}

/**
 * 특정 보드(slug)의 활성 게시글 수를 반환합니다.
 */
export async function countArticlesBySlug(slug: string, params?: { q?: string }): Promise<number> {
  const canonicalSlug = normalizeBoardSlug(slug);
  if (isSqlInjectionTargetEnabled('articleLookup')) {
    return labImplementation.countArticlesBySlug(canonicalSlug, params);
  }
  return normalImplementation.countArticlesBySlug(canonicalSlug, params);
}

/**
 * 전체 게시글 목록(outline)을 페이지네이션으로 조회합니다.
 */
export async function listArticleOutlines(params: {
  offset: number;
  limit: number;
}): Promise<ArticleOutline[]> {
  if (isSqlInjectionTargetEnabled('articleLookup')) {
    return labImplementation.listArticleOutlines(params);
  }
  return normalImplementation.listArticleOutlines(params);
}

export async function listArticleOutlinesBySlug(params: {
  slug: string;
  offset: number;
  limit: number;
  q?: string;
  sort?: BoardListSort;
  order?: BoardListOrder;
}): Promise<ArticleOutline[]> {
  const canonicalSlug = normalizeBoardSlug(params.slug);
  const canonicalParams = { ...params, slug: canonicalSlug };
  if (isSqlInjectionTargetEnabled('articleLookup')) {
    return labImplementation.listArticleOutlinesBySlug(canonicalParams);
  }
  return normalImplementation.listArticleOutlinesBySlug(canonicalParams);
}

/**
 * 보드 slug + displayId로 게시글 상세 레코드를 조회합니다.
 */
export async function findArticleBySlugDisplayId(params: {
  slug: string;
  displayId: number;
}): Promise<ArticleRecord | null> {
  const canonicalSlug = normalizeBoardSlug(params.slug);
  const canonicalParams = { ...params, slug: canonicalSlug };
  if (isSqlInjectionTargetEnabled('articleLookup')) {
    return labImplementation.findArticleBySlugDisplayId(canonicalParams);
  }
  return normalImplementation.findArticleBySlugDisplayId(canonicalParams);
}

/**
 * 게시글 존재 여부를 반환합니다.
 * (404/403 분기 등에 사용)
 */
export async function doesArticleExistBySlugDisplayId(params: {
  slug: string;
  displayId: number;
}): Promise<boolean> {
  const canonicalSlug = normalizeBoardSlug(params.slug);
  const canonicalParams = { ...params, slug: canonicalSlug };
  if (isSqlInjectionTargetEnabled('articleLookup')) {
    return labImplementation.doesArticleExistBySlugDisplayId(canonicalParams);
  }
  return normalImplementation.doesArticleExistBySlugDisplayId(canonicalParams);
}

/**
 * 게시글 상세 화면 렌더링용 데이터를 조회합니다.
 */
export async function findArticleForShowBySlugDisplayId(params: {
  slug: string;
  displayId: number;
}): Promise<ArticleForShow | null> {
  const canonicalSlug = normalizeBoardSlug(params.slug);
  const canonicalParams = { ...params, slug: canonicalSlug };
  if (isSqlInjectionTargetEnabled('articleLookup')) {
    return labImplementation.findArticleForShowBySlugDisplayId(canonicalParams);
  }
  return normalImplementation.findArticleForShowBySlugDisplayId(canonicalParams);
}

/**
 * 게시글 상세 화면에서 이전/다음 게시글 링크를 조회합니다.
 */
export async function findNeighborArticles(params: {
  boardId: number;
  displayId: number;
  viewerUserId?: number;
}): Promise<{ prevPost: NeighborPost; nextPost: NeighborPost }> {
  if (isSqlInjectionTargetEnabled('articleLookup')) {
    return labImplementation.findNeighborArticles(params);
  }
  return normalImplementation.findNeighborArticles(params);
}
