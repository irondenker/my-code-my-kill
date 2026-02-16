import { isSqlInjectionTargetEnabled } from "../lab/sql-injection-control.service.js";
import * as labImplementation from "./post-show.lab.service.js";
import * as normalImplementation from "./post-show.normal.service.js";
import type { BoardPostForShow, NeighborPost } from "../../types/board.types.js";

/**
 * 게시글 상세/이웃 조회 서비스 facade입니다.
 *
 * 모드:
 * - 타깃별 SQLi가 활성화된 기능만 `post-show.lab.service`를 사용합니다.
 * - 그 외 기능은 `post-show.normal.service`를 사용합니다.
 */

export async function findBoardPostForShowBySlugDisplayId(params: {
    slug: string;
    displayId: number;
}): Promise<BoardPostForShow | null> {
    if (isSqlInjectionTargetEnabled("postLookup")) {
        return labImplementation.findBoardPostForShowBySlugDisplayId(params);
    }
    return normalImplementation.findBoardPostForShowBySlugDisplayId(params);
}

export async function findNeighborPosts(params: {
    boardId: number;
    displayId: number;
    viewerUserId?: number;
}): Promise<{ prevPost: NeighborPost; nextPost: NeighborPost }> {
    if (isSqlInjectionTargetEnabled("postLookup")) {
        return labImplementation.findNeighborPosts(params);
    }
    return normalImplementation.findNeighborPosts(params);
}
