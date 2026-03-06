declare module 'ejs' {
  export type RenderOptions = Record<string, unknown>;
  export function render(
    template: string,
    data?: Record<string, unknown>,
    options?: RenderOptions
  ): string;
}
