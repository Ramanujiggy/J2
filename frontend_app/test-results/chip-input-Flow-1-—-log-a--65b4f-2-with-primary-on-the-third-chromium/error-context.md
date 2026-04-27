# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: chip-input.spec.ts >> Flow 1 — log a session via chips >> 1.4 two taps + double-tap a third → 0.6 / 0.2 / 0.2 with primary on the third
- Location: playwright\tests\chip-input.spec.ts:172:5

# Error details

```
TimeoutError: page.waitForRequest: Timeout 10000ms exceeded while waiting for event "request"
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
            - generic [ref=e64]: 107h 30m
            - generic [ref=e65]: 215 sessions
          - generic [ref=e66]:
            - generic [ref=e67]: Alignment
            - generic [ref=e68]: 40%
            - generic [ref=e69]: 87 of 215 on focus
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
                - generic "Week 17 · 215 sessions · 107.5h" [ref=e103]
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
                - generic [ref=e354]: JAN
                - generic [ref=e355]: FEB
                - generic [ref=e356]: MAR
                - generic [ref=e357]: APR
                - generic [ref=e358]: MAY
                - generic [ref=e359]: JUN
                - generic [ref=e360]: JUL
                - generic [ref=e361]: AUG
                - generic [ref=e362]: SEP
                - generic [ref=e363]: OCT
                - generic [ref=e364]: NOV
                - generic [ref=e365]: DEC
                - generic [ref=e366]: "2026"
                - generic [ref=e367]: 215 SESSIONS
                - generic [ref=e368]: 108 HOURS
              - generic [ref=e369]:
                - generic [ref=e370]:
                  - generic [ref=e372]: Stand-up
                  - generic [ref=e373]: "87"
                - generic [ref=e374]:
                  - generic [ref=e376]: Guard Passing
                  - generic [ref=e377]: "0"
                - generic [ref=e378]:
                  - generic [ref=e380]: Dynamic Pins
                  - generic [ref=e381]: "0"
                - generic [ref=e382]:
                  - generic [ref=e384]: Submissions
                  - generic [ref=e385]: "0"
                - generic [ref=e386]:
                  - generic [ref=e388]: Guard
                  - generic [ref=e389]: "128"
            - generic [ref=e390] [cursor=pointer]:
              - generic [ref=e391]:
                - generic [ref=e392]: Training Rhythm
                - generic [ref=e393]: View calendar →
              - generic [ref=e395]:
                - generic [ref=e396]: Nov
                - generic [ref=e399]: Dec
                - generic [ref=e404]: Jan
                - generic [ref=e408]: Feb
                - generic [ref=e412]: Mar
                - generic [ref=e417]: Apr
            - generic [ref=e590]:
              - generic [ref=e592]: Training Telemetry
              - generic [ref=e594]:
                - generic [ref=e595]: 215 sessions
                - generic [ref=e596]: ·
                - generic [ref=e597]: 107h 30m total
              - paragraph [ref=e598]:
                - text: Splitting time between
                - strong [ref=e599]: Guard
                - text: and
                - strong [ref=e600]: Stand-up
                - text: .
          - generic [ref=e601]:
            - generic [ref=e603]:
              - generic [ref=e604]:
                - generic [ref=e605]: ◈
                - generic [ref=e606]: This week's focus
              - paragraph [ref=e607]: Stand-up
              - generic [ref=e609]: 5d remaining
              - generic [ref=e613]: 215 sessions
              - generic [ref=e614]:
                - button "Edit" [ref=e615] [cursor=pointer]
                - button "Journal" [ref=e616] [cursor=pointer]
                - button "Delete" [ref=e617] [cursor=pointer]
            - generic [ref=e618]:
              - generic [ref=e619]: ◈ Most recent session
              - generic [ref=e622]: Stand-up
              - generic [ref=e623]: 30m · Class · Gi
              - generic [ref=e624]: Sun, Apr 26
            - generic [ref=e625]:
              - generic [ref=e626]: ◈ Last 30 days · intensity
              - generic [ref=e627]:
                - generic [ref=e630]: "0"
                - generic [ref=e633]: "0"
                - generic [ref=e636]: "215"
                - generic [ref=e639]: "0"
                - generic [ref=e642]: "0"
              - generic [ref=e643]:
                - generic [ref=e644]: Drill
                - generic [ref=e645]: Steady
                - generic [ref=e646]: Hard roll
            - generic [ref=e647]:
              - generic [ref=e648]:
                - generic [ref=e649]:
                  - button "Previous week" [ref=e650] [cursor=pointer]:
                    - img [ref=e651]
                  - button "Return to current week" [ref=e653] [cursor=pointer]: This Week
                  - button "Next week" [ref=e654] [cursor=pointer]:
                    - img [ref=e655]
                - generic [ref=e657]:
                  - button "Calendar view" [ref=e658] [cursor=pointer]:
                    - img [ref=e659]
                  - button "List view" [ref=e661] [cursor=pointer]:
                    - img [ref=e662]
              - generic [ref=e664]:
                - button "M 20" [ref=e665] [cursor=pointer]:
                  - generic [ref=e666]: M
                  - generic [ref=e668]: "20"
                - button "T 21" [ref=e669] [cursor=pointer]:
                  - generic [ref=e670]: T
                  - generic [ref=e672]: "21"
                - button "W 22" [ref=e673] [cursor=pointer]:
                  - generic [ref=e674]: W
                  - generic [ref=e676]: "22"
                - button "T 23" [ref=e677] [cursor=pointer]:
                  - generic [ref=e678]: T
                  - generic [ref=e680]: "23"
                - button "F 24" [ref=e681] [cursor=pointer]:
                  - generic [ref=e682]: F
                  - generic [ref=e684]: "24"
                - button "S 25" [ref=e685] [cursor=pointer]:
                  - generic [ref=e686]: S
                  - generic [ref=e688]: "25"
                - button "S 26 107h 30m" [ref=e689] [cursor=pointer]:
                  - generic [ref=e690]: S
                  - generic [ref=e692]: "26"
                  - generic [ref=e693]: 107h 30m
            - generic [ref=e694]:
              - paragraph [ref=e695]: ◇ Reflection
              - paragraph [ref=e696]: “What's the smallest detail you're drilling this week?”
              - button "Write an entry" [ref=e697] [cursor=pointer]
        - generic [ref=e698]:
          - generic [ref=e699]:
            - generic [ref=e700]: ◈ Recent intentions
            - button "See all →" [ref=e701] [cursor=pointer]
          - generic [ref=e703]:
            - generic [ref=e704]: Wk of Apr 26
            - generic [ref=e705]: Stand-up
        - generic [ref=e709]:
          - generic [ref=e710]:
            - generic: Apr 26, 2026
            - textbox [ref=e713] [cursor=pointer]: 2026-04-26
          - generic [ref=e714]:
            - heading "Log a Training Session" [level=2] [ref=e715]
            - generic [ref=e716]:
              - text: The Basics
              - generic [ref=e717]:
                - button "Gi" [ref=e718] [cursor=pointer]
                - button "No-Gi" [ref=e719] [cursor=pointer]
              - generic [ref=e720]:
                - button "Class" [ref=e721] [cursor=pointer]
                - button "Drilling" [ref=e722] [cursor=pointer]
                - button "Competition" [ref=e723] [cursor=pointer]
              - generic [ref=e725]:
                - button "−" [ref=e726] [cursor=pointer]
                - generic [ref=e727]: tap above
                - button "+" [ref=e728] [cursor=pointer]
              - generic [ref=e729]:
                - button [ref=e730] [cursor=pointer]
                - button [ref=e731] [cursor=pointer]
                - button "Moderate" [ref=e732] [cursor=pointer]
                - button [ref=e733] [cursor=pointer]
                - button [ref=e734] [cursor=pointer]
            - generic [ref=e735]:
              - heading "What did you work on?" [level=3] [ref=e737]
              - generic [ref=e738]:
                - group "Focus areas for this session" [ref=e739]:
                  - switch "Stand-up" [ref=e740] [cursor=pointer]
                  - switch "Passing" [ref=e741] [cursor=pointer]
                  - switch "Pins" [ref=e742] [cursor=pointer]
                  - switch "Subs" [checked] [ref=e743] [cursor=pointer]: Subs
                  - switch "Guard, primary focus" [checked] [ref=e745] [cursor=pointer]: Guard
                - paragraph [ref=e747]:
                  - text: Tap to add. Double-tap to set your focus. Hold for deep work.
                  - button "got it" [ref=e748] [cursor=pointer]
              - generic [ref=e749]:
                - generic [ref=e750]:
                  - button "Defense" [ref=e751] [cursor=pointer]
                  - button "Neutral" [ref=e752] [cursor=pointer]
                  - button "Offense" [ref=e753] [cursor=pointer]
                - paragraph [ref=e754]: What side of the exchange were you primarily on?
              - generic [ref=e755]:
                - generic [ref=e756]:
                  - button "Coach-led" [ref=e757] [cursor=pointer]
                  - button "Open Mat" [ref=e758] [cursor=pointer]
                - paragraph [ref=e759]: Was this instructor-led or self-directed?
            - generic [ref=e760]:
              - text: Details
              - generic [ref=e761]:
                - generic [ref=e762]: Tags (optional, max 5)
                - textbox "Search positions or type to add…" [ref=e764]
              - generic [ref=e765]:
                - generic [ref=e766]: Notes (optional)
                - generic [ref=e767]:
                  - textbox "What stood out today?" [ref=e768]
                  - button "Record voice note" [ref=e769] [cursor=pointer]:
                    - img [ref=e770]
            - paragraph [ref=e773]: Please select a duration.
            - generic [ref=e774]:
              - button "Cancel" [ref=e775] [cursor=pointer]
              - button "Save Session" [active] [ref=e776] [cursor=pointer]
  - region "Notifications (F8)":
    - list
```

# Test source

```ts
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
  84  |     await expect(c).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true');
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
> 114 |     const reqPromise = page.waitForRequest(
      |                             ^ TimeoutError: page.waitForRequest: Timeout 10000ms exceeded while waiting for event "request"
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
  185 |         expect(dist.standup).toBeCloseTo(0.2, 2);
  186 |         expect(dist.submissions).toBeCloseTo(0.2, 2);
  187 |     });
  188 | 
  189 |     test('1.5 primary transfer (double-tap A then B) → only B has primary', async ({ page }) => {
  190 |         await openLogForm(page);
  191 |         await setMinDuration(page);
  192 |         await setPrimary(chip(page, 'guard'));
  193 |         await setPrimary(chip(page, 'submissions'));
  194 |         // Guard should still be selected (not deselected) but no longer primary.
  195 |         await expect(chip(page, 'guard')).toHaveAttribute('aria-checked', 'true');
  196 |         const guardName = await chip(page, 'guard').getAttribute('aria-label');
  197 |         expect(guardName ?? '').not.toMatch(/primary focus/i);
  198 | 
  199 |         const body = await clickAndCapture(page);
  200 |         expect(body.heading).toBe('submissions');
  201 |         expect(body.had_primary).toBe(true);
  202 |         const dist = body.pillar_distribution as Record<string, number>;
  203 |         // Subs primary (3 raw points), Guard selected only (1) → 0.75 / 0.25.
  204 |         expect(dist.submissions).toBeCloseTo(0.75, 2);
  205 |         expect(dist.guard).toBeCloseTo(0.25, 2);
  206 |         expect(body.selection_count).toBe(2);
  207 |     });
  208 | 
  209 |     test('1.6 long-press → deep_work flag, telemetry had_deep_work=true', async ({ page }) => {
  210 |         await openLogForm(page);
  211 |         await setMinDuration(page);
  212 |         await setDeepWork(chip(page, 'guard'));
  213 | 
  214 |         const body = await clickAndCapture(page);
```