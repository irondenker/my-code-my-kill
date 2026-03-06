import { QueryTypes } from 'sequelize';
import { sequelize } from '../../db/index.js';
import type {
  ArticleForShow,
  ArticleOutline,
  ArticleRecord,
  NeighborPost,
} from '../../types/article/article.types.js';
import type {
  ArticleOutlineRow,
  ArticleRecordRow,
  ArticleShowRow,
  NeighborPostRow,
} from '../../types/article/article-data.types.js';
import {
  mapArticleForShow,
  mapArticleOutline,
  mapArticleRecord,
  mapNeighborArticle,
} from '../../utils/article/article-mapper.util.js';

type BoardListSort = 'display_id';
type BoardListOrder = 'asc' | 'desc';

const ORDER_BY_COLUMN_MAP: Record<BoardListSort, string> = {
  display_id: 'p.display_id',
};

const ORDER_BY_DIRECTION_MAP: Record<BoardListOrder, 'ASC' | 'DESC'> = {
  asc: 'ASC',
  desc: 'DESC',
};

/**
 * 게시글 조회/존재확인 정상 모드 서비스입니다.
 *
 * 정책:
 * - SQLi lab 비활성화 상태에서 사용하는 구현입니다.
 * - 모든 DB 접근은 안전한 바인딩 쿼리를 사용합니다.
 */

/**
 * 전체 활성 게시글 수를 반환합니다.
 */
export async function countArticles(): Promise<number> {
  const rows = await sequelize.query<{ total_count: string }>(
    `
        SELECT COUNT(*) AS total_count
        FROM posts
        WHERE use_yn = true
        `,
    { type: QueryTypes.SELECT }
  );

  return Number(rows[0]?.total_count ?? 0);
}

/**
 * 특정 보드(slug)의 활성 게시글 수를 반환합니다.
 */
export async function countArticlesBySlug(slug: string, params?: { q?: string }): Promise<number> {
  const q = typeof params?.q === 'string' ? params.q : '';
  const titleFilterClause = q.length > 0 ? ' AND p.title ILIKE :qPattern' : '';
  const replacements: { slug: string; qPattern?: string } = { slug };
  if (q.length > 0) {
    replacements.qPattern = `%${q}%`;
  }

  const rows = await sequelize.query<{ total_count: string }>(
    `
        SELECT COUNT(*) AS total_count
        FROM posts p
        JOIN boards b ON p.board_id = b.board_id
        WHERE p.use_yn = true
          AND b.slug = :slug
          ${titleFilterClause}
        `,
    {
      type: QueryTypes.SELECT,
      replacements,
    }
  );

  return Number(rows[0]?.total_count ?? 0);
}

/**
 * 전체 게시글 목록(outline)을 페이지네이션 형태로 조회합니다.
 */
export async function listArticleOutlines(params: {
  offset: number;
  limit: number;
}): Promise<ArticleOutline[]> {
  const { offset, limit } = params;

  const rows = await sequelize.query<ArticleOutlineRow>(
    `
        SELECT
            b.slug AS board_slug,
            p.display_id,
            p.user_id,
            p.title,
            u.username AS author,
            p.created_at
        FROM posts p
        JOIN boards b ON p.board_id = b.board_id
        JOIN users u ON p.user_id = u.user_id
        WHERE p.use_yn = true
        ORDER BY p.display_id DESC
        LIMIT :limit
        OFFSET :offset
        `,
    { type: QueryTypes.SELECT, replacements: { limit, offset } }
  );

  return rows.map(mapArticleOutline);
}

/**
 * 특정 보드(slug)의 게시글 목록(outline)을 페이지네이션 형태로 조회합니다.
 */
export async function listArticleOutlinesBySlug(params: {
  slug: string;
  offset: number;
  limit: number;
  q?: string;
  sort?: BoardListSort;
  order?: BoardListOrder;
}): Promise<ArticleOutline[]> {
  const { slug, offset, limit } = params;
  const q = typeof params.q === 'string' ? params.q : '';
  const sort = params.sort === 'display_id' ? params.sort : 'display_id';
  const order = params.order === 'asc' ? 'asc' : 'desc';
  const orderByColumn = ORDER_BY_COLUMN_MAP[sort];
  const orderByDirection = ORDER_BY_DIRECTION_MAP[order];
  const titleFilterClause = q.length > 0 ? ' AND p.title ILIKE :qPattern' : '';
  const replacements: { slug: string; limit: number; offset: number; qPattern?: string } = {
    slug,
    limit,
    offset,
  };
  if (q.length > 0) {
    replacements.qPattern = `%${q}%`;
  }

  const rows = await sequelize.query<ArticleOutlineRow>(
    `
        SELECT
            b.slug AS board_slug,
            p.display_id,
            p.user_id,
            p.title,
            u.username AS author,
            p.created_at
        FROM posts p
        JOIN boards b ON p.board_id = b.board_id
        JOIN users u ON p.user_id = u.user_id
        WHERE p.use_yn = true
          AND b.slug = :slug
          ${titleFilterClause}
        ORDER BY ${orderByColumn} ${orderByDirection}
        LIMIT :limit
        OFFSET :offset
        `,
    { type: QueryTypes.SELECT, replacements }
  );

  return rows.map(mapArticleOutline);
}

/**
 * 보드 slug + 게시글 displayId로 게시글을 조회합니다.
 */
export async function findArticleBySlugDisplayId(params: {
  slug: string;
  displayId: number;
}): Promise<ArticleRecord | null> {
  const { slug, displayId } = params;
  const rows = await sequelize.query<ArticleRecordRow>(
    `
        SELECT
            p.post_id,
            b.board_id,
            b.slug AS board_slug,
            b.name AS board_name,
            p.display_id,
            p.user_id,
            p.title,
            p.content,
            p.image_url,
            p.file_url
        FROM posts p
        JOIN boards b ON p.board_id = b.board_id
        WHERE b.slug = :slug
          AND p.display_id = :displayId
          AND p.use_yn = true
        LIMIT 1
        `,
    { type: QueryTypes.SELECT, replacements: { slug, displayId } }
  );

  const row = rows[0];
  return row ? mapArticleRecord(row) : null;
}

/**
 * 게시글이 존재하는지 여부를 반환합니다.
 */
export async function doesArticleExistBySlugDisplayId(params: {
  slug: string;
  displayId: number;
}): Promise<boolean> {
  const { slug, displayId } = params;
  const rows = await sequelize.query<{ exists: boolean }>(
    `
        SELECT EXISTS (
            SELECT 1
            FROM posts p
            JOIN boards b ON p.board_id = b.board_id
            WHERE b.slug = :slug
              AND p.display_id = :displayId
              AND p.use_yn = true
        ) AS exists
        `,
    { type: QueryTypes.SELECT, replacements: { slug, displayId } }
  );

  return Boolean(rows[0]?.exists);
}

/**
 * 게시글 상세 화면 렌더링용 데이터를 조회합니다.
 */
export async function findArticleForShowBySlugDisplayId(params: {
  slug: string;
  displayId: number;
}): Promise<ArticleForShow | null> {
  const { slug, displayId } = params;

  const rows = await sequelize.query<ArticleShowRow>(
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
  return row ? mapArticleForShow(row) : null;
}

/**
 * 게시글 상세 화면에서 이전/다음 게시글 링크를 조회합니다.
 */
export async function findNeighborArticles(params: {
  boardId: number;
  displayId: number;
  viewerUserId?: number;
}): Promise<{ prevPost: NeighborPost; nextPost: NeighborPost }> {
  const predicate = typeof params.viewerUserId === 'number' ? ' AND user_id = :viewerUserId' : '';
  const replacements =
    typeof params.viewerUserId === 'number'
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

  const prevPost: NeighborPost = mapNeighborArticle(prevRows[0]);
  const nextPost: NeighborPost = mapNeighborArticle(nextRows[0]);

  return { prevPost, nextPost };
}
