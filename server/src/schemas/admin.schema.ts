import { z } from "zod";
import { normalizeString } from "../utils/string.util.js";

type OpenApiObjectSchema = {
    type: "object";
    required?: string[];
    properties: Record<string, unknown>;
};

/**
 * 어드민 유저 상태 변경 폼 입력 스키마.
 */
export const adminUserStatusFormSchema = z.object({
    status: z.preprocess((value) => normalizeString(value).toLowerCase(), z.string()),
    _csrf: z.preprocess((value) => normalizeString(value, null) ?? undefined, z.string().optional()),
});

/**
 * 어드민 유저 역할 변경 폼 입력 스키마.
 */
export const adminUserRoleFormSchema = z.object({
    role: z.preprocess((value) => normalizeString(value).toLowerCase(), z.string()),
    _csrf: z.preprocess((value) => normalizeString(value, null) ?? undefined, z.string().optional()),
});

/**
 * 어드민 보드 생성/수정 폼 입력 스키마.
 * (정책/길이/slug 유효성 검증은 기존 컨트롤러 로직을 유지)
 */
export const adminBoardFormSchema = z.object({
    slug: z.preprocess((value) => normalizeString(value).toLowerCase(), z.string()),
    name: z.preprocess((value) => normalizeString(value), z.string()),
    description: z.preprocess((value) => normalizeString(value, null), z.string().nullable()),
    readAccess: z.preprocess((value) => normalizeString(value).toLowerCase(), z.string()),
    createAccess: z.preprocess((value) => normalizeString(value).toLowerCase(), z.string()),
    _csrf: z.preprocess((value) => normalizeString(value, null) ?? undefined, z.string().optional()),
});

export const adminUserStatusRequestBodyOpenApiSchema: OpenApiObjectSchema = {
    type: "object",
    required: ["status"],
    properties: {
        status: { type: "string", enum: ["active", "inactive"] },
        _csrf: { type: "string" },
    },
};

export const adminUserRoleRequestBodyOpenApiSchema: OpenApiObjectSchema = {
    type: "object",
    required: ["role"],
    properties: {
        role: { type: "string", enum: ["user", "admin"] },
        _csrf: { type: "string" },
    },
};

export const adminBoardRequestBodyOpenApiSchema: OpenApiObjectSchema = {
    type: "object",
    required: ["slug", "name", "readAccess", "createAccess"],
    properties: {
        slug: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        readAccess: {
            type: "string",
            enum: ["public", "auth", "admin", "owner_or_admin"],
        },
        createAccess: {
            type: "string",
            enum: ["auth", "admin"],
        },
        _csrf: { type: "string" },
    },
};

export function parseAdminUserStatusForm(input: unknown) {
    return adminUserStatusFormSchema.safeParse(input);
}

export function parseAdminUserRoleForm(input: unknown) {
    return adminUserRoleFormSchema.safeParse(input);
}

export function parseAdminBoardForm(input: unknown) {
    return adminBoardFormSchema.safeParse(input);
}
