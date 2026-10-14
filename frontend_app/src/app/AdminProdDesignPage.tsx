// AdminProdDesignPage — /admin/prod-design
//
// Renders the build-time architecture manifest produced by
// `backend_api/scripts/generateArchitectureManifest.ts` (served by
// /api/admin/architecture). Editorial layout matches the rest of the
// admin surface: ◇ kicker labels, copper hairlines, no card chrome
// competition.
//
// Mermaid is loaded from a CDN on demand (only when the Overview tab is
// opened) so the rest of the app doesn't pay for it. The page works
// gracefully if the CDN load fails — we show the mermaid source as a
// code block with a "Copy" button + a link to mermaid.live.

import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import PageContent from '../components/PageContent.tsx';
import { useProfile } from '../context/ProfileContext.tsx';
import { api, ApiError } from '../lib/api.ts';
import { CARD_BG, COPPER, PALE_YELLOW, SURFACE_2, SURFACE_2_BORDER, FONT_EDITORIAL, TEXT_BODY, TEXT_SECONDARY, TEXT_TERTIARY, TEXT_HINT } from '../lib/theme.ts';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';

// ── Types matching the backend manifest ────────────────────────────────────

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
interface Manifest {
    generatedAt: string;
    apiRoutes: ApiRoute[];
    migrations: Migration[];
    models: Model[];
    frontendRoutes: FrontendRoute[];
    topology: { mermaid: string; lastEdited: string | null; raw: string };
    warnings: string[];
}

type Tab = 'overview' | 'api' | 'db' | 'frontend';

const TABS: { value: Tab; label: string }[] = [
    { value: 'overview', label: 'Overview' },
    { value: 'api',      label: 'API Routes' },
    { value: 'db',       label: 'DB Schema' },
    { value: 'frontend', label: 'Frontend Pages' },
];

// ── Page ───────────────────────────────────────────────────────────────────

export default function AdminProdDesignPage() {
    const { isAdmin, loaded } = useProfile();
    const [manifest, setManifest] = useState<Manifest | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<Tab>('overview');
    const isDesktop = useIsDesktop();

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const m = await api.get<Manifest>('/api/admin/architecture');
                if (!cancelled) setManifest(m);
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof ApiError ? err.message : 'Failed to load architecture manifest.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    if (loaded && !isAdmin) return <Navigate to="/home" replace />;

    return (
        <PageContent ready={!loading} loadingMessages={['Reading the blueprints…']}>
            <div className="j2-page-container" style={{ paddingTop: isDesktop ? 48 : 20, paddingBottom: isDesktop ? 96 : 48 }}>
                <Header generatedAt={manifest?.generatedAt} isDesktop={isDesktop} />

                {error && (
                    <p style={{ color: 'rgba(218,90,70,0.9)', fontSize: 14, marginTop: 16 }}>{error}</p>
                )}

                {manifest && (
                    <>
                        <TabBar tab={tab} onChange={setTab} isDesktop={isDesktop} />
                        {manifest.warnings.length > 0 && <WarningsBlock warnings={manifest.warnings} />}

                        <div style={{ marginTop: 24 }}>
                            {tab === 'overview' && <OverviewTab manifest={manifest} isDesktop={isDesktop} />}
                            {tab === 'api'      && <ApiTab routes={manifest.apiRoutes} isDesktop={isDesktop} />}
                            {tab === 'db'       && <DbTab migrations={manifest.migrations} models={manifest.models} isDesktop={isDesktop} />}
                            {tab === 'frontend' && <FrontendTab routes={manifest.frontendRoutes} isDesktop={isDesktop} />}
                        </div>
                    </>
                )}
            </div>
        </PageContent>
    );
}

// ── Header + tabs ──────────────────────────────────────────────────────────

function Header({ generatedAt, isDesktop }: { generatedAt?: string; isDesktop?: boolean }) {
    const stamp = generatedAt ? new Date(generatedAt).toLocaleString() : '—';
    return (
        <div style={{ marginBottom: isDesktop !== false ? 32 : 20 }}>
            <div className="j2-label-copper" style={{ marginBottom: 12 }}>◇ Admin / Prod Design</div>
            <h1 className="j2-serif-display j2-heading-glow" style={{ fontSize: isDesktop !== false ? 56 : 34, margin: 0, lineHeight: 1 }}>
                Production blueprint
            </h1>
            <p
                className="j2-serif-italic"
                style={{ marginTop: 12, fontSize: isDesktop !== false ? 17 : 14, color: TEXT_TERTIARY }}
            >
                What's actually deployed, regenerated every Railway push. Last build: {stamp}.
            </p>
        </div>
    );
}

function TabBar({ tab, onChange, isDesktop }: { tab: Tab; onChange: (t: Tab) => void; isDesktop?: boolean }) {
    return (
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid rgba(196,145,95,0.18)' }}>
            {TABS.map(t => {
                const active = tab === t.value;
                return (
                    <button
                        key={t.value}
                        onClick={() => onChange(t.value)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            padding: isDesktop !== false ? '12px 18px' : '10px 10px',
                            fontSize: isDesktop !== false ? 14 : 12, fontWeight: 600,
                            color: active ? PALE_YELLOW : 'rgba(255,255,255,0.50)',
                            borderBottom: active ? `2px solid ${COPPER}` : '2px solid transparent',
                            marginBottom: -1,
                            cursor: 'pointer',
                            transition: 'color 160ms ease, border-color 160ms ease',
                        }}
                    >
                        {t.label}
                    </button>
                );
            })}
        </div>
    );
}

function WarningsBlock({ warnings }: { warnings: string[] }) {
    return (
        <div
            style={{
                marginTop: 16,
                padding: '12px 16px',
                background: 'rgba(218,90,70,0.06)',
                border: '1px solid rgba(218,90,70,0.25)',
                borderRadius: 10,
            }}
        >
            <p className="j2-label-copper" style={{ marginBottom: 6, color: 'rgba(218,90,70,0.85)' }}>
                ◇ Generator warnings ({warnings.length})
            </p>
            {warnings.map((w, i) => (
                <p key={i} style={{ fontSize: 12.5, color: TEXT_SECONDARY, margin: 0, lineHeight: 1.5 }}>
                    {w}
                </p>
            ))}
        </div>
    );
}

// ── Overview tab ───────────────────────────────────────────────────────────

function OverviewTab({ manifest, isDesktop }: { manifest: Manifest; isDesktop?: boolean }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <StatStrip manifest={manifest} isDesktop={isDesktop} />
            <MermaidBlock source={manifest.topology.mermaid} lastEdited={manifest.topology.lastEdited} isDesktop={isDesktop} />
        </div>
    );
}

function StatStrip({ manifest, isDesktop }: { manifest: Manifest; isDesktop?: boolean }) {
    const items = [
        { label: 'API routes',     value: manifest.apiRoutes.length },
        { label: 'Migrations',     value: manifest.migrations.length },
        { label: 'Models',         value: manifest.models.length },
        { label: 'Frontend routes', value: manifest.frontendRoutes.length },
    ];
    return (
        <div style={{ display: 'grid', gridTemplateColumns: isDesktop !== false ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)', gap: 12 }}>
            {items.map(i => (
                <div
                    key={i.label}
                    style={{
                        padding: isDesktop !== false ? '18px 16px' : '14px 12px',
                        background: SURFACE_2,
                        border: `1px solid ${SURFACE_2_BORDER}`,
                        borderRadius: 12,
                    }}
                >
                    <div style={{
                        fontFamily: FONT_EDITORIAL, fontSize: isDesktop !== false ? 42 : 28, lineHeight: 1,
                        color: PALE_YELLOW, marginBottom: 6,
                    }}>
                        {i.value}
                    </div>
                    <div style={{
                        fontSize: 10.5, fontWeight: 700, letterSpacing: '0.14em',
                        textTransform: 'uppercase', color: TEXT_TERTIARY,
                    }}>
                        {i.label}
                    </div>
                </div>
            ))}
        </div>
    );
}

// MermaidBlock — lazy-loads mermaid from CDN on mount. If the load or
// render fails, we render the source as a copy-able code block.
function MermaidBlock({ source, lastEdited, isDesktop }: { source: string; lastEdited: string | null; isDesktop?: boolean }) {
    const [status, setStatus] = useState<'pending' | 'ready' | 'failed' | 'empty'>('pending');
    const [svg, setSvg] = useState<string>('');

    useEffect(() => {
        if (!source.trim()) { setStatus('empty'); return; }
        let cancelled = false;
        (async () => {
            try {
                const mermaid = await loadMermaid();
                if (cancelled) return;
                const id = 'prod-design-mermaid';
                const { svg } = await mermaid.render(id, source);
                if (!cancelled) { setSvg(svg); setStatus('ready'); }
            } catch (err) {
                console.warn('Mermaid render failed:', err);
                if (!cancelled) setStatus('failed');
            }
        })();
        return () => { cancelled = true; };
    }, [source]);

    if (status === 'empty') {
        return (
            <SectionCard kicker="◇ System topology" isDesktop={isDesktop}>
                <p style={{ color: TEXT_TERTIARY, fontSize: 14 }}>
                    No topology defined. Add a <code style={{ color: COPPER }}>```mermaid</code> block to{' '}
                    <code style={{ color: COPPER }}>Docs/architecture-topology.md</code> and redeploy.
                </p>
            </SectionCard>
        );
    }

    return (
        <SectionCard
            kicker="◇ System topology"
            subtitle={lastEdited ? `Editorial layer — last edited ${new Date(lastEdited).toLocaleDateString()}` : undefined}
            isDesktop={isDesktop}
        >
            {status === 'pending' && (
                <p style={{ color: TEXT_TERTIARY, fontSize: 13 }}>Rendering diagram…</p>
            )}
            {status === 'ready' && (
                <div
                    style={{
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: 10,
                        padding: 16,
                        overflowX: 'auto',
                    }}
                    // Mermaid SVG output is generated from a sanitised source we
                    // wrote ourselves into the repo — safe to inject directly.
                    dangerouslySetInnerHTML={{ __html: svg }}
                />
            )}
            {status === 'failed' && (
                <>
                    <p style={{ color: 'rgba(218,90,70,0.85)', fontSize: 13, marginBottom: 10 }}>
                        Couldn't render Mermaid in-page (CDN blocked or render error). Source below — paste into
                        <a
                            href="https://mermaid.live"
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: COPPER, marginLeft: 4 }}
                        >
                            mermaid.live
                        </a>{' '}
                        to view.
                    </p>
                    <pre style={preStyle}>{source}</pre>
                </>
            )}
        </SectionCard>
    );
}

// Mermaid CDN loader — caches the module on `window` so repeat tab visits
// don't re-fetch. Resolves to the mermaid singleton or throws.
async function loadMermaid(): Promise<{ render: (id: string, src: string) => Promise<{ svg: string }> }> {
    const w = window as unknown as { __mermaid?: { render: (id: string, src: string) => Promise<{ svg: string }> } };
    if (w.__mermaid) return w.__mermaid;
    await new Promise<void>((resolve, reject) => {
        const existing = document.querySelector('script[data-mermaid-cdn]');
        if (existing) { resolve(); return; }
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
        s.dataset['mermaidCdn'] = '1';
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Failed to load mermaid from CDN'));
        document.head.appendChild(s);
    });
    const global = (window as unknown as { mermaid?: { initialize: (cfg: object) => void; render: (id: string, src: string) => Promise<{ svg: string }> } }).mermaid;
    if (!global) throw new Error('Mermaid loaded but global is missing');
    global.initialize({ startOnLoad: false, theme: 'dark', fontFamily: 'inherit' });
    w.__mermaid = { render: (id, src) => global.render(id, src) };
    return w.__mermaid;
}

// ── API tab ────────────────────────────────────────────────────────────────

function ApiTab({ routes, isDesktop }: { routes: ApiRoute[]; isDesktop?: boolean }) {
    const [filter, setFilter] = useState('');
    const grouped = useMemo(() => {
        const f = filter.trim().toLowerCase();
        const filtered = f ? routes.filter(r => r.path.toLowerCase().includes(f) || r.handler.toLowerCase().includes(f)) : routes;
        const map = new Map<string, ApiRoute[]>();
        for (const r of filtered) {
            const arr = map.get(r.file) ?? [];
            arr.push(r);
            map.set(r.file, arr);
        }
        return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [routes, filter]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <input
                type="text"
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder="Filter by path or handler…"
                style={{
                    padding: '10px 14px', borderRadius: 10,
                    background: SURFACE_2, border: `1px solid ${SURFACE_2_BORDER}`,
                    color: PALE_YELLOW, fontSize: 14, outline: 'none', maxWidth: isDesktop !== false ? 420 : undefined,
                }}
            />
            {grouped.length === 0 && (
                <p style={{ color: TEXT_TERTIARY, fontSize: 13 }}>No routes match.</p>
            )}
            {grouped.map(([file, fileRoutes]) => (
                <SectionCard key={file} kicker={`◇ ${file}`} isDesktop={isDesktop}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={tableStyle}>
                            <thead>
                                <tr>
                                    <th style={thStyle}>Method</th>
                                    <th style={thStyle}>Path</th>
                                    <th style={thStyle}>Handler</th>
                                    <th style={thStyle}>Auth</th>
                                </tr>
                            </thead>
                            <tbody>
                                {fileRoutes.map((r, i) => (
                                    <tr key={i}>
                                        <td style={tdStyle}><MethodBadge method={r.method} /></td>
                                        <td style={{ ...tdStyle, fontFamily: 'ui-monospace, monospace', fontSize: 12.5 }}>{r.path}</td>
                                        <td style={{ ...tdStyle, color: TEXT_SECONDARY }}>{r.handler}</td>
                                        <td style={tdStyle}><AuthBadge auth={r.auth} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>
            ))}
        </div>
    );
}

function MethodBadge({ method }: { method: Method }) {
    const colors: Record<Method, string> = {
        GET:    'rgba(82,181,108,0.85)',
        POST:   'rgba(196,145,95,0.95)',
        PATCH:  'rgba(218,180,60,0.85)',
        PUT:    'rgba(218,180,60,0.85)',
        DELETE: 'rgba(218,90,70,0.85)',
    };
    return (
        <span style={{
            fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em',
            padding: '2px 6px', borderRadius: 4,
            background: 'rgba(255,255,255,0.04)',
            color: colors[method],
        }}>
            {method}
        </span>
    );
}

function AuthBadge({ auth }: { auth: Auth }) {
    const text = auth === 'admin' ? 'ADMIN' : auth === 'user' ? 'USER' : 'PUBLIC';
    const color = auth === 'admin' ? 'rgba(218,90,70,0.85)' : auth === 'user' ? COPPER : 'rgba(255,255,255,0.40)';
    return <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color }}>{text}</span>;
}

// ── DB tab ─────────────────────────────────────────────────────────────────

function DbTab({ migrations, models, isDesktop }: { migrations: Migration[]; models: Model[]; isDesktop?: boolean }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <SectionCard kicker={`◇ Migrations (${migrations.length})`} isDesktop={isDesktop}>
                <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {migrations.map(m => (
                        <li key={m.file} style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                            <code style={{ color: COPPER, fontSize: 12, minWidth: 280, fontFamily: 'ui-monospace, monospace' }}>
                                {m.file}
                            </code>
                            <span style={{ color: TEXT_SECONDARY, fontSize: 13 }}>{m.title}</span>
                        </li>
                    ))}
                </ol>
            </SectionCard>

            <SectionCard kicker={`◇ Models (${models.length})`} isDesktop={isDesktop}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {models.map(m => <ModelRow key={`${m.file}-${m.name}`} model={m} />)}
                </div>
            </SectionCard>
        </div>
    );
}

function ModelRow({ model }: { model: Model }) {
    const [open, setOpen] = useState(false);
    return (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
            <button
                onClick={() => setOpen(o => !o)}
                style={{
                    background: 'transparent', border: 'none', padding: 0,
                    display: 'flex', alignItems: 'baseline', gap: 12, width: '100%',
                    cursor: 'pointer', textAlign: 'left',
                }}
            >
                <span style={{ color: PALE_YELLOW, fontSize: 14, fontWeight: 600 }}>{model.name}</span>
                <span style={{ color: TEXT_HINT, fontSize: 12, fontFamily: 'ui-monospace, monospace' }}>
                    {model.file}
                </span>
                <span style={{ marginLeft: 'auto', color: TEXT_TERTIARY, fontSize: 11 }}>
                    {model.fields.length} field{model.fields.length === 1 ? '' : 's'} {open ? '▾' : '▸'}
                </span>
            </button>
            {open && (
                <table style={{ ...tableStyle, marginTop: 8 }}>
                    <tbody>
                        {model.fields.map((f, i) => (
                            <tr key={i}>
                                <td style={{ ...tdStyle, color: COPPER, fontFamily: 'ui-monospace, monospace', fontSize: 12.5, paddingLeft: 0 }}>
                                    {f.name}{f.optional ? '?' : ''}
                                </td>
                                <td style={{ ...tdStyle, color: TEXT_SECONDARY, fontFamily: 'ui-monospace, monospace', fontSize: 12.5 }}>
                                    {f.type}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

// ── Frontend tab ───────────────────────────────────────────────────────────

function FrontendTab({ routes, isDesktop }: { routes: FrontendRoute[]; isDesktop?: boolean }) {
    return (
        <SectionCard kicker={`◇ Frontend routes (${routes.length})`} isDesktop={isDesktop}>
            <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                    <thead>
                        <tr>
                            <th style={thStyle}>Path</th>
                            <th style={thStyle}>Component</th>
                            <th style={thStyle}>File</th>
                            <th style={thStyle}>Shell</th>
                            <th style={thStyle}>Gated</th>
                        </tr>
                    </thead>
                    <tbody>
                        {routes.map((r, i) => (
                            <tr key={i}>
                                <td style={{ ...tdStyle, fontFamily: 'ui-monospace, monospace', fontSize: 12.5, color: COPPER }}>
                                    {r.path}
                                </td>
                                <td style={{ ...tdStyle, color: PALE_YELLOW }}>{r.component}</td>
                                <td style={{ ...tdStyle, color: TEXT_TERTIARY, fontSize: 12, fontFamily: 'ui-monospace, monospace' }}>
                                    {r.file}
                                </td>
                                <td style={{ ...tdStyle, color: TEXT_SECONDARY, fontSize: 12 }}>{r.shell}</td>
                                <td style={tdStyle}>
                                    {r.adminGated && <AuthBadge auth="admin" />}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </SectionCard>
    );
}

// ── Reusable bits ──────────────────────────────────────────────────────────

function SectionCard({ kicker, subtitle, children, isDesktop }: { kicker: string; subtitle?: string; children: React.ReactNode; isDesktop?: boolean }) {
    return (
        <div
            style={{
                background: CARD_BG,
                border: '1px solid var(--j2-border-2)',
                borderRadius: 14,
                padding: isDesktop !== false ? '20px 22px' : '14px 16px',
            }}
        >
            <div className="j2-label-copper" style={{ marginBottom: subtitle ? 4 : 14 }}>{kicker}</div>
            {subtitle && (
                <p className="j2-serif-italic" style={{ marginTop: 0, marginBottom: 14, fontSize: 13, color: TEXT_TERTIARY }}>
                    {subtitle}
                </p>
            )}
            {children}
        </div>
    );
}

const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
};
const thStyle: React.CSSProperties = {
    textAlign: 'left',
    fontSize: 10.5, fontWeight: 700, letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: TEXT_TERTIARY,
    padding: '6px 10px 6px 0',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
};
const tdStyle: React.CSSProperties = {
    padding: '8px 10px 8px 0',
    color: TEXT_BODY,
    verticalAlign: 'top',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
};
const preStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${SURFACE_2_BORDER}`,
    borderRadius: 8,
    padding: 14,
    fontSize: 12, fontFamily: 'ui-monospace, monospace',
    color: TEXT_BODY,
    overflowX: 'auto',
    whiteSpace: 'pre',
};
