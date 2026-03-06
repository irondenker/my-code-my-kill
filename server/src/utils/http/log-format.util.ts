/**
 * 로그 포맷 유틸입니다.
 *
 * 목적:
 * - `[PREFIX] key=value ...` 형태의 단일 라인 로그를 일관된 규칙으로 생성합니다.
 * - 공백/따옴표가 포함된 문자열을 안전하게 quoting하여, 사람이 읽기 쉽고 파서도 안정적으로 처리할 수 있게 합니다.
 */

export type LogKvValue = string | number | boolean | null | undefined;
export type LogKvInput = Record<string, LogKvValue>;

export type FormatKvLineOptions = {
  /**
   * null 값을 어떤 문자열로 출력할지 결정합니다.
   * 기본값: "-"
   */
  nullValue?: string;

  /**
   * undefined 값을 어떻게 처리할지 결정합니다.
   * - "omit": 해당 key를 출력에서 제외
   * - "include": key=value 형태로 출력(value는 undefinedValue 사용)
   *
   * 기본값: "omit"
   */
  undefinedBehavior?: 'omit' | 'include';

  /**
   * undefined 값을 include 할 때 출력할 문자열입니다.
   * 기본값: "-"
   */
  undefinedValue?: string;

  /**
   * 문자열 quoting 정책입니다.
   * - "auto": 공백/따옴표/등호 등이 포함되면 JSON.stringify로 quoting
   * - "always": 모든 문자열을 JSON.stringify로 quoting
   * - "never": 문자열을 quoting하지 않음(공백이 있어도 그대로 출력)
   *
   * 기본값: "auto"
   */
  quoteStrings?: 'auto' | 'always' | 'never';
};

/**
 * 문자열을 quoting 해야 하는지 판정합니다.
 * key=value 포맷을 깨기 쉬운 문자(공백/따옴표/등호 등)가 포함되면 quoting 대상으로 취급합니다.
 *
 * @param value 문자열 값
 */
function shouldQuoteString(value: string): boolean {
  // key=value 로그에서 파싱을 깨기 쉬운 문자(공백/따옴표/등호 등)는 자동 인용 대상으로 둡니다.
  return /[\s"=]/.test(value);
}

/**
 * LogKvValue를 문자열로 변환합니다.
 * quoting/omit 정책은 `formatKvLine`에서 결정된 옵션을 따릅니다.
 *
 * @param value value
 * @param options resolved options
 */
function formatKvValue(value: LogKvValue, options: Required<FormatKvLineOptions>): string {
  if (value === null) {
    return options.nullValue;
  }
  if (value === undefined) {
    return options.undefinedValue;
  }
  if (typeof value === 'string') {
    if (options.quoteStrings === 'never') {
      return value;
    }
    if (options.quoteStrings === 'always') {
      return JSON.stringify(value);
    }
    return shouldQuoteString(value) ? JSON.stringify(value) : value;
  }
  return String(value);
}

/**
 * `[PREFIX] key=value key2=value2 ...` 형태의 단일 라인 로그를 생성합니다.
 *
 * @param prefix 라인의 prefix(예: "[AUDIT][ERROR]")
 * @param kv 출력할 key-value 객체
 * @param options 포맷 옵션
 */
export function formatKvLine(
  prefix: string,
  kv: LogKvInput,
  options: FormatKvLineOptions = {}
): string {
  const resolved: Required<FormatKvLineOptions> = {
    nullValue: options.nullValue ?? '-',
    undefinedBehavior: options.undefinedBehavior ?? 'omit',
    undefinedValue: options.undefinedValue ?? '-',
    quoteStrings: options.quoteStrings ?? 'auto',
  };

  const parts: string[] = [];
  for (const [key, value] of Object.entries(kv)) {
    if (value === undefined && resolved.undefinedBehavior === 'omit') {
      continue;
    }
    parts.push(`${key}=${formatKvValue(value, resolved)}`);
  }

  return parts.length > 0 ? `${prefix} ${parts.join(' ')}` : prefix;
}
