import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openApiDocument as openApiBase } from "../docs/openapi.js";
import { openApiDocument as openApiOverrides } from "../docs/openapi.overrides.js";

const ROUTE_METHOD_PATTERN = /\brouter\.(get|post|put|patch|delete|options|head)\(\s*(['"`])([^'"`]+)\2/g;
const OPENAPI_METHODS = new Set(["get", "post", "put", "patch", "delete", "options", "head", "trace"]);

type OpenApiLike = {
    paths?: Record<string, Record<string, unknown>>;
};

function normalizeExpressPath(routePath: string): string {
    return routePath.replace(/\/:([A-Za-z0-9_]+)/g, "/{$1}");
}

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

function getDiff(params: { expected: Set<string>; actual: Set<string> }) {
    const missing = [...params.expected].filter((item) => !params.actual.has(item)).sort();
    const extras = [...params.actual].filter((item) => !params.expected.has(item)).sort();
    return { missing, extras };
}

function printDiff(documentName: string, diff: { missing: string[]; extras: string[] }) {
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
