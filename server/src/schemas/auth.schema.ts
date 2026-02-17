import { z } from "zod";
import { normalizeString } from "../utils/string.util.js";

/**
 * OpenAPI requestBody schema에서 사용하는 최소 타입입니다.
 */
type OpenApiObjectSchema = {
    type: "object";
    required: string[];
    properties: Record<string, { type: "string" }>;
};

/**
 * 로그인 폼 입력용 스키마입니다.
 *
 * 정책:
 * - username: trim 후 비어 있지 않아야 함
 * - password: 문자열이며 비어 있지 않아야 함(공백 포함 여부는 기존 로직과 동일하게 허용)
 * - next/_csrf: trim 후 빈 문자열이면 undefined로 정규화
 */
export const loginFormSchema = z.object({
    username: z.preprocess((value) => normalizeString(value), z.string().min(1)),
    password: z.preprocess((value) => (typeof value === "string" ? value : ""), z.string().min(1)),
    next: z.preprocess((value) => normalizeString(value, null) ?? undefined, z.string().optional()),
    _csrf: z.preprocess((value) => normalizeString(value, null) ?? undefined, z.string().optional()),
});

export type LoginFormInput = z.infer<typeof loginFormSchema>;

/**
 * loginFormSchema와 동일한 필드 구조를 OpenAPI requestBody로 노출할 때 사용합니다.
 * (실무에서는 zod-openapi 류 도구로 자동 생성하는 방식으로 확장 가능)
 */
export const loginRequestBodyOpenApiSchema: OpenApiObjectSchema = {
    type: "object",
    required: ["username", "password"],
    properties: {
        username: { type: "string" },
        password: { type: "string" },
        next: { type: "string" },
        _csrf: { type: "string" },
    },
};

/**
 * 로그인 폼을 안전하게 파싱/정규화합니다.
 */
export function parseLoginForm(input: unknown) {
    return loginFormSchema.safeParse(input);
}
