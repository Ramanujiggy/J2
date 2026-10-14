// AdminDashboardPage — admin-only troubleshooting surface.
//
// Three zones, top-down:
//   1. Health strip   — totals (users, sessions) + 24h/7d deltas + open cases
//   2. Cases queue    — user-submitted reports with status filter, inline expand
//                       to read description / debug context, change status / notes
//   3. Recent users   — last 50 signups + session count for spot-checking activity
//
// Route-guarded: anyone hitting /admin without `is_admin === true` gets sent
// to /home. Backend endpoints under /api/admin/* are also gated by the
// requireAdmin middleware, so even direct API calls from a non-admin token
// fail with 403 — the frontend redirect is just for UX.

import { useEffect, useMemo, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import PageContent from '../components/PageContent.tsx';
import { useProfile } from '../context/ProfileContext.tsx';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import { api, ApiError } from '../lib/api.ts';
import { PALE_YELLOW, COPPER, CARD_BG, CARD_GLOW, CARD_GLOW_BORDER, SURFACE_2, SURFACE_2_BORDER, FONT_EDITORIAL, GLOW_SOFT, STATUS_ERROR, STATUS_ERROR_BG, STATUS_ERROR_BORDER, TEXT_PRIMARY, TEXT_BODY, TEXT_SECONDARY, TEXT_TERTIARY, TEXT_HINT } from '../lib/theme.ts';
import type {
    AdminStats, AdminStatsResponse,
    AdminCasesResponse, AdminUsersResponse,
    SupportCaseWithUser, AdminUserSummary,
    CaseStatus,
    FileTreeNode, FileTreeResponse, RouteEntry, RoutesResponse,
} from '../types/api.ts';

function getTimeAgo(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
}

type StatusFilter = 'all' | CaseStatus;

const STATUS_LABEL: Record<CaseStatus, string> = {
    open:         'Open',
    in_progress:  'In progress',
    closed:       'Closed',
};

const STATUS_PILL_BG: Record<CaseStatus, string> = {
    open:         'rgba(196,145,95,0.18)',
    in_progress:  'rgba(242,228,168,0.18)',
    closed:       'rgba(255,255,255,0.06)',
};
const STATUS_PILL_FG: Record<CaseStatus, string> = {
    open:         COPPER,
    in_progress:  PALE_YELLOW,
    closed:       'rgba(255,255,255,0.45)',
};

const SEVERITY_LABEL: Record<string, string> = {
    low:     'Low',
    normal:  'Normal',
    high:    'High',
    urgent:  'Urgent',
};

export default function AdminDashboardPage() {
    const { isAdmin, loaded } = useProfile();
    const isDesktop = useIsDesktop();

    const [stats,         setStats]         = useState<AdminStats | null>(null);
    const [cases,         setCases]         = useState<SupportCaseWithUser[]>([]);
    const [users,         setUsers]         = useState<AdminUserSummary[]>([]);
    const [recentLogins,  setRecentLogins]  = useState<Array<{ id: string; email: string; name: string | null; belt_rank: string | null; last_login_at: string }>>([]);
    const [statusFilt,    setStatusFilt]    = useState<StatusFilter>('all');
    const [minSessions,   setMinSessions]   = useState<number>(0);
    const [showTestUsers, setShowTestUsers] = useState<boolean>(false);
    const [fileTree,      setFileTree]      = useState<FileTreeNode[] | null>(null);
    const [routeList,     setRouteList]     = useState<RouteEntry[] | null>(null);
    const [loading,       setLoading]       = useState(true);
    const [error,         setError]         = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            try {
                setLoading(true);
                setError(null);
                const [s, c, u, l, ft, rt] = await Promise.all([
                    api.get<AdminStatsResponse>('/api/admin/stats'),
                    api.get<AdminCasesResponse>('/api/admin/cases'),
                    api.get<AdminUsersResponse>('/api/admin/users'),
                    api.get<{ logins: Array<{ id: string; email: string; name: string | null; belt_rank: string | null; last_login_at: string }> }>('/api/admin/recent-logins'),
                    api.get<FileTreeResponse>('/api/admin/structure/files').catch(() => null),
                    api.get<RoutesResponse>('/api/admin/structure/routes').catch(() => null),
                ]);
                if (cancelled) return;
                setStats(s.stats);
                setCases(c.cases);
                setUsers(u.users);
                setRecentLogins(l.logins ?? []);
                if (ft) setFileTree(ft.tree);
                if (rt) setRouteList(rt.routes);
            } catch (e) {
                if (cancelled) return;
                if (e instanceof ApiError && e.status === 403) {
                    setError('Admin access required.');
                } else {
                    setError('Could not load admin data. Refresh to retry.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        if (loaded && isAdmin) void load();
        return () => { cancelled = true; };
    }, [loaded, isAdmin]);

    const filteredCases = useMemo(() => {
        if (statusFilt === 'all') return cases;
        return cases.filter(c => c.status === statusFilt);
    }, [cases, statusFilt]);

    // Test-user predicate — must mirror the backend's testWhere clause in
    // adminController.getStats so the displayed totals match the user list.
    const isTestEmail = (email: string): boolean => {
        return /@journada-e2e\.com$/i.test(email) || /@example\.com$/i.test(email);
    };

    // Displayed stats: subtract test-user counts when "Show test users" is
    // off so the founder sees real-user numbers by default. Server returns
    // the raw + the test deltas, frontend does the math.
    const displayedStats = useMemo(() => {
        if (!stats) return null;
        if (showTestUsers) return stats;
        return {
            ...stats,
            total_users: stats.total_users - stats.test_user_count,
            users_24h:   stats.users_24h   - stats.test_users_24h,
            users_7d:    stats.users_7d    - stats.test_users_7d,
        };
    }, [stats, showTestUsers]);

    // Filtered + sorted recent users — apply min-sessions threshold + the
    // test-user toggle, sort by session_count DESC (most active first),
    // then cap to 10 for the rendered list.
    const VISIBLE_USERS_CAP = 10;
    const filteredUsersAll = useMemo(() => {
        return users
            .filter(u => u.session_count >= minSessions)
            .filter(u => showTestUsers || !isTestEmail(u.email))
            .sort((a, b) => b.session_count - a.session_count);
    }, [users, minSessions, showTestUsers]);
    const visibleUsers = filteredUsersAll.slice(0, VISIBLE_USERS_CAP);
    const hiddenUserCount = Math.max(0, filteredUsersAll.length - VISIBLE_USERS_CAP);

    const onCaseUpdated = (updated: SupportCaseWithUser) => {
        setCases(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
        // Refresh open/in-progress counts in the health strip after a status flip.
        if (stats) {
            void api.get<AdminStatsResponse>('/api/admin/stats').then(s => setStats(s.stats));
        }
    };

    // ── Auth gates ───────────────────────────────────────────────────
    // Wait for the profile fetch to resolve so we don't redirect on cold load.
    if (!loaded) return <PageContent ready={false} loadingMessages={['Loading…']}>{null}</PageContent>;
    if (!isAdmin) return <Navigate to="/home" replace />;

    return (
        <PageContent ready={!loading} loadingMessages={['Loading admin data…']}>
            <div
                className={isDesktop ? 'j2-page-container' : 'mx-auto max-w-5xl px-4 sm:px-6'}
                style={isDesktop ? { paddingTop: 64, paddingBottom: 104 } : { paddingTop: 24, paddingBottom: 40 }}
            >
                {/* Editorial header */}
                <div style={{ marginBottom: isDesktop ? 36 : 24 }}>
                    <p className="j2-label-copper" style={{ marginBottom: 10 }}>◇ Admin</p>
                    <h1
                        className="j2-serif-display j2-heading-glow"
                        style={{
                            fontSize: isDesktop ? 64 : 36,
                            lineHeight: 1, margin: 0,
                            letterSpacing: '-0.01em',
                        }}
                    >
                        Dashboard
                    </h1>
                    <p
                        className="j2-serif-italic"
                        style={{ marginTop: 14, fontSize: isDesktop ? 18 : 15, color: TEXT_TERTIARY }}
                    >
                        Stats, cases, and recent activity.
                    </p>

                    {/* Admin tools — shortcuts to surfaces that don't get
                        a full card on this page. Add new tools here as
                        they ship. */}
                    <div style={{ marginTop: 18, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                        <Link
                            to="/admin/prod-design"
                            style={{
                                fontSize: 13, fontWeight: 600,
                                color: 'rgba(196,145,95,0.95)',
                                borderBottom: '1.5px solid rgba(196,145,95,0.55)',
                                paddingBottom: 1,
                                textDecoration: 'none',
                            }}
                        >
                            ◇ Prod Design →
                        </Link>
                    </div>
                </div>

                {error && (
                    <div
                        style={{
                            backgroundColor: STATUS_ERROR_BG,
                            border: `1px solid ${STATUS_ERROR_BORDER}`,
                            borderRadius: 12,
                            padding: '12px 16px',
                            color: STATUS_ERROR,
                            fontSize: 14,
                            marginBottom: 24,
                        }}
                    >
                        {error}
                    </div>
                )}

                {/* ── Health strip ── */}
                <Card compact={!isDesktop}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                        <SectionLabel compact={!isDesktop}>Health</SectionLabel>
                        <ShowTestUsersToggle
                            value={showTestUsers}
                            onChange={setShowTestUsers}
                            testCount={stats?.test_user_count ?? 0}
                        />
                    </div>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: isDesktop ? 'repeat(8, 1fr)' : 'repeat(2, 1fr)',
                            gap: isDesktop ? 18 : 14,
                            marginTop: 18,
                        }}
                    >
                        <Stat label="Total users"   value={displayedStats?.total_users} compact={!isDesktop} />
                        <Stat label="Users 24h"     value={displayedStats?.users_24h} compact={!isDesktop} />
                        <Stat label="Users 7d"      value={displayedStats?.users_7d} compact={!isDesktop} />
                        <Stat label="Sessions"      value={displayedStats?.total_sessions} compact={!isDesktop} />
                        <Stat label="Sessions 24h"  value={displayedStats?.sessions_24h} compact={!isDesktop} />
                        <Stat label="Sessions 7d"   value={displayedStats?.sessions_7d} compact={!isDesktop} />
                        <Stat label="Cases open"    value={displayedStats?.cases_open} accent={!!displayedStats && displayedStats.cases_open > 0 ? COPPER : undefined} compact={!isDesktop} />
                        <Stat label="In progress"   value={displayedStats?.cases_in_progress} compact={!isDesktop} />
                    </div>
                </Card>

                {/* ── Cases queue ── */}
                <Card style={{ marginTop: 24 }} compact={!isDesktop}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                        <SectionLabel compact={!isDesktop}>Cases</SectionLabel>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {(['all','open','in_progress','closed'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setStatusFilt(f)}
                                    style={{
                                        fontSize: 12,
                                        fontWeight: 600,
                                        padding: '6px 12px',
                                        borderRadius: 999,
                                        background: statusFilt === f ? COPPER : SURFACE_2,
                                        color: statusFilt === f ? '#fff' : 'rgba(255,255,255,0.55)',
                                        border: `1px solid ${statusFilt === f ? COPPER : SURFACE_2_BORDER}`,
                                        cursor: 'pointer',
                                    }}
                                >
                                    {f === 'all' ? 'All' : STATUS_LABEL[f]}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginTop: 18 }}>
                        {filteredCases.length === 0 ? (
                            <EmptyRow text={statusFilt === 'all' ? 'No cases yet — quiet is good.' : `No ${STATUS_LABEL[statusFilt as CaseStatus].toLowerCase()} cases.`} />
                        ) : (
                            filteredCases.map(c => (
                                <CaseRow key={c.id} caseItem={c} onUpdated={onCaseUpdated} />
                            ))
                        )}
                    </div>
                </Card>

                {/* ── Recent users ── */}
                <Card style={{ marginTop: 24 }} compact={!isDesktop}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                        <SectionLabel compact={!isDesktop}>Recent users</SectionLabel>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: TEXT_TERTIARY }}>
                                <span style={{ letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 10, color: TEXT_TERTIARY }}>Min sessions</span>
                                <input
                                    type="number"
                                    min={0}
                                    value={minSessions}
                                    onChange={e => setMinSessions(Math.max(0, Number(e.target.value) || 0))}
                                    style={{
                                        width: 56,
                                        padding: '6px 8px',
                                        background: SURFACE_2,
                                        border: `1px solid ${SURFACE_2_BORDER}`,
                                        borderRadius: 8,
                                        color: TEXT_PRIMARY,
                                        fontSize: 13,
                                        textAlign: 'center',
                                        outline: 'none',
                                    }}
                                />
                            </label>
                        </div>
                    </div>
                    <div style={{ marginTop: 18 }}>
                        {visibleUsers.length === 0 ? (
                            <EmptyRow text={users.length === 0 ? 'No users yet.' : 'No users match the current filter.'} />
                        ) : (
                            <>
                                {visibleUsers.map(u => <UserRow key={u.id} user={u} />)}
                                {hiddenUserCount > 0 && (
                                    <div style={{ paddingTop: 14, color: TEXT_TERTIARY, fontSize: 13, fontStyle: 'italic' }}>
                                        +{hiddenUserCount} more match the filter (raise the min-sessions threshold to narrow further).
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </Card>

                {/* ── Recent logins ── */}
                <Card style={{ marginTop: 24 }} compact={!isDesktop}>
                    <SectionLabel compact={!isDesktop}>Recent logins</SectionLabel>
                    <div style={{ marginTop: 14 }}>
                        {recentLogins.length === 0 ? (
                            <p style={{ fontSize: 13, color: TEXT_HINT, fontStyle: 'italic' }}>No login data yet.</p>
                        ) : (
                            recentLogins.slice(0, 15).map(login => {
                                const ago = getTimeAgo(login.last_login_at);
                                return (
                                    <Link
                                        key={login.id}
                                        to={`/admin/users/${login.id}`}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
                                            textDecoration: 'none',
                                        }}
                                    >
                                        <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                            {isDesktop ? (
                                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    <span style={{ fontSize: 13, color: TEXT_BODY }}>
                                                        {login.name ?? login.email}
                                                    </span>
                                                    {login.name && (
                                                        <span style={{ fontSize: 11, color: TEXT_HINT, marginLeft: 8 }}>
                                                            {login.email}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <>
                                                    <div style={{ fontSize: 13, color: TEXT_BODY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {login.name ?? login.email}
                                                    </div>
                                                    {login.name && (
                                                        <div style={{ fontSize: 11, color: TEXT_HINT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {login.email}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                        <span style={{ fontSize: 11, color: COPPER, opacity: 0.6, whiteSpace: 'nowrap' }}>
                                            {ago}
                                        </span>
                                    </Link>
                                );
                            })
                        )}
                    </div>
                </Card>

                {/* ── System info ── */}
                <Card style={{ marginTop: 24 }} compact={!isDesktop}>
                    <SectionLabel compact={!isDesktop}>System</SectionLabel>
                    <div style={{ marginTop: 14, fontSize: 13, color: TEXT_TERTIARY, lineHeight: 1.7 }}>
                        <div>App version: <span style={{ color: PALE_YELLOW }}>{(import.meta as { env?: { VITE_APP_VERSION?: string } }).env?.VITE_APP_VERSION ?? 'dev'}</span></div>
                        <div>API connected: <span style={{ color: error ? STATUS_ERROR : '#52B56C' }}>{error ? 'failed' : 'ok'}</span></div>
                        <div>Loaded at: <span style={{ color: PALE_YELLOW }}>{new Date().toLocaleString()}</span></div>
                    </div>
                </Card>

                {/* ── File tree ── */}
                <Card style={{ marginTop: 24 }} compact={!isDesktop}>
                    <SectionLabel compact={!isDesktop}>File tree</SectionLabel>
                    <div style={{ marginTop: 14, maxHeight: 500, overflowY: 'auto' }}>
                        {fileTree ? <FileTreeView nodes={fileTree} /> : <p style={{ fontSize: 13, color: TEXT_HINT, fontStyle: 'italic' }}>Loading…</p>}
                    </div>
                </Card>

                {/* ── API routes ── */}
                <Card style={{ marginTop: 24 }} compact={!isDesktop}>
                    <SectionLabel compact={!isDesktop}>API routes</SectionLabel>
                    <div style={{ marginTop: 14, maxHeight: 500, overflowY: 'auto', fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 12 }}>
                        {routeList ? routeList.map((r, i) => (
                            <div
                                key={`${r.method}-${r.path}-${i}`}
                                style={{
                                    display: 'flex',
                                    gap: 12,
                                    padding: '4px 0',
                                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                                }}
                            >
                                <span style={{
                                    width: 52,
                                    fontWeight: 700,
                                    flexShrink: 0,
                                    color: r.method === 'GET' ? '#52B56C'
                                        : r.method === 'POST' ? COPPER
                                        : r.method === 'DELETE' ? STATUS_ERROR
                                        : PALE_YELLOW,
                                }}>
                                    {r.method}
                                </span>
                                <span style={{ color: TEXT_SECONDARY, wordBreak: 'break-all' }}>{r.path}</span>
                            </div>
                        )) : <p style={{ fontSize: 13, color: TEXT_HINT, fontStyle: 'italic' }}>Loading…</p>}
                    </div>
                </Card>
            </div>
        </PageContent>
    );
}

// ─────────────────────────────────────────────────────────────────────────
// Small components
// ─────────────────────────────────────────────────────────────────────────

function Card({ children, style, compact }: { children: React.ReactNode; style?: React.CSSProperties; compact?: boolean }) {
    return (
        <div
            style={{
                backgroundColor: CARD_BG,
                border: `1px solid ${CARD_GLOW_BORDER}`,
                boxShadow: CARD_GLOW,
                borderRadius: 16,
                padding: compact ? 16 : 24,
                ...style,
            }}
        >
            {children}
        </div>
    );
}

function SectionLabel({ children, compact }: { children: React.ReactNode; compact?: boolean }) {
    // Editorial section header — small-caps copper kicker over a serif
    // display title. Same pattern the page-level header uses (◇ Admin /
    // "Dashboard"); applying it per section gives the dashboard chapter-
    // book hierarchy instead of the prior 11.5px small-caps caption-only
    // treatment.
    return (
        <div>
            <p className="j2-label-copper" style={{ margin: 0, marginBottom: 4 }}>◇ {children}</p>
            <h2
                className="j2-serif-display j2-heading-glow"
                style={{
                    fontSize: compact ? 22 : 30,
                    color: PALE_YELLOW,
                    margin: 0,
                    lineHeight: 1.1,
                    letterSpacing: '-0.005em',
                }}
            >
                {children}
            </h2>
        </div>
    );
}

function ShowTestUsersToggle({
    value,
    onChange,
    testCount,
}: {
    value: boolean;
    onChange: (v: boolean) => void;
    testCount: number;
}) {
    return (
        <button
            onClick={() => onChange(!value)}
            style={{
                fontSize: 12,
                fontWeight: 600,
                padding: '6px 12px',
                borderRadius: 999,
                background: value ? COPPER : SURFACE_2,
                color: value ? '#fff' : 'rgba(255,255,255,0.55)',
                border: `1px solid ${value ? COPPER : SURFACE_2_BORDER}`,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
            }}
            title={value ? 'Hide test users' : 'Show test users'}
        >
            {value ? '✓ Test users shown' : `Show ${testCount} test users`}
        </button>
    );
}

function Stat({ label, value, accent, compact }: { label: string; value: number | undefined; accent?: string; compact?: boolean }) {
    return (
        <div>
            <div
                style={{
                    fontFamily: FONT_EDITORIAL,
                    fontSize: compact ? 22 : 28,
                    fontWeight: 600,
                    color: accent ?? PALE_YELLOW,
                    textShadow: GLOW_SOFT,
                    lineHeight: 1,
                }}
            >
                {value === undefined ? '—' : value.toLocaleString()}
            </div>
            <div
                style={{
                    fontSize: 11,
                    color: TEXT_TERTIARY,
                    marginTop: 6,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                }}
            >
                {label}
            </div>
        </div>
    );
}

function EmptyRow({ text }: { text: string }) {
    return (
        <div
            style={{
                padding: '16px 0',
                color: TEXT_TERTIARY,
                fontSize: 14,
                fontStyle: 'italic',
            }}
        >
            {text}
        </div>
    );
}

// ── Case row ──────────────────────────────────────────────────────────────

function CaseRow({
    caseItem,
    onUpdated,
}: {
    caseItem: SupportCaseWithUser;
    onUpdated: (c: SupportCaseWithUser) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const [savingStatus, setSavingStatus] = useState<CaseStatus | null>(null);
    const [notes, setNotes] = useState(caseItem.admin_notes ?? '');
    const [savingNotes, setSavingNotes] = useState(false);

    const handleStatus = async (next: CaseStatus) => {
        setSavingStatus(next);
        try {
            const r = await api.patch<{ case: SupportCaseWithUser }>(`/api/admin/cases/${caseItem.id}`, { status: next });
            onUpdated({ ...caseItem, ...r.case });
        } catch {
            // Optimistic feel — drop and let user retry.
        } finally {
            setSavingStatus(null);
        }
    };

    const handleSaveNotes = async () => {
        setSavingNotes(true);
        try {
            const r = await api.patch<{ case: SupportCaseWithUser }>(`/api/admin/cases/${caseItem.id}`, { admin_notes: notes });
            onUpdated({ ...caseItem, ...r.case });
        } catch {
            //
        } finally {
            setSavingNotes(false);
        }
    };

    const created = new Date(caseItem.created_at).toLocaleString();

    return (
        <div
            style={{
                borderTop: '1px solid rgba(255,255,255,0.06)',
                padding: '14px 0',
            }}
        >
            <div
                style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                onClick={() => setExpanded(e => !e)}
            >
                <StatusPill status={caseItem.status} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: TEXT_PRIMARY, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {caseItem.subject}
                    </div>
                    <div style={{ color: TEXT_TERTIARY, fontSize: 12, marginTop: 2 }}>
                        <Link
                            to={`/admin/users/${caseItem.user_id}`}
                            onClick={e => e.stopPropagation()}
                            style={{ color: 'rgba(196,145,95,0.85)', textDecoration: 'none' }}
                            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                        >
                            {caseItem.user_name ?? caseItem.user_email}
                        </Link>
                        {' · '}{created} · {SEVERITY_LABEL[caseItem.severity]}
                    </div>
                </div>
                <div style={{ color: TEXT_HINT, fontSize: 12 }}>
                    {expanded ? '▾' : '▸'}
                </div>
            </div>

            {expanded && (
                <div style={{ marginTop: 14, marginLeft: 8, paddingLeft: 18, borderLeft: '2px solid rgba(196,145,95,0.20)' }}>
                    <p style={{ color: TEXT_BODY, fontSize: 14, lineHeight: 1.55, margin: '0 0 14px', whiteSpace: 'pre-wrap' }}>
                        {caseItem.description}
                    </p>

                    <div style={{ fontSize: 12, color: TEXT_TERTIARY, marginBottom: 14, lineHeight: 1.6 }}>
                        {caseItem.page_url     && <div>URL: <span style={{ color: TEXT_SECONDARY }}>{caseItem.page_url}</span></div>}
                        {caseItem.user_agent   && <div>UA: <span style={{ color: TEXT_SECONDARY }}>{caseItem.user_agent}</span></div>}
                        {caseItem.app_version  && <div>App version: <span style={{ color: TEXT_SECONDARY }}>{caseItem.app_version}</span></div>}
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                        {(['open','in_progress','closed'] as CaseStatus[]).map(s => (
                            <button
                                key={s}
                                onClick={() => handleStatus(s)}
                                disabled={caseItem.status === s || savingStatus === s}
                                style={{
                                    fontSize: 12,
                                    fontWeight: 600,
                                    padding: '6px 12px',
                                    borderRadius: 8,
                                    cursor: caseItem.status === s ? 'default' : 'pointer',
                                    opacity: caseItem.status === s ? 0.55 : 1,
                                    background: caseItem.status === s ? STATUS_PILL_BG[s] : SURFACE_2,
                                    color: caseItem.status === s ? STATUS_PILL_FG[s] : 'rgba(255,255,255,0.65)',
                                    border: `1px solid ${SURFACE_2_BORDER}`,
                                }}
                            >
                                {savingStatus === s ? '...' : `Set ${STATUS_LABEL[s]}`}
                            </button>
                        ))}
                    </div>

                    <div>
                        <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: TEXT_TERTIARY }}>
                            Admin notes
                        </label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={3}
                            placeholder="Triage notes, repro steps…"
                            style={{
                                width: '100%',
                                marginTop: 6,
                                padding: '10px 12px',
                                background: SURFACE_2,
                                border: `1px solid ${SURFACE_2_BORDER}`,
                                borderRadius: 10,
                                color: TEXT_PRIMARY,
                                fontSize: 13,
                                resize: 'vertical',
                                outline: 'none',
                                fontFamily: 'inherit',
                            }}
                        />
                        <button
                            onClick={handleSaveNotes}
                            disabled={savingNotes || (notes === (caseItem.admin_notes ?? ''))}
                            style={{
                                marginTop: 8,
                                fontSize: 12,
                                fontWeight: 600,
                                padding: '6px 14px',
                                background: COPPER,
                                color: '#fff',
                                border: 'none',
                                borderRadius: 8,
                                cursor: 'pointer',
                                opacity: (savingNotes || notes === (caseItem.admin_notes ?? '')) ? 0.5 : 1,
                            }}
                        >
                            {savingNotes ? 'Saving…' : 'Save notes'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatusPill({ status }: { status: CaseStatus }) {
    return (
        <span
            style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
                padding: '4px 10px',
                borderRadius: 999,
                background: STATUS_PILL_BG[status],
                color: STATUS_PILL_FG[status],
                whiteSpace: 'nowrap',
                flexShrink: 0,
            }}
        >
            {STATUS_LABEL[status]}
        </span>
    );
}

// ── User row ──────────────────────────────────────────────────────────────

function UserRow({ user }: { user: AdminUserSummary }) {
    // Whole row is a link to the user-detail page (/admin/users/:id).
    // Hover shifts the bg subtly and turns the email copper to telegraph
    // affordance without going noisy.
    return (
        <Link
            to={`/admin/users/${user.id}`}
            style={{
                borderTop: '1px solid rgba(255,255,255,0.06)',
                padding: '12px 8px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                textDecoration: 'none',
                color: 'inherit',
                borderRadius: 8,
                transition: 'background-color 160ms ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: TEXT_PRIMARY, fontSize: 14, fontWeight: 600 }}>
                    {user.name ?? '(no name)'}
                </div>
                <div style={{ color: TEXT_TERTIARY, fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.email} · {user.belt_rank ?? 'no belt'} · joined {new Date(user.created_at).toLocaleDateString()}
                </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 12, color: TEXT_TERTIARY }}>
                <div style={{ fontFamily: FONT_EDITORIAL, fontSize: 18, color: PALE_YELLOW }}>
                    {user.session_count}
                </div>
                <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: TEXT_TERTIARY }}>
                    sessions
                </div>
            </div>
            <div style={{ fontSize: 12, color: TEXT_HINT, marginLeft: 4 }}>↗</div>
        </Link>
    );
}

// ── File tree ────────────────────────────────────────────────────────────

function FileTreeView({ nodes, depth = 0 }: { nodes: FileTreeNode[]; depth?: number }) {
    return <>{nodes.map(node => <FileTreeItem key={node.name} node={node} depth={depth} />)}</>;
}

function FileTreeItem({ node, depth }: { node: FileTreeNode; depth: number }) {
    const [expanded, setExpanded] = useState(depth < 1);
    const isDir = node.type === 'directory';
    const hasChildren = isDir && node.children && node.children.length > 0;
    return (
        <div>
            <div
                onClick={() => hasChildren && setExpanded(e => !e)}
                style={{
                    paddingTop: 3,
                    paddingBottom: 3,
                    paddingLeft: depth * 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: hasChildren ? 'pointer' : 'default',
                    fontSize: 12,
                    color: isDir ? PALE_YELLOW : 'rgba(255,255,255,0.55)',
                    fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                }}
            >
                <span style={{ width: 10, textAlign: 'center', fontSize: 10, color: TEXT_HINT }}>
                    {hasChildren ? (expanded ? '▾' : '▸') : ''}
                </span>
                <span>{isDir ? `${node.name}/` : node.name}</span>
            </div>
            {expanded && hasChildren && <FileTreeView nodes={node.children!} depth={depth + 1} />}
        </div>
    );
}
