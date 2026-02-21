import fs from "node:fs/promises";
import path from "node:path";
import * as ts from "typescript";

const ROUTE_METHODS = new Set(["get", "post", "put", "patch", "delete"]);
const METHOD_ORDER = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

const SINK_RULES = [
    { sink: "DB_RAW", patterns: [/sequelize\.query\s*\(/] },
    { sink: "DB_ORM", patterns: [/\.(findOne|findAll|create|update|destroy)\s*\(/] },
    { sink: "RENDER", patterns: [/res\.render\s*\(/, /\.render\s*\(/] },
    { sink: "SEND", patterns: [/res\.send\s*\(/, /\.send\s*\(/] },
    { sink: "JSON", patterns: [/res\.json\s*\(/, /\.json\s*\(/] },
    { sink: "REDIRECT", patterns: [/res\.redirect\s*\(/, /\.redirect\s*\(/] },
    { sink: "SESSION", patterns: [/req\.session\b/, /req\.session\.regenerate\s*\(/] },
    { sink: "COOKIE", patterns: [/res\.cookie\s*\(/] },
    { sink: "UPLOAD", patterns: [/multer\s*\(/, /req\.(file|files)\b/] },
    { sink: "IMAGE", patterns: [/sharp\s*\(/] },
    { sink: "FS", patterns: [/\bfs\.\w+\s*\(/] },
    { sink: "EXTERNAL", patterns: [/\bfetch\s*\(/, /axios\./] },
    { sink: "LAB_TOGGLE", patterns: [/SECURITY_LAB/i, /\bCSRF\b/i, /\bXSS\b/i] },
] as const;

const EXIT_RULES = [
    { exit: "render", patterns: [/res\.render\s*\(/, /\.render\s*\(/] },
    { exit: "send", patterns: [/res\.send\s*\(/, /\.send\s*\(/] },
    { exit: "json", patterns: [/res\.json\s*\(/, /\.json\s*\(/] },
    { exit: "redirect", patterns: [/res\.redirect\s*\(/, /\.redirect\s*\(/] },
    { exit: "next_err", patterns: [/\bnext\s*\(/] },
] as const;

type Sink = typeof SINK_RULES[number]["sink"];
type Exit = typeof EXIT_RULES[number]["exit"];

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
        return `INLINE_MW@${fileRel}:${line}`;
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

function scanSinksAndExits(handlerText: string): { sinks: Sink[]; exits: Exit[] } {
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

    return { sinks, exits };
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
}): string {
    const lines: string[] = ["flowchart TD"];
    const sinkNodeIds: string[] = [];
    const exitNodeIds: string[] = [];
    const maxNodes = 30;

    lines.push(`ENTRY["ENTRY\\n${params.method.toUpperCase()} ${params.path}"]`);
    let currentNode = "ENTRY";

    const middlewareChain = [...params.globalMiddlewares, ...params.routeMiddlewares];
    const middlewareNodeBudget = Math.max(0, maxNodes - (1 + 1 + params.sinks.length + params.exits.length));
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

    for (const [index, middleware] of effectiveMiddlewares.entries()) {
        const nodeId = `MW${index + 1}`;
        const label = sanitizeInlineLabel(middleware).slice(0, 100).replace(/"/g, "'");
        lines.push(`${currentNode} --> ${nodeId}["MW: ${label}"]`);
        currentNode = nodeId;
    }

    const handlerLabel = sanitizeInlineLabel(params.handlerName).slice(0, 120).replace(/"/g, "'");
    lines.push(`${currentNode} --> HANDLER["HANDLER: ${handlerLabel}"]`);

    for (const [index, sink] of params.sinks.entries()) {
        const nodeId = `SINK${index + 1}`;
        sinkNodeIds.push(nodeId);
        lines.push(`HANDLER --> ${nodeId}["SINK: ${sink}"]`);
    }

    for (const [index, exitKind] of params.exits.entries()) {
        const nodeId = `EXIT${index + 1}`;
        exitNodeIds.push(nodeId);
        lines.push(`HANDLER --> ${nodeId}["EXIT: ${exitKind}"]`);
    }

    lines.push("classDef sink stroke-width:2;");
    lines.push("classDef exit stroke-dasharray: 4 2;");

    if (sinkNodeIds.length > 0) {
        lines.push(`class ${sinkNodeIds.join(",")} sink;`);
    }
    if (exitNodeIds.length > 0) {
        lines.push(`class ${exitNodeIds.join(",")} exit;`);
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
    await fs.rm(flowmapDir, { recursive: true, force: true });
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
        })),
    };

    await fs.writeFile(path.join(flowmapDir, "catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

    for (const endpoint of params.flowEndpoints) {
        const flowJsonPath = path.join(flowDir, `${endpoint.id}.json`);
        const flowMmdPath = path.join(flowDir, `${endpoint.id}.mmd`);

        const flowPayload = {
            id: endpoint.id,
            method: endpoint.method,
            path: endpoint.path,
            routeFile: endpoint.routeFile,
            globalMiddlewares: endpoint.globalMiddlewares,
            middlewares: endpoint.middlewares,
            middlewareChain: [...endpoint.globalMiddlewares, ...endpoint.middlewares],
            handler: endpoint.handler,
            sinks: endpoint.sinks,
            exits: endpoint.exits,
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

    for (const section of [...groups.keys()].sort()) {
        indexLines.push(`## ${section}`);
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
