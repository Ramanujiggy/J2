// LandingPage — public marketing page at `/`.
//
// Implementation of the design handoff in `Journada (2).zip` —
// `design_handoff_landing/source/components/path.jsx` + `styles.css`.
//
// Voice and copy come from `Docs/product-offer.md`, `Docs/beliefs.md`, and the
// brand archetype/research docs in the handoff. Copy is locked — do not
// paraphrase without checking the brand voice.
//
// Auth bounce: logged-in users hitting `/` get redirected to `/home`.
// CTA routing:
//   - "Begin your record" / "See a sample journal" → /login?mode=register
//   - "Open Journada", "Sign in" → /login
//   - Footer/nav idea/journal/field-notes/contact links are inert (no anchors yet)

import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
// Brand surfaces/accents come from the token registry. Aliased to the local
// names this file already uses (CHAMPAGNE/BORDER_2) so the markup reads the
// same while the values stay single-sourced.
import {
  PAGE_BG, COPPER, CARD_BG,
  PALE_YELLOW as CHAMPAGNE,
  SURFACE_3_BORDER as BORDER_2,
} from '../lib/theme.ts';

// Landing-only values with no registry equivalent.
const ORANGE = '#DA7422';
const ORANGE_HOVER = '#E8823A';
const CARD_BG_2 = '#122619';
const TEXT_PRIMARY = 'rgba(255,255,255,0.90)';
const TEXT_SECONDARY = 'rgba(255,255,255,0.60)';
const TEXT_TERTIARY = 'rgba(255,255,255,0.40)';
const BORDER_1 = 'rgba(255,255,255,0.05)';

// CTA primary button (52px tall, used in hero + closing). Inline so the
// hover state can be driven by simple onMouseEnter without adding bespoke CSS.
function CTAPrimary({ children, to }: { children: React.ReactNode; to: string }) {
  return (
    <Link
      to={to}
      style={{
        height: 52,
        padding: '0 28px',
        background: ORANGE,
        color: '#fff',
        fontWeight: 600,
        borderRadius: 12,
        boxShadow: '0 0 0 1px rgba(218,116,34,0.30), 0 10px 24px -12px rgba(218,116,34,0.60)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 15,
        textDecoration: 'none',
        transition: 'background 180ms ease, transform 180ms ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = ORANGE_HOVER; }}
      onMouseLeave={e => { e.currentTarget.style.background = ORANGE; }}
    >
      {children}
    </Link>
  );
}

function CTAGhost({ children, to, height = 52 }: { children: React.ReactNode; to: string; height?: number }) {
  return (
    <Link
      to={to}
      style={{
        height,
        padding: '0 22px',
        background: 'rgba(255,255,255,0.08)',
        color: TEXT_PRIMARY,
        border: `1px solid ${BORDER_2}`,
        borderRadius: 10,
        fontWeight: 500,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 13,
        textDecoration: 'none',
        transition: 'background 180ms ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
    >
      {children}
    </Link>
  );
}

// Nav anchor links in the handoff are inert — no anchor targets exist yet.
// Render as a styled span; swap to <a href="#section"> when sections get IDs.
function NavLinkText({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 13, color: COPPER, fontWeight: 600, cursor: 'default' }}>
      {children}
    </span>
  );
}

const HOW_IT_WORKS = [
  {
    kicker: '01 · Record',
    title: 'A session is a paragraph, not a stat',
    body: "Quickly note what you drilled, who you rolled with, and the detail that finally clicked. Five lines, while it's fresh — that's all.",
  },
  {
    kicker: '02 · Reflect',
    title: 'Set what this week is about',
    body: 'Working De La Riva? Pressure passing? Naming the focus turns scattered classes into a thread you can pull on.',
  },
  {
    kicker: '03 · Read',
    title: 'See the shape of your game',
    body: "Recurring positions. Holes that keep showing up. The technique you've quietly made yours. Your training, finally legible.",
  },
] as const;

const BELIEFS = [
  'Your training matters more than you realize.',
  'You forget more of it than you think.',
  "Your progress already has patterns — you just can't see them yet.",
  'Recording is the only reliable way to make those patterns visible.',
  'Your years on the mats deserve to be remembered.',
] as const;

const NOT_THIS = [
  'Streaks, leaderboards, levels',
  'Calorie rings and tap counts',
  'Fitness-tracker dashboards',
  '"Optimize your performance"',
] as const;

const THIS = [
  'A record of what you worked on',
  'The shape of a belt-era, in your own words',
  "Patterns the eye can't see alone",
  "A keepsake of the practice that's quietly shaping your life",
] as const;

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/home" replace />;

  const registerHref = '/login?mode=register';
  const loginHref = '/login';

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        overflow: 'hidden',
        backgroundColor: PAGE_BG,
        color: TEXT_PRIMARY,
        fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      }}
    >
      {/* Ambient seigaiha pattern — same one used on the auth page for continuity. */}
      <div className="j2-seigaiha-bg" aria-hidden="true" />

      {/* ── Nav ──────────────────────────────────────────────────────── */}
      <nav
        style={{
          position: 'relative',
          zIndex: 2,
          padding: '28px 56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div className="j2-wordmark" style={{ fontSize: 30 }}>Journada</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <NavLinkText>The idea</NavLinkText>
          <NavLinkText>The journal</NavLinkText>
          <Link
            to={loginHref}
            style={{ fontSize: 13, color: COPPER, fontWeight: 600, textDecoration: 'none' }}
          >
            Sign in
          </Link>
          <CTAGhost to={loginHref} height={38}>Open Journada →</CTAGhost>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: 1040,
          margin: '0 auto',
          padding: '72px 48px 96px',
          textAlign: 'center',
        }}
      >
        <div className="j2-label-copper" style={{ marginBottom: 28, letterSpacing: '0.22em' }}>
          ◇ A training journal for jiu-jitsu
        </div>
        <h1
          className="j2-serif-display"
          style={{
            fontSize: 88,
            lineHeight: 1.02,
            margin: 0,
            letterSpacing: '-0.025em',
            textShadow: '0 0 20px rgba(242,228,168,0.35), 0 0 48px rgba(242,228,168,0.20)',
            paddingBottom: 8,
            color: CHAMPAGNE,
          }}
        >
          Your training already<br />
          tells a{' '}
          <span className="j2-serif-italic" style={{ color: COPPER, fontStyle: 'italic' }}>
            story.
          </span>
        </h1>
        <p
          style={{
            maxWidth: 620,
            margin: '56px auto 14px',
            fontSize: 20,
            lineHeight: 1.55,
            color: CHAMPAGNE,
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontStyle: 'italic',
            fontWeight: 500,
          }}
        >
          Journada lets you finally read it.
        </p>
        <p
          style={{
            maxWidth: 580,
            margin: '0 auto 44px',
            fontSize: 16,
            lineHeight: 1.7,
            color: TEXT_SECONDARY,
          }}
        >
          A long-form journal for grapplers who care too much to keep forgetting. Record what
          you worked on. See the shape of your game emerge — across weeks, belts, and years
          on the mat.
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <CTAPrimary to={registerHref}>Begin your record</CTAPrimary>
          <CTAGhost to={registerHref}>See a sample journal →</CTAGhost>
        </div>
        <div
          style={{
            marginTop: 20,
            fontSize: 12,
            color: TEXT_TERTIARY,
            letterSpacing: '0.06em',
          }}
        >
          Free through your first belt · $6/month after · No ads. No leaderboards. No streaks.
        </div>
      </section>

      {/* ── Quote band ───────────────────────────────────────────────── */}
      <section
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: 980,
          margin: '0 auto',
          padding: '0 48px 96px',
        }}
      >
        <div
          style={{
            padding: '40px 48px',
            borderTop: `1px solid ${BORDER_2}`,
            borderBottom: `1px solid ${BORDER_2}`,
            textAlign: 'center',
          }}
        >
          <div
            className="j2-serif-italic"
            style={{
              fontSize: 26,
              lineHeight: 1.45,
              color: TEXT_PRIMARY,
              maxWidth: 760,
              margin: '0 auto',
            }}
          >
            &ldquo;I&rsquo;ve been training for years and I still feel like<br />
            my game is a fog of half-remembered positions.&rdquo;
          </div>
          <div className="j2-label-micro" style={{ marginTop: 18, color: TEXT_TERTIARY }}>
            ◈ Every grappler we talked to · in their own words
          </div>
        </div>
      </section>

      {/* ── The wound: training amnesia ──────────────────────────────── */}
      <section
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: 1100,
          margin: '0 auto',
          padding: '0 48px 120px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.2fr',
            gap: 80,
            alignItems: 'center',
          }}
        >
          <div>
            <div className="j2-label-copper" style={{ marginBottom: 18 }}>
              ◇ The problem nobody names
            </div>
            <h2
              className="j2-serif-display"
              style={{
                fontSize: 48,
                lineHeight: 1.05,
                margin: 0,
                letterSpacing: '-0.02em',
                color: CHAMPAGNE,
              }}
            >
              You&rsquo;re not losing skill.<br />
              <span className="j2-serif-italic" style={{ color: COPPER }}>
                You&rsquo;re losing memory.
              </span>
            </h2>
          </div>
          <div style={{ fontSize: 16, lineHeight: 1.75, color: TEXT_SECONDARY }}>
            <p style={{ margin: '0 0 18px' }}>
              You learn a detail in class. By Saturday it&rsquo;s gone. The weeks blur. Months
              disappear. Years stack up.
            </p>
            <p style={{ margin: '0 0 18px' }}>
              Most apps count what happened — minutes, sessions, taps. None of them help you
              remember what it{' '}
              <em style={{ color: CHAMPAGNE, fontStyle: 'italic' }}>meant</em>.
            </p>
            <p style={{ margin: 0, color: TEXT_PRIMARY }}>
              The problem was never effort. It was record.
            </p>
          </div>
        </div>
      </section>

      {/* ── Three movements ──────────────────────────────────────────── */}
      <section
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: 1180,
          margin: '0 auto',
          padding: '0 48px 100px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div className="j2-label-copper" style={{ marginBottom: 14 }}>
            ◈ How it works
          </div>
          <h2
            className="j2-serif-display"
            style={{
              fontSize: 44,
              margin: 0,
              letterSpacing: '-0.02em',
              color: CHAMPAGNE,
            }}
          >
            Record. Reflect.{' '}
            <span className="j2-serif-italic" style={{ color: COPPER }}>
              Read your game.
            </span>
          </h2>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 28,
          }}
        >
          {HOW_IT_WORKS.map((p, i) => (
            <div
              key={i}
              style={{
                background: CARD_BG,
                border: `1px solid ${BORDER_2}`,
                borderRadius: 16,
                padding: 32,
              }}
            >
              <div className="j2-label-copper" style={{ marginBottom: 16 }}>
                {p.kicker}
              </div>
              <div
                className="j2-serif-display"
                style={{
                  fontSize: 24,
                  marginBottom: 12,
                  lineHeight: 1.2,
                  color: CHAMPAGNE,
                }}
              >
                {p.title}
              </div>
              <div style={{ fontSize: 14.5, color: TEXT_SECONDARY, lineHeight: 1.65 }}>
                {p.body}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── What it isn't ────────────────────────────────────────────── */}
      <section
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: 1100,
          margin: '0 auto',
          padding: '0 48px 120px',
        }}
      >
        <div
          style={{
            background: CARD_BG_2,
            border: `1px solid ${BORDER_1}`,
            borderRadius: 16,
            padding: '48px 56px',
          }}
        >
          <div className="j2-label-copper" style={{ marginBottom: 18 }}>
            ◇ What Journada is not
          </div>
          <h2
            className="j2-serif-display"
            style={{
              fontSize: 36,
              lineHeight: 1.15,
              margin: '0 0 28px',
              maxWidth: 820,
              letterSpacing: '-0.015em',
              color: CHAMPAGNE,
            }}
          >
            We are tired of jiu-jitsu being turned into{' '}
            <span className="j2-serif-italic" style={{ color: COPPER }}>
              another scoreboard.
            </span>
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 48,
              fontSize: 15,
              lineHeight: 1.75,
            }}
          >
            <div>
              <div className="j2-label-micro" style={{ marginBottom: 14, color: TEXT_TERTIARY }}>
                Not this
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', color: TEXT_TERTIARY }}>
                {NOT_THIS.map(item => (
                  <li
                    key={item}
                    style={{
                      padding: '6px 0',
                      textDecoration: 'line-through',
                      textDecorationColor: 'rgba(218,116,34,0.50)',
                    }}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="j2-label-micro" style={{ marginBottom: 14, color: COPPER }}>
                This
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', color: TEXT_PRIMARY }}>
                {THIS.map(item => (
                  <li key={item} style={{ padding: '6px 0' }}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Belief chain — the wager ─────────────────────────────────── */}
      <section
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: 760,
          margin: '0 auto',
          padding: '0 48px 120px',
        }}
      >
        <div className="j2-label-copper" style={{ marginBottom: 22, textAlign: 'center' }}>
          ◈ The wager
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {BELIEFS.map((line, i, arr) => (
            <div
              key={i}
              style={{
                padding: '22px 0',
                borderBottom: i < arr.length - 1 ? `1px solid ${BORDER_2}` : 'none',
                display: 'flex',
                gap: 22,
                alignItems: 'baseline',
              }}
            >
              <div
                style={{
                  fontFamily: '"Cormorant Garamond", Georgia, serif',
                  fontSize: 18,
                  fontStyle: 'italic',
                  color: COPPER,
                  minWidth: 24,
                  fontWeight: 500,
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </div>
              <div
                className="j2-serif-display"
                style={{
                  fontSize: 22,
                  lineHeight: 1.4,
                  color: TEXT_PRIMARY,
                  fontWeight: 500,
                  letterSpacing: '-0.005em',
                }}
              >
                {line}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Closing CTA ──────────────────────────────────────────────── */}
      <section
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: 780,
          margin: '0 auto',
          padding: '0 48px 120px',
          textAlign: 'center',
        }}
      >
        <h2
          className="j2-serif-display j2-heading-glow"
          style={{
            fontSize: 56,
            lineHeight: 1.05,
            margin: '0 0 20px',
            letterSpacing: '-0.02em',
          }}
        >
          Years from now, you&rsquo;ll wish<br />
          <span className="j2-serif-italic" style={{ color: COPPER }}>
            you had written this down.
          </span>
        </h2>
        <p
          style={{
            fontSize: 16,
            color: TEXT_SECONDARY,
            maxWidth: 540,
            margin: '0 auto 36px',
            lineHeight: 1.7,
          }}
        >
          Start today. Tomorrow&rsquo;s class is the first entry. A year from now, you&rsquo;ll
          have something most grapplers never do — a real record of how your game became yours.
        </p>
        <CTAPrimary to={registerHref}>Begin your record</CTAPrimary>
        <div
          style={{
            marginTop: 20,
            fontSize: 12,
            color: TEXT_TERTIARY,
            letterSpacing: '0.06em',
          }}
        >
          Free through your first belt · $6/month after
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer
        style={{
          position: 'relative',
          zIndex: 2,
          borderTop: `1px solid ${BORDER_1}`,
          padding: '40px 56px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: TEXT_TERTIARY,
          fontSize: 12,
          flexWrap: 'wrap',
          gap: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="j2-wordmark" style={{ fontSize: 18 }}>Journada</div>
          <div className="j2-serif-italic" style={{ fontSize: 13 }}>
            · A record of your practice.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24, fontSize: 12 }}>
          <NavLinkText>The idea</NavLinkText>
          <NavLinkText>The journal</NavLinkText>
          <NavLinkText>Field notes</NavLinkText>
          <NavLinkText>Contact</NavLinkText>
        </div>
      </footer>
    </div>
  );
}
