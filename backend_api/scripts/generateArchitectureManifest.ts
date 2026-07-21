// generateArchitectureManifest — build-time extractor for the admin "Prod
// Design" page.
//
// Walks the codebase and emits one JSON file the backend serves on
// /api/admin/architecture. Everything here is regex-based; the route files,
// migration files, and frontend route table all follow strict-enough
// conventions that we don't need a full TS compiler walk.
//
// Each extractor catches its own failures and records them under
// `warnings` so the build never fails over a diagram glitch — the page
// renders what we did get and shows the warnings.
//
// Run via: npm run build:architecture
// Output:  backend_api/data/architecture-manifest.json

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const ROOT       = path.resolve(__dirname, '..');                       // backend_api/
const PROJECT    = path.resolve(ROOT, '..');                            // project/J2/
const FRONTEND   = path.resolve(PROJECT, 'frontend_app');
const DOCS_ROOT  = path.resolve(PROJECT, 'Docs');

const OUTPUT_DIR  = path.join(ROOT, 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'architecture-manifest.json');

// ─── Types ───────────────────────────────────────────────────────────────────

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
type Auth   = 'public' | 'user' | 'admin';

interface ApiRoute  { method: Method; path: string; file: string; handler: string; auth: Auth; }
interface Migration { file: string; title: string; }
interface ModelField { name: string; type: string; optional: boolean; }
interface Model     { name: string; file: string; fields: ModelField[]; }
interface FrontendRoute {
    path: string; component: string; file: string;
    shell: 'AppShell' | 'OnboardingProvider' | 'unauth' | 'redirect' | 'unknown';
    adminGated: boolean;
}
interface Topology { mermaid: string; lastEdited: string | null; raw: string; }

interface Manifest {
    generatedAt: string;
    apiRoutes: ApiRoute[];
    migrations: Migration[];
    models: Model[];
    frontendRoutes: FrontendRoute[];
    topology: Topology;
    warnings: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function readDirFiles(dir: string, suffix: string): Promise<string[]> {
    try {
        const entries = await fs.readdir(dir);
        return entries.filter(f => f.endsWith(suffix)).sort();
    } catch {
        return [];
    }
}

async function safeRead(file: string): Promise<string> {
    try { return await fs.readFile(file, 'utf-8'); } catch { return ''; }
}

// ─── API routes ──────────────────────────────────────────────────────────────
//
// Two-pass extraction:
//   1. Read app.ts → map { importName → { mountPath, routesFile } }
//   2. For each routes file, read router.METHOD(...) calls + middleware chain
//      to infer per-route auth level. Compose `mountPath + routePath` for the
//      full endpoint path the client sees.

async function extractApiRoutes(warnings: string[]): Promise<ApiRoute[]> {
    const routes: ApiRoute[] = [];

    const appPath = path.join(ROOT, 'src', 'app.ts');
    const appSrc  = await safeRead(appPath);
    if (!appSrc) { warnings.push('Could not read src/app.ts; API routes will be empty.'); return routes; }

    // Pass 1: imports — `import xxxRoutes from './routes/xxxRoutes.js';`
    const importMap = new Map<string, string>();  // importName → routes file (e.g. 'authRoutes' → 'routes/authRoutes.ts')
    for (const m of appSrc.matchAll(/^import\s+(\w+Routes)\s+from\s+['"]\.\/routes\/(\w+)\.js['"]/gm)) {
        importMap.set(m[1]!, `routes/${m[2]}.ts`);
    }

    // Pass 1.5: mount paths — `app.use('/api/foo', xxxRoutes);` or `app.use('/auth', authRoutes);`
    const mountMap = new Map<string, string>();  // importName → mount path
    for (const m of appSrc.matchAll(/app\.use\(\s*['"]([^'"]+)['"]\s*,\s*(\w+Routes)\s*\)/g)) {
        mountMap.set(m[2]!, m[1]!);
    }

    // Pass 2: per-routes file extraction.
    for (const [importName, relPath] of importMap) {
        const mount = mountMap.get(importName);
        if (!mount) { warnings.push(`No mount path found for ${importName}`); continue; }

        const fullPath = path.join(ROOT, 'src', relPath);
        const src = await safeRead(fullPath);
        if (!src) { warnings.push(`Could not read ${relPath}`); continue; }

        // File-level middleware via `router.use(verifyToken)` / `router.use(requireAdmin)`
        const fileLevelUse = [...src.matchAll(/router\.use\(\s*([^)]+)\)/g)]
            .map(m => m[1] ?? '').join(' ');
        const fileAuth = inferAuth(fileLevelUse);

        // Each `router.METHOD('/path', mw, mw, handler)` call. Captures everything
        // between the parens; we then split args to extract path + handler.
        // Permits whitespace + line breaks inside the call.
        const callRe = /router\.(get|post|patch|put|delete)\(\s*['"]([^'"]+)['"]([^;]*?)\)/gs;
        for (const m of src.matchAll(callRe)) {
            const method = m[1]!.toUpperCase() as Method;
            const routePath = m[2]!;
            const rest = m[3] ?? '';

            // Per-call auth merges file-level + this call's middleware list.
            const callAuth = inferAuth(rest);
            const auth: Auth = callAuth === 'admin' || fileAuth === 'admin' ? 'admin'
                : callAuth === 'user' || fileAuth === 'user' ? 'user'
                : 'public';

            // Handler: last identifier in the arg list (after the final comma).
            // Fallback to '(inline)' if it's a fat-arrow expression.
            const handler = (() => {
                const parts = rest.split(',').map(s => s.trim()).filter(Boolean);
                const last = parts[parts.length - 1] ?? '';
                const ident = last.match(/^([a-zA-Z_$][\w$]*)/)?.[1];
                return ident ?? '(inline)';
            })();

            const fullPathStr = (mount.endsWith('/') || routePath.startsWith('/')
                ? mount.replace(/\/+$/, '') + routePath
                : mount + '/' + routePath).replace(/\/+/g, '/');

            routes.push({ method, path: fullPathStr, file: relPath, handler, auth });
        }
    }

    // Sort by file then path for stable output.
    routes.sort((a, b) => a.file.localeCompare(b.file) || a.path.localeCompare(b.path));
    return routes;
}

function inferAuth(middlewareBlob: string): Auth {
    if (/requireAdmin/.test(middlewareBlob)) return 'admin';
    if (/verifyToken/.test(middlewareBlob))  return 'user';
    return 'public';
}

// ─── Migrations ──────────────────────────────────────────────────────────────

async function extractMigrations(warnings: string[]): Promise<Migration[]> {
    const dir = path.join(ROOT, 'migrations');
    const files = await readDirFiles(dir, '.sql');
    if (files.length === 0) warnings.push('No migration files found in migrations/');
    const out: Migration[] = [];
    for (const file of files) {
        const src = await safeRead(path.join(dir, file));
        // Title: first non-empty line of the leading comment block, stripping `-- ` and the file number prefix.
        const lines = src.split('\n');
        let title = '';
        for (const raw of lines) {
            const line = raw.trim();
            if (!line) continue;
            if (line.startsWith('--')) {
                const cleaned = line.replace(/^--+\s*/, '').trim();
                // Skip the bare filename echo (e.g. "034_intention_completion_modes.sql")
                if (cleaned && !cleaned.endsWith('.sql')) { title = cleaned; break; }
                continue;
            }
            break;
        }
        out.push({ file, title: title || '(no title)' });
    }
    return out;
}

// ─── Models ──────────────────────────────────────────────────────────────────

async function extractModels(warnings: string[]): Promise<Model[]> {
    const dir = path.join(ROOT, 'src', 'models');
    const files = await readDirFiles(dir, '.ts');
    if (files.length === 0) warnings.push('No model files found in src/models/');
    const out: Model[] = [];
    for (const file of files) {
        const src = await safeRead(path.join(dir, file));
        // `export interface Name { ... }` — capture name + body. The body
        // ends at the matching brace; we use a non-greedy match plus a
        // sentinel since none of our model interfaces contain nested braces.
        const ifaceRe = /export\s+interface\s+(\w+)\s*\{([^}]*)\}/g;
        for (const m of src.matchAll(ifaceRe)) {
            const name = m[1]!;
            const body = m[2] ?? '';
            const fields = parseFields(body);
            out.push({ name, file: `models/${file}`, fields });
        }
    }
    out.sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name));
    return out;
}

function parseFields(body: string): ModelField[] {
    const fields: ModelField[] = [];
    // Strip /* ... */ comments and // ... comments so they don't confuse the parser.
    const stripped = body
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
    for (const rawLine of stripped.split(/[;\n]/)) {
        const line = rawLine.trim();
        if (!line) continue;
        // `fieldName?: Type` or `fieldName: Type`
        const m = line.match(/^(\w+)(\??)\s*:\s*(.+)$/);
        if (!m) continue;
        fields.push({ name: m[1]!, optional: m[2] === '?', type: m[3]!.trim().replace(/,$/, '') });
    }
    return fields;
}

// ─── Frontend routes ─────────────────────────────────────────────────────────
//
// Reads src/App.tsx (the single source of truth for routes) and extracts
// every <Route path=... element=... /> entry. Determines shell + admin
// gating from the element JSX structure.

async function extractFrontendRoutes(warnings: string[]): Promise<FrontendRoute[]> {
    const appPath = path.join(FRONTEND, 'src', 'App.tsx');
    let src = await safeRead(appPath);
    if (!src) src = await safeRead(path.join(OUTPUT_DIR, 'App.tsx.snapshot'));
    if (!src) { warnings.push('Could not read frontend src/App.tsx'); return []; }

    // Build a map of `ComponentName → "src/app/ComponentName.tsx"` from
    // the lazy + eager imports at the top of the file.
    const fileMap = new Map<string, string>();
    for (const m of src.matchAll(/import\s+(\w+)\s+from\s+['"]\.\/(app\/\w+)\.tsx['"]/g)) {
        fileMap.set(m[1]!, `src/${m[2]}.tsx`);
    }
    for (const m of src.matchAll(/const\s+(\w+)\s*=\s*lazy\(\(\)\s*=>\s*import\(['"]\.\/(app\/\w+)\.tsx['"]\)\)/g)) {
        fileMap.set(m[1]!, `src/${m[2]}.tsx`);
    }

    const out: FrontendRoute[] = [];
    // `<Route path="..." element={...} />`
    const routeRe = /<Route\s+path=["']([^"']+)["']\s+element=\{([^}]+(?:\{[^}]*\}[^}]*)*)\}\s*\/>/g;
    for (const m of src.matchAll(routeRe)) {
        const routePath = m[1]!;
        const element = m[2] ?? '';

        // Detect redirects up-front
        if (/Navigate\s+to=/.test(element)) {
            const to = element.match(/to=["']([^"']+)["']/)?.[1] ?? '?';
            out.push({ path: routePath, component: `→ ${to}`, file: '(App.tsx)', shell: 'redirect', adminGated: false });
            continue;
        }

        // Component name: pick the last PascalCase identifier referenced in the element JSX.
        const idents = [...element.matchAll(/\b([A-Z]\w+)/g)].map(x => x[1]!);
        // Filter out wrappers we know aren't pages (ProtectedShell, OnboardingProvider, etc.)
        const wrappers = new Set(['ProtectedShell', 'OnboardingProvider', 'RootLanding', 'Suspense', 'Navigate', 'AppShell']);
        const componentCandidates = idents.filter(i => !wrappers.has(i));
        const component = componentCandidates[componentCandidates.length - 1] ?? '(unknown)';

        const shell: FrontendRoute['shell'] =
            /ProtectedShell/.test(element) ? 'AppShell' :
            /OnboardingProvider/.test(element) ? 'OnboardingProvider' :
            'unauth';

        const adminGated = routePath.startsWith('/admin');

        out.push({
            path: routePath,
            component,
            file: fileMap.get(component) ?? '(inline)',
            shell,
            adminGated,
        });
    }
    if (out.length === 0) warnings.push('No <Route> entries parsed from App.tsx');
    out.sort((a, b) => a.path.localeCompare(b.path));
    return out;
}

// ─── Topology ────────────────────────────────────────────────────────────────

async function extractTopology(warnings: string[]): Promise<Topology> {
    const file = path.join(DOCS_ROOT, 'architecture-topology.md');
    const raw  = await safeRead(file);
    if (!raw) {
        warnings.push('Docs/architecture-topology.md not found — Overview tab will show a stub.');
        return { mermaid: '', lastEdited: null, raw: '' };
    }
    // First fenced ```mermaid ... ``` block.
    const m = raw.match(/```mermaid\s*\n([\s\S]*?)```/);
    const mermaid = m?.[1]?.trim() ?? '';
    if (!mermaid) warnings.push('No mermaid block found in architecture-topology.md');
    // Last-edited: file mtime (good enough; we don't need git blame here).
    let lastEdited: string | null = null;
    try { lastEdited = (await fs.stat(file)).mtime.toISOString(); } catch { /* ignore */ }
    return { mermaid, lastEdited, raw };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    const warnings: string[] = [];

    const [apiRoutes, migrations, models, frontendRoutes, topology] = await Promise.all([
        extractApiRoutes(warnings).catch(e => { warnings.push(`apiRoutes: ${String(e)}`); return [] as ApiRoute[]; }),
        extractMigrations(warnings).catch(e => { warnings.push(`migrations: ${String(e)}`); return [] as Migration[]; }),
        extractModels(warnings).catch(e => { warnings.push(`models: ${String(e)}`); return [] as Model[]; }),
        extractFrontendRoutes(warnings).catch(e => { warnings.push(`frontendRoutes: ${String(e)}`); return [] as FrontendRoute[]; }),
        extractTopology(warnings).catch(e => { warnings.push(`topology: ${String(e)}`); return { mermaid: '', lastEdited: null, raw: '' }; }),
    ]);

    const manifest: Manifest = {
        generatedAt: new Date().toISOString(),
        apiRoutes,
        migrations,
        models,
        frontendRoutes,
        topology,
        warnings,
    };

    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');

    // Brief summary so the build log isn't silent.
    console.log(
        `architecture-manifest.json written: ` +
        `${apiRoutes.length} routes, ${migrations.length} migrations, ` +
        `${models.length} models, ${frontendRoutes.length} frontend routes` +
        (warnings.length ? ` (${warnings.length} warnings)` : ''),
    );
    if (warnings.length) {
        for (const w of warnings) console.warn(`  ⚠️  ${w}`);
    }
}

main().catch(err => {
    console.error('Failed to generate architecture manifest:', err);
    process.exit(1);
});
