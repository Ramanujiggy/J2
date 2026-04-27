# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: chip-input.spec.ts >> Flow 1 — log a session via chips >> 1.1 single tap → distribution {standup:1}, telemetry false/false/1
- Location: playwright\tests\chip-input.spec.ts:122:5

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
            - generic [ref=e64]: 58h 30m
            - generic [ref=e65]: 117 sessions
          - generic [ref=e66]:
            - generic [ref=e67]: Alignment
            - generic [ref=e68]: 41%
            - generic [ref=e69]: 48 of 117 on focus
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
                - generic "Week 17 · 117 sessions · 58.5h" [ref=e103]
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
                - generic [ref=e256]: JAN
                - generic [ref=e257]: FEB
                - generic [ref=e258]: MAR
                - generic [ref=e259]: APR
                - generic [ref=e260]: MAY
                - generic [ref=e261]: JUN
                - generic [ref=e262]: JUL
                - generic [ref=e263]: AUG
                - generic [ref=e264]: SEP
                - generic [ref=e265]: OCT
                - generic [ref=e266]: NOV
                - generic [ref=e267]: DEC
                - generic [ref=e268]: "2026"
                - generic [ref=e269]: 117 SESSIONS
                - generic [ref=e270]: 59 HOURS
              - generic [ref=e271]:
                - generic [ref=e272]:
                  - generic [ref=e274]: Stand-up
                  - generic [ref=e275]: "48"
                - generic [ref=e276]:
                  - generic [ref=e278]: Guard Passing
                  - generic [ref=e279]: "0"
                - generic [ref=e280]:
                  - generic [ref=e282]: Dynamic Pins
                  - generic [ref=e283]: "0"
                - generic [ref=e284]:
                  - generic [ref=e286]: Submissions
                  - generic [ref=e287]: "0"
                - generic [ref=e288]:
                  - generic [ref=e290]: Guard
                  - generic [ref=e291]: "69"
            - generic [ref=e292] [cursor=pointer]:
              - generic [ref=e293]:
                - generic [ref=e294]: Training Rhythm
                - generic [ref=e295]: View calendar →
              - generic [ref=e297]:
                - generic [ref=e298]: Nov
                - generic [ref=e301]: Dec
                - generic [ref=e306]: Jan
                - generic [ref=e310]: Feb
                - generic [ref=e314]: Mar
                - generic [ref=e319]: Apr
            - generic [ref=e492]:
              - generic [ref=e494]: Training Telemetry
              - generic [ref=e496]:
                - generic [ref=e497]: 117 sessions
                - generic [ref=e498]: ·
                - generic [ref=e499]: 58h 30m total
              - paragraph [ref=e500]:
                - text: Splitting time between
                - strong [ref=e501]: Guard
                - text: and
                - strong [ref=e502]: Stand-up
                - text: .
          - generic [ref=e503]:
            - generic [ref=e505]:
              - generic [ref=e506]:
                - generic [ref=e507]: ◈
                - generic [ref=e508]: This week's focus
              - paragraph [ref=e509]: Stand-up
              - generic [ref=e511]: 5d remaining
              - generic [ref=e515]: 117 sessions
              - generic [ref=e516]:
                - button "Edit" [ref=e517] [cursor=pointer]
                - button "Journal" [ref=e518] [cursor=pointer]
                - button "Delete" [ref=e519] [cursor=pointer]
            - generic [ref=e520]:
              - generic [ref=e521]: ◈ Most recent session
              - generic [ref=e524]: Stand-up
              - generic [ref=e525]: 30m · Class · Gi
              - generic [ref=e526]: Sun, Apr 26
            - generic [ref=e527]:
              - generic [ref=e528]: ◈ Last 30 days · intensity
              - generic [ref=e529]:
                - generic [ref=e532]: "0"
                - generic [ref=e535]: "0"
                - generic [ref=e538]: "117"
                - generic [ref=e541]: "0"
                - generic [ref=e544]: "0"
              - generic [ref=e545]:
                - generic [ref=e546]: Drill
                - generic [ref=e547]: Steady
                - generic [ref=e548]: Hard roll
            - generic [ref=e549]:
              - generic [ref=e550]:
                - generic [ref=e551]:
                  - button "Previous week" [ref=e552] [cursor=pointer]:
                    - img [ref=e553]
                  - button "Return to current week" [ref=e555] [cursor=pointer]: This Week
                  - button "Next week" [ref=e556] [cursor=pointer]:
                    - img [ref=e557]
                - generic [ref=e559]:
                  - button "Calendar view" [ref=e560] [cursor=pointer]:
                    - img [ref=e561]
                  - button "List view" [ref=e563] [cursor=pointer]:
                    - img [ref=e564]
              - generic [ref=e566]:
                - button "M 20" [ref=e567] [cursor=pointer]:
                  - generic [ref=e568]: M
                  - generic [ref=e570]: "20"
                - button "T 21" [ref=e571] [cursor=pointer]:
                  - generic [ref=e572]: T
                  - generic [ref=e574]: "21"
                - button "W 22" [ref=e575] [cursor=pointer]:
                  - generic [ref=e576]: W
                  - generic [ref=e578]: "22"
                - button "T 23" [ref=e579] [cursor=pointer]:
                  - generic [ref=e580]: T
                  - generic [ref=e582]: "23"
                - button "F 24" [ref=e583] [cursor=pointer]:
                  - generic [ref=e584]: F
                  - generic [ref=e586]: "24"
                - button "S 25" [ref=e587] [cursor=pointer]:
                  - generic [ref=e588]: S
                  - generic [ref=e590]: "25"
                - button "S 26 58h 30m" [ref=e591] [cursor=pointer]:
                  - generic [ref=e592]: S
                  - generic [ref=e594]: "26"
                  - generic [ref=e595]: 58h 30m
            - generic [ref=e596]:
              - paragraph [ref=e597]: ◇ Reflection
              - paragraph [ref=e598]: “What's the smallest detail you're drilling this week?”
              - button "Write an entry" [ref=e599] [cursor=pointer]
        - generic [ref=e600]:
          - generic [ref=e601]:
            - generic [ref=e602]: ◈ Recent intentions
            - button "See all →" [ref=e603] [cursor=pointer]
          - generic [ref=e605]:
            - generic [ref=e606]: Wk of Apr 26
            - generic [ref=e607]: Stand-up
        - generic [ref=e611]:
          - generic [ref=e612]:
            - generic: Apr 26, 2026
            - textbox [ref=e615] [cursor=pointer]: 2026-04-26
          - generic [ref=e616]:
            - heading "Log a Training Session" [level=2] [ref=e617]
            - generic [ref=e618]:
              - text: The Basics
              - generic [ref=e619]:
                - button "Gi" [ref=e620] [cursor=pointer]
                - button "No-Gi" [ref=e621] [cursor=pointer]
              - generic [ref=e622]:
                - button "Class" [ref=e623] [cursor=pointer]
                - button "Drilling" [ref=e624] [cursor=pointer]
                - button "Competition" [ref=e625] [cursor=pointer]
              - generic [ref=e626]:
                - generic [ref=e627]:
                  - button "30 m" [ref=e628] [cursor=pointer]
                  - button "1 h" [ref=e629] [cursor=pointer]
                  - button "1 h 30 m" [ref=e630] [cursor=pointer]
                  - button "2 h" [ref=e631] [cursor=pointer]
                - generic [ref=e632]:
                  - button "−" [ref=e633] [cursor=pointer]
                  - generic [ref=e634]: tap above
                  - button "+" [ref=e635] [cursor=pointer]
              - generic [ref=e636]:
                - button [ref=e637] [cursor=pointer]
                - button [ref=e638] [cursor=pointer]
                - button "Moderate" [ref=e639] [cursor=pointer]
                - button [ref=e640] [cursor=pointer]
                - button [ref=e641] [cursor=pointer]
            - generic [ref=e642]:
              - heading "What did you work on?" [level=3] [ref=e644]
              - generic [ref=e645]:
                - group "Focus areas for this session" [ref=e646]:
                  - switch "Stand-up" [checked] [ref=e647] [cursor=pointer]: Stand-up
                  - switch "Passing" [ref=e649] [cursor=pointer]
                  - switch "Pins" [ref=e650] [cursor=pointer]
                  - switch "Subs" [ref=e651] [cursor=pointer]
                  - switch "Guard" [ref=e652] [cursor=pointer]
                - paragraph [ref=e653]:
                  - text: Tap to add. Double-tap to set your focus. Hold for deep work.
                  - button "got it" [ref=e654] [cursor=pointer]
              - generic [ref=e655]:
                - generic [ref=e656]:
                  - button "Coach-led" [ref=e657] [cursor=pointer]
                  - button "Open Mat" [ref=e658] [cursor=pointer]
                - paragraph [ref=e659]: Was this instructor-led or self-directed?
            - generic [ref=e660]:
              - text: Details
              - generic [ref=e661]:
                - generic [ref=e662]: Tags (optional, max 5)
                - textbox "Search positions or type to add…" [ref=e664]
              - generic [ref=e665]:
                - generic [ref=e666]: Notes (optional)
                - generic [ref=e667]:
                  - textbox "What stood out today?" [ref=e668]
                  - button "Record voice note" [ref=e669] [cursor=pointer]:
                    - img [ref=e670]
            - paragraph [ref=e673]: Please select a duration.
            - generic [ref=e674]:
              - button "Cancel" [ref=e675] [cursor=pointer]
              - button "Save Session" [active] [ref=e676] [cursor=pointer]
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