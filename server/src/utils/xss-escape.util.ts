import type { DefaultEscapeRuleToggleKey, EscapeRule, XssSideOptions } from "../config/lab-options.js";

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

function escapeRegExp(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
