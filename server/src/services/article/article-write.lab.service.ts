import { QueryTypes, type Transaction } from 'sequelize';
import { sequelize } from '../../db/index.js';

/**
 * 게시글 쓰기/수정/삭제 lab 모드 서비스입니다.
 *
 * 책임:
 * - facade가 lab 경로로 라우팅한 기능을 취약 쿼리로 실행합니다.
 * - 타깃 활성 여부 판정은 facade(`article-write.service.ts`)에서 담당합니다.
 */

/**
 * 게시글을 생성합니다.
 *
 * 구현:
 * - 동일 보드 내 displayId를 트랜잭션으로 할당하여 중복을 방지합니다.
 * - INSERT는 취약 쿼리로 실행됩니다.
 */
export async function createArticle(params: {
  boardId: number;
  userId: number;
  title: string;
  content: string;
  imageUrl?: string | null;
  fileUrl?: string | null;
}): Promise<{ displayId: number }> {
  const { boardId, userId, title, content, imageUrl, fileUrl } = params;

  return sequelize.transaction(async (transaction: Transaction) => {
    // displayId는 보드 내에서 증가하는 사용자 노출용 ID입니다.
    // 카운터 테이블을 이용해 동시성에서 중복이 발생하지 않게 합니다.
    const displayRows = await sequelize.query<{ display_id: number }>(
      `
            WITH max_display AS (
                SELECT COALESCE(MAX(display_id), 0) AS max_display_id
                FROM posts
                WHERE board_id = ${boardId}
            ),
            upsert AS (
                INSERT INTO board_post_counters (board_id, next_display_id)
                SELECT ${boardId}, max_display_id + 2 FROM max_display
                ON CONFLICT (board_id) DO UPDATE
                SET next_display_id = GREATEST(
                    board_post_counters.next_display_id,
                    (SELECT max_display_id + 1 FROM max_display)
                ) + 1
                RETURNING next_display_id
            )
            SELECT next_display_id - 1 AS display_id FROM upsert
            `,
      { type: QueryTypes.SELECT, transaction }
    );

    const displayId = Number(displayRows[0]?.display_id);
    if (!Number.isFinite(displayId) || displayId <= 0) {
      throw new Error('Failed to allocate display id');
    }

    await sequelize.query(
      `
            INSERT INTO posts (
                board_id,
                display_id,
                user_id,
                title,
                content,
                image_url,
                file_url,
                created_at,
                updated_at,
                use_yn
            )
            VALUES (
                ${boardId},
                ${displayId},
                ${userId},
                '${title}',
                '${content}',
                ${imageUrl ? `'${imageUrl}'` : 'NULL'},
                ${fileUrl ? `'${fileUrl}'` : 'NULL'},
                NOW(),
                NOW(),
                true
            )
            `,
      { transaction }
    );

    return { displayId };
  });
}

/**
 * 게시글을 업데이트합니다.
 * (facade에서 타깃 활성화 시에만 이 lab 구현이 호출됩니다.)
 */
export async function updateArticle(params: {
  postId: number;
  title: string;
  content: string;
  imageUrl?: string | null;
  fileUrl?: string | null;
}): Promise<boolean> {
  const { postId, title, content, imageUrl, fileUrl } = params;

  const rows = await sequelize.query<{ post_id: number }>(
    `
        UPDATE posts
        SET title = '${title}',
            content = '${content}',
            image_url = ${imageUrl ? `'${imageUrl}'` : 'NULL'},
            file_url = ${fileUrl ? `'${fileUrl}'` : 'NULL'},
            updated_at = NOW()
        WHERE post_id = ${postId}
          AND use_yn = true
        RETURNING post_id
        `,
    { type: QueryTypes.SELECT }
  );
  return rows.length > 0;
}

/**
 * 관리자 권한으로 게시글을 soft delete(use_yn=false) 처리합니다.
 */
export async function softDeleteArticleBySlugDisplayIdAsAdmin(params: {
  slug: string;
  displayId: number;
}): Promise<boolean> {
  const { slug, displayId } = params;
  const rows = await sequelize.query<{ post_id: number }>(
    `
        WITH updated AS (
            UPDATE posts p
            SET use_yn = false,
                updated_at = NOW()
            FROM boards b
            WHERE p.board_id = b.board_id
              AND b.slug = '${slug}'
              AND p.display_id = ${displayId}
              AND p.use_yn = true
            RETURNING p.post_id
        )
        SELECT post_id FROM updated
        `,
    { type: QueryTypes.SELECT }
  );

  return rows.length > 0;
}

/**
 * 요청 사용자(requestUserId)가 작성자 또는 admin인 경우에만 게시글을 soft delete 처리합니다.
 */
export async function softDeleteArticleBySlugDisplayId(params: {
  slug: string;
  displayId: number;
  requestUserId: number;
}): Promise<boolean> {
  const { slug, displayId, requestUserId } = params;
  const rows = await sequelize.query<{ post_id: number }>(
    `
        WITH updated AS (
            UPDATE posts p
            SET use_yn = false,
                updated_at = NOW()
            FROM boards b, users u
            WHERE p.board_id = b.board_id
              AND b.slug = '${slug}'
              AND p.display_id = ${displayId}
              AND p.use_yn = true
              AND u.user_id = ${requestUserId}
              AND (u.user_role = 'admin' OR p.user_id = u.user_id)
            RETURNING p.post_id
        )
        SELECT post_id FROM updated
        `,
    { type: QueryTypes.SELECT }
  );

  return rows.length > 0;
}
