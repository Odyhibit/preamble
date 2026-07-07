/**
 * Route refiner: for HTTP handlers the METHOD + PATH is the interface.
 * Covers Express/Fastify-style `app.get('/path', h)` calls and Next.js
 * file-based routes (app/**\/route.ts exporting GET/POST…, pages/api/*).
 */

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'all']);
const ROUTER_NAMES = new Set(['app', 'router', 'server', 'fastify', 'api']);
const NEXT_HANDLERS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

export function refineRoutes(entry, ctx) {
  // Express/Fastify style: registration calls anywhere in the file.
  const calls = [];
  collectRouteCalls(ctx.tree.rootNode, calls);
  for (const { method, path, line } of calls) {
    entry.symbols.push({
      name: `${method} ${path}`,
      kind: 'route',
      params: null,
      returns: null,
      detail: '',
      desc: '',
      line,
      exported: true,
      isDefault: false,
    });
  }

  // Next.js app router: app/**/route.{js,ts} exports GET/POST/…
  const appRoute = entry.path.match(/(?:^|\/)app\/(.*?)\/?route\.[jt]sx?$/);
  if (appRoute) {
    const urlPath = '/' + appRoute[1].replace(/\(.+?\)\//g, ''); // drop route groups
    for (const sym of entry.symbols) {
      if (sym.exported && NEXT_HANDLERS.has(sym.name)) {
        sym.kind = 'route';
        sym.name = `${sym.name} ${urlPath}`;
        sym.params = null;
        sym.returns = null;
      }
    }
  }
  // Next.js pages router: pages/api/** default export is the handler
  const apiRoute = entry.path.match(/(?:^|\/)pages\/(api\/.*?)\.[jt]sx?$/);
  if (apiRoute) {
    const urlPath = '/' + apiRoute[1].replace(/\/index$/, '');
    for (const sym of entry.symbols) {
      if (sym.isDefault && sym.kind === 'function') {
        sym.kind = 'route';
        sym.name = `handler ${urlPath}`;
        sym.params = null;
      }
    }
  }
}

function collectRouteCalls(node, out) {
  if (node.type === 'call_expression') {
    const callee = node.childForFieldName('function');
    if (callee?.type === 'member_expression') {
      const obj = callee.childForFieldName('object');
      const prop = callee.childForFieldName('property');
      if (obj?.type === 'identifier' && ROUTER_NAMES.has(obj.text) && prop && HTTP_METHODS.has(prop.text)) {
        const firstArg = node.childForFieldName('arguments')?.namedChild(0);
        if (firstArg && (firstArg.type === 'string' || firstArg.type === 'template_string')) {
          out.push({
            method: prop.text.toUpperCase(),
            path: firstArg.text.replace(/^['"`]|['"`]$/g, ''),
            line: node.startPosition.row + 1,
          });
        }
      }
    }
  }
  for (const child of node.namedChildren) collectRouteCalls(child, out);
}
