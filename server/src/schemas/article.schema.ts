import { z } from "zod";

/**
 * 게시글 작성/수정 폼 입력 스키마.
 * (필수/길이 검증은 기존 article-form 유틸의 정책을 유지)
 */
export const articleFormSchema = z.object({
    title: z.preprocess((value) => String(value ?? "").trim(), z.string()),
    content: z.preprocess((value) => String(value ?? "").trim(), z.string()),
});

export function parseArticleForm(input: unknown) {
    return articleFormSchema.safeParse(input);
}
