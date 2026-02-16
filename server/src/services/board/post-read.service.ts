import { isSqlInjectionTargetEnabled } from "../lab/sql-injection-control.service.js";
import * as labImplementation from "./post-read.lab.service.js";
import * as normalImplementation from "./post-read.normal.service.js";
import type { BoardPostOutline, BoardPostRecord } from "../../types/board.types.js";

/**
 * 게시글 조회/존재확인 서비스 facade입니다.
 *
 * 모드:
 * - 타깃별 SQLi가 활성화된 기능만 `post-read.lab.service`를 사용합니다.
 * - 그 외 기능은 `post-read.normal.service`를 사용합니다.
 */

export async function countBoardPosts(): Promise<number> {
    return normalImplementation.countBoardPosts();
}

export async function countBoardPostsBySlug(slug: string): Promise<number> {
    return normalImplementation.countBoardPostsBySlug(slug);
}

export async function listBoardPostOutlines(params: { offset: number; limit: number }): Promise<BoardPostOutline[]> {
    return normalImplementation.listBoardPostOutlines(params);
}

export async function listBoardPostOutlinesBySlug(params: {
    slug: string;
    offset: number;
    limit: number;
}): Promise<BoardPostOutline[]> {
    return normalImplementation.listBoardPostOutlinesBySlug(params);
}

export async function findPostBySlugDisplayId(params: {
    slug: string;
    displayId: number;
}): Promise<BoardPostRecord | null> {
    if (isSqlInjectionTargetEnabled("postLookup")) {
        return labImplementation.findPostBySlugDisplayId(params);
    }
    return normalImplementation.findPostBySlugDisplayId(params);
}

export async function doesPostExistBySlugDisplayId(params: { slug: string; displayId: number }): Promise<boolean> {
    return normalImplementation.doesPostExistBySlugDisplayId(params);
}
