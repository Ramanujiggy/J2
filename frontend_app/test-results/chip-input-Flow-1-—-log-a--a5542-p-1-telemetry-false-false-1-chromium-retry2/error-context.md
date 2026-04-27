# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: chip-input.spec.ts >> Flow 1 — log a session via chips >> 1.1 single tap → distribution {standup:1}, telemetry false/false/1
- Location: playwright\tests\chip-input.spec.ts:126:5

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  getByRole('switch', { name: /^Stand-up(,|$)/ })
Expected: "true"
Received: "false"
Timeout:  5000ms

Call log:
  - Expect "toHaveAttribute" with timeout 5000ms
  - waiting for getByRole('switch', { name: /^Stand-up(,|$)/ })
    9 × locator resolved to <button tabindex="0" type="button" role="switch" aria-checked="false" aria-label="Stand-up" class="relative rounded-[10px] px-3.5 py-2 text-sm font-medium transition-colors touch-manipulation select-none j2-press">…</button>
      - unexpected value "false"

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - complementary [ref=e4]:
      - generic:
        - img
      - generic [ref=e5]:
        - generic [ref=e6]: Journada
        - generic [ref=e7]: For intentional grappling
      - navigation [ref=e8]:
        - button "Path Ahead" [ref=e9] [cursor=pointer]:
          - img [ref=e11]
          - generic [ref=e14]: Path Ahead
        - button "Journal" [ref=e15] [cursor=pointer]:
          - img [ref=e16]
          - generic [ref=e19]: Journal
        - button "Atlas" [ref=e20] [cursor=pointer]:
          - img [ref=e21]
          - generic [ref=e23]: Atlas
        - button "Intentions" [ref=e24] [cursor=pointer]:
          - img [ref=e25]
          - generic [ref=e27]: Intentions
        - button "Profile" [ref=e28] [cursor=pointer]:
          - img [ref=e29]
          - generic [ref=e32]: Profile
      - generic [ref=e33]:
        - generic [ref=e34]: ◇ This week
        - generic [ref=e35]: Stand-up
        - generic [ref=e36]: standup
        - generic [ref=e37]: 5 days left
        - button "View Intentions →" [ref=e38] [cursor=pointer]
      - generic [ref=e39]:
        - generic "White belt" [ref=e40]
        - button "J Practitioner White belt" [ref=e41] [cursor=pointer]:
          - generic [ref=e42]: J
          - generic [ref=e43]:
            - generic [ref=e44]: Practitioner
            - generic [ref=e45]: White belt
    - main [ref=e46]:
      - generic [ref=e48]:
        - generic [ref=e49]:
          - generic [ref=e50]:
            - generic [ref=e51]: SUNDAY, APRIL 26
            - heading "This week" [level=1] [ref=e52]
            - generic [ref=e53]: 1 week in. Building the habit.
          - generic [ref=e54]:
            - button "◇ Adjust focus" [ref=e55] [cursor=pointer]
            - button "+ Log session" [ref=e56] [cursor=pointer]
        - generic [ref=e57]:
          - generic [ref=e58]:
            - generic [ref=e59]: Practice streak
            - generic [ref=e60]: 1d
            - generic [ref=e61]: "best: 1d"
          - generic [ref=e62]:
            - generic [ref=e63]: This week
            - generic [ref=e64]: 88h 30m
            - generic [ref=e65]: 177 sessions
          - generic [ref=e66]:
            - generic [ref=e67]: Alignment
            - generic [ref=e68]: 40%
            - generic [ref=e69]: 70 of 177 on focus
          - generic [ref=e70]:
            - generic [ref=e71]: Consistent weeks
            - generic [ref=e72]: "1"
            - generic [ref=e73]: weeks without a break
        - generic [ref=e74]:
          - generic [ref=e75]:
            - generic [ref=e76]:
              - generic [ref=e78]:
                - generic [ref=e79]: ◈ The Path · 2026
                - generic [ref=e80]: A year of training at a glance
              - img [ref=e82]:
                - generic "Week 1 · rest" [ref=e87]
                - generic "Week 2 · rest" [ref=e88]
                - generic "Week 3 · rest" [ref=e89]
                - generic "Week 4 · rest" [ref=e90]
                - generic "Week 5 · rest" [ref=e91]
                - generic "Week 6 · rest" [ref=e92]
                - generic "Week 7 · rest" [ref=e93]
                - generic "Week 8 · rest" [ref=e94]
                - generic "Week 9 · rest" [ref=e95]
                - generic "Week 10 · rest" [ref=e96]
                - generic "Week 11 · rest" [ref=e97]
                - generic "Week 12 · rest" [ref=e98]
                - generic "Week 13 · rest" [ref=e99]
                - generic "Week 14 · rest" [ref=e100]
                - generic "Week 15 · rest" [ref=e101]
                - generic "Week 16 · rest" [ref=e102]
                - generic "Week 17 · 177 sessions · 88.5h" [ref=e103]
                - generic "Week 18 · rest" [ref=e104]
                - generic "Week 19 · rest" [ref=e105]
                - generic "Week 20 · rest" [ref=e106]
                - generic "Week 21 · rest" [ref=e107]
                - generic "Week 22 · rest" [ref=e108]
                - generic "Week 23 · rest" [ref=e109]
                - generic "Week 24 · rest" [ref=e110]
                - generic "Week 25 · rest" [ref=e111]
                - generic "Week 26 · rest" [ref=e112]
                - generic "Week 27 · rest" [ref=e113]
                - generic "Week 28 · rest" [ref=e114]
                - generic "Week 29 · rest" [ref=e115]
                - generic "Week 30 · rest" [ref=e116]
                - generic "Week 31 · rest" [ref=e117]
                - generic "Week 32 · rest" [ref=e118]
                - generic "Week 33 · rest" [ref=e119]
                - generic "Week 34 · rest" [ref=e120]
                - generic "Week 35 · rest" [ref=e121]
                - generic "Week 36 · rest" [ref=e122]
                - generic "Week 37 · rest" [ref=e123]
                - generic "Week 38 · rest" [ref=e124]
                - generic "Week 39 · rest" [ref=e125]
                - generic "Week 40 · rest" [ref=e126]
                - generic "Week 41 · rest" [ref=e127]
                - generic "Week 42 · rest" [ref=e128]
                - generic "Week 43 · rest" [ref=e129]
                - generic "Week 44 · rest" [ref=e130]
                - generic "Week 45 · rest" [ref=e131]
                - generic "Week 46 · rest" [ref=e132]
                - generic "Week 47 · rest" [ref=e133]
                - generic "Week 48 · rest" [ref=e134]
                - generic "Week 49 · rest" [ref=e135]
                - generic "Week 50 · rest" [ref=e136]
                - generic "Week 51 · rest" [ref=e137]
                - generic "Week 52 · rest" [ref=e138]
                - generic [ref=e316]: JAN
                - generic [ref=e317]: FEB
                - generic [ref=e318]: MAR
                - generic [ref=e319]: APR
                - generic [ref=e320]: MAY
                - generic [ref=e321]: JUN
                - generic [ref=e322]: JUL
                - generic [ref=e323]: AUG
                - generic [ref=e324]: SEP
                - generic [ref=e325]: OCT
                - generic [ref=e326]: NOV
                - generic [ref=e327]: DEC
                - generic [ref=e328]: "2026"
                - generic [ref=e329]: 177 SESSIONS
                - generic [ref=e330]: 89 HOURS
              - generic [ref=e331]:
                - generic [ref=e332]:
                  - generic [ref=e334]: Stand-up
                  - generic [ref=e335]: "70"
                - generic [ref=e336]:
                  - generic [ref=e338]: Guard Passing
                  - generic [ref=e339]: "0"
                - generic [ref=e340]:
                  - generic [ref=e342]: Dynamic Pins
                  - generic [ref=e343]: "0"
                - generic [ref=e344]:
                  - generic [ref=e346]: Submissions
                  - generic [ref=e347]: "0"
                - generic [ref=e348]:
                  - generic [ref=e350]: Guard
                  - generic [ref=e351]: "107"
            - generic [ref=e352] [cursor=pointer]:
              - generic [ref=e353]:
                - generic [ref=e354]: Training Rhythm
                - generic [ref=e355]: View calendar →
              - generic [ref=e357]:
                - generic [ref=e358]: Nov
                - generic [ref=e361]: Dec
                - generic [ref=e366]: Jan
                - generic [ref=e370]: Feb
                - generic [ref=e374]: Mar
                - generic [ref=e379]: Apr
            - generic [ref=e552]:
              - generic [ref=e554]: Training Telemetry
              - generic [ref=e556]:
                - generic [ref=e557]: 177 sessions
                - generic [ref=e558]: ·
                - generic [ref=e559]: 88h 30m total
              - paragraph [ref=e560]:
                - text: Splitting time between
                - strong [ref=e561]: Guard
                - text: and
                - strong [ref=e562]: Stand-up
                - text: .
          - generic [ref=e563]:
            - generic [ref=e565]:
              - generic [ref=e566]:
                - generic [ref=e567]: ◈
                - generic [ref=e568]: This week's focus
              - paragraph [ref=e569]: Stand-up
              - generic [ref=e571]: 5d remaining
              - generic [ref=e575]: 177 sessions
              - generic [ref=e576]:
                - button "Edit" [ref=e577] [cursor=pointer]
                - button "Journal" [ref=e578] [cursor=pointer]
                - button "Delete" [ref=e579] [cursor=pointer]
            - generic [ref=e580]:
              - generic [ref=e581]: ◈ Most recent session
              - generic [ref=e584]: Stand-up
              - generic [ref=e585]: 30m · Class · Gi
              - generic [ref=e586]: Sun, Apr 26
            - generic [ref=e587]:
              - generic [ref=e588]: ◈ Last 30 days · intensity
              - generic [ref=e589]:
                - generic [ref=e592]: "0"
                - generic [ref=e595]: "0"
                - generic [ref=e598]: "177"
                - generic [ref=e601]: "0"
                - generic [ref=e604]: "0"
              - generic [ref=e605]:
                - generic [ref=e606]: Drill
                - generic [ref=e607]: Steady
                - generic [ref=e608]: Hard roll
            - generic [ref=e609]:
              - generic [ref=e610]:
                - generic [ref=e611]:
                  - button "Previous week" [ref=e612] [cursor=pointer]:
                    - img [ref=e613]
                  - button "Return to current week" [ref=e615] [cursor=pointer]: This Week
                  - button "Next week" [ref=e616] [cursor=pointer]:
                    - img [ref=e617]
                - generic [ref=e619]:
                  - button "Calendar view" [ref=e620] [cursor=pointer]:
                    - img [ref=e621]
                  - button "List view" [ref=e623] [cursor=pointer]:
                    - img [ref=e624]
              - generic [ref=e626]:
                - button "M 20" [ref=e627] [cursor=pointer]:
                  - generic [ref=e628]: M
                  - generic [ref=e630]: "20"
                - button "T 21" [ref=e631] [cursor=pointer]:
                  - generic [ref=e632]: T
                  - generic [ref=e634]: "21"
                - button "W 22" [ref=e635] [cursor=pointer]:
                  - generic [ref=e636]: W
                  - generic [ref=e638]: "22"
                - button "T 23" [ref=e639] [cursor=pointer]:
                  - generic [ref=e640]: T
                  - generic [ref=e642]: "23"
                - button "F 24" [ref=e643] [cursor=pointer]:
                  - generic [ref=e644]: F
                  - generic [ref=e646]: "24"
                - button "S 25" [ref=e647] [cursor=pointer]:
                  - generic [ref=e648]: S
                  - generic [ref=e650]: "25"
                - button "S 26 88h 30m" [ref=e651] [cursor=pointer]:
                  - generic [ref=e652]: S
                  - generic [ref=e654]: "26"
                  - generic [ref=e655]: 88h 30m
            - generic [ref=e656]:
              - paragraph [ref=e657]: ◇ Reflection
              - paragraph [ref=e658]: “What's the smallest detail you're drilling this week?”
              - button "Write an entry" [ref=e659] [cursor=pointer]
        - generic [ref=e660]:
          - generic [ref=e661]:
            - generic [ref=e662]: ◈ Recent intentions
            - button "See all →" [ref=e663] [cursor=pointer]
          - generic [ref=e665]:
            - generic [ref=e666]: Wk of Apr 26
            - generic [ref=e667]: Stand-up
        - generic [ref=e671]:
          - generic [ref=e672]:
            - generic: Apr 26, 2026
            - textbox [ref=e675] [cursor=pointer]: 2026-04-26
          - generic [ref=e676]:
            - heading "Log a Training Session" [level=2] [ref=e677]
            - generic [ref=e678]:
              - text: The Basics
              - generic [ref=e679]:
                - button "Gi" [ref=e680] [cursor=pointer]
                - button "No-Gi" [ref=e681] [cursor=pointer]
              - generic [ref=e682]:
                - button "Class" [ref=e683] [cursor=pointer]
                - button "Drilling" [ref=e684] [cursor=pointer]
                - button "Competition" [ref=e685] [cursor=pointer]
              - generic [ref=e686]:
                - generic [ref=e687]:
                  - button "30 m" [ref=e688] [cursor=pointer]
                  - button "1 h" [ref=e689] [cursor=pointer]
                  - button "1 h 30 m" [ref=e690] [cursor=pointer]
                  - button "2 h" [ref=e691] [cursor=pointer]
                - generic [ref=e692]:
                  - button "−" [ref=e693] [cursor=pointer]
                  - generic [ref=e694]: tap above
                  - button "+" [ref=e695] [cursor=pointer]
              - generic [ref=e696]:
                - button [ref=e697] [cursor=pointer]
                - button [ref=e698] [cursor=pointer]
                - button "Moderate" [ref=e699] [cursor=pointer]
                - button [ref=e700] [cursor=pointer]
                - button [ref=e701] [cursor=pointer]
            - generic [ref=e702]:
              - heading "What did you work on?" [level=3] [ref=e704]
              - generic [ref=e705]:
                - group "Focus areas for this session" [ref=e706]:
                  - switch "Stand-up" [ref=e707] [cursor=pointer]
                  - switch "Passing" [ref=e708] [cursor=pointer]
                  - switch "Pins" [ref=e709] [cursor=pointer]
                  - switch "Subs" [ref=e710] [cursor=pointer]
                  - switch "Guard" [ref=e711] [cursor=pointer]
                - paragraph [ref=e712]:
                  - text: Tap to add. Double-tap to set your focus. Hold for deep work.
                  - button "got it" [ref=e713] [cursor=pointer]
              - generic [ref=e714]:
                - generic [ref=e715]:
                  - button "Coach-led" [ref=e716] [cursor=pointer]
                  - button "Open Mat" [ref=e717] [cursor=pointer]
                - paragraph [ref=e718]: Was this instructor-led or self-directed?
            - generic [ref=e719]:
              - text: Details
              - generic [ref=e720]:
                - generic [ref=e721]: Tags (optional, max 5)
                - textbox "Pick a heading on the Prism first" [ref=e723]
              - generic [ref=e724]:
                - generic [ref=e725]: Notes (optional)
                - generic [ref=e726]:
                  - textbox "What stood out today?" [ref=e727]
                  - button "Record voice note" [ref=e728] [cursor=pointer]:
                    - img [ref=e729]
                  - status [ref=e732] [cursor=pointer]: Don't type — just talk. Tap the mic.
            - generic [ref=e733]:
              - button "Cancel" [ref=e734] [cursor=pointer]
              - button "Save Session" [ref=e735] [cursor=pointer]
  - region "Notifications (F8)":
    - list
```

# Test source

```ts
  1   | // E2E coverage for Flow 1 of the smoke-test runbook (LogSessionForm).
  2   | //
  3   | // We target the running dev stack (Vite :3000 → Express :5000), open the log
  4   | // modal from the home page, exercise the chip palette via Playwright pointer
  5   | // events, then capture the resulting POST /api/sessions request to assert on
  6   | // payload shape (heading, tags, pillar_distribution, telemetry).
  7   | //
  8   | // Each gesture helper waits for the chip's aria-* state to commit before
  9   | // returning. Without that, click events race ahead of React renders and the
  10  | // next gesture (or the form submit) reads stale state.
  11  | 
  12  | import { test, expect, type Page, type Locator } from '@playwright/test';
  13  | 
  14  | const SAVE_URL_RE = /\/api\/sessions(\?|$)/;
  15  | 
  16  | // Chip aria-labels include suffixes like ", primary focus" or ", deep work"
  17  | // when selected. Anchor at start + match either comma or end-of-string so the
  18  | // same pattern hits both unselected and selected states.
  19  | // FocusAreaChips uses short labels for the visible chip text and copies them
  20  | // straight into aria-label (FocusAreaChips.tsx:325). Suffixes ", primary focus"
  21  | // and ", deep work" are appended when those flags are set.
  22  | const CHIP_RE = {
  23  |     standup:     /^Stand-up(,|$)/,
  24  |     passing:     /^Passing(,|$)/,
  25  |     pins:        /^Pins(,|$)/,
  26  |     submissions: /^Subs(,|$)/,
  27  |     guard:       /^Guard(,|$)/,
  28  | } as const;
  29  | 
  30  | type PillarKey = keyof typeof CHIP_RE;
  31  | 
  32  | function chip(page: Page, pillar: PillarKey): Locator {
  33  |     return page.getByRole('switch', { name: CHIP_RE[pillar] });
  34  | }
  35  | 
  36  | async function openLogForm(page: Page): Promise<void> {
  37  |     await page.goto('/home');
  38  |     // PathAheadPage listens for `journada:open-log-form` (dispatched by the
  39  |     // mobile FAB at AppShell:312). Using the event sidesteps viewport-specific
  40  |     // button visibility (desktop hides the FAB). The listener mounts via
  41  |     // useEffect on PathAheadPage; if we dispatch too early it's missed, so we
  42  |     // retry until the modal opens.
  43  |     await page.waitForLoadState('networkidle');
  44  |     const saveBtn = page.getByRole('button', { name: /save session/i });
  45  |     for (let i = 0; i < 10; i++) {
  46  |         await page.evaluate(() => window.dispatchEvent(new CustomEvent('journada:open-log-form')));
  47  |         try {
  48  |             await saveBtn.waitFor({ state: 'visible', timeout: 1000 });
  49  |             // Confirm the chip palette has finished rendering — Save being
  50  |             // visible only proves the modal mounted, not that FocusAreaChips
  51  |             // committed its first render.
  52  |             await chip(page, 'standup').waitFor({ state: 'visible', timeout: 2000 });
  53  |             return;
  54  |         } catch { /* retry */ }
  55  |     }
  56  |     throw new Error('Log form modal did not open after 10 dispatch attempts.');
  57  | }
  58  | 
  59  | async function setMinDuration(page: Page): Promise<void> {
  60  |     await page.getByRole('button', { name: '+', exact: true }).first().click();
  61  |     // Confirm the new duration committed to the DOM before proceeding.
  62  |     await expect(page.locator('span', { hasText: /^30\s*m$/ })).toBeVisible();
  63  | }
  64  | 
  65  | // --- Gesture helpers (each waits for state to commit) -----------------------
  66  | 
  67  | // Wait for two animation frames. The first lets React commit the current
  68  | // pending state update; the second guarantees the parent component's render
  69  | // (and therefore its handler closures over the latest state) has happened
  70  | // before we fire the next event.
  71  | async function settle(page: Page): Promise<void> {
  72  |     await page.evaluate(() => new Promise<void>(r =>
  73  |         requestAnimationFrame(() => requestAnimationFrame(() => r())),
  74  |     ));
  75  | }
  76  | 
  77  | async function tap(c: Locator): Promise<void> {
  78  |     const before = await c.getAttribute('aria-checked');
  79  |     // force: true bypasses Playwright's stability/actionability checks. The
  80  |     // chip animates colors on selection change (`transition-colors`), and
  81  |     // overlapping animation frames between rapid taps were causing Playwright
  82  |     // to occasionally retry a click while the React commit was still in flight.
  83  |     await c.click({ force: true });
> 84  |     await expect(c).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true');
      |                     ^ Error: expect(locator).toHaveAttribute(expected) failed
  85  |     await settle(c.page());
  86  | }
  87  | 
  88  | async function setPrimary(c: Locator): Promise<void> {
  89  |     await c.dblclick({ force: true });
  90  |     await expect(c).toHaveAttribute('aria-checked', 'true');
  91  |     await expect(c).toHaveAccessibleName(/primary focus/i);
  92  |     await settle(c.page());
  93  | }
  94  | 
  95  | async function setDeepWork(target: Locator, holdMs = 600): Promise<void> {
  96  |     const box = await target.boundingBox();
  97  |     if (!box) throw new Error('Cannot long-press a chip with no bounding box');
  98  |     const cx = box.x + box.width / 2;
  99  |     const cy = box.y + box.height / 2;
  100 |     const page = target.page();
  101 |     await page.mouse.move(cx, cy);
  102 |     await page.mouse.down();
  103 |     await page.waitForTimeout(holdMs);
  104 |     await page.mouse.up();
  105 |     await expect(target).toHaveAccessibleName(/deep work/i);
  106 |     await settle(page);
  107 | }
  108 | 
  109 | async function clickAndCapture(page: Page): Promise<Record<string, unknown>> {
  110 |     // The gesture helpers above already settle via two RAFs. Belt-and-suspenders:
  111 |     // settle once more here before submitting, since the form's submit closure
  112 |     // is on a separate React subtree from the chip palette.
  113 |     await settle(page);
  114 |     const reqPromise = page.waitForRequest(
  115 |         r => SAVE_URL_RE.test(r.url()) && r.method() === 'POST',
  116 |         { timeout: 10_000 },
  117 |     );
  118 |     await page.getByRole('button', { name: /save session/i }).click();
  119 |     const req = await reqPromise;
  120 |     return req.postDataJSON() as Record<string, unknown>;
  121 | }
  122 | 
  123 | // --- Tests ------------------------------------------------------------------
  124 | 
  125 | test.describe('Flow 1 — log a session via chips', () => {
  126 |     test('1.1 single tap → distribution {standup:1}, telemetry false/false/1', async ({ page }) => {
  127 |         await openLogForm(page);
  128 |         await setMinDuration(page);
  129 |         await tap(chip(page, 'standup'));
  130 | 
  131 |         const body = await clickAndCapture(page);
  132 |         expect(body.heading).toBe('standup');
  133 |         expect(body.tags).toEqual(['standup']);
  134 |         expect(body.pillar_distribution).toEqual({ standup: 1 });
  135 |         expect(body.had_primary).toBe(false);
  136 |         expect(body.had_deep_work).toBe(false);
  137 |         expect(body.selection_count).toBe(1);
  138 |     });
  139 | 
  140 |     test('1.2 double-tap → primary, telemetry had_primary=true', async ({ page }) => {
  141 |         await openLogForm(page);
  142 |         await setMinDuration(page);
  143 |         await setPrimary(chip(page, 'guard'));
  144 | 
  145 |         const body = await clickAndCapture(page);
  146 |         expect(body.heading).toBe('guard');
  147 |         expect(body.tags).toEqual(['guard']);
  148 |         expect(body.pillar_distribution).toEqual({ guard: 1 });
  149 |         expect(body.had_primary).toBe(true);
  150 |         expect(body.had_deep_work).toBe(false);
  151 |         expect(body.selection_count).toBe(1);
  152 |     });
  153 | 
  154 |     test('1.3 three taps no primary → distribution split ~0.3333, telemetry false/false/3', async ({ page }) => {
  155 |         await openLogForm(page);
  156 |         await setMinDuration(page);
  157 |         await tap(chip(page, 'standup'));
  158 |         await tap(chip(page, 'submissions'));
  159 |         await tap(chip(page, 'guard'));
  160 | 
  161 |         const body = await clickAndCapture(page);
  162 |         expect(body.had_primary).toBe(false);
  163 |         expect(body.had_deep_work).toBe(false);
  164 |         expect(body.selection_count).toBe(3);
  165 |         const dist = body.pillar_distribution as Record<string, number>;
  166 |         expect(Object.keys(dist).sort()).toEqual(['guard', 'standup', 'submissions']);
  167 |         for (const w of Object.values(dist)) expect(w).toBeCloseTo(0.3333, 3);
  168 |         // Heading derives to first-tapped pillar in tie scenarios.
  169 |         expect(body.heading).toBe('standup');
  170 |     });
  171 | 
  172 |     test('1.4 two taps + double-tap a third → 0.6 / 0.2 / 0.2 with primary on the third', async ({ page }) => {
  173 |         await openLogForm(page);
  174 |         await setMinDuration(page);
  175 |         await tap(chip(page, 'standup'));
  176 |         await tap(chip(page, 'submissions'));
  177 |         await setPrimary(chip(page, 'guard'));
  178 | 
  179 |         const body = await clickAndCapture(page);
  180 |         expect(body.heading).toBe('guard');
  181 |         expect(body.had_primary).toBe(true);
  182 |         expect(body.selection_count).toBe(3);
  183 |         const dist = body.pillar_distribution as Record<string, number>;
  184 |         expect(dist.guard).toBeCloseTo(0.6, 2);
```