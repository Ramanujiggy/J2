// AdminUserDetailPage — admin-only deep dive into a single user.
//
// Route: /admin/users/:userId. Read-only in v1 — getting visibility first;
// edit affordances (toggle is_admin, force password reset, etc.) come later
// if the founder finds themselves wanting them.
//
// Single backend round-trip via GET /api/admin/users/:id which returns
// profile + activity stats + recent sessions (20) + recent intentions (5)
// + this user's support cases (all). No pagination — admin view, low N.

import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams, Link } from 'react-router-dom';
import PageContent from '../components/PageContent.tsx';
import { useProfile } from '../context/ProfileContext.tsx';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import { api, ApiError } from '../lib/api.ts';
import {
    PALE_YELLOW, COPPER, CARD_BG, CARD_GLOW, CARD_GLOW_BORDER,
    SURFACE_2, SURFACE_2_BORDER, FONT_EDITORIAL, GLOW_SOFT,
} from '../lib/theme.ts';
import { formatDuration, SESSION_TYPE_LABELS, INTENSITY_COLOR, formatGiNogi } from '../lib/sessionUtils.ts';
import type {
    AdminUserDetailResponse,
    AdminUserSession,
    AdminUserIntention,
    SupportCase,
} from '../types/api.ts';

const TEST_EMAIL_PATTERNS = [/@journada-e2e\.com$/i, /@example\.com$/i];

export default function AdminUserDetailPage() {
    const { userId } = useParams<{ userId: string }>();
    const navigate = useNavigate();
    const { isAdmin, loaded } = useProfile();
    const isDesktop = useIsDesktop();

    const [data, setData]       = useState<AdminUserDetailResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState<string | null>(null);

    useEffect(() => {
        if (!loaded || !isAdmin || !userId) return;
        let cancelled = false;
        async function load() {
            try {
                setLoading(true);
                setError(null);
                const r = await api.get<AdminUserDetailResponse>(`/api/admin/users/${userId}`);
                if (!cancelled) setData(r);
            } catch (e) {
                if (cancelled) return;
                if (e instanceof ApiError && e.status === 404) {
                    setError('User not found.');
                } else if (e instanceof ApiError && e.status === 403) {
                    setError('Admin access required.');
                } else {
                    setError('Could not load user. Refresh to retry.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        void load();
        return () => { cancelled = true; };
    }, [loaded, isAdmin, userId]);

    // Auth gates
    if (!loaded) return <PageContent ready={false} loadingMessages={['Loading…']}>{null}</PageContent>;
    if (!isAdmin) return <Navigate to="/home" replace />;

    const isTestUser = data && TEST_EMAIL_PATTERNS.some(re => re.test(data.user.email));

    return (
        <PageContent ready={!loading} loadingMessages={['Loading user…']}>
            <div
                className={isDesktop ? 'j2-page-container' : 'mx-auto max-w-5xl px-4 sm:px-6'}
                style={isDesktop ? { paddingTop: 64, paddingBottom: 104 } : { paddingTop: 24, paddingBottom: 40 }}
            >
                {/* Back link */}
                <button
                    onClick={() => navigate('/admin')}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'rgba(255,255,255,0.45)',
                        fontSize: 13,
                        cursor: 'pointer',
                        padding: 0,
                        marginBottom: 18,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = COPPER)}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
                >
                    ← Back to dashboard
                </button>

                {error && (
                    <div
                        style={{
                            backgroundColor: 'rgba(248,113,113,0.10)',
                            border: '1px solid rgba(248,113,113,0.25)',
                            borderRadius: 12,
                            padding: '12px 16px',
                            color: 'rgba(248,113,113,0.95)',
                            fontSize: 14,
                            marginBottom: 24,
                        }}
                    >
                        {error}
                    </div>
                )}

                {data && (
                    <>
                        {/* Editorial header */}
                        <div style={{ marginBottom: isDesktop ? 36 : 24 }}>
                            <p className="j2-label-copper" style={{ marginBottom: 8 }}>
                                ◇ User · {isTestUser ? 'TEST ACCOUNT' : 'Account'}
                            </p>
                            <h1
                                className="j2-serif-display j2-heading-glow"
                                style={{
                                    fontSize: isDesktop ? 56 : 32,
                                    lineHeight: 1.05,
                                    margin: 0,
                                    letterSpacing: '-0.01em',
                                }}
                            >
                                {data.user.name ?? '(no name)'}
                            </h1>
                            <p
                                style={{
                                    marginTop: 12,
                                    fontSize: isDesktop ? 16 : 14,
                                    color: 'rgba(255,255,255,0.55)',
                                    fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                                }}
                            >
                                {data.user.email}
                            </p>
                        </div>

                        {/* Identity card */}
                        <Card>
                            <SectionLabel>Identity</SectionLabel>
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: isDesktop ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
                                    gap: 14,
                                    marginTop: 18,
                                }}
                            >
                                <Field label="Belt"               value={data.user.belt_rank ? `${cap(data.user.belt_rank)} · ${data.user.stripes} stripes` : '—'} />
                                <Field label="Home gym"           value={data.user.home_gym_name ?? '—'} />
                                <Field label="Timezone"           value={data.user.timezone ?? '—'} />
                                <Field label="Intentions enabled" value={data.user.intentions_enabled ? 'Yes' : 'No'} />
                                <Field label="Admin"              value={data.user.is_admin ? '✓ admin' : 'no'} accent={data.user.is_admin ? COPPER : undefined} />
                                <Field label="Onboarded"          value={data.user.onboarding_completed_at ? formatDate(data.user.onboarding_completed_at) : 'not yet'} />
                                <Field label="Joined"             value={formatDate(data.user.created_at)} />
                                {isTestUser && (
                                    <Field label="Test account"   value="✓ matches e2e pattern" accent={COPPER} />
                                )}
                            </div>
                        </Card>

                        {/* Activity strip */}
                        <Card style={{ marginTop: 24 }}>
                            <SectionLabel>Activity</SectionLabel>
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: isDesktop ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)',
                                    gap: isDesktop ? 18 : 14,
                                    marginTop: 18,
                                }}
                            >
                                <Stat label="Total sessions" value={data.stats.total_sessions} />
                                <Stat label="Total hours"    value={Math.round(data.stats.total_minutes / 60)} />
                                <Stat label="Sessions 7d"    value={data.stats.sessions_7d} />
                                <Stat label="Last session"   text={data.stats.last_session_at ? formatDate(data.stats.last_session_at) : '—'} />
                            </div>
                        </Card>

                        {/* Recent sessions */}
                        <Card style={{ marginTop: 24 }}>
                            <SectionLabel>Recent sessions ({data.recent_sessions.length})</SectionLabel>
                            <div style={{ marginTop: 18 }}>
                                {data.recent_sessions.length === 0 ? (
                                    <Empty text="No sessions logged yet." />
                                ) : (
                                    data.recent_sessions.map(s => <SessionRow key={s.id} session={s} />)
                                )}
                            </div>
                        </Card>

                        {/* Recent intentions */}
                        <Card style={{ marginTop: 24 }}>
                            <SectionLabel>Recent intentions ({data.recent_intentions.length})</SectionLabel>
                            <div style={{ marginTop: 18 }}>
                                {data.recent_intentions.length === 0 ? (
                                    <Empty text="No intentions set." />
                                ) : (
                                    data.recent_intentions.map(i => <IntentionRow key={i.id} intention={i} />)
                                )}
                            </div>
                        </Card>

                        {/* Cases this user filed */}
                        <Card style={{ marginTop: 24 }}>
                            <SectionLabel>Support cases ({data.cases.length})</SectionLabel>
                            <div style={{ marginTop: 18 }}>
                                {data.cases.length === 0 ? (
                                    <Empty text="No cases filed." />
                                ) : (
                                    data.cases.map(c => <CaseRow key={c.id} caseItem={c} />)
                                )}
                            </div>
                        </Card>
                    </>
                )}
            </div>
        </PageContent>
    );
}

// ── Tiny helpers ─────────────────────────────────────────────────────────

function cap(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
    });
}

// ── Layout primitives — mirror AdminDashboardPage for consistency ────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return (
        <div
            style={{
                backgroundColor: CARD_BG,
                border: `1px solid ${CARD_GLOW_BORDER}`,
                boxShadow: CARD_GLOW,
                borderRadius: 16,
                padding: 24,
                ...style,
            }}
        >
            {children}
        </div>
    );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <div>
            <p className="j2-label-copper" style={{ margin: 0, marginBottom: 4 }}>◇ {children}</p>
            <h2
                className="j2-serif-display j2-heading-glow"
                style={{
                    fontSize: 26,
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

function Field({ label, value, accent }: { label: string; value: string; accent?: string }) {
    return (
        <div>
            <div
                style={{
                    fontSize: 10,
                    color: 'rgba(255,255,255,0.40)',
                    letterSpacing: '0.10em',
                    textTransform: 'uppercase',
                    marginBottom: 4,
                }}
            >
                {label}
            </div>
            <div
                style={{
                    fontSize: 14,
                    color: accent ?? 'rgba(255,255,255,0.85)',
                    fontWeight: 500,
                }}
            >
                {value}
            </div>
        </div>
    );
}

function Stat({ label, value, text }: { label: string; value?: number; text?: string }) {
    return (
        <div>
            <div
                style={{
                    fontFamily: FONT_EDITORIAL,
                    fontSize: 28,
                    fontWeight: 600,
                    color: PALE_YELLOW,
                    textShadow: GLOW_SOFT,
                    lineHeight: 1,
                }}
            >
                {text ?? (value === undefined ? '—' : value.toLocaleString())}
            </div>
            <div
                style={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.45)',
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

function Empty({ text }: { text: string }) {
    return (
        <div
            style={{
                padding: '14px 0',
                color: 'rgba(255,255,255,0.40)',
                fontSize: 14,
                fontStyle: 'italic',
            }}
        >
            {text}
        </div>
    );
}

// ── Row components ───────────────────────────────────────────────────────

function SessionRow({ session }: { session: AdminUserSession }) {
    const intColor = INTENSITY_COLOR[Math.max(1, Math.min(5, session.intensity)) as 1 | 2 | 3 | 4 | 5];
    const date = new Date(session.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return (
        <Link
            to={`/journal/${session.id}`}
            style={{
                display: 'grid',
                gridTemplateColumns: '110px 60px 1fr auto',
                gap: 12,
                alignItems: 'center',
                padding: '12px 0',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.85)',
                textDecoration: 'none',
                cursor: 'pointer',
            }}
        >
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>{date}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: intColor, boxShadow: `0 0 6px ${intColor}60` }} />
                {formatDuration(session.duration)}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {SESSION_TYPE_LABELS[session.session_type] ?? session.session_type}
                {session.heading && ` · ${cap(session.heading)}`}
                {session.gi_nogi && ` · ${formatGiNogi(session.gi_nogi)}`}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.30)' }}>↗</div>
        </Link>
    );
}

function IntentionRow({ intention }: { intention: AdminUserIntention }) {
    const week = new Date(intention.week_start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return (
        <div style={{ padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, justifyContent: 'space-between' }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
                    {intention.intent_label || (intention.heading ? cap(intention.heading) : '(no label)')}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap' }}>
                    {week} · {intention.duration_days}d
                </div>
            </div>
            {intention.heading && (
                <div style={{ fontSize: 12, color: 'rgba(196,145,95,0.85)', marginTop: 4 }}>
                    Focus: {cap(intention.heading)}
                </div>
            )}
        </div>
    );
}

function CaseRow({ caseItem }: { caseItem: SupportCase }) {
    const statusBg: Record<string, string> = {
        open:         'rgba(196,145,95,0.18)',
        in_progress:  'rgba(242,228,168,0.18)',
        closed:       'rgba(255,255,255,0.06)',
    };
    const statusFg: Record<string, string> = {
        open:         COPPER,
        in_progress:  PALE_YELLOW,
        closed:       'rgba(255,255,255,0.45)',
    };
    const created = new Date(caseItem.created_at).toLocaleString();
    return (
        <div style={{ padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span
                    style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase',
                        padding: '4px 10px', borderRadius: 999,
                        background: statusBg[caseItem.status] ?? SURFACE_2,
                        color: statusFg[caseItem.status] ?? 'rgba(255,255,255,0.55)',
                    }}
                >
                    {caseItem.status.replace('_', ' ')}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.88)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {caseItem.subject}
                </span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)', whiteSpace: 'nowrap' }}>
                    {caseItem.severity}
                </span>
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>
                {created}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {caseItem.description}
            </div>
            {caseItem.admin_notes && (
                <div style={{ marginTop: 8, padding: '8px 10px', background: SURFACE_2, border: `1px solid ${SURFACE_2_BORDER}`, borderRadius: 8, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                    <span style={{ fontWeight: 600, color: COPPER }}>Notes:</span> {caseItem.admin_notes}
                </div>
            )}
        </div>
    );
}
