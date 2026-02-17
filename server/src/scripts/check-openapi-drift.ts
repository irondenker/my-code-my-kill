import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openApiDocument as openApiBase } from "../docs/openapi.js";
import { openApiDocument as openApiOverrides } from "../docs/openapi.overrides.js";

/**
 * 다음과 같은 router 메서드 호출을 탐지한다.
 * - router.get("/path", ...)
 * - router.post('/path', ...)
 *
 * 한계: 라우트 파일 내 "문자열 리터럴" 경로만 대상으로 한다.
 * 동적으로 생성되는 path/method는 의도적으로 범위에서 제외한다.
 */
const ROUTE_METHOD_PATTERN = /\brouter\.(get|post|put|patch|delete|options|head)\(\s*(['"`])([^'"`]+)\2/g;

/**
 * 드리프트 검증 시 비교 대상으로 삼는 OpenAPI operation 키 목록.
 * 문서에 명시된 trace operation도 허용하기 위해 "trace"를 포함한다.
 */
const OPENAPI_METHODS = new Set(["get", "post", "put", "patch", "delete", "options", "head", "trace"]);

type OpenApiLike = {
    paths?: Record<string, Record<string, unknown>>;
};

type EndpointDiff = {
    missing: string[];
    extras: string[];
};

/** Express 스타일 파라미터(/:id)를 OpenAPI 스타일({id})로 변환한다. */
function normalizeExpressPath(routePath: string): string {
    return routePath.replace(/\/:([A-Za-z0-9_]+)/g, "/{$1}");
}

/**
 * 라우트 소스 파일을 스캔해 정규화된 엔드포인트 시그니처를 수집한다.
 * 예시: "get /articles/{id}".
 */
async function collectRouteEndpoints(): Promise<Set<string>> {
    const scriptDir = path.dirname(fileURLToPath(import.meta.url));
    const routesDir = path.resolve(scriptDir, "../routes");
    const filenames = (await fs.readdir(routesDir))
        .filter((filename) => filename.endsWith(".ts") || filename.endsWith(".js"))
        .sort();

    const endpoints = new Set<string>();

    for (const filename of filenames) {
        const fullPath = path.join(routesDir, filename);
        const source = await fs.readFile(fullPath, "utf8");

        for (const match of source.matchAll(ROUTE_METHOD_PATTERN)) {
            const method = match[1]?.toLowerCase();
            const rawPath = match[3];
            if (!method || !rawPath) {
                continue;
            }
            endpoints.add(`${method} ${normalizeExpressPath(rawPath)}`);
        }
    }

    return endpoints;
}

/**
 * OpenAPI 유사 문서 구조에서 엔드포인트 시그니처를 추출한다.
 */
function collectOpenApiEndpoints(document: OpenApiLike): Set<string> {
    const endpoints = new Set<string>();
    const paths = document.paths ?? {};

    for (const [pathKey, operationMap] of Object.entries(paths)) {
        for (const methodKey of Object.keys(operationMap)) {
            const normalizedMethod = methodKey.toLowerCase();
            if (!OPENAPI_METHODS.has(normalizedMethod)) {
                continue;
            }
            endpoints.add(`${normalizedMethod} ${pathKey}`);
        }
    }

    return endpoints;
}

/**
 * 누락/초과 엔드포인트 시그니처를 계산한다.
 * - missing: 라우트에는 있지만 OpenAPI에는 없는 항목
 * - extras: OpenAPI에는 있지만 라우트에는 없는 항목
 */
function getDiff(params: { expected: Set<string>; actual: Set<string> }): EndpointDiff {
    const missing = [...params.expected].filter((item) => !params.actual.has(item)).sort();
    const extras = [...params.actual].filter((item) => !params.expected.has(item)).sort();
    return { missing, extras };
}

/** 문서별 비교 결과를 콘솔에 출력한다. */
function printDiff(documentName: string, diff: EndpointDiff): void {
    if (diff.missing.length === 0 && diff.extras.length === 0) {
        console.log(`[openapi-drift] ${documentName}: OK`);
        return;
    }

    console.error(`[openapi-drift] ${documentName}: mismatch detected`);
    if (diff.missing.length > 0) {
        console.error("  Missing in OpenAPI:");
        for (const endpoint of diff.missing) {
            console.error(`    - ${endpoint}`);
        }
    }
    if (diff.extras.length > 0) {
        console.error("  Extra in OpenAPI:");
        for (const endpoint of diff.extras) {
            console.error(`    - ${endpoint}`);
        }
    }
}

/**
 * CI/로컬 드리프트 체크 진입점.
 *
 * 동작 순서:
 * 1) 라우트와 base OpenAPI 문서를 비교
 * 2) 라우트와 override OpenAPI 문서를 비교
 * 3) 하나라도 불일치가 있으면 종료 코드를 1로 설정
 */
async function main() {
    const routeEndpoints = await collectRouteEndpoints();
    const baseOpenApiEndpoints = collectOpenApiEndpoints(openApiBase);
    const overrideOpenApiEndpoints = collectOpenApiEndpoints(openApiOverrides);

    const baseDiff = getDiff({ expected: routeEndpoints, actual: baseOpenApiEndpoints });
    const overrideDiff = getDiff({ expected: routeEndpoints, actual: overrideOpenApiEndpoints });

    printDiff("openapi.ts", baseDiff);
    printDiff("openapi.overrides.ts", overrideDiff);

    const hasDiff =
        baseDiff.missing.length > 0 ||
        baseDiff.extras.length > 0 ||
        overrideDiff.missing.length > 0 ||
        overrideDiff.extras.length > 0;

    if (hasDiff) {
        process.exitCode = 1;
        return;
    }

    console.log(`[openapi-drift] checked ${routeEndpoints.size} endpoints`);
}

await main();
