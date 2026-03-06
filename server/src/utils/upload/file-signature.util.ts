/**
 * 파일 시그니처(매직넘버) 기반 검증 유틸입니다.
 *
 * 용도:
 * - 업로드된 바이너리(Buffer)가 기대한 타입인지 빠르게 판별합니다.
 * - "확장자/Content-Type만 믿는" 취약점을 줄이기 위한 보조 검증으로 사용합니다.
 */

/**
 * 바이트 배열 입력 타입입니다.
 * Node `Buffer`와 브라우저/표준 `Uint8Array`를 모두 허용합니다.
 */
type ByteArray = Uint8Array | Buffer;

/**
 * 버퍼의 특정 오프셋에 기대 바이트 시퀀스가 존재하는지 검사합니다.
 *
 * @param buf 대상 버퍼
 * @param offset 시작 오프셋
 * @param bytes 기대 바이트 시퀀스
 */
function hasBytesAt(buf: ByteArray, offset: number, bytes: readonly number[]): boolean {
  if (offset < 0) return false;
  if (buf.length < offset + bytes.length) return false;
  for (let i = 0; i < bytes.length; i += 1) {
    if (buf[offset + i] !== bytes[i]) return false;
  }
  return true;
}

/**
 * JPEG 시그니처(FF D8 FF) 여부를 판정합니다.
 *
 * @param buf 대상 버퍼
 */
export function isJpegSignature(buf: ByteArray): boolean {
  // JPEG 파일 시작 시그니처
  return hasBytesAt(buf, 0, [0xff, 0xd8, 0xff]);
}

/**
 * PNG 시그니처 여부를 판정합니다.
 *
 * @param buf 대상 버퍼
 */
export function isPngSignature(buf: ByteArray): boolean {
  // PNG 파일 시작 시그니처
  return hasBytesAt(buf, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
}

/**
 * WebP(RIFF ... WEBP) 시그니처 여부를 판정합니다.
 *
 * @param buf 대상 버퍼
 */
export function isWebpSignature(buf: ByteArray): boolean {
  // RIFF 컨테이너 + WEBP 브랜드 시그니처
  return (
    hasBytesAt(buf, 0, [0x52, 0x49, 0x46, 0x46]) && hasBytesAt(buf, 8, [0x57, 0x45, 0x42, 0x50])
  );
}

/**
 * PDF("%PDF-") 시그니처 여부를 판정합니다.
 *
 * @param buf 대상 버퍼
 */
export function isPdfSignature(buf: ByteArray): boolean {
  // PDF 파일 시작 시그니처("%PDF-")
  return hasBytesAt(buf, 0, [0x25, 0x50, 0x44, 0x46, 0x2d]);
}

/**
 * ZIP("PK..") 시그니처 여부를 판정합니다.
 * local file header / end of central directory / spanned archive 패턴을 허용합니다.
 *
 * @param buf 대상 버퍼
 */
export function isZipSignature(buf: ByteArray): boolean {
  // "PK" + (로컬 헤더 / 중앙 디렉터리 종료 / 분할 아카이브) 시그니처 허용
  if (!hasBytesAt(buf, 0, [0x50, 0x4b])) return false;
  if (buf.length < 4) return false;
  const b2 = buf[2];
  const b3 = buf[3];
  return (
    (b2 === 0x03 && b3 === 0x04) || (b2 === 0x05 && b3 === 0x06) || (b2 === 0x07 && b3 === 0x08)
  );
}

/**
 * PDF로 "보이는지" 라이트 체크합니다.
 * - 시그니처("%PDF-") 확인
 * - tail 근처에 "%%EOF" 존재 여부 확인(보수적 검사)
 *
 * @param buffer 대상 버퍼
 */
export function looksLikePdf(buffer: Buffer): boolean {
  if (!isPdfSignature(buffer)) return false;
  // 라이트 sanity check: 대부분의 PDF는 파일 끝 근처에 "%%EOF"가 존재합니다.
  const tailSize = Math.min(buffer.length, 2048);
  const tail = buffer.subarray(buffer.length - tailSize);
  return tail.includes('%%EOF');
}

export type TextLooksLikeOptions = {
  /**
   * 검사에 사용할 샘플 바이트 수(앞/뒤에서 일부를 샘플링).
   */
  sampleBytes?: number;
  /**
   * 의심스러운 제어문자 비율 허용치.
   */
  maxControlCharRatio?: number;
};

/**
 * 큰 파일에서 앞/뒤 일부만 샘플링하기 위한 helper입니다.
 *
 * @param buffer 원본 버퍼
 * @param sampleBytes 샘플 크기
 */
function sliceSamples(buffer: Buffer, sampleBytes: number): Buffer[] {
  if (buffer.length <= sampleBytes) return [buffer];
  if (buffer.length <= sampleBytes * 2) return [buffer.subarray(0, sampleBytes)];
  return [buffer.subarray(0, sampleBytes), buffer.subarray(buffer.length - sampleBytes)];
}

/**
 * 텍스트에서 바이너리/깨진 인코딩을 의심할 제어문자 비율을 계산합니다.
 *
 * @param text 디코딩된 텍스트
 */
function countSuspiciousControlChars(text: string): { suspicious: number; total: number } {
  let suspicious = 0;
  let total = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    total += 1;
    // 일반적인 공백 제어문자(tab/newline/carriage return)만 허용합니다.
    if (code === 0x09 || code === 0x0a || code === 0x0d) continue;
    if (code < 0x20 || code === 0x7f) suspicious += 1;
  }
  return { suspicious, total };
}

/**
 * 버퍼가 UTF-8 텍스트로 "그럴듯한지" 검사합니다.
 * 명백한 바이너리 마커(NUL 바이트, 흔한 바이너리 시그니처)를 우선 차단한 뒤,
 * 일부 샘플을 UTF-8로 디코딩하고 제어문자 비율로 2차 판정합니다.
 *
 * @param buffer 대상 버퍼
 * @param options 샘플/비율 옵션
 * @throws 텍스트로 보기 어렵다면 Error를 던집니다.
 */
export function assertLooksLikeUtf8Text(buffer: Buffer, options: TextLooksLikeOptions = {}): void {
  const sampleBytes = options.sampleBytes ?? 64 * 1024;
  const maxControlCharRatio = options.maxControlCharRatio ?? 0.02;

  // 일부 바이너리도 UTF-8 디코딩 자체는 될 수 있으므로, 명백한 바이너리 마커를 먼저 차단합니다.
  if (buffer.includes(0x00)) {
    throw new Error('Attachment is not a valid text file (contains NUL bytes).');
  }
  if (
    isPdfSignature(buffer) ||
    isZipSignature(buffer) ||
    isJpegSignature(buffer) ||
    isPngSignature(buffer) ||
    isWebpSignature(buffer)
  ) {
    throw new Error('Attachment is not a valid text file (looks like a binary format).');
  }

  const decoder = new TextDecoder('utf-8', { fatal: true });
  const samples = sliceSamples(buffer, sampleBytes);

  let suspicious = 0;
  let total = 0;
  for (const sample of samples) {
    let decoded: string;
    try {
      decoded = decoder.decode(sample);
    } catch {
      throw new Error('Attachment is not a valid UTF-8 text file.');
    }

    const counts = countSuspiciousControlChars(decoded);
    suspicious += counts.suspicious;
    total += counts.total;
  }

  if (total > 0 && suspicious / total > maxControlCharRatio) {
    throw new Error('Attachment is not a valid text file (too many control characters).');
  }
}
