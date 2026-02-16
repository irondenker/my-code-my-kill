import { isSqlInjectionLabEnabled } from "../lab/sql-injection-control.service.js";
import * as labImplementation from "./post-read.lab.service.js";
import * as normalImplementation from "./post-read.normal.service.js";
import type { BoardPostOutline, BoardPostRecord } from "../../types/board.types.js";

/**
 * 게시글 조회/존재확인 서비스 facade입니다.
 *
 * 모드:
 * - SQLi lab 활성화: `post-read.lab.service`
 * - SQLi lab 비활성화: `post-read.normal.service`
 */

const useLabImplementation = isSqlInjectionLabEnabled();

export async function countBoardPosts(): Promise<number> {
    if (useLabImplementation) {
        return labImplementation.countBoardPosts();
    }
    return normalImplementation.countBoardPosts();
}

export async function countBoardPostsBySlug(slug: string): Promise<number> {
    if (useLabImplementation) {
        return labImplementation.countBoardPostsBySlug(slug);
    }
    return normalImplementation.countBoardPostsBySlug(slug);
}

export async function listBoardPostOutlines(params: { offset: number; limit: number }): Promise<BoardPostOutline[]> {
    if (useLabImplementation) {
        return labImplementation.listBoardPostOutlines(params);
    }
    return normalImplementation.listBoardPostOutlines(params);
}

export async function listBoardPostOutlinesBySlug(params: {
    slug: string;
    offset: number;
    limit: number;
}): Promise<BoardPostOutline[]> {
    if (useLabImplementation) {
        return labImplementation.listBoardPostOutlinesBySlug(params);
    }
    return normalImplementation.listBoardPostOutlinesBySlug(params);
}

export async function findPostBySlugDisplayId(params: {
    slug: string;
    displayId: number;
}): Promise<BoardPostRecord | null> {
    if (useLabImplementation) {
        return labImplementation.findPostBySlugDisplayId(params);
    }
    return normalImplementation.findPostBySlugDisplayId(params);
}

export async function doesPostExistBySlugDisplayId(params: { slug: string; displayId: number }): Promise<boolean> {
    if (useLabImplementation) {
        return labImplementation.doesPostExistBySlugDisplayId(params);
    }
    return normalImplementation.doesPostExistBySlugDisplayId(params);
}
