import { z } from 'zod';
import { normalizeString } from '../utils/string.util.js';

type OpenApiObjectSchema = {
  type: 'object';
  required?: string[];
  properties: Record<string, unknown>;
};

/**
 * 사용자 프로필 수정 폼 입력 스키마.
 * (길이/형식 검증은 기존 컨트롤러 로직 유지)
 */
export const profileEditFormSchema = z.object({
  displayName: z.preprocess((value) => normalizeString(value, null), z.string().nullable()),
  email: z.preprocess((value) => normalizeString(value, null), z.string().nullable()),
  phoneNumber: z.preprocess((value) => normalizeString(value, null), z.string().nullable()),
  bio: z.preprocess((value) => normalizeString(value, null), z.string().nullable()),
  _csrf: z.preprocess((value) => normalizeString(value, null) ?? undefined, z.string().optional()),
});

export const profileEditRequestBodyOpenApiSchema: OpenApiObjectSchema = {
  type: 'object',
  properties: {
    displayName: { type: 'string' },
    email: { type: 'string' },
    phoneNumber: { type: 'string' },
    bio: { type: 'string' },
    _csrf: { type: 'string' },
  },
};

export function parseProfileEditForm(input: unknown) {
  return profileEditFormSchema.safeParse(input);
}
