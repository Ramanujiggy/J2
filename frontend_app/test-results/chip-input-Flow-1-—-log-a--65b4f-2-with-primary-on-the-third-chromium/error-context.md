# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: chip-input.spec.ts >> Flow 1 — log a session via chips >> 1.4 two taps + double-tap a third → 0.6 / 0.2 / 0.2 with primary on the third
- Location: playwright\tests\chip-input.spec.ts:168:5

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
            - generic [ref=e64]: 60h
            - generic [ref=e65]: 120 sessions
          - generic [ref=e66]:
            - generic [ref=e67]: Alignment
            - generic [ref=e68]: 42%
            - generic [ref=e69]: 50 of 120 on focus
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
                - generic "Week 17 · 120 sessions · 60h" [ref=e103]
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
                - generic [ref=e259]: JAN
                - generic [ref=e260]: FEB
                - generic [ref=e261]: MAR
                - generic [ref=e262]: APR
                - generic [ref=e263]: MAY
                - generic [ref=e264]: JUN
                - generic [ref=e265]: JUL
                - generic [ref=e266]: AUG
                - generic [ref=e267]: SEP
                - generic [ref=e268]: OCT
                - generic [ref=e269]: NOV
                - generic [ref=e270]: DEC
                - generic [ref=e271]: "2026"
                - generic [ref=e272]: 120 SESSIONS
                - generic [ref=e273]: 60 HOURS
              - generic [ref=e274]:
                - generic [ref=e275]:
                  - generic [ref=e277]: Stand-up
                  - generic [ref=e278]: "50"
                - generic [ref=e279]:
                  - generic [ref=e281]: Guard Passing
                  - generic [ref=e282]: "0"
                - generic [ref=e283]:
                  - generic [ref=e285]: Dynamic Pins
                  - generic [ref=e286]: "0"
                - generic [ref=e287]:
                  - generic [ref=e289]: Submissions
                  - generic [ref=e290]: "0"
                - generic [ref=e291]:
                  - generic [ref=e293]: Guard
                  - generic [ref=e294]: "70"
            - generic [ref=e295] [cursor=pointer]:
              - generic [ref=e296]:
                - generic [ref=e297]: Training Rhythm
                - generic [ref=e298]: View calendar →
              - generic [ref=e300]:
                - generic [ref=e301]: Nov
                - generic [ref=e304]: Dec
                - generic [ref=e309]: Jan
                - generic [ref=e313]: Feb
                - generic [ref=e317]: Mar
                - generic [ref=e322]: Apr
            - generic [ref=e495]:
              - generic [ref=e497]: Training Telemetry
              - generic [ref=e499]:
                - generic [ref=e500]: 120 sessions
                - generic [ref=e501]: ·
                - generic [ref=e502]: 60h total
              - paragraph [ref=e503]:
                - text: Splitting time between
                - strong [ref=e504]: Guard
                - text: and
                - strong [ref=e505]: Stand-up
                - text: .
          - generic [ref=e506]:
            - generic [ref=e508]:
              - generic [ref=e509]:
                - generic [ref=e510]: ◈
                - generic [ref=e511]: This week's focus
              - paragraph [ref=e512]: Stand-up
              - generic [ref=e514]: 5d remaining
              - generic [ref=e518]: 120 sessions
              - generic [ref=e519]:
                - button "Edit" [ref=e520] [cursor=pointer]
                - button "Journal" [ref=e521] [cursor=pointer]
                - button "Delete" [ref=e522] [cursor=pointer]
            - generic [ref=e523]:
              - generic [ref=e524]: ◈ Most recent session
              - generic [ref=e527]: Stand-up
              - generic [ref=e528]: 30m · Class · Gi
              - generic [ref=e529]: Sun, Apr 26
            - generic [ref=e530]:
              - generic [ref=e531]: ◈ Last 30 days · intensity
              - generic [ref=e532]:
                - generic [ref=e535]: "0"
                - generic [ref=e538]: "0"
                - generic [ref=e541]: "120"
                - generic [ref=e544]: "0"
                - generic [ref=e547]: "0"
              - generic [ref=e548]:
                - generic [ref=e549]: Drill
                - generic [ref=e550]: Steady
                - generic [ref=e551]: Hard roll
            - generic [ref=e552]:
              - generic [ref=e553]:
                - generic [ref=e554]:
                  - button "Previous week" [ref=e555] [cursor=pointer]:
                    - img [ref=e556]
                  - button "Return to current week" [ref=e558] [cursor=pointer]: This Week
                  - button "Next week" [ref=e559] [cursor=pointer]:
                    - img [ref=e560]
                - generic [ref=e562]:
                  - button "Calendar view" [ref=e563] [cursor=pointer]:
                    - img [ref=e564]
                  - button "List view" [ref=e566] [cursor=pointer]:
                    - img [ref=e567]
              - generic [ref=e569]:
                - button "M 20" [ref=e570] [cursor=pointer]:
                  - generic [ref=e571]: M
                  - generic [ref=e573]: "20"
                - button "T 21" [ref=e574] [cursor=pointer]:
                  - generic [ref=e575]: T
                  - generic [ref=e577]: "21"
                - button "W 22" [ref=e578] [cursor=pointer]:
                  - generic [ref=e579]: W
                  - generic [ref=e581]: "22"
                - button "T 23" [ref=e582] [cursor=pointer]:
                  - generic [ref=e583]: T
                  - generic [ref=e585]: "23"
                - button "F 24" [ref=e586] [cursor=pointer]:
                  - generic [ref=e587]: F
                  - generic [ref=e589]: "24"
                - button "S 25" [ref=e590] [cursor=pointer]:
                  - generic [ref=e591]: S
                  - generic [ref=e593]: "25"
                - button "S 26 60h" [ref=e594] [cursor=pointer]:
                  - generic [ref=e595]: S
                  - generic [ref=e597]: "26"
                  - generic [ref=e598]: 60h
            - generic [ref=e599]:
              - paragraph [ref=e600]: ◇ Reflection
              - paragraph [ref=e601]: “What's the smallest detail you're drilling this week?”
              - button "Write an entry" [ref=e602] [cursor=pointer]
        - generic [ref=e603]:
          - generic [ref=e604]:
            - generic [ref=e605]: ◈ Recent intentions
            - button "See all →" [ref=e606] [cursor=pointer]
          - generic [ref=e608]:
            - generic [ref=e609]: Wk of Apr 26
            - generic [ref=e610]: Stand-up
        - generic [ref=e614]:
          - generic [ref=e615]:
            - generic: Apr 26, 2026
            - textbox [ref=e618] [cursor=pointer]: 2026-04-26
          - generic [ref=e619]:
            - heading "Log a Training Session" [level=2] [ref=e620]
            - generic [ref=e621]:
              - text: The Basics
              - generic [ref=e622]:
                - button "Gi" [ref=e623] [cursor=pointer]
                - button "No-Gi" [ref=e624] [cursor=pointer]
              - generic [ref=e625]:
                - button "Class" [ref=e626] [cursor=pointer]
                - button "Drilling" [ref=e627] [cursor=pointer]
                - button "Competition" [ref=e628] [cursor=pointer]
              - generic [ref=e629]:
                - generic [ref=e630]:
                  - button "30 m" [ref=e631] [cursor=pointer]
                  - button "1 h" [ref=e632] [cursor=pointer]
                  - button "1 h 30 m" [ref=e633] [cursor=pointer]
                  - button "2 h" [ref=e634] [cursor=pointer]
                - generic [ref=e635]:
                  - button "−" [ref=e636] [cursor=pointer]
                  - generic [ref=e637]: tap above
                  - button "+" [ref=e638] [cursor=pointer]
              - generic [ref=e639]:
                - button [ref=e640] [cursor=pointer]
                - button [ref=e641] [cursor=pointer]
                - button "Moderate" [ref=e642] [cursor=pointer]
                - button [ref=e643] [cursor=pointer]
                - button [ref=e644] [cursor=pointer]
            - generic [ref=e645]:
              - heading "What did you work on?" [level=3] [ref=e647]
              - generic [ref=e648]:
                - group "Focus areas for this session" [ref=e649]:
                  - switch "Stand-up" [checked] [ref=e650] [cursor=pointer]: Stand-up
                  - switch "Passing" [ref=e652] [cursor=pointer]
                  - switch "Pins" [ref=e653] [cursor=pointer]
                  - switch "Subs" [checked] [ref=e654] [cursor=pointer]: Subs
                  - switch "Guard, primary focus" [checked] [ref=e656] [cursor=pointer]: Guard
                - paragraph [ref=e658]:
                  - text: Tap to add. Double-tap to set your focus. Hold for deep work.
                  - button "got it" [ref=e659] [cursor=pointer]
              - generic [ref=e660]:
                - generic [ref=e661]:
                  - button "Defense" [ref=e662] [cursor=pointer]
                  - button "Neutral" [ref=e663] [cursor=pointer]
                  - button "Offense" [ref=e664] [cursor=pointer]
                - paragraph [ref=e665]: What side of the exchange were you primarily on?
              - generic [ref=e666]:
                - generic [ref=e667]:
                  - button "Coach-led" [ref=e668] [cursor=pointer]
                  - button "Open Mat" [ref=e669] [cursor=pointer]
                - paragraph [ref=e670]: Was this instructor-led or self-directed?
            - generic [ref=e671]:
              - text: Details
              - generic [ref=e672]:
                - generic [ref=e673]: Tags (optional, max 5)
                - textbox "Search positions or type to add…" [ref=e675]
              - generic [ref=e676]:
                - generic [ref=e677]: Notes (optional)
                - generic [ref=e678]:
                  - textbox "What stood out today?" [ref=e679]
                  - button "Record voice note" [ref=e680] [cursor=pointer]:
                    - img [ref=e681]
            - paragraph [ref=e684]: Please select a duration.
            - generic [ref=e685]:
              - button "Cancel" [ref=e686] [cursor=pointer]
              - button "Save Session" [active] [ref=e687] [cursor=pointer]
  - region "Notifications (F8)":
    - list
```

# Test source

```ts
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
  79  |     await c.click();
  80  |     await expect(c).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true');
  81  |     await settle(c.page());
  82  | }
  83  | 
  84  | async function setPrimary(c: Locator): Promise<void> {
  85  |     await c.dblclick();
  86  |     await expect(c).toHaveAttribute('aria-checked', 'true');
  87  |     await expect(c).toHaveAccessibleName(/primary focus/i);
  88  |     await settle(c.page());
  89  | }
  90  | 
  91  | async function setDeepWork(target: Locator, holdMs = 600): Promise<void> {
  92  |     const box = await target.boundingBox();
  93  |     if (!box) throw new Error('Cannot long-press a chip with no bounding box');
  94  |     const cx = box.x + box.width / 2;
  95  |     const cy = box.y + box.height / 2;
  96  |     const page = target.page();
  97  |     await page.mouse.move(cx, cy);
  98  |     await page.mouse.down();
  99  |     await page.waitForTimeout(holdMs);
  100 |     await page.mouse.up();
  101 |     await expect(target).toHaveAccessibleName(/deep work/i);
  102 |     await settle(page);
  103 | }
  104 | 
  105 | async function clickAndCapture(page: Page): Promise<Record<string, unknown>> {
  106 |     // The gesture helpers above already settle via two RAFs. Belt-and-suspenders:
  107 |     // settle once more here before submitting, since the form's submit closure
  108 |     // is on a separate React subtree from the chip palette.
  109 |     await settle(page);
> 110 |     const reqPromise = page.waitForRequest(
      |                             ^ TimeoutError: page.waitForRequest: Timeout 10000ms exceeded while waiting for event "request"
  111 |         r => SAVE_URL_RE.test(r.url()) && r.method() === 'POST',
  112 |         { timeout: 10_000 },
  113 |     );
  114 |     await page.getByRole('button', { name: /save session/i }).click();
  115 |     const req = await reqPromise;
  116 |     return req.postDataJSON() as Record<string, unknown>;
  117 | }
  118 | 
  119 | // --- Tests ------------------------------------------------------------------
  120 | 
  121 | test.describe('Flow 1 — log a session via chips', () => {
  122 |     test('1.1 single tap → distribution {standup:1}, telemetry false/false/1', async ({ page }) => {
  123 |         await openLogForm(page);
  124 |         await setMinDuration(page);
  125 |         await tap(chip(page, 'standup'));
  126 | 
  127 |         const body = await clickAndCapture(page);
  128 |         expect(body.heading).toBe('standup');
  129 |         expect(body.tags).toEqual(['standup']);
  130 |         expect(body.pillar_distribution).toEqual({ standup: 1 });
  131 |         expect(body.had_primary).toBe(false);
  132 |         expect(body.had_deep_work).toBe(false);
  133 |         expect(body.selection_count).toBe(1);
  134 |     });
  135 | 
  136 |     test('1.2 double-tap → primary, telemetry had_primary=true', async ({ page }) => {
  137 |         await openLogForm(page);
  138 |         await setMinDuration(page);
  139 |         await setPrimary(chip(page, 'guard'));
  140 | 
  141 |         const body = await clickAndCapture(page);
  142 |         expect(body.heading).toBe('guard');
  143 |         expect(body.tags).toEqual(['guard']);
  144 |         expect(body.pillar_distribution).toEqual({ guard: 1 });
  145 |         expect(body.had_primary).toBe(true);
  146 |         expect(body.had_deep_work).toBe(false);
  147 |         expect(body.selection_count).toBe(1);
  148 |     });
  149 | 
  150 |     test('1.3 three taps no primary → distribution split ~0.3333, telemetry false/false/3', async ({ page }) => {
  151 |         await openLogForm(page);
  152 |         await setMinDuration(page);
  153 |         await tap(chip(page, 'standup'));
  154 |         await tap(chip(page, 'submissions'));
  155 |         await tap(chip(page, 'guard'));
  156 | 
  157 |         const body = await clickAndCapture(page);
  158 |         expect(body.had_primary).toBe(false);
  159 |         expect(body.had_deep_work).toBe(false);
  160 |         expect(body.selection_count).toBe(3);
  161 |         const dist = body.pillar_distribution as Record<string, number>;
  162 |         expect(Object.keys(dist).sort()).toEqual(['guard', 'standup', 'submissions']);
  163 |         for (const w of Object.values(dist)) expect(w).toBeCloseTo(0.3333, 3);
  164 |         // Heading derives to first-tapped pillar in tie scenarios.
  165 |         expect(body.heading).toBe('standup');
  166 |     });
  167 | 
  168 |     test('1.4 two taps + double-tap a third → 0.6 / 0.2 / 0.2 with primary on the third', async ({ page }) => {
  169 |         await openLogForm(page);
  170 |         await setMinDuration(page);
  171 |         await tap(chip(page, 'standup'));
  172 |         await tap(chip(page, 'submissions'));
  173 |         await setPrimary(chip(page, 'guard'));
  174 | 
  175 |         const body = await clickAndCapture(page);
  176 |         expect(body.heading).toBe('guard');
  177 |         expect(body.had_primary).toBe(true);
  178 |         expect(body.selection_count).toBe(3);
  179 |         const dist = body.pillar_distribution as Record<string, number>;
  180 |         expect(dist.guard).toBeCloseTo(0.6, 2);
  181 |         expect(dist.standup).toBeCloseTo(0.2, 2);
  182 |         expect(dist.submissions).toBeCloseTo(0.2, 2);
  183 |     });
  184 | 
  185 |     test('1.5 primary transfer (double-tap A then B) → only B has primary', async ({ page }) => {
  186 |         await openLogForm(page);
  187 |         await setMinDuration(page);
  188 |         await setPrimary(chip(page, 'guard'));
  189 |         await setPrimary(chip(page, 'submissions'));
  190 |         // Guard should still be selected (not deselected) but no longer primary.
  191 |         await expect(chip(page, 'guard')).toHaveAttribute('aria-checked', 'true');
  192 |         const guardName = await chip(page, 'guard').getAttribute('aria-label');
  193 |         expect(guardName ?? '').not.toMatch(/primary focus/i);
  194 | 
  195 |         const body = await clickAndCapture(page);
  196 |         expect(body.heading).toBe('submissions');
  197 |         expect(body.had_primary).toBe(true);
  198 |         const dist = body.pillar_distribution as Record<string, number>;
  199 |         // Subs primary (3 raw points), Guard selected only (1) → 0.75 / 0.25.
  200 |         expect(dist.submissions).toBeCloseTo(0.75, 2);
  201 |         expect(dist.guard).toBeCloseTo(0.25, 2);
  202 |         expect(body.selection_count).toBe(2);
  203 |     });
  204 | 
  205 |     test('1.6 long-press → deep_work flag, telemetry had_deep_work=true', async ({ page }) => {
  206 |         await openLogForm(page);
  207 |         await setMinDuration(page);
  208 |         await setDeepWork(chip(page, 'guard'));
  209 | 
  210 |         const body = await clickAndCapture(page);
```