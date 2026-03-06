import fs from 'node:fs/promises';
import path from 'node:path';
import * as ts from 'typescript';

const ROUTE_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);
const METHOD_ORDER = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

const SINK_RULES = [
  { sink: 'DB: Raw Query', patterns: [/sequelize\.query\s*\(/] },
  { sink: 'DB: ORM', patterns: [/\.(findOne|findAll|create|update|destroy)\s*\(/] },
  { sink: 'req.session.read()', patterns: [] },
  { sink: 'req.session.write()', patterns: [] },
  { sink: 'res.cookie()', patterns: [/res\.cookie\s*\(/] },
  { sink: 'File Upload', patterns: [/multer\s*\(/, /req\.(file|files)\b/] },
  { sink: 'Image Upload', patterns: [/sharp\s*\(/] },
  { sink: 'fs', patterns: [/\bfs\.\w+\s*\(/] },
  { sink: 'AJAX', patterns: [/\bfetch\s*\(/, /axios\./] },
  { sink: 'Lab Options', patterns: [/SECURITY_LAB/i, /\bCSRF\b/i, /\bXSS\b/i] },
] as const;

const EXIT_RULES = [
  { exit: 'res.render()', patterns: [/res\.render\s*\(/, /\.render\s*\(/] },
  { exit: 'res.send()', patterns: [/res\.send\s*\(/, /\.send\s*\(/] },
  { exit: 'JSON', patterns: [/res\.json\s*\(/, /\.json\s*\(/] },
  { exit: 'res.redirect()', patterns: [/res\.redirect\s*\(/, /\.redirect\s*\(/] },
  { exit: 'next(err)', patterns: [/\bnext\s*\(/] },
] as const;

type Sink = (typeof SINK_RULES)[number]['sink'];
type Exit = (typeof EXIT_RULES)[number]['exit'];
type RenderDiagnostics = {
  statuses: string[];
};
type SessionAccess = {
  read: boolean;
  write: boolean;
  readKeys: string[];
  writeKeys: string[];
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
  sessionAccess: SessionAccess;
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
const SESSION_READ_SINK = 'req.session.read()' as const;
const SESSION_WRITE_SINK = 'req.session.write()' as const;
const SESSION_ROOT_KEY = '<session>' as const;
const SESSION_DYNAMIC_KEY = '<dynamic>' as const;
type KeyBindings = Map<string, string[]>;
type CallInvocation = {
  argValuesByIndex: Map<number, string[]>;
};
type SessionPathSegment =
  | {
      kind: 'literal';
      value: string;
    }
  | {
      kind: 'identifier';
      value: string;
    }
  | {
      kind: 'dynamic';
    };

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join('/');
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

function parseTypeScriptSource(fileName: string, text: string): ts.SourceFile {
  return ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
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
  const text = await fs.readFile(fileAbs, 'utf8');
  const sourceFile = parseTypeScriptSource(fileAbs, text);
  const entry = { text, sourceFile };
  sourceCache.set(fileAbs, entry);
  return entry;
}

function sanitizeInlineLabel(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

function formatCallableLabel(raw: string): string {
  const label = sanitizeInlineLabel(raw);
  if (!label) {
    return label;
  }
  const inlineHandlerMatch = label.match(/^INLINE_HANDLER@(.+):(\d+)$/);
  if (inlineHandlerMatch) {
    const filePath = inlineHandlerMatch[1] ?? '';
    return `Inline Handler<br/>(${path.basename(filePath)})`;
  }
  const inlineMiddlewareMatch = label.match(/^INLINE_MIDDLEWARE@(.+):(\d+)$/);
  if (inlineMiddlewareMatch) {
    const filePath = inlineMiddlewareMatch[1] ?? '';
    const line = inlineMiddlewareMatch[2] ?? '';
    return `inlineMiddleware() @ ${path.basename(filePath)}:${line}`;
  }
  if (label.includes('->') || label.startsWith('...')) {
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

function isLiteralPath(
  node: ts.Expression
): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
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
        importedName: 'default',
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
        importedName: '*',
        moduleSpecifier: moduleSpecifier.text,
      });
    }
  }
  return importMap;
}

function getExpressionLabel(
  sourceFile: ts.SourceFile,
  fileRel: string,
  expression: ts.Expression
): string {
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

async function extractRouteEndpoints(params: {
  serverRoot: string;
  repoRoot: string;
}): Promise<RouteExtractionResult> {
  const routesDir = path.resolve(params.serverRoot, 'src/routes');
  const routeFiles = (await listFilesRecursive(routesDir)).filter((fileAbs) =>
    fileAbs.endsWith('.ts')
  );
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
        if (ts.isIdentifier(caller) && caller.text === 'router' && ROUTE_METHODS.has(method)) {
          const [pathArg, ...remainingArgs] = node.arguments;
          if (!pathArg) {
            warnings.push(
              `[route-skip] missing path argument: ${routeFileRel}:${getNodeLine(sourceFile, node)}`
            );
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
            const routeMiddlewares = middlewareArgs.map((arg) =>
              getExpressionLabel(sourceFile, routeFileRel, arg)
            );

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

async function resolveImportToFile(
  fromFileAbs: string,
  moduleSpecifier: string
): Promise<string | null> {
  if (!moduleSpecifier.startsWith('.')) {
    return null;
  }
  const basePath = path.resolve(path.dirname(fromFileAbs), moduleSpecifier);
  const candidates = new Set<string>();

  candidates.add(basePath);
  if (basePath.endsWith('.js')) {
    candidates.add(basePath.slice(0, -3) + '.ts');
  } else if (!path.extname(basePath)) {
    candidates.add(`${basePath}.ts`);
    candidates.add(`${basePath}.tsx`);
    candidates.add(path.join(basePath, 'index.ts'));
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
    if (
      ts.isFunctionDeclaration(statement) &&
      hasExportModifier(statement) &&
      statement.name?.text === params.exportName
    ) {
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
    if (
      !ts.isExportDeclaration(statement) ||
      !statement.exportClause ||
      statement.moduleSpecifier
    ) {
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
    if (
      !ts.isExportDeclaration(statement) ||
      !statement.moduleSpecifier ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      continue;
    }

    const targetModuleAbs = await resolveImportToFile(
      params.fileAbs,
      statement.moduleSpecifier.text
    );
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

function formatRedirectTargetExpression(
  expression: ts.Expression,
  sourceFile: ts.SourceFile
): string {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.text;
  }
  return sanitizeInlineLabel(expression.getText(sourceFile));
}

function extractRedirectTargetsFromSourceFile(sourceFile: ts.SourceFile): string[] {
  const targets: string[] = [];

  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'redirect'
    ) {
      const firstArg = node.arguments[0];
      if (!firstArg) {
        targets.push('<missing>');
      } else {
        targets.push(formatRedirectTargetExpression(firstArg, sourceFile));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return dedupePreserveOrder(targets);
}

function extractRenderDiagnosticsFromSourceFile(sourceFile: ts.SourceFile): RenderDiagnostics {
  const statuses: string[] = [];

  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'render'
    ) {
      const renderReceiver = node.expression.expression;
      if (
        ts.isCallExpression(renderReceiver) &&
        ts.isPropertyAccessExpression(renderReceiver.expression) &&
        renderReceiver.expression.name.text === 'status'
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

function addBindingValues(bindings: KeyBindings, name: string, values: string[]) {
  if (values.length === 0) {
    return;
  }
  const existing = bindings.get(name) ?? [];
  bindings.set(name, dedupePreserveOrder([...existing, ...values]));
}

function resolveExpressionToStringLiterals(
  expression: ts.Expression,
  resolveIdentifierValues: (name: string) => string[]
): string[] {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return [expression.text];
  }
  if (ts.isIdentifier(expression)) {
    return resolveIdentifierValues(expression.text);
  }
  if (ts.isConditionalExpression(expression)) {
    return dedupePreserveOrder([
      ...resolveExpressionToStringLiterals(expression.whenTrue, resolveIdentifierValues),
      ...resolveExpressionToStringLiterals(expression.whenFalse, resolveIdentifierValues),
    ]);
  }
  return [];
}

function collectLocalLiteralBindings(
  sourceFile: ts.SourceFile,
  parentKeyBindings: KeyBindings | undefined
): KeyBindings {
  const localBindings: KeyBindings = new Map();
  const resolveIdentifierValues = (name: string): string[] => {
    const fromLocal = localBindings.get(name);
    if (fromLocal && fromLocal.length > 0) {
      return fromLocal;
    }
    const fromParent = parentKeyBindings?.get(name);
    if (fromParent && fromParent.length > 0) {
      return fromParent;
    }
    return [];
  };

  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const values = resolveExpressionToStringLiterals(node.initializer, resolveIdentifierValues);
      addBindingValues(localBindings, node.name.text, values);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return localBindings;
}

function collectIdentifierCallInvocations(
  sourceFile: ts.SourceFile,
  resolveIdentifierValues: (name: string) => string[]
): Map<string, CallInvocation[]> {
  const invocationsByName = new Map<string, CallInvocation[]>();
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const invocation: CallInvocation = { argValuesByIndex: new Map<number, string[]>() };
      for (const [index, arg] of node.arguments.entries()) {
        const values = resolveExpressionToStringLiterals(arg, resolveIdentifierValues);
        if (values.length > 0) {
          invocation.argValuesByIndex.set(index, dedupePreserveOrder(values));
        }
      }
      const calledName = node.expression.text;
      const items = invocationsByName.get(calledName) ?? [];
      items.push(invocation);
      invocationsByName.set(calledName, items);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return invocationsByName;
}

function findPrimaryFunctionLikeNode(
  sourceFile: ts.SourceFile
): ts.FunctionLikeDeclarationBase | null {
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement)) {
      return statement;
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const initializer = declaration.initializer;
        if (
          initializer &&
          (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
        ) {
          return initializer;
        }
      }
    }
    if (ts.isExpressionStatement(statement) && ts.isBinaryExpression(statement.expression)) {
      const right = statement.expression.right;
      if (ts.isArrowFunction(right) || ts.isFunctionExpression(right)) {
        return right;
      }
    }
  }
  return null;
}

function deriveBindingsForDeclaration(
  declarationText: string,
  invocations: CallInvocation[]
): KeyBindings {
  if (invocations.length === 0) {
    return new Map();
  }
  const sourceFile = parseTypeScriptSource('decl.ts', declarationText);
  const functionLike = findPrimaryFunctionLikeNode(sourceFile);
  if (!functionLike) {
    return new Map();
  }

  const bindings: KeyBindings = new Map();
  for (const [index, parameter] of functionLike.parameters.entries()) {
    if (!ts.isIdentifier(parameter.name)) {
      continue;
    }
    const values: string[] = [];
    for (const invocation of invocations) {
      const currentValues = invocation.argValuesByIndex.get(index);
      if (!currentValues) {
        continue;
      }
      values.push(...currentValues);
    }
    addBindingValues(bindings, parameter.name.text, values);
  }

  return bindings;
}

function serializeKeyBindings(bindings: KeyBindings): string {
  const keys = [...bindings.keys()].sort();
  const serialized = keys.map((key) => {
    const values = [...(bindings.get(key) ?? [])].sort();
    return `${key}=${values.join('|')}`;
  });
  return serialized.join(';');
}

function isAssignmentOperator(kind: ts.SyntaxKind): boolean {
  return (
    kind === ts.SyntaxKind.EqualsToken ||
    kind === ts.SyntaxKind.PlusEqualsToken ||
    kind === ts.SyntaxKind.MinusEqualsToken ||
    kind === ts.SyntaxKind.AsteriskEqualsToken ||
    kind === ts.SyntaxKind.AsteriskAsteriskEqualsToken ||
    kind === ts.SyntaxKind.SlashEqualsToken ||
    kind === ts.SyntaxKind.PercentEqualsToken ||
    kind === ts.SyntaxKind.LessThanLessThanEqualsToken ||
    kind === ts.SyntaxKind.GreaterThanGreaterThanEqualsToken ||
    kind === ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken ||
    kind === ts.SyntaxKind.AmpersandEqualsToken ||
    kind === ts.SyntaxKind.BarEqualsToken ||
    kind === ts.SyntaxKind.CaretEqualsToken ||
    kind === ts.SyntaxKind.BarBarEqualsToken ||
    kind === ts.SyntaxKind.AmpersandAmpersandEqualsToken ||
    kind === ts.SyntaxKind.QuestionQuestionEqualsToken
  );
}

function unwrapExpressionNode(node: ts.Node): ts.Node {
  if (ts.isParenthesizedExpression(node)) {
    return unwrapExpressionNode(node.expression);
  }
  if (ts.isNonNullExpression(node)) {
    return unwrapExpressionNode(node.expression);
  }
  if (ts.isAsExpression(node)) {
    return unwrapExpressionNode(node.expression);
  }
  if (ts.isTypeAssertionExpression(node)) {
    return unwrapExpressionNode(node.expression);
  }
  return node;
}

function getElementAccessSegment(node: ts.ElementAccessExpression): SessionPathSegment {
  const argumentExpression = node.argumentExpression;
  if (!argumentExpression) {
    return { kind: 'dynamic' };
  }
  if (
    ts.isStringLiteral(argumentExpression) ||
    ts.isNoSubstitutionTemplateLiteral(argumentExpression)
  ) {
    return { kind: 'literal', value: argumentExpression.text };
  }
  if (ts.isNumericLiteral(argumentExpression)) {
    return { kind: 'literal', value: argumentExpression.text };
  }
  if (ts.isIdentifier(argumentExpression)) {
    return { kind: 'identifier', value: argumentExpression.text };
  }
  return { kind: 'dynamic' };
}

function getSessionSegments(node: ts.Node): SessionPathSegment[] | null {
  const segments: SessionPathSegment[] = [];
  let current: ts.Node = node;

  while (true) {
    const unwrapped = unwrapExpressionNode(current);
    if (isReqSessionObjectExpression(unwrapped)) {
      return segments.reverse();
    }
    if (ts.isPropertyAccessExpression(unwrapped)) {
      segments.push({ kind: 'literal', value: unwrapped.name.text });
      current = unwrapped.expression;
      continue;
    }
    if (ts.isElementAccessExpression(unwrapped)) {
      segments.push(getElementAccessSegment(unwrapped));
      current = unwrapped.expression;
      continue;
    }
    return null;
  }
}

function normalizeSessionKey(raw: string | undefined): string {
  const key = sanitizeInlineLabel(raw ?? '');
  if (!key) {
    return SESSION_ROOT_KEY;
  }
  return key;
}

function getSessionKeysFromChain(
  node: ts.Node,
  resolveIdentifierValues: (name: string) => string[]
): string[] {
  const segments = getSessionSegments(node);
  if (!segments) {
    return [];
  }
  const firstSegment = segments[0];
  if (!firstSegment) {
    return [SESSION_ROOT_KEY];
  }
  if (firstSegment.kind === 'literal') {
    return [normalizeSessionKey(firstSegment.value)];
  }
  if (firstSegment.kind === 'identifier') {
    const values = resolveIdentifierValues(firstSegment.value).map((value) =>
      normalizeSessionKey(value)
    );
    if (values.length > 0) {
      return dedupePreserveOrder(values);
    }
    return [SESSION_DYNAMIC_KEY];
  }
  return [SESSION_DYNAMIC_KEY];
}

function isReqSessionObjectExpression(node: ts.Node): boolean {
  return (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'req' &&
    node.name.text === 'session'
  );
}

function isSessionChainExpression(node: ts.Node): boolean {
  if (isReqSessionObjectExpression(unwrapExpressionNode(node))) {
    return true;
  }
  if (getSessionSegments(node)) {
    return true;
  }
  return false;
}

function isSessionWriteMethodCall(node: ts.CallExpression): boolean {
  if (!ts.isPropertyAccessExpression(node.expression)) {
    return false;
  }
  const method = node.expression.name.text;
  if (!['regenerate', 'save', 'destroy'].includes(method)) {
    return false;
  }
  return isSessionChainExpression(node.expression.expression);
}

function isSessionReadNode(
  node: ts.PropertyAccessExpression | ts.ElementAccessExpression
): boolean {
  const parent = node.parent;
  if (!parent) {
    return true;
  }
  if (
    (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) &&
    parent.expression === node
  ) {
    return false;
  }
  if (
    ts.isBinaryExpression(parent) &&
    parent.left === node &&
    isAssignmentOperator(parent.operatorToken.kind)
  ) {
    return false;
  }
  if (ts.isDeleteExpression(parent) && parent.expression === node) {
    return false;
  }
  if (
    ts.isCallExpression(parent) &&
    parent.expression === node &&
    isSessionWriteMethodCall(parent)
  ) {
    return false;
  }
  return true;
}

function detectSessionAccessInSourceFile(
  sourceFile: ts.SourceFile,
  options?: { keyBindings?: KeyBindings }
): SessionAccess {
  const localBindings = collectLocalLiteralBindings(sourceFile, options?.keyBindings);
  const resolveIdentifierValues = (name: string): string[] => {
    const fromLocal = localBindings.get(name);
    if (fromLocal && fromLocal.length > 0) {
      return fromLocal;
    }
    const fromContext = options?.keyBindings?.get(name);
    if (fromContext && fromContext.length > 0) {
      return fromContext;
    }
    return [];
  };
  let read = false;
  let write = false;
  const readKeys: string[] = [];
  const writeKeys: string[] = [];

  const addReadKeys = (keys: string[]) => {
    if (keys.length === 0) {
      return;
    }
    readKeys.push(...keys);
  };
  const addWriteKeys = (keys: string[]) => {
    if (keys.length === 0) {
      return;
    }
    writeKeys.push(...keys);
  };

  const visit = (node: ts.Node) => {
    if (
      ts.isBinaryExpression(node) &&
      isAssignmentOperator(node.operatorToken.kind) &&
      isSessionChainExpression(node.left)
    ) {
      write = true;
      addWriteKeys(getSessionKeysFromChain(node.left, resolveIdentifierValues));
    }
    if (ts.isDeleteExpression(node) && isSessionChainExpression(node.expression)) {
      write = true;
      addWriteKeys(getSessionKeysFromChain(node.expression, resolveIdentifierValues));
    }
    if (ts.isCallExpression(node) && isSessionWriteMethodCall(node)) {
      write = true;
      if (ts.isPropertyAccessExpression(node.expression)) {
        addWriteKeys(getSessionKeysFromChain(node.expression.expression, resolveIdentifierValues));
      } else {
        addWriteKeys([SESSION_ROOT_KEY]);
      }
    }
    if (
      (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
      isSessionChainExpression(node)
    ) {
      if (isSessionReadNode(node)) {
        read = true;
        addReadKeys(getSessionKeysFromChain(node, resolveIdentifierValues));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  if (read && readKeys.length === 0) {
    readKeys.push(SESSION_ROOT_KEY);
  }
  if (write && writeKeys.length === 0) {
    writeKeys.push(SESSION_ROOT_KEY);
  }

  return {
    read,
    write,
    readKeys: dedupePreserveOrder(readKeys),
    writeKeys: dedupePreserveOrder(writeKeys),
  };
}

function mergeSessionAccess(base: SessionAccess, incoming: SessionAccess): SessionAccess {
  return {
    read: base.read || incoming.read,
    write: base.write || incoming.write,
    readKeys: dedupePreserveOrder([...base.readKeys, ...incoming.readKeys]),
    writeKeys: dedupePreserveOrder([...base.writeKeys, ...incoming.writeKeys]),
  };
}

async function detectSessionAccessThroughHelpers(params: {
  handlerFileAbs: string | null;
  repoRoot: string;
  handlerSourceFile: ts.SourceFile;
}): Promise<SessionAccess> {
  if (!params.handlerFileAbs) {
    return detectSessionAccessInSourceFile(params.handlerSourceFile);
  }
  let found: SessionAccess = { read: false, write: false, readKeys: [], writeKeys: [] };

  const maxDepth = 2;
  const visited = new Set<string>();
  const queue: Array<{
    fileAbs: string;
    sourceFile: ts.SourceFile;
    depth: number;
    keyBindings: KeyBindings;
  }> = [
    {
      fileAbs: params.handlerFileAbs,
      sourceFile: params.handlerSourceFile,
      depth: 0,
      keyBindings: new Map(),
    },
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    const currentAccess = detectSessionAccessInSourceFile(current.sourceFile, {
      keyBindings: current.keyBindings,
    });
    found = mergeSessionAccess(found, currentAccess);
    if (current.depth >= maxDepth) {
      continue;
    }

    const currentLocalBindings = collectLocalLiteralBindings(
      current.sourceFile,
      current.keyBindings
    );
    const resolveIdentifierValues = (name: string): string[] => {
      const localValues = currentLocalBindings.get(name);
      if (localValues && localValues.length > 0) {
        return localValues;
      }
      const contextValues = current.keyBindings.get(name);
      if (contextValues && contextValues.length > 0) {
        return contextValues;
      }
      return [];
    };
    const callsByName = collectIdentifierCallInvocations(
      current.sourceFile,
      resolveIdentifierValues
    );
    const calledNames = [...callsByName.keys()];
    if (calledNames.length === 0) {
      continue;
    }

    const { sourceFile } = await readSourceFile(current.fileAbs);
    const importMap = getImportMap(sourceFile);

    for (const calledName of calledNames) {
      const invocations = callsByName.get(calledName) ?? [];
      const localDecl = findLocalDeclaration(sourceFile, calledName);
      if (localDecl) {
        const localDeclText = localDecl.getText(sourceFile);
        const nextBindings = deriveBindingsForDeclaration(localDeclText, invocations);
        const localKey = `${current.fileAbs}::local::${calledName}::${serializeKeyBindings(nextBindings)}`;
        if (!visited.has(localKey)) {
          visited.add(localKey);
          queue.push({
            fileAbs: current.fileAbs,
            sourceFile: parseTypeScriptSource('decl-local.ts', localDeclText),
            depth: current.depth + 1,
            keyBindings: nextBindings,
          });
        }
      }

      const binding = importMap.get(calledName);
      if (!binding || binding.importedName === '*') {
        continue;
      }
      const importedFileAbs = await resolveImportToFile(current.fileAbs, binding.moduleSpecifier);
      if (!importedFileAbs) {
        continue;
      }

      const resolvedDecl = await resolveExportedDeclaration({
        fileAbs: importedFileAbs,
        exportName: binding.importedName,
        repoRoot: params.repoRoot,
        visited: new Set<string>(),
      });
      if (!resolvedDecl) {
        continue;
      }

      const nextBindings = deriveBindingsForDeclaration(resolvedDecl.text, invocations);
      const importKey = `${resolvedDecl.fileAbs}::import::${binding.importedName}::${serializeKeyBindings(nextBindings)}`;
      if (visited.has(importKey)) {
        continue;
      }
      visited.add(importKey);
      queue.push({
        fileAbs: resolvedDecl.fileAbs,
        sourceFile: parseTypeScriptSource('decl-import.ts', resolvedDecl.text),
        depth: current.depth + 1,
        keyBindings: nextBindings,
      });
    }
  }

  return found;
}

async function scanSinksAndExits(params: {
  handlerText: string;
  handlerFileAbs: string | null;
  repoRoot: string;
}): Promise<{
  sinks: Sink[];
  exits: Exit[];
  redirectTargets: string[];
  renderDiagnostics: RenderDiagnostics;
  sessionAccess: SessionAccess;
}> {
  const sinks: Sink[] = [];
  const exits: Exit[] = [];
  const handlerSource = parseTypeScriptSource('handler.ts', params.handlerText);
  const redirectTargets = extractRedirectTargetsFromSourceFile(handlerSource);
  const renderDiagnostics = extractRenderDiagnosticsFromSourceFile(handlerSource);

  for (const rule of SINK_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(params.handlerText))) {
      sinks.push(rule.sink);
    }
  }
  for (const rule of EXIT_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(params.handlerText))) {
      exits.push(rule.exit);
    }
  }
  const sessionAccess = await detectSessionAccessThroughHelpers({
    handlerFileAbs: params.handlerFileAbs,
    repoRoot: params.repoRoot,
    handlerSourceFile: handlerSource,
  });
  if (sessionAccess.read) {
    sinks.push(SESSION_READ_SINK);
  }
  if (sessionAccess.write) {
    sinks.push(SESSION_WRITE_SINK);
  }

  return {
    sinks,
    exits,
    redirectTargets,
    renderDiagnostics,
    sessionAccess,
  };
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

function annotateRedirectTargetWithMethod(params: {
  target: string;
  pathMethodIndex: Map<string, Set<string>>;
}): string {
  const trimmed = params.target.trim();
  if (!trimmed.startsWith('/')) {
    return trimmed;
  }
  const methods = params.pathMethodIndex.get(trimmed);
  if (!methods || methods.size === 0) {
    return trimmed;
  }
  if (methods.has('GET')) {
    return `GET ${trimmed}`;
  }
  const ordered = [...methods].sort((left, right) => compareMethods(left, right));
  if (ordered.length === 1) {
    return `${ordered[0]} ${trimmed}`;
  }
  return `${ordered.join('|')} ${trimmed}`;
}

function normalizeRedirectTarget(target: string): string {
  let normalized = target.trim();
  if (normalized.startsWith('`') && normalized.endsWith('`') && normalized.length >= 2) {
    normalized = normalized.slice(1, -1);
  }
  return normalized;
}

function formatRedirectTargetForDisplay(target: string): string {
  let formatted = normalizeRedirectTarget(target);
  formatted = formatted.replace(
    /\$\{([^}]+)\}/g,
    (_match, inner: string) => `<i>{${inner.trim()}}</i>`
  );
  if (/^[A-Za-z_$][\w$.]*$/.test(formatted)) {
    return `<i>{${formatted}}</i>`;
  }
  return formatted;
}

function normalizeRouteSegmentPattern(segment: string): string {
  return segment.replace(/:[A-Za-z0-9_]+/g, ':');
}

function normalizeExpressionSegmentPattern(segment: string): string {
  return segment.replace(/\$\{[^}]+\}/g, ':').replace(/<i>\{[^}]+\}<\/i>/g, ':');
}

function inferRouteTemplatePathFromExpressionPath(params: {
  expressionPath: string;
  knownPaths: string[];
}): string | null {
  const expressionPath = params.expressionPath.trim();
  if (!expressionPath.startsWith('/')) {
    return null;
  }
  const expressionSegments = expressionPath.split('/');
  for (const knownPath of params.knownPaths) {
    const routeSegments = knownPath.split('/');
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
  if (normalizedTarget.startsWith('/')) {
    return [
      annotateRedirectTargetWithMethod({
        target: normalizedTarget,
        pathMethodIndex: params.pathMethodIndex,
      }),
    ];
  }
  return [formatRedirectTargetForDisplay(normalizedTarget)];
}

function buildEndpointId(method: string, routePath: string): string {
  let normalizedPath = routePath.replace(/^\/+/, '');
  normalizedPath = normalizedPath.replace(/:([A-Za-z0-9_]+)/g, '$1');
  normalizedPath = normalizedPath.replace(/\//g, '__');
  normalizedPath = normalizedPath.replace(/[^A-Za-z0-9_]/g, '_');
  normalizedPath = normalizedPath.replace(/_+/g, '_');
  normalizedPath = normalizedPath.replace(/^_+|_+$/g, '');
  if (!normalizedPath) {
    normalizedPath = 'root';
  }
  return `${method.toUpperCase()}__${normalizedPath}`;
}

function buildSessionKeyNodesForSinks(params: {
  lines: string[];
  sinkNodeIds: string[];
  keys: string[];
  nodePrefix: string;
  flashSessionKeyNodeIds: string[];
  authSessionKeyNodeIds: string[];
  otherSessionKeyNodeIds: string[];
}): string[] {
  const keyNodeIds: string[] = [];
  if (params.sinkNodeIds.length === 0 || params.keys.length === 0) {
    return keyNodeIds;
  }

  for (const [index, key] of params.keys.entries()) {
    const nodeId = `${params.nodePrefix}${index + 1}`;
    const keyLabel = formatSessionKeyForDisplay(key).replace(/"/g, "'");
    keyNodeIds.push(nodeId);
    const category = classifySessionKey(key);
    if (category === 'flash') {
      params.flashSessionKeyNodeIds.push(nodeId);
    } else if (category === 'auth') {
      params.authSessionKeyNodeIds.push(nodeId);
    } else {
      params.otherSessionKeyNodeIds.push(nodeId);
    }
    params.lines.push(`${nodeId}["${keyLabel}"]`);
  }

  for (const sinkNodeId of params.sinkNodeIds) {
    for (const keyNodeId of keyNodeIds) {
      params.lines.push(`${sinkNodeId} --> ${keyNodeId}`);
    }
  }

  return keyNodeIds;
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
  sessionAccess: SessionAccess;
  pathMethodIndex: Map<string, Set<string>>;
}): string {
  const lines: string[] = ['flowchart TD'];
  const middlewareNodeIds: string[] = [];
  const sinkNodeIds: string[] = [];
  const sessionReadSinkNodeIds: string[] = [];
  const sessionWriteSinkNodeIds: string[] = [];
  let sessionReadKeyNodeIds: string[] = [];
  let sessionWriteKeyNodeIds: string[] = [];
  const flashSessionKeyNodeIds: string[] = [];
  const authSessionKeyNodeIds: string[] = [];
  const otherSessionKeyNodeIds: string[] = [];
  const exitNodeIds: string[] = [];
  const renderExitNodeIds: string[] = [];
  const redirectExitNodeIds: string[] = [];
  const renderDiagnosticNodeIds: string[] = [];
  const maxNodes = 30;
  const renderDiagnosticItems = [...params.renderDiagnostics.statuses];
  const sessionReadKeys = dedupePreserveOrder(params.sessionAccess.readKeys);
  const sessionWriteKeys = dedupePreserveOrder(params.sessionAccess.writeKeys);

  lines.push(`subgraph ENTRY_BLOCK["[ENTRY]"]`);
  lines.push('direction TB');
  lines.push(`ENTRY["${params.method.toUpperCase()} ${params.path}"]`);
  lines.push('end');
  let currentNode = 'ENTRY';

  const middlewareChain = [
    ...(params.globalMiddlewares.length > 0 ? ['<b>[Global Middlewares]</b>'] : []),
    ...params.routeMiddlewares,
  ];
  const reservedNodes =
    1 +
    1 +
    params.sinks.length +
    params.exits.length +
    renderDiagnosticItems.length +
    sessionReadKeys.length +
    sessionWriteKeys.length +
    (params.redirectTargets.length > 0 ? 1 : 0);
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
    lines.push('direction TB');
    for (const [index, middleware] of effectiveMiddlewares.entries()) {
      const nodeId = `MIDDLEWARE${index + 1}`;
      const label = formatCallableLabel(middleware).slice(0, 90).replace(/"/g, "'");
      middlewareNodeIds.push(nodeId);
      lines.push(`${nodeId}["${label}"]`);
    }
    lines.push('end');
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
  lines.push('direction TB');
  lines.push(`HANDLER["${handlerLabel}"]`);
  lines.push('end');
  lines.push(`${currentNode} --> HANDLER`);

  if (renderDiagnosticItems.length > 0) {
    lines.push(`subgraph ERROR_STATUS["[ERROR STATUS]"]`);
    lines.push('direction TB');
    for (const [index, status] of renderDiagnosticItems.entries()) {
      const nodeId = `RDIAG${index + 1}`;
      const label = sanitizeInlineLabel(status).slice(0, 120).replace(/"/g, "'");
      renderDiagnosticNodeIds.push(nodeId);
      lines.push(`${nodeId}["${label}"]`);
    }
    lines.push('end');
  }

  if (params.sinks.length > 0) {
    lines.push(`subgraph SINKS["[SINKS]"]`);
    lines.push('direction TB');
    for (const [index, sink] of params.sinks.entries()) {
      const nodeId = `SINK${index + 1}`;
      sinkNodeIds.push(nodeId);
      let sinkLabelRaw: string = sink;
      if (sink === SESSION_READ_SINK) {
        sinkLabelRaw = 'Session<br/>(Read)';
        sessionReadSinkNodeIds.push(nodeId);
      }
      if (sink === SESSION_WRITE_SINK) {
        sinkLabelRaw = 'Session<br/>(Write)';
        sessionWriteSinkNodeIds.push(nodeId);
      }
      const sinkLabel = sinkLabelRaw.replace(/"/g, "'");
      lines.push(`${nodeId}["${sinkLabel}"]`);
    }
    lines.push('end');
    for (const nodeId of sinkNodeIds) {
      lines.push(`HANDLER --> ${nodeId}`);
    }
  }

  sessionReadKeyNodeIds = buildSessionKeyNodesForSinks({
    lines,
    sinkNodeIds: sessionReadSinkNodeIds,
    keys: sessionReadKeys,
    nodePrefix: 'SINK_READ_KEY',
    flashSessionKeyNodeIds,
    authSessionKeyNodeIds,
    otherSessionKeyNodeIds,
  });
  sessionWriteKeyNodeIds = buildSessionKeyNodesForSinks({
    lines,
    sinkNodeIds: sessionWriteSinkNodeIds,
    keys: sessionWriteKeys,
    nodePrefix: 'SINK_WRITE_KEY',
    flashSessionKeyNodeIds,
    authSessionKeyNodeIds,
    otherSessionKeyNodeIds,
  });

  if (params.exits.length > 0) {
    lines.push(`subgraph EXITS["[EXITS]"]`);
    lines.push('direction TB');
    for (const [index, exitKind] of params.exits.entries()) {
      const nodeId = `EXIT${index + 1}`;
      exitNodeIds.push(nodeId);
      if (exitKind === 'res.render()') {
        renderExitNodeIds.push(nodeId);
      }
      if (exitKind === 'res.redirect()' && params.redirectTargets.length > 0) {
        redirectExitNodeIds.push(nodeId);
      }
      const exitLabel = exitKind === 'res.redirect()' ? 'REDIRECT' : exitKind;
      lines.push(`${nodeId}["${exitLabel}"]`);
    }
    lines.push('end');
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
    lines.push('direction TB');
    for (const [index, nextEntryRaw] of nextEntries.entries()) {
      const nodeId = `NEXT_ENTRY${index + 1}`;
      const label = nextEntryRaw.replace(/"/g, "'");
      nextEntryNodeIds.push(nodeId);
      lines.push(`${nodeId}["${label}"]`);
    }
    lines.push('end');
    for (const redirectExitNodeId of redirectExitNodeIds) {
      for (const nextEntryNodeId of nextEntryNodeIds) {
        lines.push(`${redirectExitNodeId} --> ${nextEntryNodeId}`);
      }
    }
  }

  lines.push('classDef middleware font-size:10px,padding:2px,stroke-width:1;');
  lines.push('classDef diagnostics stroke-dasharray: 2 2;');
  lines.push('classDef sink stroke-width:2;');
  const hasSessionKeyNodes = sessionReadKeyNodeIds.length > 0 || sessionWriteKeyNodeIds.length > 0;
  if (hasSessionKeyNodes) {
    lines.push('classDef sessionKey font-size:10px,padding:2px;');
    lines.push('classDef flash stroke-dasharray: 5 3,stroke-width:1.5;');
    lines.push('classDef auth stroke-dasharray: 0,stroke-width:1.5;');
    lines.push('classDef other stroke:#6b7280;');
  }
  lines.push('classDef exit stroke-dasharray: 4 2;');

  if (middlewareNodeIds.length > 0) {
    lines.push(`class ${middlewareNodeIds.join(',')} middleware;`);
  }
  if (renderDiagnosticNodeIds.length > 0) {
    lines.push(`class ${renderDiagnosticNodeIds.join(',')} diagnostics;`);
  }
  if (sinkNodeIds.length > 0) {
    lines.push(`class ${sinkNodeIds.join(',')} sink;`);
  }
  if (hasSessionKeyNodes && sessionReadKeyNodeIds.length > 0) {
    lines.push(`class ${sessionReadKeyNodeIds.join(',')} sessionKey;`);
  }
  if (hasSessionKeyNodes && sessionWriteKeyNodeIds.length > 0) {
    lines.push(`class ${sessionWriteKeyNodeIds.join(',')} sessionKey;`);
  }
  if (hasSessionKeyNodes && flashSessionKeyNodeIds.length > 0) {
    lines.push(`class ${dedupePreserveOrder(flashSessionKeyNodeIds).join(',')} flash;`);
  }
  if (hasSessionKeyNodes && authSessionKeyNodeIds.length > 0) {
    lines.push(`class ${dedupePreserveOrder(authSessionKeyNodeIds).join(',')} auth;`);
  }
  if (hasSessionKeyNodes && otherSessionKeyNodeIds.length > 0) {
    lines.push(`class ${dedupePreserveOrder(otherSessionKeyNodeIds).join(',')} other;`);
  }
  if (exitNodeIds.length > 0) {
    lines.push(`class ${exitNodeIds.join(',')} exit;`);
  }

  return `${lines.join('\n')}\n`;
}

function buildGlobalMiddlewaresMermaid(globalMiddlewares: string[]): string {
  const lines: string[] = ['flowchart TD'];
  const nodeIds: string[] = [];

  lines.push(`subgraph ENTRY_BLOCK["[ENTRY]"]`);
  lines.push('direction TB');
  lines.push(`ENTRY["Global Middleware Chain"]`);
  lines.push('end');

  if (globalMiddlewares.length === 0) {
    lines.push(`ENTRY --> EMPTY["(none)"]`);
    return `${lines.join('\n')}\n`;
  }

  lines.push(`subgraph GLOBAL_MIDDLEWARES["[GLOBAL MIDDLEWARES]"]`);
  lines.push('direction TB');
  for (const [index, middleware] of globalMiddlewares.entries()) {
    const nodeId = `GMW${index + 1}`;
    const label = sanitizeInlineLabel(middleware).slice(0, 100).replace(/"/g, "'");
    nodeIds.push(nodeId);
    lines.push(`${nodeId}["${label}"]`);
  }
  lines.push('end');

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

  lines.push('classDef middleware font-size:10px,padding:2px,stroke-width:1;');
  if (nodeIds.length > 0) {
    lines.push(`class ${nodeIds.join(',')} middleware;`);
  }

  return `${lines.join('\n')}\n`;
}

type SessionKeyUsage = {
  key: string;
  readEndpoints: string[];
  writeEndpoints: string[];
};

type SessionUsageGroups = {
  root: SessionKeyUsage | null;
  flash: SessionKeyUsage[];
  auth: SessionKeyUsage[];
  other: SessionKeyUsage[];
  all: SessionKeyUsage[];
};

type DomainSummary = {
  domain: string;
  routeFiles: string[];
  endpointCount: number;
  endpointIds: string[];
  sessionReadKeys: string[];
  sessionWriteKeys: string[];
  sessionReadKeyLabels: string[];
  sessionWriteKeyLabels: string[];
};

function formatSessionKeyForDisplay(key: string): string {
  if (key === SESSION_ROOT_KEY) {
    return 'session (root)';
  }
  if (key === SESSION_DYNAMIC_KEY) {
    return 'session[dynamic]';
  }
  return `session.${key}`;
}

function isFlashSessionKey(key: string): boolean {
  return /FlashMessage$/i.test(key);
}

function classifySessionKey(key: string): 'root' | 'flash' | 'auth' | 'other' {
  if (key === SESSION_ROOT_KEY) {
    return 'root';
  }
  if (key === SESSION_DYNAMIC_KEY) {
    return 'other';
  }
  if (isFlashSessionKey(key)) {
    return 'flash';
  }
  return 'auth';
}

function buildEndpointLabel(endpoint: FlowEndpoint): string {
  return `${endpoint.method} ${endpoint.path}`;
}

function buildSessionAccessDetailLabel(kind: 'READ' | 'WRITE', endpoints: string[]): string {
  if (endpoints.length === 0) {
    return `${kind}: 0`;
  }
  return `${kind}: ${endpoints.length}<br/>${endpoints.join('<br/>')}`;
}

function buildSessionAccessSummary(flowEndpoints: FlowEndpoint[]): SessionKeyUsage[] {
  const byKey = new Map<string, { reads: Set<string>; writes: Set<string> }>();

  for (const endpoint of flowEndpoints) {
    const endpointLabel = buildEndpointLabel(endpoint);
    for (const key of endpoint.sessionAccess.readKeys) {
      const slot = byKey.get(key) ?? { reads: new Set<string>(), writes: new Set<string>() };
      slot.reads.add(endpointLabel);
      byKey.set(key, slot);
    }
    for (const key of endpoint.sessionAccess.writeKeys) {
      const slot = byKey.get(key) ?? { reads: new Set<string>(), writes: new Set<string>() };
      slot.writes.add(endpointLabel);
      byKey.set(key, slot);
    }
  }

  return [...byKey.entries()]
    .map(([key, access]) => {
      const readEndpoints = [...access.reads].sort();
      const writeEndpoints = [...access.writes].sort();
      return { key, readEndpoints, writeEndpoints };
    })
    .sort((left, right) => left.key.localeCompare(right.key));
}

function groupSessionUsage(summary: SessionKeyUsage[]): SessionUsageGroups {
  const groups: SessionUsageGroups = {
    root: null,
    flash: [],
    auth: [],
    other: [],
    all: summary,
  };
  for (const item of summary) {
    const category = classifySessionKey(item.key);
    if (category === 'root') {
      groups.root = item;
      continue;
    }
    if (category === 'flash') {
      groups.flash.push(item);
      continue;
    }
    if (category === 'auth') {
      groups.auth.push(item);
      continue;
    }
    groups.other.push(item);
  }
  return groups;
}

function buildSessionAccessMermaid(summary: SessionUsageGroups): string {
  const lines: string[] = ['flowchart TD'];
  const sessionKeyNodeIds: string[] = [];
  const readNodeIds: string[] = [];
  const writeNodeIds: string[] = [];
  const flashNodeIds: string[] = [];
  const authNodeIds: string[] = [];
  const otherNodeIds: string[] = [];
  const sessionRootNodeId = 'SESSION_ROOT';
  const rootUsage = summary.root;
  const rootLabel = 'session (root)';
  const readNodeDefinitions: string[] = [];
  const writeNodeDefinitions: string[] = [];
  const rootToKeyEdges: string[] = [];
  const keyToReadEdges: string[] = [];
  const keyToWriteEdges: string[] = [];
  const rootToReadEdges: string[] = [];
  const rootToWriteEdges: string[] = [];

  lines.push(`subgraph SESSION_ACCESS["[SESSION ACCESS]"]`);
  lines.push('direction TB');
  lines.push(`ENTRY["Session Access"]`);
  lines.push('end');

  lines.push(`subgraph SESSION["[SESSION]"]`);
  lines.push('direction TB');
  lines.push(`${sessionRootNodeId}["${rootLabel.replace(/"/g, "'")}"]`);
  lines.push('end');

  if (rootUsage && rootUsage.readEndpoints.length > 0) {
    const rootReadNodeId = 'SESSION_ROOT_READ';
    const rootReadLabel = buildSessionAccessDetailLabel('READ', rootUsage.readEndpoints).replace(
      /"/g,
      "'"
    );
    readNodeIds.push(rootReadNodeId);
    readNodeDefinitions.push(`${rootReadNodeId}["${rootReadLabel}"]`);
    rootToReadEdges.push(`${sessionRootNodeId} --> ${rootReadNodeId}`);
  }
  if (rootUsage && rootUsage.writeEndpoints.length > 0) {
    const rootWriteNodeId = 'SESSION_ROOT_WRITE';
    const rootWriteLabel = buildSessionAccessDetailLabel('WRITE', rootUsage.writeEndpoints).replace(
      /"/g,
      "'"
    );
    writeNodeIds.push(rootWriteNodeId);
    writeNodeDefinitions.push(`${rootWriteNodeId}["${rootWriteLabel}"]`);
    rootToWriteEdges.push(`${sessionRootNodeId} --> ${rootWriteNodeId}`);
  }

  const keyGroups = [
    {
      subgraphId: 'SESSION_FLASH_KEYS',
      title: '[FLASH KEYS]',
      category: 'FLASH' as const,
      items: summary.flash,
    },
    {
      subgraphId: 'SESSION_AUTH_KEYS',
      title: '[AUTH KEYS]',
      category: 'AUTH' as const,
      items: summary.auth,
    },
    {
      subgraphId: 'SESSION_OTHER_KEYS',
      title: '[OTHER KEYS]',
      category: 'OTHER' as const,
      items: summary.other,
    },
  ];
  const totalKeyCount = keyGroups.reduce((acc, group) => acc + group.items.length, 0);

  if (totalKeyCount === 0) {
    lines.push(`ENTRY --> ${sessionRootNodeId}`);
    lines.push(...readNodeDefinitions);
    lines.push(...writeNodeDefinitions);
    lines.push(...rootToReadEdges);
    lines.push(...rootToWriteEdges);
    lines.push('classDef session font-size:10px,padding:2px,stroke-width:1;');
    lines.push('classDef readBlock stroke-dasharray: 4 2;');
    lines.push('classDef writeBlock stroke-dasharray: 2 2;');
    lines.push(`class ${sessionRootNodeId} session;`);
    if (readNodeIds.length > 0) {
      lines.push(`class ${readNodeIds.join(',')} readBlock;`);
    }
    if (writeNodeIds.length > 0) {
      lines.push(`class ${writeNodeIds.join(',')} writeBlock;`);
    }
    return `${lines.join('\n')}\n`;
  }

  lines.push(`ENTRY --> ${sessionRootNodeId}`);
  let keyIndex = 0;
  for (const group of keyGroups) {
    if (group.items.length === 0) {
      continue;
    }
    lines.push(`subgraph ${group.subgraphId}["${group.title}"]`);
    lines.push('direction TB');
    for (const item of group.items) {
      keyIndex += 1;
      const nodeId = `SESSION_KEY${keyIndex}`;
      const label = `${formatSessionKeyForDisplay(item.key)}`.replace(/"/g, "'");
      const readNodeId = `SESSION_KEY_READ${keyIndex}`;
      const writeNodeId = `SESSION_KEY_WRITE${keyIndex}`;
      sessionKeyNodeIds.push(nodeId);
      lines.push(`${nodeId}["${label}"]`);
      rootToKeyEdges.push(`${sessionRootNodeId} --> ${nodeId}`);
      if (item.readEndpoints.length > 0) {
        const readLabel = buildSessionAccessDetailLabel('READ', item.readEndpoints).replace(
          /"/g,
          "'"
        );
        readNodeIds.push(readNodeId);
        readNodeDefinitions.push(`${readNodeId}["${readLabel}"]`);
        keyToReadEdges.push(`${nodeId} --> ${readNodeId}`);
      }
      if (item.writeEndpoints.length > 0) {
        const writeLabel = buildSessionAccessDetailLabel('WRITE', item.writeEndpoints).replace(
          /"/g,
          "'"
        );
        writeNodeIds.push(writeNodeId);
        writeNodeDefinitions.push(`${writeNodeId}["${writeLabel}"]`);
        keyToWriteEdges.push(`${nodeId} --> ${writeNodeId}`);
      }
      if (group.category === 'FLASH') {
        flashNodeIds.push(nodeId);
      } else if (group.category === 'AUTH') {
        authNodeIds.push(nodeId);
      } else {
        otherNodeIds.push(nodeId);
      }
    }
    lines.push('end');
  }
  lines.push(...readNodeDefinitions);
  lines.push(...writeNodeDefinitions);
  lines.push(...rootToReadEdges);
  lines.push(...rootToWriteEdges);
  lines.push(...rootToKeyEdges);
  lines.push(...keyToReadEdges);
  lines.push(...keyToWriteEdges);

  lines.push('classDef session font-size:10px,padding:2px,stroke-width:1;');
  lines.push('classDef sessionKey stroke-width:1;');
  lines.push('classDef readBlock stroke-dasharray: 4 2,fill:#dbeafe,stroke:#1d4ed8,color:#0f172a;');
  lines.push(
    'classDef writeBlock stroke-dasharray: 2 2,fill:#ffedd5,stroke:#c2410c,color:#0f172a;'
  );
  lines.push('classDef flash stroke-dasharray: 5 3,stroke-width:1.5;');
  lines.push('classDef auth stroke-dasharray: 0,stroke-width:1.5;');
  lines.push('classDef other stroke:#6b7280;');
  lines.push(`class ${sessionRootNodeId} session;`);
  if (sessionKeyNodeIds.length > 0) {
    lines.push(`class ${sessionKeyNodeIds.join(',')} sessionKey;`);
  }
  if (readNodeIds.length > 0) {
    lines.push(`class ${readNodeIds.join(',')} readBlock;`);
  }
  if (writeNodeIds.length > 0) {
    lines.push(`class ${writeNodeIds.join(',')} writeBlock;`);
  }
  if (flashNodeIds.length > 0) {
    lines.push(`class ${flashNodeIds.join(',')} flash;`);
  }
  if (authNodeIds.length > 0) {
    lines.push(`class ${authNodeIds.join(',')} auth;`);
  }
  if (otherNodeIds.length > 0) {
    lines.push(`class ${otherNodeIds.join(',')} other;`);
  }

  return `${lines.join('\n')}\n`;
}

function splitSessionKeysByCategory(keys: string[]): {
  rootKeys: string[];
  flashKeys: string[];
  authKeys: string[];
  otherKeys: string[];
} {
  const rootKeys: string[] = [];
  const flashKeys: string[] = [];
  const authKeys: string[] = [];
  const otherKeys: string[] = [];

  for (const key of keys) {
    const category = classifySessionKey(key);
    if (category === 'root') {
      rootKeys.push(key);
      continue;
    }
    if (category === 'flash') {
      flashKeys.push(key);
      continue;
    }
    if (category === 'auth') {
      authKeys.push(key);
      continue;
    }
    otherKeys.push(key);
  }

  return {
    rootKeys: dedupePreserveOrder(rootKeys),
    flashKeys: dedupePreserveOrder(flashKeys),
    authKeys: dedupePreserveOrder(authKeys),
    otherKeys: dedupePreserveOrder(otherKeys),
  };
}

function buildSessionKeyUsagePayload(item: SessionKeyUsage) {
  return {
    key: item.key,
    category: classifySessionKey(item.key),
    readCount: item.readEndpoints.length,
    writeCount: item.writeEndpoints.length,
    readEndpoints: item.readEndpoints,
    writeEndpoints: item.writeEndpoints,
  };
}

function buildSessionEndpointCategoryPayload(endpoint: FlowEndpoint) {
  const readSplit = splitSessionKeysByCategory(endpoint.sessionAccess.readKeys);
  const writeSplit = splitSessionKeysByCategory(endpoint.sessionAccess.writeKeys);

  return {
    id: endpoint.id,
    method: endpoint.method,
    path: endpoint.path,
    readKeys: endpoint.sessionAccess.readKeys,
    writeKeys: endpoint.sessionAccess.writeKeys,
    readAuthKeys: readSplit.authKeys,
    readFlashKeys: readSplit.flashKeys,
    readOtherKeys: readSplit.otherKeys,
    readRootKeys: readSplit.rootKeys,
    writeAuthKeys: writeSplit.authKeys,
    writeFlashKeys: writeSplit.flashKeys,
    writeOtherKeys: writeSplit.otherKeys,
    writeRootKeys: writeSplit.rootKeys,
  };
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

async function extractAppFlowContext(params: {
  serverRoot: string;
  repoRoot: string;
}): Promise<AppFlowContext> {
  const appFileAbs = path.resolve(params.serverRoot, 'src/app.ts');
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
    if (!moduleSpecifier.includes('/routes/')) {
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
    routeImportsByLocal.set(
      localName,
      toPosixPath(path.relative(params.repoRoot, resolvedRouteFile))
    );
  }

  const createApp = sourceFile.statements.find((statement) => {
    return ts.isFunctionDeclaration(statement) && statement.name?.text === 'createApp';
  });
  if (!createApp || !ts.isFunctionDeclaration(createApp) || !createApp.body) {
    return { globalMiddlewares: [] };
  }

  const appUseCalls: ts.CallExpression[] = [];
  const collectCalls = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const target = node.expression.expression;
      const method = node.expression.name.text;
      if (ts.isIdentifier(target) && target.text === 'app' && method === 'use') {
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
          return `${mountPath}: ${getExpressionLabel(sourceFile, 'server/src/app.ts', middlewareArg)}`;
        }
      }
      return getExpressionLabel(sourceFile, 'server/src/app.ts', firstArg);
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
    let handlerFileAbs: string | null = endpoint.inlineHandlerText ? endpoint.routeFileAbs : null;
    let handlerLine: number | undefined;
    let handlerText = endpoint.inlineHandlerText ?? '';

    if (!endpoint.inlineHandlerText && endpoint.handlerLocalName) {
      const routeImportMap = params.routeExtraction.importMapsByRouteFile.get(
        endpoint.routeFileAbs
      );
      const binding = routeImportMap?.get(endpoint.handlerLocalName);
      if (!binding) {
        warnings.push(
          `[handler-unresolved] no import binding for '${endpoint.handlerLocalName}' in ${endpoint.routeFileRel}`
        );
      } else {
        const importedSourceFileAbs = await resolveImportToFile(
          endpoint.routeFileAbs,
          binding.moduleSpecifier
        );
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
            handlerFileAbs = resolvedDecl.fileAbs;
            handlerLine = resolvedDecl.line;
            handlerText = resolvedDecl.text;
          }
        }
      }
    }

    const scanned = await scanSinksAndExits({
      handlerText,
      handlerFileAbs,
      repoRoot: params.repoRoot,
    });
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
      sessionAccess: {
        read: scanned.sessionAccess.read,
        write: scanned.sessionAccess.write,
        readKeys: dedupePreserveOrder(scanned.sessionAccess.readKeys),
        writeKeys: dedupePreserveOrder(scanned.sessionAccess.writeKeys),
      },
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
  const flowmapDir = path.resolve(params.repoRoot, 'docs/flowmap');
  const flowDir = path.join(flowmapDir, 'flows');
  await fs.mkdir(flowmapDir, { recursive: true });
  await fs.mkdir(flowDir, { recursive: true });

  const groups = new Map<string, FlowEndpoint[]>();
  for (const endpoint of params.flowEndpoints) {
    const section = path.basename(endpoint.routeFile);
    const items = groups.get(section) ?? [];
    items.push(endpoint);
    groups.set(section, items);
  }

  const domainSummaries: DomainSummary[] = [...groups.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([section, items]) => {
      const sortedItems = [...items].sort((left, right) => {
        const byPath = left.path.localeCompare(right.path);
        if (byPath !== 0) {
          return byPath;
        }
        return compareMethods(left.method, right.method);
      });
      const readKeys = dedupePreserveOrder(
        sortedItems.flatMap((item) => item.sessionAccess.readKeys)
      ).sort((left, right) =>
        formatSessionKeyForDisplay(left).localeCompare(formatSessionKeyForDisplay(right))
      );
      const writeKeys = dedupePreserveOrder(
        sortedItems.flatMap((item) => item.sessionAccess.writeKeys)
      ).sort((left, right) =>
        formatSessionKeyForDisplay(left).localeCompare(formatSessionKeyForDisplay(right))
      );
      return {
        domain: section,
        routeFiles: dedupePreserveOrder(sortedItems.map((item) => item.routeFile)),
        endpointCount: sortedItems.length,
        endpointIds: sortedItems.map((item) => item.id),
        sessionReadKeys: readKeys,
        sessionWriteKeys: writeKeys,
        sessionReadKeyLabels: readKeys.map((key) => formatSessionKeyForDisplay(key)),
        sessionWriteKeyLabels: writeKeys.map((key) => formatSessionKeyForDisplay(key)),
      };
    });

  const catalog = {
    project: 'my-code-my-kill/server',
    domains: domainSummaries,
    endpoints: params.flowEndpoints.map((endpoint) => ({
      id: endpoint.id,
      method: endpoint.method,
      path: endpoint.path,
      routeFile: endpoint.routeFile,
      middlewares: endpoint.middlewares,
      handler: endpoint.handler,
      sinks: endpoint.sinks,
      exits: endpoint.exits,
      sessionAccess: endpoint.sessionAccess,
      ...(endpoint.redirectTargets.length > 0 ? { redirectTargets: endpoint.redirectTargets } : {}),
      ...(endpoint.renderDiagnostics.statuses.length > 0
        ? { renderDiagnostics: endpoint.renderDiagnostics }
        : {}),
    })),
  };

  await fs.writeFile(
    path.join(flowmapDir, 'catalog.json'),
    `${JSON.stringify(catalog, null, 2)}\n`,
    'utf8'
  );
  const globalMiddlewares = params.flowEndpoints[0]?.globalMiddlewares ?? [];
  await fs.writeFile(
    path.join(flowmapDir, 'global-middlewares.mmd'),
    buildGlobalMiddlewaresMermaid(globalMiddlewares),
    'utf8'
  );
  const sessionSummary = buildSessionAccessSummary(params.flowEndpoints);
  const sessionGroups = groupSessionUsage(sessionSummary);
  const sessionCatalog = {
    project: 'my-code-my-kill/server',
    groups: {
      root: sessionGroups.root ? buildSessionKeyUsagePayload(sessionGroups.root) : null,
      flash: sessionGroups.flash.map(buildSessionKeyUsagePayload),
      auth: sessionGroups.auth.map(buildSessionKeyUsagePayload),
      other: sessionGroups.other.map(buildSessionKeyUsagePayload),
    },
    keys: sessionGroups.all.map(buildSessionKeyUsagePayload),
    endpoints: params.flowEndpoints.map(buildSessionEndpointCategoryPayload),
  };
  await fs.writeFile(
    path.join(flowmapDir, 'session-access.mmd'),
    buildSessionAccessMermaid(sessionGroups),
    'utf8'
  );
  await fs.writeFile(
    path.join(flowmapDir, 'session-access.json'),
    `${JSON.stringify(sessionCatalog, null, 2)}\n`,
    'utf8'
  );
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
      sessionAccess: endpoint.sessionAccess,
      ...(endpoint.redirectTargets.length > 0 ? { redirectTargets: endpoint.redirectTargets } : {}),
      ...(endpoint.renderDiagnostics.statuses.length > 0
        ? { renderDiagnostics: endpoint.renderDiagnostics }
        : {}),
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
      sessionAccess: endpoint.sessionAccess,
      pathMethodIndex,
    });

    await fs.writeFile(flowJsonPath, `${JSON.stringify(flowPayload, null, 2)}\n`, 'utf8');
    await fs.writeFile(flowMmdPath, mermaidSource, 'utf8');
  }

  const indexLines: string[] = [];
  indexLines.push('# Flowmap');
  indexLines.push('');
  indexLines.push('> This file is auto-generated by `server/src/scripts/generate-flowmap.ts`.');
  indexLines.push('> Do not edit this file manually.');
  indexLines.push('');
  indexLines.push(
    'Flowmap은 서버 엔드포인트 중심으로 요청 흐름을 빠르게 파악하기 위한 문서입니다.'
  );
  indexLines.push(
    '각 문서는 Entry -> Middleware -> Handler -> Sink/Exit 순서로 유스케이스 단위 흐름을 요약합니다.'
  );
  indexLines.push('');
  indexLines.push('## Shared');
  indexLines.push('');
  indexLines.push('- [Global Middlewares](global-middlewares.mmd)');
  indexLines.push('- [Session Access](session-access.mmd)');
  indexLines.push('');

  for (const section of [...groups.keys()].sort()) {
    indexLines.push(`## ${section}`);
    indexLines.push('');
    const items = groups.get(section) ?? [];
    items.sort((left, right) => {
      const byPath = left.path.localeCompare(right.path);
      if (byPath !== 0) {
        return byPath;
      }
      return compareMethods(left.method, right.method);
    });
    for (const item of items) {
      indexLines.push(`- [${item.method} ${item.path}](flows/${item.id}.mmd)`);
    }
    indexLines.push('');
  }

  await fs.writeFile(
    path.join(flowmapDir, 'README.md'),
    `${indexLines.join('\n').trimEnd()}\n`,
    'utf8'
  );

  // 생성 산출물 디렉토리는 "정의된 파일만" 유지합니다.
  // Finder/iCloud 충돌 복사본(e.g. `flows 2`, `README 2.md`)도 여기서 정리합니다.
  const expectedTopLevelEntries = new Set([
    'catalog.json',
    'README.md',
    'global-middlewares.mmd',
    'session-access.mmd',
    'session-access.json',
    'flows',
  ]);
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
  const repoRoot = path.resolve(serverRoot, '..');

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
