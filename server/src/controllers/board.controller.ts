import type { Request, Response, NextFunction } from "express";
import { QueryTypes } from "sequelize";
import { sequelize } from "../db/index.ts";
import { doesPostExistBySlugDisplayId, softDeletePostBySlugDisplayId } from "../services/board.service.ts";
import { buildBoardIndexViewModel, buildBoardSlugViewModel } from "../view-models/board.view-model.ts";

export async function getBoardIndex(req: Request, res: Response, next: NextFunction) {
    try {
        const viewModel = await buildBoardIndexViewModel(req);
        return res.render('board/index', viewModel);
    } catch (err) {
        return next(err); // ?�기??throw ?��? 말고 ?�러 미들?�어�??�기??�??�석
    }
}

export async function getBoardBySlug(req: Request, res: Response, next: NextFunction) {
    try {
        const slug = String(req.params.slug ?? "").trim();
        if (!slug) {
            return res.status(400).send("Invalid slug");
        }

        const viewModel = await buildBoardSlugViewModel(req, slug);
        return res.render("board/index", viewModel);
    } catch (err) {
        return next(err);
    }
}


// 실험용 x-user-id 헤더 검증 패턴 ---> 매우 위험함을 인지하고 있음!!!!
export async function deleteBoardPost(req: Request, res: Response, next: NextFunction) {
    try {
        const slug = String(req.params.slug ?? "").trim();
        const displayId = Number(req.params.displayId);
        const requestUserId = Number(req.header("x-user-id"));

        if (!slug) {
            return res.status(400).send("Invalid slug");
        }

        if (!Number.isFinite(displayId) || displayId <= 0) {
            return res.status(400).send("Invalid displayId");
        }

        if (!Number.isFinite(requestUserId) || requestUserId <= 0) {
            return res.status(400).send("Invalid requester");
        }

        const deleted = await softDeletePostBySlugDisplayId({
            slug,
            displayId,
            requestUserId,
        });

        if (deleted) {
            return res.status(204).send();
        }

        const exists = await doesPostExistBySlugDisplayId({ slug, displayId });
        if (!exists) {
            return res.status(404).send("Post not found");
        }

        return res.status(403).send("Forbidden");
    } catch (err) {
        return next(err);
    }
}

type BoardPostRow = {
    board_id: number;
    board_slug: string;
    display_id: number;
    title: string;
    username: string;
    content: string;
    created_at: Date;
    updated_at: Date | null;
};

type BoardPost = {
    board_slug: string;
    display_id: number;
    title: string;
    username: string;
    content: string;
    created_at: string;
    updated_at: string | null;
};

type NeighborRow = { display_id: number; title: string };
type Neighbor = { display_id: number; title: string } | null;

export async function getBoardShow(req: Request, res: Response, next: NextFunction) {
    try {
        const slug = String(req.params.slug ?? "").trim();
        const displayId = Number(req.params.displayId);

        if (!slug) {
            return res.status(400).send("Invalid slug");
        }

        if (!Number.isFinite(displayId) || displayId <= 0) {
            return res.status(400).send("Invalid displayId");
        }

        const postRows = await sequelize.query<BoardPostRow>(
            `
            SELECT
                b.board_id,
                b.slug AS board_slug,
                p.display_id,
                p.title,
                u.username,
                p.content,
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
            {
                type: QueryTypes.SELECT,
                replacements: { slug, displayId },
            }
        );

        const postRow = postRows[0];

        if (!postRow) {
            return res.status(404).render("errors/404", { message: "Post not found" });
        }

        const post: BoardPost = {
            board_slug: postRow.board_slug,
            display_id: Number(postRow.display_id),
            title: postRow.title,
            username: postRow.username,
            content: postRow.content,
            created_at: new Date(postRow.created_at).toISOString(),
            updated_at: postRow.updated_at ? new Date(postRow.updated_at).toISOString() : null,
        };

        const boardId = Number(postRow.board_id);

        const prevRows = await sequelize.query<NeighborRow>(
            `
            SELECT display_id, title
            FROM posts
            WHERE board_id = :boardId
              AND use_yn = true
              AND display_id < :displayId
            ORDER BY display_id DESC
            LIMIT 1
            `,
            {
                type: QueryTypes.SELECT,
                replacements: { boardId, displayId },
            }
        );
        const prevPost: Neighbor = prevRows[0]
            ? { display_id: Number(prevRows[0].display_id), title: prevRows[0].title }
            : null;

        const nextRows = await sequelize.query<NeighborRow>(
            `
            SELECT display_id, title
            FROM posts
            WHERE board_id = :boardId
              AND use_yn = true
              AND display_id > :displayId
            ORDER BY display_id ASC
            LIMIT 1
            `,
            {
                type: QueryTypes.SELECT,
                replacements: { boardId, displayId },
            }
        );
        const nextPost: Neighbor = nextRows[0]
            ? { display_id: Number(nextRows[0].display_id), title: nextRows[0].title }
            : null;

        // 1) 본문 글
        // const [rows] = await sequelize.query<BoardPost[]>(


        // 2) ?�전 글 (id < ?�재) - 가??가까운 글
        // const [prevRows] = await sequelize.query<{id:number; title:string}[]>(

        // 3) ?�음 글 (id > ?�재) - 가??가까운 글
        // const [nextRows] = await sequelize.query<{id:number; title:string}[]>(

        return res.render("board/show", {
            post,
            prevPost,
            nextPost,
            boardSlug: slug,
        });
    } catch (err) {
        next(err);
    }
}
