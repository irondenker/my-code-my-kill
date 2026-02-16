import { isSqlInjectionLabEnabled } from "../lab/sql-injection-control.service.js";
import * as labImplementation from "./profile-management.lab.service.js";
import * as normalImplementation from "./profile-management.normal.service.js";
import type { PublicUserProfile, UserProfile } from "../../types/auth.types.js";

/**
 * 프로필 관리 서비스 facade입니다.
 *
 * 모드:
 * - SQLi lab 활성화: `profile-management.lab.service`
 * - SQLi lab 비활성화: `profile-management.normal.service`
 *
 * 참고:
 * - 모드 선택은 모듈 로드 시 1회 결정됩니다.
 */

const useLabImplementation = isSqlInjectionLabEnabled();

export async function findUserProfileById(userId: number): Promise<UserProfile | null> {
    if (useLabImplementation) {
        return labImplementation.findUserProfileById(userId);
    }
    return normalImplementation.findUserProfileById(userId);
}

export async function findUserProfileByUsername(username: string): Promise<UserProfile | null> {
    if (useLabImplementation) {
        return labImplementation.findUserProfileByUsername(username);
    }
    return normalImplementation.findUserProfileByUsername(username);
}

export async function findPublicProfileByUsername(username: string): Promise<PublicUserProfile | null> {
    if (useLabImplementation) {
        return labImplementation.findPublicProfileByUsername(username);
    }
    return normalImplementation.findPublicProfileByUsername(username);
}

export async function updateUserProfile(params: {
    userId: number;
    displayName: string | null;
    email: string | null;
    phoneNumber: string | null;
    bio: string | null;
}): Promise<boolean> {
    if (useLabImplementation) {
        return labImplementation.updateUserProfile(params);
    }
    return normalImplementation.updateUserProfile(params);
}

export async function updateUserProfileImage(params: {
    userId: number;
    profileImageUrl: string | null;
}): Promise<boolean> {
    if (useLabImplementation) {
        return labImplementation.updateUserProfileImage(params);
    }
    return normalImplementation.updateUserProfileImage(params);
}
