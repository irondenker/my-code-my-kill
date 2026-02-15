import type { DefaultEscapeRuleToggleKey, EscapeRule, XssSideOptions } from "../config/lab-options.js";

/**
 * XSS escape 유틸입니다.
 *
 * 제공 기능:
 * - `lab-options.json`에서 정의한 default/custom 규칙을 합쳐 escape rule 목록을 구성합니다.
 * - rule 목록으로부터 escaper 함수를 생성합니다.
 *
 * 주의:
 * - 이 유틸은 "문자 치환" 기반의 escape만 수행합니다. HTML context별 완전한 sanitizer가 아닙니다.
 */

type DefaultEscapeRule = {
    key: DefaultEscapeRuleToggleKey;
    from: string;
    to: string;
};

const DEFAULT_ESCAPE_RULES: readonly DefaultEscapeRule[] = [
    { key: "ampersand", from: "&", to: "&amp;" },
    { key: "lessThan", from: "<", to: "&lt;" },
    { key: "greaterThan", from: ">", to: "&gt;" },
    { key: "doubleQuote", from: "\"", to: "&quot;" },
    { key: "singleQuote", from: "'", to: "&#39;" },
    { key: "backtick", from: "`", to: "&#96;" },
];

/**
 * 문자열을 정규식 패턴에 안전하게 삽입할 수 있도록 escape 합니다.
 *
 * @param input raw 문자열
 */
function escapeRegExp(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * XSS escape 규칙 목록을 구성합니다.
 *
 * 정책:
 * - default 규칙은 toggle이 켜진 것만 포함합니다.
 * - custom rule은 동일한 `from`이 있으면 default를 덮어씁니다.
 * - 긴 `from`이 먼저 매칭되도록 `from.length` 내림차순으로 정렬합니다.
 *
 * @param options lab-options의 xss 설정
 */
export function buildXssEscapeRules(options: XssSideOptions): EscapeRule[] {
    const rules: EscapeRule[] = [];
    DEFAULT_ESCAPE_RULES.forEach((rule) => {
        if (!options.defaultRuleToggles[rule.key]) {
            return;
        }
        rules.push({
            from: rule.from,
            to: rule.to,
        });
    });

    options.customRules.forEach((rule) => {
        const existingIndex = rules.findIndex((candidate) => candidate.from === rule.from);
        if (existingIndex >= 0) {
            rules.splice(existingIndex, 1);
        }
        rules.push({
            from: rule.from,
            to: rule.to,
        });
    });

    return rules.sort((left, right) => right.from.length - left.from.length);
}

/**
 * 주어진 규칙으로 XSS escape 함수(escaper)를 생성합니다.
 *
 * @param options lab-options의 xss 설정
 * @returns unknown 입력을 문자열로 변환 후 escape 처리한 결과
 */
export function createXssEscaper(options: XssSideOptions): (value: unknown) => string {
    const rules = buildXssEscapeRules(options);

    if (rules.length === 0) {
        return (value: unknown) => {
            if (value === null || typeof value === "undefined") {
                return "";
            }
            return String(value);
        };
    }

    const replacementMap = new Map(rules.map((rule) => [rule.from, rule.to]));
    const pattern = new RegExp(rules.map((rule) => escapeRegExp(rule.from)).join("|"), "g");

    return (value: unknown) => {
        if (value === null || typeof value === "undefined") {
            return "";
        }

        return String(value).replace(pattern, (matched) => {
            return replacementMap.get(matched) ?? matched;
        });
    };
}
