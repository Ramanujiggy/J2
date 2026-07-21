interface RouteEntry { method: string; path: string }

let cached: RouteEntry[] | null = null;

export function buildRouteManifest(app: { _router?: { stack: unknown[] } }): void {
  const routes: RouteEntry[] = [];

  function walkStack(stack: unknown[], prefix: string) {
    for (const layer of stack as Record<string, unknown>[]) {
      const route = layer.route as { path?: string; methods?: Record<string, boolean> } | undefined;
      if (route?.path && route.methods) {
        for (const method of Object.keys(route.methods)) {
          routes.push({ method: method.toUpperCase(), path: prefix + route.path });
        }
      } else if (layer.name === 'router' && (layer.handle as { stack?: unknown[] })?.stack) {
        const mountPath = extractMountPath(layer);
        walkStack((layer.handle as { stack: unknown[] }).stack, prefix + mountPath);
      }
    }
  }

  function extractMountPath(layer: Record<string, unknown>): string {
    if (typeof layer.path === 'string') return layer.path;
    const keys = layer.keys as { name: string }[] | undefined;
    const regexp = layer.regexp as RegExp | undefined;
    if (!regexp) return '';
    const src = regexp.source
      .replace(/^\^/, '')
      .replace(/\\\/\?\(\?=\\\/\|\$\)$/, '')
      .replace(/\\\//g, '/');
    if (keys?.length) return src;
    return src || '';
  }

  try {
    if (app._router?.stack) walkStack(app._router.stack, '');
  } catch {
    // Graceful — return empty if internal structure doesn't match
  }

  cached = routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

export function getRouteManifest(): RouteEntry[] {
  return cached ?? [];
}
