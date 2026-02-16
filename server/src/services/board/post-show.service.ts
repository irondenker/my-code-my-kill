import { isSqlInjectionLabEnabled } from "../lab/sql-injection-control.service.js";
import * as labImplementation from "./post-show.lab.service.js";
import * as normalImplementation from "./post-show.normal.service.js";
import type { BoardPostForShow, NeighborPost } from "../../types/board.types.js";

/**
 * 게시글 상세/이웃 조회 서비스 facade입니다.
 *
 * 모드:
 * - SQLi lab 활성화: `post-show.lab.service`
 * - SQLi lab 비활성화: `post-show.normal.service`
 */

const useLabImplementation = isSqlInjectionLabEnabled();

export async function findBoardPostForShowBySlugDisplayId(params: {
    slug: string;
    displayId: number;
}): Promise<BoardPostForShow | null> {
    if (useLabImplementation) {
        return labImplementation.findBoardPostForShowBySlugDisplayId(params);
    }
    return normalImplementation.findBoardPostForShowBySlugDisplayId(params);
}

export async function findNeighborPosts(params: {
    boardId: number;
    displayId: number;
    viewerUserId?: number;
}): Promise<{ prevPost: NeighborPost; nextPost: NeighborPost }> {
    if (useLabImplementation) {
        return labImplementation.findNeighborPosts(params);
    }
    return normalImplementation.findNeighborPosts(params);
}
