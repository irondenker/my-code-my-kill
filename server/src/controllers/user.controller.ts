import type { Request, Response } from "express";
import { findUserProfileById, findUserProfileByUsername, updateUserProfile } from "../services/profile.service.js";
import { isPublicProfileHandle, normalizeUsernameParam } from "../utils/username.util.js";
import { HttpError } from "../utils/http-error.js";

/**
 * 사용자 프로필(공개 페이지 + 설정 페이지) 컨트롤러입니다.
 *
 * 책임:
 * - 라우트 파라미터/폼 입력 정규화 및 검증
 * - 세션에 따른 노출 범위 제어(본인/관리자만 사적 정보 노출)
 * - 프로필 조회/수정은 `profile.service`로 위임
 */

/**
 * 문자열 입력을 trim하여 반환합니다.
 */
function normalizeString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

/**
 * 문자열을 trim 후 비어 있으면 null로 정규화합니다.
 */
function normalizeNullable(value: unknown): string | null {
    const trimmed = normalizeString(value);
    return trimmed ? trimmed : null;
}

/**
 * 이메일 형식을 간단히 검증합니다.
 */
function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * 전화번호 형식을 간단히 검증합니다.
 */
function isValidPhone(value: string): boolean {
    return /^[0-9+\-() ]+$/.test(value);
}

/**
 * 공개 프로필 페이지(`/@:username`)를 렌더링합니다.
 *
 * 노출 정책:
 * - 기본: 공개 필드(username/displayName/bio/profileImageUrl)
 * - 본인 또는 admin: email/phoneNumber도 노출
 */
export async function getUserProfile(req: Request, res: Response) {
    // 1) `/:username` 파라미터를 정규화하고, 공개 프로필 핸들 형식인지 확인합니다.
    const username = normalizeUsernameParam(req.params.username);
    if (!isPublicProfileHandle(username)) {
        throw new HttpError(400, "Invalid username");
    }

    // 2) 공개 프로필은 username으로 조회합니다.
    const profile = await findUserProfileByUsername(username);
    if (!profile) {
        throw new HttpError(404, "Not Found");
    }

    // 3) 사적 정보(email/phone) 노출 여부는 본인/관리자만 허용합니다.
    const viewerUserId = Number(req.session.userId);
    const isOwner = Number.isFinite(viewerUserId) && viewerUserId === profile.userId;
    const isAdmin = req.session.userRole === "admin";
    const canViewPrivate = isOwner || isAdmin;

    // 4) 뷰에 내려줄 모델은 "항상 공개되는 필드"와 "조건부 필드"로 분리합니다.
    return res.render("users/show", {
        profile: {
            username: profile.username,
            displayName: profile.displayName,
            bio: profile.bio,
            profileImageUrl: profile.profileImageUrl
                ? profile.profileImageUrl.startsWith("/")
                    ? profile.profileImageUrl
                    : `/uploads/avatars/${profile.profileImageUrl}`
                : null,
        },
        privateProfile: canViewPrivate
            ? {
                  email: profile.email,
                  phoneNumber: profile.phoneNumber,
              }
            : null,
        showOwnerActions: isOwner,
        showAdminNotice: isAdmin && !isOwner,
    });
}

/**
 * 프로필 수정 폼을 렌더링합니다.
 * 로그인하지 않은 경우 로그인 페이지로 보냅니다.
 */
export async function getProfileEditForm(req: Request, res: Response) {
    const userId = Number(req.session.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
        return res.status(401).redirect("/login");
    }

    const profile = await findUserProfileById(userId);
    if (!profile) {
        throw new HttpError(404, "Not Found");
    }

    return res.render("settings/profile", {
        formError: null,
        avatarError: null,
        profile: {
            username: profile.username,
            displayName: profile.displayName,
            email: profile.email,
            phoneNumber: profile.phoneNumber,
            bio: profile.bio,
        },
    });
}

/**
 * 프로필 수정 요청을 처리합니다.
 * 입력값 검증 후 프로필을 업데이트합니다.
 */
export async function postProfileEdit(req: Request, res: Response) {
    // 1) 로그인 사용자만 프로필 수정이 가능합니다.
    const userId = Number(req.session.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
        return res.status(401).redirect("/login");
    }

    // 2) 수정 대상은 "본인 프로필"만 허용합니다.
    const profile = await findUserProfileById(userId);
    if (!profile) {
        throw new HttpError(404, "Not Found");
    }

    // 3) 입력값을 trim/nullable로 정규화합니다.
    const displayName = normalizeNullable(req.body?.displayName);
    const email = normalizeNullable(req.body?.email);
    const phoneNumber = normalizeNullable(req.body?.phoneNumber);
    const bio = normalizeNullable(req.body?.bio);

    // 4) 필드 단위 검증 후 실패 시 기존 값 + 입력값을 그대로 폼에 바인딩하여 재표시합니다.
    if (displayName && displayName.length > 50) {
        return res.status(422).render("settings/profile", {
            formError: "Display name must be 50 characters or less.",
            avatarError: null,
            profile: { ...profile, displayName, email, phoneNumber, bio },
        });
    }

    if (email && !isValidEmail(email)) {
        return res.status(422).render("settings/profile", {
            formError: "Email format is invalid.",
            avatarError: null,
            profile: { ...profile, displayName, email, phoneNumber, bio },
        });
    }

    if (phoneNumber && (phoneNumber.length > 30 || !isValidPhone(phoneNumber))) {
        return res.status(422).render("settings/profile", {
            formError: "Phone number format is invalid.",
            avatarError: null,
            profile: { ...profile, displayName, email, phoneNumber, bio },
        });
    }

    if (bio && bio.length > 500) {
        return res.status(422).render("settings/profile", {
            formError: "Bio must be 500 characters or less.",
            avatarError: null,
            profile: { ...profile, displayName, email, phoneNumber, bio },
        });
    }

    // 5) 검증 통과 시 업데이트를 수행하고, 성공하면 공개 프로필 페이지로 이동합니다.
    const updated = await updateUserProfile({
        userId,
        displayName,
        email,
        phoneNumber,
        bio,
    });

    if (!updated) {
        throw new HttpError(404, "Not Found");
    }

    return res.redirect(`/@${profile.username}`);
}
