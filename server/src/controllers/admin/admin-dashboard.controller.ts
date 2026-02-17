import type { Request, Response } from "express";
import { QueryTypes } from "sequelize";
import { sequelize } from "../../db/index.js";

/**
 * 어드민 대시보드 화면을 렌더링합니다.
 * (기본 통계: 사용자 수/활성 게시글 수/보드 수)
 */
export async function getAdminDashboard(_req: Request, res: Response) {
    const [usersCountRows, postsCountRows, boardsCountRows] = await Promise.all([
        sequelize.query<{ total_count: string }>("SELECT COUNT(*) AS total_count FROM users", {
            type: QueryTypes.SELECT,
        }),
        sequelize.query<{ total_count: string }>("SELECT COUNT(*) AS total_count FROM posts WHERE use_yn = true", {
            type: QueryTypes.SELECT,
        }),
        sequelize.query<{ total_count: string }>("SELECT COUNT(*) AS total_count FROM boards", {
            type: QueryTypes.SELECT,
        }),
    ]);

    return res.render("admin/index", {
        stats: {
            users: Number(usersCountRows[0]?.total_count ?? 0),
            posts: Number(postsCountRows[0]?.total_count ?? 0),
            boards: Number(boardsCountRows[0]?.total_count ?? 0),
        },
    });
}
