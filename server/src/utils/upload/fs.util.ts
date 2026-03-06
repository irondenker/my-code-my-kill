import fs from 'node:fs/promises';

/**
 * 파일 시스템 관련 유틸입니다.
 *
 * 목표:
 * - 컨트롤러/서비스에서 반복되는 `mkdir({ recursive: true })`, `unlink().catch()` 패턴을 표준화합니다.
 * - 업로드/삭제 처리를 best-effort로 처리할 때, 중복 코드를 줄이고 실수 가능성을 낮춥니다.
 */

/**
 * 디렉토리가 없으면 생성합니다.
 *
 * @param dirPath 생성할 디렉토리 경로
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * 파일을 best-effort로 삭제합니다.
 * (존재하지 않거나 권한 문제 등으로 실패해도 에러를 던지지 않습니다.)
 *
 * @param filePath 삭제할 파일 경로(없으면 no-op)
 */
export async function safeUnlink(filePath: string | null): Promise<void> {
  if (!filePath) {
    return;
  }
  await fs.unlink(filePath).catch(() => undefined);
}
