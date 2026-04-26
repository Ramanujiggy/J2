// LandingPage — public marketing page at /.
//
// This is a STRUCTURAL SCAFFOLD. The visual design is being authored separately
// (Claude artifacts) and will replace the body of each section component below.
// Section names + copy hooks mirror Docs/product-offer.md and Docs/beliefs.md so
// the designer and the developer stay in sync.
//
// Auth bounce: logged-in users hitting / get redirected to /home — returning
// PWA users want the app, not the marketing pitch. Logged-out users see the
// landing page and convert via /login (CTAs deep-link to ?mode=register).

import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.ts';
import {
  CARD_BG, CARD_GLOW, CARD_GLOW_BORDER, COPPER, PALE_YELLOW,
} from '../lib/theme.ts';
import WaveBackground from '../components/WaveBackground.tsx';

const PAGE_BG = '#0D1A14';

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/home" replace />;

  return (
    <div
      className="min-h-screen min-h-dvh flex flex-col relative overflow-x-hidden"
      style={{ backgroundColor: PAGE_BG, color: 'rgba(255,255,255,0.85)' }}
    >
      {/* Ambient wave backdrop — same seigaiha pattern as the auth page for visual continuity. */}
      <div
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, opacity: 0.25, pointerEvents: 'none' }}
      >
        <WaveBackground />
      </div>

      {/* Lightweight nav: wordmark + Log In link. No marketing nav until we have multiple pages. */}
      <header
        className="relative z-10 flex items-center justify-between px-6 py-5"
        style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))' }}
      >
        <span className="j2-wordmark" style={{ fontSize: 24 }}>Journada</span>
        <Link
          to="/login"
          className="text-sm transition-colors"
          style={{ color: 'rgba(255,255,255,0.55)' }}
        >
          Log In
        </Link>
      </header>

      <main className="relative z-10 flex-1">
        <HeroSection />
        <ProblemSection />
        <DiscoverySection />
        <MechanismSection />
        <BeliefsSection />
        <SocialProofSection />
        <FAQSection />
        <FinalCTASection />
      </main>

      <footer
        className="relative z-10 px-6 py-8 text-center"
        style={{
          color: 'rgba(255,255,255,0.30)',
          fontSize: 12,
          paddingBottom: 'max(2rem, env(safe-area-inset-bottom))',
        }}
      >
        <p className="j2-label-micro" style={{ color: 'rgba(255,255,255,0.22)' }}>·   ·   ·</p>
        <p className="mt-3">© Journada · The mat remembers every session.</p>
      </footer>
    </div>
  );
}

// ─── Section stubs ──────────────────────────────────────────────────────────
// Each section is a placeholder that the Claude-design output replaces. The
// data-section attribute makes them easy to target during design integration.
// Copy hooks reference Docs/product-offer.md and Docs/beliefs.md — designer
// pulls headlines, big idea, UMP/UMS, and the six beliefs from those docs.

function HeroSection() {
  // Hooks: primary headline, big idea, primary CTA.
  // Recommended copy seeds (product-offer.md):
  //   - "Your Training Has a Shape. You Just Can't See It Yet."
  //   - "Most Apps Count Sessions. This One Reveals Your Game."
  //   - Subheadline: "A journal that reveals the patterns hidden inside your training."
  return (
    <section
      data-section="hero"
      className="px-6 pt-12 pb-20 flex flex-col items-center text-center"
      style={{ minHeight: '70vh' }}
    >
      <p className="j2-label-copper" style={{ marginBottom: 16 }}>
        ◇ For intentional grappling
      </p>
      <h1
        className="j2-serif-display j2-heading-glow"
        style={{ fontSize: 'clamp(40px, 8vw, 88px)', lineHeight: 1.05, letterSpacing: '-0.01em', maxWidth: 920 }}
      >
        Your training has a shape.
        <br />
        You just can&apos;t see it yet.
      </h1>
      <p
        className="j2-serif-italic"
        style={{ marginTop: 24, fontSize: 'clamp(16px, 2.4vw, 22px)', color: 'rgba(255,255,255,0.65)', maxWidth: 640, lineHeight: 1.5 }}
      >
        A journal that reveals the patterns hidden inside your training.
      </p>
      <PrimaryCTA className="mt-10" label="Begin your record" />
      <p style={{ marginTop: 16, fontSize: 13, color: 'rgba(255,255,255,0.40)' }}>
        Free through your first belt. Then $6/month.
      </p>
    </section>
  );
}

function ProblemSection() {
  // Hooks: UMP — "Training Amnesia." Loss of accumulated memory.
  // Belief #2: "I forget more of my training than I think."
  // Pull verbatim quotes from customer-research.md "Failures, Frustrations" section.
  return (
    <section data-section="problem" className="px-6 py-20 max-w-3xl mx-auto">
      <p className="j2-label-copper">◇ The problem</p>
      <h2 className="j2-serif-display" style={{ fontSize: 'clamp(28px, 4.5vw, 44px)', lineHeight: 1.2, marginTop: 12 }}>
        You&apos;re not losing skill. You&apos;re losing memory.
      </h2>
      {/* TODO(claude-design): replace with the "Training Amnesia" treatment — verbatim
          customer quotes ("I forgot everything we did in class", "sloppy and full of
          holes", "no plan B"), then the framing reveal. */}
    </section>
  );
}

function DiscoverySection() {
  // Hooks: discovery story from product-offer.md ("I kept training. Three times a week...").
  // Long-form narrative. The piece that converts emotional readers.
  return (
    <section data-section="discovery" className="px-6 py-20 max-w-2xl mx-auto">
      <p className="j2-label-copper">◇ Discovery story</p>
      <h2 className="j2-serif-display" style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', lineHeight: 1.2, marginTop: 12 }}>
        How Journada started
      </h2>
      {/* TODO(claude-design): paste the discovery story from product-offer.md verbatim,
          formatted as long-form prose with breathing room between paragraphs. */}
    </section>
  );
}

function MechanismSection() {
  // Hooks: UMS — "Long-Horizon Pattern Surfacing." It turns sessions into patterns.
  // Belief #3: "My progress already has patterns — I just can't see them yet."
  // Belief #5: "Recording my training is the only reliable way to make those patterns visible."
  // Visual treatment: side-by-side or stacked — record (left/top) vs reveal (right/bottom).
  return (
    <section data-section="mechanism" className="px-6 py-20 max-w-4xl mx-auto">
      <p className="j2-label-copper">◇ How it works</p>
      <h2 className="j2-serif-display" style={{ fontSize: 'clamp(28px, 4.5vw, 44px)', lineHeight: 1.2, marginTop: 12 }}>
        It turns sessions into patterns.
      </h2>
      {/* TODO(claude-design): two-column or stacked treatment.
          LEFT: "You record" (what you worked on / who / what showed up / what failed).
          RIGHT: "Journada reveals" (recurring positions / dominant habits / missing areas / game evolution). */}
    </section>
  );
}

function BeliefsSection() {
  // Hooks: the six beliefs from beliefs.md, in order. Each becomes a card or row.
  // This is the structural body of the pitch — the inevitability chain.
  const beliefs = [
    'My training matters more than I realized.',
    'I forget more of my training than I think.',
    'My progress already has patterns — I just can\u2019t see them yet.',
    'Seeing those patterns would help me understand and improve my game.',
    'Recording my training is the only reliable way to make those patterns visible.',
    'This system will make recording my training easy enough to actually stick with.',
  ];
  return (
    <section data-section="beliefs" className="px-6 py-20 max-w-4xl mx-auto">
      <p className="j2-label-copper">◇ What you already know</p>
      <h2 className="j2-serif-display" style={{ fontSize: 'clamp(28px, 4.5vw, 44px)', lineHeight: 1.2, marginTop: 12, marginBottom: 32 }}>
        Six things that are true whether you record them or not.
      </h2>
      {/* TODO(claude-design): style each belief as a numbered card or quiet editorial row.
          Keep them un-ornamented — these are claims, not features. */}
      <ol className="space-y-6" style={{ counterReset: 'belief' }}>
        {beliefs.map((b, i) => (
          <li
            key={i}
            className="flex gap-5"
            style={{ borderLeft: `2px solid ${COPPER}`, paddingLeft: 20 }}
          >
            <span style={{ color: COPPER, fontSize: 14, fontWeight: 700, minWidth: 24 }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <p style={{ fontSize: 18, lineHeight: 1.5, color: 'rgba(255,255,255,0.85)' }}>{b}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function SocialProofSection() {
  // Hooks: testimonials, founder quote, or "early users say" once available.
  // Empty placeholder — don't fabricate proof.
  return (
    <section data-section="social-proof" className="px-6 py-20 max-w-3xl mx-auto">
      {/* TODO(claude-design): empty until we have real testimonials or notable users.
          Don't invent proof. If empty at launch, hide this section entirely. */}
    </section>
  );
}

function FAQSection() {
  // Hooks: objection handling from product-offer.md "List All Objections" — Time,
  // Consistency, Value, Need, Technology, Identity, Belief, Emotional.
  // Pick the 5–7 most likely objections; collapse rest into the FAQ.
  return (
    <section data-section="faq" className="px-6 py-20 max-w-2xl mx-auto">
      <p className="j2-label-copper">◇ Common questions</p>
      <h2 className="j2-serif-display" style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', lineHeight: 1.2, marginTop: 12 }}>
        What about—
      </h2>
      {/* TODO(claude-design): accordion or expandable Q&A. Top objections to address:
          - "I don't have time to write notes" (consistency / friction)
          - "I'll forget to use it" (consistency)
          - "I can just use Notes / a notebook" (value)
          - "I'm not serious enough for this" (identity)
          - "Writing things down won't make me better" (belief)
          - "Why pay $6/month?" (value) */}
    </section>
  );
}

function FinalCTASection() {
  // Hooks: pricing + final emotional appeal.
  // "Free through your first belt. Then $6/month."
  // Closing line possibilities (product-offer.md): "The journal for hobbyists who plan
  // to stay for life." / "Build a record of your game, not just a count of your taps."
  return (
    <section
      data-section="final-cta"
      className="px-6 py-24 flex flex-col items-center text-center max-w-2xl mx-auto"
    >
      <div
        className="rounded-2xl w-full"
        style={{
          padding: 'clamp(28px, 5vw, 48px)',
          backgroundColor: CARD_BG,
          border: `1px solid ${CARD_GLOW_BORDER}`,
          boxShadow: CARD_GLOW,
        }}
      >
        <p className="j2-label-copper" style={{ marginBottom: 14 }}>◇ Start your record</p>
        <h2
          className="j2-serif-display j2-heading-glow"
          style={{ fontSize: 'clamp(28px, 4.5vw, 44px)', lineHeight: 1.2 }}
        >
          The journal for hobbyists who plan to stay for life.
        </h2>
        <p
          className="j2-serif-italic"
          style={{ marginTop: 18, fontSize: 17, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}
        >
          Free through your first belt. Then $6/month.
        </p>
        <PrimaryCTA className="mt-8" label="Begin your record" />
        <p style={{ marginTop: 14, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
          Already have an account? <Link to="/login" style={{ color: PALE_YELLOW }}>Log In</Link>
        </p>
      </div>
    </section>
  );
}

// ─── Shared CTA ─────────────────────────────────────────────────────────────
// Single source of truth for the primary "convert" button. All CTAs deep-link
// to /login?mode=register so the auth page lands on the Register tab.

function PrimaryCTA({ label, className }: { label: string; className?: string }) {
  return (
    <Link
      to="/login?mode=register"
      className={`inline-flex items-center justify-center text-white font-semibold rounded-xl transition-all touch-manipulation j2-press ${className ?? ''}`}
      style={{
        height: 56,
        paddingLeft: 28,
        paddingRight: 28,
        backgroundColor: '#DA7422',
        boxShadow: '0 2px 16px rgba(218,116,34,0.35)',
        fontSize: 16,
        minWidth: 220,
      }}
    >
      {label}
    </Link>
  );
}
