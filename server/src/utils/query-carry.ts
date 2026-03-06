import {
    PAGINATION_DEFAULT_LIMIT,
    PAGINATION_LIMIT_OPTIONS,
    PAGINATION_MAX_LIMIT,
} from "../constants/board.constants.js";
import { normalizeLimitByOptions, parsePositiveInt } from "./pagination.util.js";

export type BoardListSort = "display_id";
export type BoardListOrder = "asc" | "desc";

export type BoardListQuery = {
    q: string;
    sort: BoardListSort;
    order: BoardListOrder;
    page: number;
    limit: number;
};

export type BoardListQueryOverrides = Partial<BoardListQuery>;

const DEFAULT_SORT: BoardListSort = "display_id";
const DEFAULT_ORDER: BoardListOrder = "desc";
const MAX_SEARCH_QUERY_LENGTH = 100;

function getFirstQueryValue(value: unknown): string | undefined {
    if (typeof value === "string") {
        return value;
    }
    if (Array.isArray(value)) {
        for (let index = value.length - 1; index >= 0; index -= 1) {
            const entry = value[index];
            if (typeof entry === "string") {
                return entry;
            }
        }
        return undefined;
    }
    return undefined;
}

function normalizeSearchQuery(raw: unknown): string {
    const value = getFirstQueryValue(raw);
    if (typeof value !== "string") {
        return "";
    }
    return value.trim().slice(0, MAX_SEARCH_QUERY_LENGTH);
}

function normalizeSort(raw: unknown): BoardListSort {
    const value = getFirstQueryValue(raw);
    if (value === "display_id") {
        return "display_id";
    }
    return DEFAULT_SORT;
}

function normalizeOrder(raw: unknown): BoardListOrder {
    const value = getFirstQueryValue(raw);
    if (typeof value === "string" && value.toLowerCase() === "asc") {
        return "asc";
    }
    if (typeof value === "string" && value.toLowerCase() === "desc") {
        return "desc";
    }
    return DEFAULT_ORDER;
}

function normalizePage(raw: unknown): number {
    return parsePositiveInt(raw, 1);
}

function normalizeLimit(raw: unknown): number {
    return normalizeLimitByOptions({
        rawValue: raw,
        defaultLimit: PAGINATION_DEFAULT_LIMIT,
        maxLimit: PAGINATION_MAX_LIMIT,
        allowedOptions: PAGINATION_LIMIT_OPTIONS,
    });
}

function toQueryRecord(rawQuery: unknown): Record<string, unknown> {
    if (!rawQuery || typeof rawQuery !== "object" || Array.isArray(rawQuery)) {
        return {};
    }
    return rawQuery as Record<string, unknown>;
}

export function normalizeBoardListQuery(rawQuery: unknown): BoardListQuery {
    const query = toQueryRecord(rawQuery);
    return {
        q: normalizeSearchQuery(query.q),
        sort: normalizeSort(query.sort),
        order: normalizeOrder(query.order),
        page: normalizePage(query.page),
        limit: normalizeLimit(query.limit),
    };
}

export function buildBoardListQueryCarry(current: BoardListQuery, overrides: BoardListQueryOverrides = {}): string {
    const mergedRaw: Record<string, unknown> = {
        q: current.q,
        sort: current.sort,
        order: current.order,
        page: current.page,
        limit: current.limit,
        ...overrides,
    };

    if (typeof overrides.limit !== "undefined" && typeof overrides.page === "undefined") {
        mergedRaw.page = 1;
    }

    const merged = normalizeBoardListQuery(mergedRaw);
    const query = new URLSearchParams();

    if (merged.q.length > 0) {
        query.set("q", merged.q);
    }
    query.set("sort", merged.sort);
    query.set("order", merged.order);
    query.set("page", String(merged.page));
    query.set("limit", String(merged.limit));

    const queryString = query.toString();
    return queryString.length > 0 ? `?${queryString}` : "";
}
