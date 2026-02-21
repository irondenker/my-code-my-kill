import fs from "node:fs/promises";
import path from "node:path";
import * as ts from "typescript";

const ROUTE_METHODS = new Set(["get", "post", "put", "patch", "delete"]);
const METHOD_ORDER = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

const SINK_RULES = [
    { sink: "DB: Raw Query", patterns: [/sequelize\.query\s*\(/] },
    { sink: "DB: ORM", patterns: [/\.(findOne|findAll|create|update|destroy)\s*\(/] },
    { sink: "req.session()", patterns: [/req\.session\b/, /req\.session\.regenerate\s*\(/] },
    { sink: "res.cookie()", patterns: [/res\.cookie\s*\(/] },
    { sink: "File Upload", patterns: [/multer\s*\(/, /req\.(file|files)\b/] },
    { sink: "Image Upload", patterns: [/sharp\s*\(/] },
    { sink: "fs", patterns: [/\bfs\.\w+\s*\(/] },
    { sink: "AJAX", patterns: [/\bfetch\s*\(/, /axios\./] },
    { sink: "Lab Options", patterns: [/SECURITY_LAB/i, /\bCSRF\b/i, /\bXSS\b/i] },
] as const;

const EXIT_RULES = [
    { exit: "res.render()", patterns: [/res\.render\s*\(/, /\.render\s*\(/] },
    { exit: "res.send()", patterns: [/res\.send\s*\(/, /\.send\s*\(/] },
    { exit: "JSON", patterns: [/res\.json\s*\(/, /\.json\s*\(/] },
    { exit: "res.redirect()", patterns: [/res\.redirect\s*\(/, /\.redirect\s*\(/] },
    { exit: "next(err)", patterns: [/\bnext\s*\(/] },
] as const;

type Sink = typeof SINK_RULES[number]["sink"];
type Exit = typeof EXIT_RULES[number]["exit"];
type RenderDiagnostics = {
    statuses: string[];
};

type RouteImportBinding = {
    importedName: string;
    moduleSpecifier: string;
};

type RouteEndpointCandidate = {
    method: Uppercase<string>;
    path: string;
    routeFileAbs: string;
    routeFileRel: string;
    routeMiddlewares: string[];
    handlerSymbol: string;
    handlerLocalName: string | null;
    inlineHandlerText: string | null;
};

type ResolvedDeclaration = {
    fileAbs: string;
    fileRel: string;
    line: number;
    text: string;
};

type FlowEndpoint = {
    id: string;
    method: Uppercase<string>;
    path: string;
    routeFile: string;
    middlewares: string[];
    handler: {
        name: string;
        file?: string;
        line?: number;
    };
    sinks: Sink[];
    exits: Exit[];
    redirectTargets: string[];
    renderDiagnostics: RenderDiagnostics;
    globalMiddlewares: string[];
    warnings: string[];
};

type AppFlowContext = {
    globalMiddlewares: string[];
};

type SourceCacheEntry = {
    text: string;
    sourceFile: ts.SourceFile;
};

const sourceCache = new Map<string, SourceCacheEntry>();

function toPosixPath(filePath: string): string {
    return filePath.split(path.sep).join("/");
}

function dedupePreserveOrder(values: string[]): string[] {
    const seen = new Set<string>();
    const output: string[] = [];
    for (const value of values) {
        if (seen.has(value)) {
            continue;
        }
        seen.add(value);
        output.push(value);
    }
    return output;
}

async function pathExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function listFilesRecursive(directory: string): Promise<string[]> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const collected: string[] = [];
    for (const entry of entries) {
        const absPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            const childFiles = await listFilesRecursive(absPath);
            collected.push(...childFiles);
            continue;
        }
        if (entry.isFile()) {
            collected.push(absPath);
        }
    }
    return collected.sort();
}

async function readSourceFile(fileAbs: string): Promise<SourceCacheEntry> {
    const cached = sourceCache.get(fileAbs);
    if (cached) {
        return cached;
    }
    const text = await fs.readFile(fileAbs, "utf8");
    const sourceFile = ts.createSourceFile(fileAbs, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const entry = { text, sourceFile };
    sourceCache.set(fileAbs, entry);
    return entry;
}

function sanitizeInlineLabel(raw: string): string {
    return raw.replace(/\s+/g, " ").trim();
}

function formatCallableLabel(raw: string): string {
    const label = sanitizeInlineLabel(raw);
    if (!label) {
        return label;
    }
    const inlineHandlerMatch = label.match(/^INLINE_HANDLER@(.+):(\d+)$/);
    if (inlineHandlerMatch) {
        const filePath = inlineHandlerMatch[1] ?? "";
        return `Inline Handler<br/>(${path.basename(filePath)})`;
    }
    const inlineMiddlewareMatch = label.match(/^INLINE_MIDDLEWARE@(.+):(\d+)$/);
    if (inlineMiddlewareMatch) {
        const filePath = inlineMiddlewareMatch[1] ?? "";
        const line = inlineMiddlewareMatch[2] ?? "";
        return `inlineMiddleware() @ ${path.basename(filePath)}:${line}`;
    }
    if (label.includes("->") || label.startsWith("...")) {
        return label;
    }
    if (/\)\s*$/.test(label)) {
        return label;
    }
    if (/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/.test(label)) {
        return `${label}()`;
    }
    return label;
}

function getNodeLine(sourceFile: ts.SourceFile, node: ts.Node): number {
    return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function isLiteralPath(node: ts.Expression): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
    return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

function getImportMap(sourceFile: ts.SourceFile): Map<string, RouteImportBinding> {
    const importMap = new Map<string, RouteImportBinding>();
    for (const statement of sourceFile.statements) {
        if (!ts.isImportDeclaration(statement)) {
            continue;
        }
        const moduleSpecifier = statement.moduleSpecifier;
        if (!ts.isStringLiteral(moduleSpecifier)) {
            continue;
        }
        const importClause = statement.importClause;
        if (!importClause) {
            continue;
        }
        if (importClause.name) {
            importMap.set(importClause.name.text, {
                importedName: "default",
                moduleSpecifier: moduleSpecifier.text,
            });
        }
        const namedBindings = importClause.namedBindings;
        if (!namedBindings) {
            continue;
        }
        if (ts.isNamedImports(namedBindings)) {
            for (const element of namedBindings.elements) {
                const localName = element.name.text;
                const importedName = element.propertyName?.text ?? element.name.text;
                importMap.set(localName, {
                    importedName,
                    moduleSpecifier: moduleSpecifier.text,
                });
            }
            continue;
        }
        if (ts.isNamespaceImport(namedBindings)) {
            importMap.set(namedBindings.name.text, {
                importedName: "*",
                moduleSpecifier: moduleSpecifier.text,
            });
        }
    }
    return importMap;
}

function getExpressionLabel(sourceFile: ts.SourceFile, fileRel: string, expression: ts.Expression): string {
    if (ts.isIdentifier(expression)) {
        return expression.text;
    }
    if (ts.isPropertyAccessExpression(expression)) {
        return expression.getText(sourceFile);
    }
    if (ts.isCallExpression(expression)) {
        return `${expression.expression.getText(sourceFile)}()`;
    }
    if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
        const line = getNodeLine(sourceFile, expression);
        return `INLINE_MIDDLEWARE@${fileRel}:${line}`;
    }
    return sanitizeInlineLabel(expression.getText(sourceFile));
}

type RouteExtractionResult = {
    endpoints: RouteEndpointCandidate[];
    importMapsByRouteFile: Map<string, Map<string, RouteImportBinding>>;
    warnings: string[];
};

async function extractRouteEndpoints(params: { serverRoot: string; repoRoot: string }): Promise<RouteExtractionResult> {
    const routesDir = path.resolve(params.serverRoot, "src/routes");
    const routeFiles = (await listFilesRecursive(routesDir)).filter((fileAbs) => fileAbs.endsWith(".ts"));
    const endpoints: RouteEndpointCandidate[] = [];
    const warnings: string[] = [];
    const importMapsByRouteFile = new Map<string, Map<string, RouteImportBinding>>();

    for (const routeFileAbs of routeFiles) {
        const routeFileRel = toPosixPath(path.relative(params.repoRoot, routeFileAbs));
        const { sourceFile } = await readSourceFile(routeFileAbs);
        const importMap = getImportMap(sourceFile);
        importMapsByRouteFile.set(routeFileAbs, importMap);

        const visit = (node: ts.Node) => {
            if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
                const caller = node.expression.expression;
                const method = node.expression.name.text;
                if (ts.isIdentifier(caller) && caller.text === "router" && ROUTE_METHODS.has(method)) {
                    const [pathArg, ...remainingArgs] = node.arguments;
                    if (!pathArg) {
                        warnings.push(`[route-skip] missing path argument: ${routeFileRel}:${getNodeLine(sourceFile, node)}`);
                    } else if (!isLiteralPath(pathArg)) {
                        warnings.push(
                            `[route-skip] non-literal path: ${routeFileRel}:${getNodeLine(sourceFile, pathArg)} (${pathArg.getText(sourceFile)})`
                        );
                    } else if (remainingArgs.length === 0) {
                        warnings.push(
                            `[route-skip] missing handler argument: ${routeFileRel}:${getNodeLine(sourceFile, node)} (${method.toUpperCase()} ${pathArg.text})`
                        );
                    } else {
                        const handlerArg = remainingArgs[remainingArgs.length - 1];
                        if (!handlerArg) {
                            warnings.push(
                                `[route-skip] missing handler argument: ${routeFileRel}:${getNodeLine(sourceFile, node)} (${method.toUpperCase()} ${pathArg.text})`
                            );
                            return;
                        }
                        const middlewareArgs = remainingArgs.slice(0, -1);
                        const routeMiddlewares = middlewareArgs.map((arg) => getExpressionLabel(sourceFile, routeFileRel, arg));

                        let handlerLocalName: string | null = null;
                        let handlerSymbol: string;
                        let inlineHandlerText: string | null = null;

                        if (ts.isArrowFunction(handlerArg) || ts.isFunctionExpression(handlerArg)) {
                            const handlerLine = getNodeLine(sourceFile, handlerArg);
                            handlerSymbol = `INLINE_HANDLER@${routeFileRel}:${handlerLine}`;
                            inlineHandlerText = handlerArg.getText(sourceFile);
                        } else if (ts.isIdentifier(handlerArg)) {
                            handlerLocalName = handlerArg.text;
                            handlerSymbol = handlerArg.text;
                        } else {
                            handlerSymbol = sanitizeInlineLabel(handlerArg.getText(sourceFile));
                        }

                        endpoints.push({
                            method: method.toUpperCase() as Uppercase<string>,
                            path: pathArg.text,
                            routeFileAbs,
                            routeFileRel,
                            routeMiddlewares,
                            handlerSymbol,
                            handlerLocalName,
                            inlineHandlerText,
                        });
                    }
                }
            }
            ts.forEachChild(node, visit);
        };

        visit(sourceFile);
    }

    return { endpoints, importMapsByRouteFile, warnings };
}

async function resolveImportToFile(fromFileAbs: string, moduleSpecifier: string): Promise<string | null> {
    if (!moduleSpecifier.startsWith(".")) {
        return null;
    }
    const basePath = path.resolve(path.dirname(fromFileAbs), moduleSpecifier);
    const candidates = new Set<string>();

    candidates.add(basePath);
    if (basePath.endsWith(".js")) {
        candidates.add(basePath.slice(0, -3) + ".ts");
    } else if (!path.extname(basePath)) {
        candidates.add(`${basePath}.ts`);
        candidates.add(`${basePath}.tsx`);
        candidates.add(path.join(basePath, "index.ts"));
    }

    for (const candidate of candidates) {
        if (await pathExists(candidate)) {
            return path.resolve(candidate);
        }
    }
    return null;
}

function hasExportModifier(node: ts.Node): boolean {
    if (!ts.canHaveModifiers(node)) {
        return false;
    }
    const modifiers = ts.getModifiers(node);
    return !!modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
}

function findLocalDeclaration(sourceFile: ts.SourceFile, name: string): ts.Node | null {
    for (const statement of sourceFile.statements) {
        if (ts.isFunctionDeclaration(statement) && statement.name?.text === name) {
            return statement;
        }
        if (ts.isVariableStatement(statement)) {
            for (const declaration of statement.declarationList.declarations) {
                if (ts.isIdentifier(declaration.name) && declaration.name.text === name) {
                    return declaration;
                }
            }
        }
        if (ts.isClassDeclaration(statement) && statement.name?.text === name) {
            return statement;
        }
    }
    return null;
}

async function resolveExportedDeclaration(params: {
    fileAbs: string;
    exportName: string;
    repoRoot: string;
    visited: Set<string>;
}): Promise<ResolvedDeclaration | null> {
    const key = `${params.fileAbs}::${params.exportName}`;
    if (params.visited.has(key)) {
        return null;
    }
    params.visited.add(key);

    const { sourceFile } = await readSourceFile(params.fileAbs);

    for (const statement of sourceFile.statements) {
        if (ts.isFunctionDeclaration(statement) && hasExportModifier(statement) && statement.name?.text === params.exportName) {
            return {
                fileAbs: params.fileAbs,
                fileRel: toPosixPath(path.relative(params.repoRoot, params.fileAbs)),
                line: getNodeLine(sourceFile, statement),
                text: statement.getText(sourceFile),
            };
        }
        if (ts.isVariableStatement(statement) && hasExportModifier(statement)) {
            for (const declaration of statement.declarationList.declarations) {
                if (ts.isIdentifier(declaration.name) && declaration.name.text === params.exportName) {
                    return {
                        fileAbs: params.fileAbs,
                        fileRel: toPosixPath(path.relative(params.repoRoot, params.fileAbs)),
                        line: getNodeLine(sourceFile, declaration),
                        text: declaration.getText(sourceFile),
                    };
                }
            }
        }
    }

    for (const statement of sourceFile.statements) {
        if (!ts.isExportDeclaration(statement) || !statement.exportClause || statement.moduleSpecifier) {
            continue;
        }
        if (!ts.isNamedExports(statement.exportClause)) {
            continue;
        }
        for (const element of statement.exportClause.elements) {
            if (element.name.text !== params.exportName) {
                continue;
            }
            const localName = element.propertyName?.text ?? element.name.text;
            const localDeclaration = findLocalDeclaration(sourceFile, localName);
            if (!localDeclaration) {
                continue;
            }
            return {
                fileAbs: params.fileAbs,
                fileRel: toPosixPath(path.relative(params.repoRoot, params.fileAbs)),
                line: getNodeLine(sourceFile, localDeclaration),
                text: localDeclaration.getText(sourceFile),
            };
        }
    }

    for (const statement of sourceFile.statements) {
        if (!ts.isExportDeclaration(statement) || !statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) {
            continue;
        }

        const targetModuleAbs = await resolveImportToFile(params.fileAbs, statement.moduleSpecifier.text);
        if (!targetModuleAbs) {
            continue;
        }

        if (!statement.exportClause) {
            const candidate = await resolveExportedDeclaration({
                fileAbs: targetModuleAbs,
                exportName: params.exportName,
                repoRoot: params.repoRoot,
                visited: params.visited,
            });
            if (candidate) {
                return candidate;
            }
            continue;
        }

        if (!ts.isNamedExports(statement.exportClause)) {
            continue;
        }

        for (const element of statement.exportClause.elements) {
            if (element.name.text !== params.exportName) {
                continue;
            }
            const upstreamExportName = element.propertyName?.text ?? element.name.text;
            const candidate = await resolveExportedDeclaration({
                fileAbs: targetModuleAbs,
                exportName: upstreamExportName,
                repoRoot: params.repoRoot,
                visited: params.visited,
            });
            if (candidate) {
                return candidate;
            }
        }
    }

    return null;
}

function formatRedirectTargetExpression(expression: ts.Expression, sourceFile: ts.SourceFile): string {
    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
        return expression.text;
    }
    return sanitizeInlineLabel(expression.getText(sourceFile));
}

function extractRedirectTargets(handlerText: string): string[] {
    const sourceFile = ts.createSourceFile("handler.ts", handlerText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const targets: string[] = [];

    const visit = (node: ts.Node) => {
        if (
            ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            node.expression.name.text === "redirect"
        ) {
            const firstArg = node.arguments[0];
            if (!firstArg) {
                targets.push("<missing>");
            } else {
                targets.push(formatRedirectTargetExpression(firstArg, sourceFile));
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);

    return dedupePreserveOrder(targets);
}

function extractRenderDiagnostics(handlerText: string): RenderDiagnostics {
    const sourceFile = ts.createSourceFile("handler.ts", handlerText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const statuses: string[] = [];

    const visit = (node: ts.Node) => {
        if (
            ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            node.expression.name.text === "render"
        ) {
            const renderReceiver = node.expression.expression;
            if (
                ts.isCallExpression(renderReceiver) &&
                ts.isPropertyAccessExpression(renderReceiver.expression) &&
                renderReceiver.expression.name.text === "status"
            ) {
                const statusArg = renderReceiver.arguments[0];
                if (statusArg) {
                    if (ts.isNumericLiteral(statusArg)) {
                        const numericStatus = Number(statusArg.text);
                        if (Number.isFinite(numericStatus) && numericStatus >= 400) {
                            statuses.push(statusArg.text);
                        }
                    }
                }
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);

    return {
        statuses: dedupePreserveOrder(statuses),
    };
}

function scanSinksAndExits(handlerText: string): {
    sinks: Sink[];
    exits: Exit[];
    redirectTargets: string[];
    renderDiagnostics: RenderDiagnostics;
} {
    const sinks: Sink[] = [];
    const exits: Exit[] = [];

    for (const rule of SINK_RULES) {
        if (rule.patterns.some((pattern) => pattern.test(handlerText))) {
            sinks.push(rule.sink);
        }
    }
    for (const rule of EXIT_RULES) {
        if (rule.patterns.some((pattern) => pattern.test(handlerText))) {
            exits.push(rule.exit);
        }
    }

    return {
        sinks,
        exits,
        redirectTargets: extractRedirectTargets(handlerText),
        renderDiagnostics: extractRenderDiagnostics(handlerText),
    };
}

function buildRedirectSinkLabel(params: { sink: Sink }): string {
    return params.sink;
}

function buildPathMethodIndex(endpoints: FlowEndpoint[]): Map<string, Set<string>> {
    const index = new Map<string, Set<string>>();
    for (const endpoint of endpoints) {
        const methods = index.get(endpoint.path) ?? new Set<string>();
        methods.add(endpoint.method.toUpperCase());
        index.set(endpoint.path, methods);
    }
    return index;
}

function annotateRedirectTargetWithMethod(params: { target: string; pathMethodIndex: Map<string, Set<string>> }): string {
    const trimmed = params.target.trim();
    if (!trimmed.startsWith("/")) {
        return trimmed;
    }
    const methods = params.pathMethodIndex.get(trimmed);
    if (!methods || methods.size === 0) {
        return trimmed;
    }
    if (methods.has("GET")) {
        return `GET ${trimmed}`;
    }
    const ordered = [...methods].sort((left, right) => compareMethods(left, right));
    if (ordered.length === 1) {
        return `${ordered[0]} ${trimmed}`;
    }
    return `${ordered.join("|")} ${trimmed}`;
}

function normalizeRedirectTarget(target: string): string {
    let normalized = target.trim();
    if (normalized.startsWith("`") && normalized.endsWith("`") && normalized.length >= 2) {
        normalized = normalized.slice(1, -1);
    }
    return normalized;
}

function formatRedirectTargetForDisplay(target: string): string {
    let formatted = normalizeRedirectTarget(target);
    formatted = formatted.replace(/\$\{([^}]+)\}/g, (_match, inner: string) => `<i>{${inner.trim()}}</i>`);
    if (/^[A-Za-z_$][\w$.]*$/.test(formatted)) {
        return `<i>{${formatted}}</i>`;
    }
    return formatted;
}

function normalizeRouteSegmentPattern(segment: string): string {
    return segment.replace(/:[A-Za-z0-9_]+/g, ":");
}

function normalizeExpressionSegmentPattern(segment: string): string {
    return segment.replace(/\$\{[^}]+\}/g, ":").replace(/<i>\{[^}]+\}<\/i>/g, ":");
}

function inferRouteTemplatePathFromExpressionPath(params: { expressionPath: string; knownPaths: string[] }): string | null {
    const expressionPath = params.expressionPath.trim();
    if (!expressionPath.startsWith("/")) {
        return null;
    }
    const expressionSegments = expressionPath.split("/");
    for (const knownPath of params.knownPaths) {
        const routeSegments = knownPath.split("/");
        if (routeSegments.length !== expressionSegments.length) {
            continue;
        }
        let matched = true;
        for (let index = 0; index < routeSegments.length; index += 1) {
            const routeSegment = routeSegments[index];
            const expressionSegment = expressionSegments[index];
            if (routeSegment === undefined || expressionSegment === undefined) {
                matched = false;
                break;
            }
            const normalizedRoute = normalizeRouteSegmentPattern(routeSegment);
            const normalizedExpression = normalizeExpressionSegmentPattern(expressionSegment);
            if (normalizedRoute !== normalizedExpression) {
                matched = false;
                break;
            }
        }
        if (matched) {
            return knownPath;
        }
    }
    return null;
}

function formatRouteTemplatePathForDisplay(pathValue: string): string {
    return pathValue.replace(/:([A-Za-z0-9_]+)/g, (_match, name: string) => `<i>{:${name}}</i>`);
}

function buildRedirectNextEntries(params: {
    redirectTargets: string[];
    pathMethodIndex: Map<string, Set<string>>;
}): string[] {
    // 다이어그램 과밀 방지를 위해 대표 타겟 1개만 노출합니다.
    const firstTarget = params.redirectTargets[0];
    if (!firstTarget) {
        return [];
    }
    const normalizedTarget = normalizeRedirectTarget(firstTarget);
    const inferredRoutePath = inferRouteTemplatePathFromExpressionPath({
        expressionPath: normalizedTarget,
        knownPaths: [...params.pathMethodIndex.keys()],
    });
    if (inferredRoutePath) {
        return [formatRouteTemplatePathForDisplay(inferredRoutePath)];
    }
    if (normalizedTarget.startsWith("/")) {
        return [annotateRedirectTargetWithMethod({ target: normalizedTarget, pathMethodIndex: params.pathMethodIndex })];
    }
    return [formatRedirectTargetForDisplay(normalizedTarget)];
}

function buildEndpointId(method: string, routePath: string): string {
    let normalizedPath = routePath.replace(/^\/+/, "");
    normalizedPath = normalizedPath.replace(/:([A-Za-z0-9_]+)/g, "$1");
    normalizedPath = normalizedPath.replace(/\//g, "__");
    normalizedPath = normalizedPath.replace(/[^A-Za-z0-9_]/g, "_");
    normalizedPath = normalizedPath.replace(/_+/g, "_");
    normalizedPath = normalizedPath.replace(/^_+|_+$/g, "");
    if (!normalizedPath) {
        normalizedPath = "root";
    }
    return `${method.toUpperCase()}__${normalizedPath}`;
}

function buildMermaid(params: {
    method: string;
    path: string;
    handlerName: string;
    globalMiddlewares: string[];
    routeMiddlewares: string[];
    sinks: Sink[];
    exits: Exit[];
    redirectTargets: string[];
    renderDiagnostics: RenderDiagnostics;
    pathMethodIndex: Map<string, Set<string>>;
}): string {
    const lines: string[] = ["flowchart TD"];
    const middlewareNodeIds: string[] = [];
    const sinkNodeIds: string[] = [];
    const exitNodeIds: string[] = [];
    const renderExitNodeIds: string[] = [];
    const redirectExitNodeIds: string[] = [];
    const renderDiagnosticNodeIds: string[] = [];
    const maxNodes = 30;
    const renderDiagnosticItems = [...params.renderDiagnostics.statuses];

    lines.push(`subgraph ENTRY_BLOCK["[ENTRY]"]`);
    lines.push("direction TB");
    lines.push(`ENTRY["${params.method.toUpperCase()} ${params.path}"]`);
    lines.push("end");
    let currentNode = "ENTRY";

    const middlewareChain = [
        ...(params.globalMiddlewares.length > 0 ? ["<b>[Global Middlewares]</b>"] : []),
        ...params.routeMiddlewares,
    ];
    const reservedNodes =
        1 + 1 + params.sinks.length + params.exits.length + renderDiagnosticItems.length + (params.redirectTargets.length > 0 ? 1 : 0);
    const middlewareNodeBudget = Math.max(0, maxNodes - reservedNodes);
    let effectiveMiddlewares = [...middlewareChain];

    if (effectiveMiddlewares.length > middlewareNodeBudget) {
        if (middlewareNodeBudget === 0) {
            effectiveMiddlewares = [];
        } else if (middlewareNodeBudget === 1) {
            effectiveMiddlewares = [`... (+${middlewareChain.length} more middleware)`];
        } else {
            const kept = effectiveMiddlewares.slice(0, middlewareNodeBudget - 1);
            kept.push(`... (+${middlewareChain.length - (middlewareNodeBudget - 1)} more middleware)`);
            effectiveMiddlewares = kept;
        }
    }

    if (effectiveMiddlewares.length > 0) {
        lines.push(`subgraph MIDDLEWARES["[MIDDLEWARES]"]`);
        lines.push("direction TB");
        for (const [index, middleware] of effectiveMiddlewares.entries()) {
            const nodeId = `MIDDLEWARE${index + 1}`;
            const label = formatCallableLabel(middleware).slice(0, 90).replace(/"/g, "'");
            middlewareNodeIds.push(nodeId);
            lines.push(`${nodeId}["${label}"]`);
        }
        lines.push("end");
        const firstMiddlewareNode = middlewareNodeIds[0];
        if (firstMiddlewareNode) {
            lines.push(`ENTRY --> ${firstMiddlewareNode}`);
        }
        for (let index = 1; index < middlewareNodeIds.length; index += 1) {
            const previousNode = middlewareNodeIds[index - 1];
            const currentMiddlewareNode = middlewareNodeIds[index];
            if (!previousNode || !currentMiddlewareNode) {
                continue;
            }
            lines.push(`${previousNode} --> ${currentMiddlewareNode}`);
        }
        const lastMiddlewareNode = middlewareNodeIds[middlewareNodeIds.length - 1];
        if (lastMiddlewareNode) {
            currentNode = lastMiddlewareNode;
        }
    }

    const handlerLabel = formatCallableLabel(params.handlerName).slice(0, 120).replace(/"/g, "'");
    lines.push(`subgraph HANDLER_BLOCK["[HANDLER]"]`);
    lines.push("direction TB");
    lines.push(`HANDLER["${handlerLabel}"]`);
    lines.push("end");
    lines.push(`${currentNode} --> HANDLER`);

    if (renderDiagnosticItems.length > 0) {
        lines.push(`subgraph ERROR_STATUS["[ERROR STATUS]"]`);
        lines.push("direction TB");
        for (const [index, status] of renderDiagnosticItems.entries()) {
            const nodeId = `RDIAG${index + 1}`;
            const label = sanitizeInlineLabel(status).slice(0, 120).replace(/"/g, "'");
            renderDiagnosticNodeIds.push(nodeId);
            lines.push(`${nodeId}["${label}"]`);
        }
        lines.push("end");
    }

    if (params.sinks.length > 0) {
        lines.push(`subgraph SINKS["[SINKS]"]`);
        lines.push("direction TB");
        for (const [index, sink] of params.sinks.entries()) {
            const nodeId = `SINK${index + 1}`;
            sinkNodeIds.push(nodeId);
            const sinkLabelRaw = buildRedirectSinkLabel({ sink });
            const sinkLabel = sinkLabelRaw.replace(/"/g, "'");
            lines.push(`${nodeId}["${sinkLabel}"]`);
        }
        lines.push("end");
        for (const nodeId of sinkNodeIds) {
            lines.push(`HANDLER --> ${nodeId}`);
        }
    }
    if (params.exits.length > 0) {
        lines.push(`subgraph EXITS["[EXITS]"]`);
        lines.push("direction TB");
        for (const [index, exitKind] of params.exits.entries()) {
            const nodeId = `EXIT${index + 1}`;
            exitNodeIds.push(nodeId);
            if (exitKind === "res.render()") {
                renderExitNodeIds.push(nodeId);
            }
            if (exitKind === "res.redirect()" && params.redirectTargets.length > 0) {
                redirectExitNodeIds.push(nodeId);
            }
            lines.push(`${nodeId}["${exitKind}"]`);
        }
        lines.push("end");
        for (const nodeId of exitNodeIds) {
            lines.push(`HANDLER --> ${nodeId}`);
        }
    }

    if (renderDiagnosticNodeIds.length > 0) {
        const renderTargets = [...renderExitNodeIds];
        if (renderTargets.length > 0) {
            for (const renderTargetNodeId of renderTargets) {
                for (const diagnosticNodeId of renderDiagnosticNodeIds) {
                    lines.push(`${renderTargetNodeId} --> ${diagnosticNodeId}`);
                }
            }
        } else {
            for (const diagnosticNodeId of renderDiagnosticNodeIds) {
                lines.push(`HANDLER --> ${diagnosticNodeId}`);
            }
        }
    }

    const nextEntries = buildRedirectNextEntries({
        redirectTargets: params.redirectTargets,
        pathMethodIndex: params.pathMethodIndex,
    });
    if (redirectExitNodeIds.length > 0 && nextEntries.length > 0) {
        const nextEntryNodeIds: string[] = [];
        lines.push(`subgraph NEXT_ENTRY["[NEXT ENTRY]"]`);
        lines.push("direction TB");
        for (const [index, nextEntryRaw] of nextEntries.entries()) {
            const nodeId = `NEXT_ENTRY${index + 1}`;
            const label = nextEntryRaw.replace(/"/g, "'");
            nextEntryNodeIds.push(nodeId);
            lines.push(`${nodeId}["${label}"]`);
        }
        lines.push("end");
        for (const redirectExitNodeId of redirectExitNodeIds) {
            for (const nextEntryNodeId of nextEntryNodeIds) {
                lines.push(`${redirectExitNodeId} --> ${nextEntryNodeId}`);
            }
        }
    }

    lines.push("classDef middleware font-size:10px,padding:2px,stroke-width:1;");
    lines.push("classDef diagnostics stroke-dasharray: 2 2;");
    lines.push("classDef sink stroke-width:2;");
    lines.push("classDef exit stroke-dasharray: 4 2;");

    if (middlewareNodeIds.length > 0) {
        lines.push(`class ${middlewareNodeIds.join(",")} middleware;`);
    }
    if (renderDiagnosticNodeIds.length > 0) {
        lines.push(`class ${renderDiagnosticNodeIds.join(",")} diagnostics;`);
    }
    if (sinkNodeIds.length > 0) {
        lines.push(`class ${sinkNodeIds.join(",")} sink;`);
    }
    if (exitNodeIds.length > 0) {
        lines.push(`class ${exitNodeIds.join(",")} exit;`);
    }

    return `${lines.join("\n")}\n`;
}

function buildGlobalMiddlewaresMermaid(globalMiddlewares: string[]): string {
    const lines: string[] = ["flowchart TD"];
    const nodeIds: string[] = [];

    lines.push(`subgraph ENTRY_BLOCK["[ENTRY]"]`);
    lines.push("direction TB");
    lines.push(`ENTRY["Global Middleware Chain"]`);
    lines.push("end");

    if (globalMiddlewares.length === 0) {
        lines.push(`ENTRY --> EMPTY["(none)"]`);
        return `${lines.join("\n")}\n`;
    }

    lines.push(`subgraph GLOBAL_MIDDLEWARES["[GLOBAL MIDDLEWARES]"]`);
    lines.push("direction TB");
    for (const [index, middleware] of globalMiddlewares.entries()) {
        const nodeId = `GMW${index + 1}`;
        const label = sanitizeInlineLabel(middleware).slice(0, 100).replace(/"/g, "'");
        nodeIds.push(nodeId);
        lines.push(`${nodeId}["${label}"]`);
    }
    lines.push("end");

    const first = nodeIds[0];
    if (first) {
        lines.push(`ENTRY --> ${first}`);
    }
    for (let index = 1; index < nodeIds.length; index += 1) {
        const prev = nodeIds[index - 1];
        const curr = nodeIds[index];
        if (!prev || !curr) {
            continue;
        }
        lines.push(`${prev} --> ${curr}`);
    }

    lines.push("classDef middleware font-size:10px,padding:2px,stroke-width:1;");
    if (nodeIds.length > 0) {
        lines.push(`class ${nodeIds.join(",")} middleware;`);
    }

    return `${lines.join("\n")}\n`;
}

function compareMethods(left: string, right: string): number {
    const leftIndex = METHOD_ORDER.indexOf(left as (typeof METHOD_ORDER)[number]);
    const rightIndex = METHOD_ORDER.indexOf(right as (typeof METHOD_ORDER)[number]);
    if (leftIndex === -1 && rightIndex === -1) {
        return left.localeCompare(right);
    }
    if (leftIndex === -1) {
        return 1;
    }
    if (rightIndex === -1) {
        return -1;
    }
    return leftIndex - rightIndex;
}

async function extractAppFlowContext(params: { serverRoot: string; repoRoot: string }): Promise<AppFlowContext> {
    const appFileAbs = path.resolve(params.serverRoot, "src/app.ts");
    const { sourceFile } = await readSourceFile(appFileAbs);

    const routeImportsByLocal = new Map<string, string>();
    for (const statement of sourceFile.statements) {
        if (!ts.isImportDeclaration(statement)) {
            continue;
        }
        if (!ts.isStringLiteral(statement.moduleSpecifier)) {
            continue;
        }
        const moduleSpecifier = statement.moduleSpecifier.text;
        if (!moduleSpecifier.includes("/routes/")) {
            continue;
        }
        const localName = statement.importClause?.name?.text;
        if (!localName) {
            continue;
        }
        const resolvedRouteFile = await resolveImportToFile(appFileAbs, moduleSpecifier);
        if (!resolvedRouteFile) {
            continue;
        }
        routeImportsByLocal.set(localName, toPosixPath(path.relative(params.repoRoot, resolvedRouteFile)));
    }

    const createApp = sourceFile.statements.find((statement) => {
        return ts.isFunctionDeclaration(statement) && statement.name?.text === "createApp";
    });
    if (!createApp || !ts.isFunctionDeclaration(createApp) || !createApp.body) {
        return { globalMiddlewares: [] };
    }

    const appUseCalls: ts.CallExpression[] = [];
    const collectCalls = (node: ts.Node) => {
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
            const target = node.expression.expression;
            const method = node.expression.name.text;
            if (ts.isIdentifier(target) && target.text === "app" && method === "use") {
                appUseCalls.push(node);
            }
        }
        ts.forEachChild(node, collectCalls);
    };
    collectCalls(createApp.body);

    const globalMiddlewares: string[] = [];
    let encounteredRouterMount = false;

    for (const appUseCall of appUseCalls) {
        const args = appUseCall.arguments;
        const hasRouterMount = args.some((argument) => {
            if (!ts.isIdentifier(argument)) {
                return false;
            }
            return routeImportsByLocal.has(argument.text);
        });

        if (hasRouterMount) {
            encounteredRouterMount = true;
            continue;
        }
        if (encounteredRouterMount) {
            continue;
        }
        if (args.length === 0) {
            continue;
        }

        const label = (() => {
            const firstArg = args[0];
            if (!firstArg) {
                return null;
            }
            if (args.length >= 2 && isLiteralPath(firstArg)) {
                const mountPath = firstArg.text;
                const middlewareArg = args[args.length - 1];
                if (middlewareArg) {
                    return `${mountPath}: ${getExpressionLabel(sourceFile, "server/src/app.ts", middlewareArg)}`;
                }
            }
            return getExpressionLabel(sourceFile, "server/src/app.ts", firstArg);
        })();

        if (!label) {
            continue;
        }

        globalMiddlewares.push(label);
    }

    return { globalMiddlewares: dedupePreserveOrder(globalMiddlewares) };
}

async function buildFlowEndpoints(params: {
    repoRoot: string;
    appFlowContext: AppFlowContext;
    routeExtraction: RouteExtractionResult;
}): Promise<FlowEndpoint[]> {
    const flows: FlowEndpoint[] = [];

    for (const endpoint of params.routeExtraction.endpoints) {
        const warnings: string[] = [];
        let handlerFile: string | undefined;
        let handlerLine: number | undefined;
        let handlerText = endpoint.inlineHandlerText ?? "";

        if (!endpoint.inlineHandlerText && endpoint.handlerLocalName) {
            const routeImportMap = params.routeExtraction.importMapsByRouteFile.get(endpoint.routeFileAbs);
            const binding = routeImportMap?.get(endpoint.handlerLocalName);
            if (!binding) {
                warnings.push(
                    `[handler-unresolved] no import binding for '${endpoint.handlerLocalName}' in ${endpoint.routeFileRel}`
                );
            } else {
                const importedSourceFileAbs = await resolveImportToFile(endpoint.routeFileAbs, binding.moduleSpecifier);
                if (!importedSourceFileAbs) {
                    warnings.push(
                        `[handler-unresolved] cannot resolve import '${binding.moduleSpecifier}' from ${endpoint.routeFileRel}`
                    );
                } else {
                    const resolvedDecl = await resolveExportedDeclaration({
                        fileAbs: importedSourceFileAbs,
                        exportName: binding.importedName,
                        repoRoot: params.repoRoot,
                        visited: new Set<string>(),
                    });
                    if (!resolvedDecl) {
                        warnings.push(
                            `[handler-unresolved] cannot resolve export '${binding.importedName}' from ${toPosixPath(path.relative(params.repoRoot, importedSourceFileAbs))}`
                        );
                    } else {
                        handlerFile = resolvedDecl.fileRel;
                        handlerLine = resolvedDecl.line;
                        handlerText = resolvedDecl.text;
                    }
                }
            }
        }

        const scanned = scanSinksAndExits(handlerText);
        const mergedSinks = dedupePreserveOrder(scanned.sinks) as Sink[];
        const mergedExits = dedupePreserveOrder(scanned.exits) as Exit[];
        const redirectTargets = dedupePreserveOrder(scanned.redirectTargets);

        flows.push({
            id: buildEndpointId(endpoint.method, endpoint.path),
            method: endpoint.method,
            path: endpoint.path,
            routeFile: endpoint.routeFileRel,
            middlewares: endpoint.routeMiddlewares,
            handler: {
                name: endpoint.handlerSymbol,
                ...(handlerFile ? { file: handlerFile } : {}),
                ...(handlerLine ? { line: handlerLine } : {}),
            },
            sinks: mergedSinks,
            exits: mergedExits,
            redirectTargets,
            renderDiagnostics: scanned.renderDiagnostics,
            globalMiddlewares: params.appFlowContext.globalMiddlewares,
            warnings,
        });
    }

    flows.sort((left, right) => {
        const byRouteFile = left.routeFile.localeCompare(right.routeFile);
        if (byRouteFile !== 0) {
            return byRouteFile;
        }
        const byPath = left.path.localeCompare(right.path);
        if (byPath !== 0) {
            return byPath;
        }
        return compareMethods(left.method, right.method);
    });

    return flows;
}

async function writeFlowmapArtifacts(params: {
    repoRoot: string;
    flowEndpoints: FlowEndpoint[];
    routeWarnings: string[];
}): Promise<void> {
    const flowmapDir = path.resolve(params.repoRoot, "docs/flowmap");
    const flowDir = path.join(flowmapDir, "flows");
    await fs.mkdir(flowmapDir, { recursive: true });
    await fs.mkdir(flowDir, { recursive: true });

    const catalog = {
        generatedAt: new Date().toISOString(),
        project: "my-code-my-kill/server",
        endpoints: params.flowEndpoints.map((endpoint) => ({
            id: endpoint.id,
            method: endpoint.method,
            path: endpoint.path,
            routeFile: endpoint.routeFile,
            middlewares: endpoint.middlewares,
            handler: endpoint.handler,
            sinks: endpoint.sinks,
            exits: endpoint.exits,
            ...(endpoint.redirectTargets.length > 0 ? { redirectTargets: endpoint.redirectTargets } : {}),
            ...(endpoint.renderDiagnostics.statuses.length > 0 ? { renderDiagnostics: endpoint.renderDiagnostics } : {}),
        })),
    };

    await fs.writeFile(path.join(flowmapDir, "catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
    const globalMiddlewares = params.flowEndpoints[0]?.globalMiddlewares ?? [];
    await fs.writeFile(path.join(flowmapDir, "global-middlewares.mmd"), buildGlobalMiddlewaresMermaid(globalMiddlewares), "utf8");
    const pathMethodIndex = buildPathMethodIndex(params.flowEndpoints);

    const expectedFlowFilenames = new Set<string>();
    for (const endpoint of params.flowEndpoints) {
        const flowJsonPath = path.join(flowDir, `${endpoint.id}.json`);
        const flowMmdPath = path.join(flowDir, `${endpoint.id}.mmd`);
        expectedFlowFilenames.add(`${endpoint.id}.json`);
        expectedFlowFilenames.add(`${endpoint.id}.mmd`);

        const flowPayload = {
            id: endpoint.id,
            method: endpoint.method,
            path: endpoint.path,
            routeFile: endpoint.routeFile,
            middlewares: endpoint.middlewares,
            handler: endpoint.handler,
            sinks: endpoint.sinks,
            exits: endpoint.exits,
            ...(endpoint.redirectTargets.length > 0 ? { redirectTargets: endpoint.redirectTargets } : {}),
            ...(endpoint.renderDiagnostics.statuses.length > 0 ? { renderDiagnostics: endpoint.renderDiagnostics } : {}),
            warnings: endpoint.warnings,
        };

        const mermaidSource = buildMermaid({
            method: endpoint.method,
            path: endpoint.path,
            handlerName: endpoint.handler.name,
            globalMiddlewares: endpoint.globalMiddlewares,
            routeMiddlewares: endpoint.middlewares,
            sinks: endpoint.sinks,
            exits: endpoint.exits,
            redirectTargets: endpoint.redirectTargets,
            renderDiagnostics: endpoint.renderDiagnostics,
            pathMethodIndex,
        });

        await fs.writeFile(flowJsonPath, `${JSON.stringify(flowPayload, null, 2)}\n`, "utf8");
        await fs.writeFile(flowMmdPath, mermaidSource, "utf8");
    }

    const groups = new Map<string, FlowEndpoint[]>();
    for (const endpoint of params.flowEndpoints) {
        const section = path.basename(endpoint.routeFile);
        const items = groups.get(section) ?? [];
        items.push(endpoint);
        groups.set(section, items);
    }

    const indexLines: string[] = [];
    indexLines.push("# Flowmap Index");
    indexLines.push("");
    indexLines.push(`Generated at: ${catalog.generatedAt}`);
    indexLines.push("");
    indexLines.push("## Shared");
    indexLines.push("");
    indexLines.push("- [Global Middlewares](global-middlewares.mmd)");
    indexLines.push("");

    for (const section of [...groups.keys()].sort()) {
        indexLines.push(`## ${section}`);
        indexLines.push("");
        const items = groups.get(section) ?? [];
        items.sort((left, right) => {
            const byPath = left.path.localeCompare(right.path);
            if (byPath !== 0) {
                return byPath;
            }
            return compareMethods(left.method, right.method);
        });
        for (const item of items) {
            const sinksLabel = item.sinks.length > 0 ? item.sinks.join(", ") : "none";
            indexLines.push(`- [${item.method} ${item.path}](flows/${item.id}.mmd) — sinks: ${sinksLabel}`);
        }
        indexLines.push("");
    }

    await fs.writeFile(path.join(flowmapDir, "index.md"), `${indexLines.join("\n").trimEnd()}\n`, "utf8");

    // 생성 산출물 디렉토리는 "정의된 파일만" 유지합니다.
    // Finder/iCloud 충돌 복사본(e.g. `flows 2`, `index 2.md`)도 여기서 정리합니다.
    const expectedTopLevelEntries = new Set(["catalog.json", "index.md", "global-middlewares.mmd", "flows"]);
    const topLevelEntries = await fs.readdir(flowmapDir, { withFileTypes: true });
    for (const entry of topLevelEntries) {
        if (expectedTopLevelEntries.has(entry.name)) {
            continue;
        }
        await fs.rm(path.join(flowmapDir, entry.name), { recursive: true, force: true });
    }

    const currentFlowEntries = await fs.readdir(flowDir, { withFileTypes: true });
    for (const entry of currentFlowEntries) {
        if (!entry.isFile() || !expectedFlowFilenames.has(entry.name)) {
            await fs.rm(path.join(flowDir, entry.name), { recursive: true, force: true });
        }
    }

    const flowWarnings = [
        ...params.routeWarnings,
        ...params.flowEndpoints.flatMap((endpoint) => endpoint.warnings),
    ];
    if (flowWarnings.length > 0) {
        for (const warning of flowWarnings) {
            console.warn(warning);
        }
    }
}

async function main() {
    const serverRoot = process.cwd();
    const repoRoot = path.resolve(serverRoot, "..");

    const routeExtraction = await extractRouteEndpoints({ serverRoot, repoRoot });
    const appFlowContext = await extractAppFlowContext({ serverRoot, repoRoot });
    const flowEndpoints = await buildFlowEndpoints({
        repoRoot,
        appFlowContext,
        routeExtraction,
    });

    await writeFlowmapArtifacts({
        repoRoot,
        flowEndpoints,
        routeWarnings: routeExtraction.warnings,
    });

    console.log(`[flowmap] generated ${flowEndpoints.length} endpoint flows at docs/flowmap`);
}

await main();
