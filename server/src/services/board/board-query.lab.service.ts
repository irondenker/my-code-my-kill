import { QueryTypes } from 'sequelize';
import { sequelize } from '../../db/index.js';
import type { BoardMeta } from '../../types/board/board.types.js';
import type { BoardMetaRow } from '../../types/board/board-data.types.js';
import { mapBoardMeta } from '../../utils/board/board-mapper.util.js';

/**
 * 보드 메타(boards) lab 모드 서비스입니다.
 *
 * 책임:
 * - facade가 lab 경로로 라우팅한 기능을 취약 쿼리로 실행합니다.
 * - 타깃 활성 여부 판정은 facade(`board-query.service.ts`)에서 담당합니다.
 */

/**
 * slug로 보드 메타를 조회합니다.
 * (facade에서 타깃 활성화 시에만 이 lab 구현이 호출됩니다.)
 */
export async function findBoardBySlug(slug: string): Promise<BoardMeta | null> {
  const rows = await sequelize.query<BoardMetaRow>(
    `
        SELECT board_id, slug, name, description, read_access, create_access
        FROM boards
        WHERE slug = '${slug}'
        LIMIT 1
        `,
    { type: QueryTypes.SELECT }
  );

  const row = rows[0];
  return row ? mapBoardMeta(row) : null;
}

/**
 * boardId로 보드 메타를 조회합니다.
 */
export async function findBoardById(boardId: number): Promise<BoardMeta | null> {
  const rows = await sequelize.query<BoardMetaRow>(
    `
        SELECT board_id, slug, name, description, read_access, create_access
        FROM boards
        WHERE board_id = ${boardId}
        LIMIT 1
        `,
    { type: QueryTypes.SELECT }
  );

  const row = rows[0];
  return row ? mapBoardMeta(row) : null;
}
