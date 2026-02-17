import fs from "node:fs/promises";
import path from "node:path";

const ROUTE_METHOD_PATTERN = /\brouter\.(get|post|put|patch|delete|options|head)\(\s*(['"`])([^'"`]+)\2/g;
const OPENAPI_METHODS = new Set(["get", "post", "put", "patch", "delete", "options", "head", "trace"]);
const METHOD_ORDER = ["get", "post", "put", "patch", "delete", "options", "head", "trace"] as const;

type OpenApiLike = {
    [key: string]: unknown;
    tags?: ReadonlyArray<{ name?: string; [key: string]: unknown }>;
    paths?: Record<string, Record<string, unknown>>;
};

type SyncResult = {
    updated: OpenApiLike;
    added: string[];
    removed: string[];
};

/** Express 스타일 파라미터(/:id)를 OpenAPI 스타일({id})로 변환한다. */
function normalizeExpressPath(routePath: string): string {
    return routePath.replace(/\/:([A-Za-z0-9_]+)/g, "/{$1}");
}

/**
 * 라우트 소스 파일에서 path/method 조합을 수집한다.
 * 실행 기준 경로는 server 루트(process.cwd())를 사용한다.
 */
async function collectRouteEndpointMap(serverRoot: string): Promise<Map<string, Set<string>>> {
    const routesDir = path.resolve(serverRoot, "src/routes");
    const filenames = (await fs.readdir(routesDir))
        .filter((filename) => filename.endsWith(".ts") || filename.endsWith(".js"))
        .sort();

    const endpointMap = new Map<string, Set<string>>();

    for (const filename of filenames) {
        const fullPath = path.join(routesDir, filename);
        const source = await fs.readFile(fullPath, "utf8");

        for (const match of source.matchAll(ROUTE_METHOD_PATTERN)) {
            const method = match[1]?.toLowerCase();
            const rawPath = match[3];
            if (!method || !rawPath) {
                continue;
            }

            const pathKey = normalizeExpressPath(rawPath);
            const methods = endpointMap.get(pathKey) ?? new Set<string>();
            methods.add(method);
            endpointMap.set(pathKey, methods);
        }
    }

    return endpointMap;
}

/** 자동 생성된 placeholder operation 기본값을 만든다. */
function createPlaceholderOperation(pathKey: string, method: string): Record<string, unknown> {
    return {
        tags: ["Auto"],
        summary: `TODO: ${method.toUpperCase()} ${pathKey}`,
        description: "자동 생성된 placeholder 명세입니다. 실제 스펙으로 교체하세요.",
        responses: {
            200: {
                description: "TODO: 응답 명세를 작성하세요.",
            },
        },
    };
}

/** placeholder를 추가한 경우 Auto 태그가 문서에 존재하도록 보장한다. */
function ensureAutoTag(document: OpenApiLike): void {
    const tags = Array.isArray(document.tags) ? [...document.tags] : [];
    const hasAutoTag = tags.some((tag) => tag?.name === "Auto");
    if (!hasAutoTag) {
        tags.push({
            name: "Auto",
            description: "라우트와 OpenAPI 동기화 시 자동 생성된 placeholder operation",
        });
    }
    document.tags = tags;
}

/** OpenAPI 문서를 route 기준으로 동기화한다. */
function syncOpenApiDocument(document: OpenApiLike, routeMap: Map<string, Set<string>>): SyncResult {
    const cloned = structuredClone(document) as OpenApiLike;
    const currentPaths = cloned.paths ?? {};
    const nextPaths: Record<string, Record<string, unknown>> = {};
    const added: string[] = [];
    const removed: string[] = [];

    const routePaths = [...routeMap.keys()].sort();
    for (const pathKey of routePaths) {
        const expectedMethods = routeMap.get(pathKey) ?? new Set<string>();
        const currentPathItem = currentPaths[pathKey] ?? {};
        const nextPathItem: Record<string, unknown> = {};

        for (const method of METHOD_ORDER) {
            if (!expectedMethods.has(method)) {
                continue;
            }

            const existingOperation = currentPathItem[method];
            if (existingOperation && typeof existingOperation === "object") {
                nextPathItem[method] = existingOperation;
                continue;
            }

            nextPathItem[method] = createPlaceholderOperation(pathKey, method);
            added.push(`${method.toUpperCase()} ${pathKey}`);
        }

        for (const methodKey of Object.keys(currentPathItem)) {
            const normalizedMethod = methodKey.toLowerCase();
            if (!OPENAPI_METHODS.has(normalizedMethod)) {
                continue;
            }
            if (!expectedMethods.has(normalizedMethod)) {
                removed.push(`${normalizedMethod.toUpperCase()} ${pathKey}`);
            }
        }

        nextPaths[pathKey] = nextPathItem;
    }

    for (const [pathKey, pathItem] of Object.entries(currentPaths)) {
        if (routeMap.has(pathKey)) {
            continue;
        }
        for (const methodKey of Object.keys(pathItem)) {
            const normalizedMethod = methodKey.toLowerCase();
            if (OPENAPI_METHODS.has(normalizedMethod)) {
                removed.push(`${normalizedMethod.toUpperCase()} ${pathKey}`);
            }
        }
    }

    cloned.paths = nextPaths;
    if (added.length > 0) {
        ensureAutoTag(cloned);
    }

    return {
        updated: cloned,
        added: added.sort(),
        removed: removed.sort(),
    };
}

function serializeOpenApiDocument(document: OpenApiLike): string {
    return `export const openApiDocument = ${JSON.stringify(document, null, 4)};\n`;
}

async function syncFile(params: { filePath: string; document: OpenApiLike; routeMap: Map<string, Set<string>> }) {
    const result = syncOpenApiDocument(params.document, params.routeMap);
    const changed = result.added.length > 0 || result.removed.length > 0;
    if (changed) {
        const nextSource = serializeOpenApiDocument(result.updated);
        await fs.writeFile(params.filePath, nextSource, "utf8");
    }

    return { changed, ...result };
}

async function main() {
    const serverRoot = process.cwd();
    const docsDir = path.resolve(serverRoot, "src/docs");
    const docPath = path.join(docsDir, "openapi.ts");

    const { openApiDocument } = await import("../docs/openapi.js");

    const routeMap = await collectRouteEndpointMap(serverRoot);

    const result = await syncFile({
        filePath: docPath,
        document: openApiDocument as unknown as OpenApiLike,
        routeMap,
    });

    const printSummary = (name: string, result: { added: string[]; removed: string[]; changed: boolean }) => {
        if (!result.changed) {
            console.log(`[openapi-sync] ${name}: no changes`);
            return;
        }

        console.log(`[openapi-sync] ${name}: updated`);
        for (const endpoint of result.added) {
            console.log(`  + ${endpoint}`);
        }
        for (const endpoint of result.removed) {
            console.log(`  - ${endpoint}`);
        }
    };

    printSummary("openapi.ts", result);
}

await main();
