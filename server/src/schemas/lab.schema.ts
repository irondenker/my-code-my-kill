import { z } from 'zod';

type OpenApiObjectSchema = {
  type: 'object';
  required?: string[];
  properties: Record<string, unknown>;
};

/**
 * SSTI 랩 입력 폼 스키마.
 */
export const sstiRenderFormSchema = z.object({
  title: z.preprocess((value) => (typeof value === 'string' ? value : ''), z.string()),
  template: z.preprocess((value) => (typeof value === 'string' ? value : ''), z.string()),
  _csrf: z.preprocess(
    (value) => (typeof value === 'string' ? value : undefined),
    z.string().optional()
  ),
});

export const sstiRenderRequestBodyOpenApiSchema: OpenApiObjectSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    template: { type: 'string' },
    _csrf: { type: 'string' },
  },
};

export function parseSstiRenderForm(input: unknown) {
  return sstiRenderFormSchema.safeParse(input);
}
