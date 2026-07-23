-- 018: Seed canonical_constraints from the CLA-BJJ research report
-- (Docs/research-input deep-research-report_CLABJJ).
--
-- Each row is a *variant* (a specific game), not a family — families group
-- variants via `details.family`. ~40 entries spanning all 24 published
-- families across both player perspectives.
--
-- BJJ role taxonomy (`details.your_role`) honors the "playing guard" vs
-- "under bottom" distinction:
--   guard_player    — on your back with legs between you and them (offense from below)
--   pin_escaper     — they're past your legs (recovery work from a dominant pin)
--   top_passer      — defeating their guard
--   pin_holder      — top in side / mount / NS, consolidating or attacking from there
--   back_attacker   — chest-to-back from the offensive side
--   back_escaper    — escaping back control
--   turtle_attacker — attacking turtle from the front-headlock or behind side
--   turtle_defender — defending turtle (escape, stand, reverse, pull guard)
--   standing        — neutral feet-to-feet
--
-- Idempotent: ON CONFLICT (name) DO UPDATE refreshes the metadata in place,
-- so editing this file and re-running the migration upserts cleanly.

INSERT INTO canonical_constraints (name, parent_pillar, aliases, description, details) VALUES

-- ─────────────────────────────────────────────────────────────────────────
-- NUMBER ONE — Offensive / dominant-side games
-- ─────────────────────────────────────────────────────────────────────────

('Stand vs Seated: Pass', 'passing',
 ARRAY['force supine', 'flatten the seated guard', 'stand vs sit pass'],
 'Top stands and works to connect, then flatten a seated/open-guard player to their back.',
 $${
   "family": "Standing vs Seated Force-Supine",
   "full_label": "Standing vs Seated: top forces the bottom flat to their back",
   "your_role": "top_passer",
   "start_position": "Top standing, bottom seated/open guard",
   "continuous_goals": {
     "top": "Connect to the body, work toward flattening posture",
     "bottom": "Preserve seated structure with posts and frames"
   },
   "terminal_goals": {
     "top": "Bottom flat on their back",
     "bottom": "Maintain seated/open guard for the round"
   },
   "reset_condition": "Top flattens bottom OR round time expires",
   "difficulty": "low",
   "recommended_level": "white+",
   "duration_minutes": 2,
   "cues": ["Connect first, grips second.", "Stay tall enough to move, low enough to connect."],
   "metrics": ["Forced-supine reps", "Time-to-flatten", "Seated retentions"],
   "common_errors": ["Overreaching for grips before body connection."],
   "safety_notes": "Avoid diving onto posted arms or knees.",
   "progression": "Stand-vs-seated with grip allowance; eventually full open-guard pass.",
   "regression": "Bottom limited to posts/frames only.",
   "source": "JPJJ public lesson plans",
   "roulette_eligible": true
 }$$::jsonb),

('Stand-only Pass', 'passing',
 ARRAY['no knees pass', 'standing pass discipline'],
 'Top must pass and pin a seated/open-guard player without ever placing knees on the mat.',
 $${
   "family": "No-knees Pass-to-Pin",
   "full_label": "Standing pass: top cannot put knees on the mat",
   "your_role": "top_passer",
   "start_position": "Top standing, bottom seated or open guard",
   "continuous_goals": {
     "top": "Maintain stand-up posture while progressing toward the pass",
     "bottom": "Retain or counter-offense without committing to a sweep that requires top to plant knees"
   },
   "terminal_goals": {
     "top": "Pass and consolidate a pin",
     "bottom": "Maintain guard or sweep"
   },
   "reset_condition": "Pass + 3-second pin OR sweep OR knee touches the mat (top loses)",
   "difficulty": "medium",
   "recommended_level": "white+",
   "duration_minutes": 2,
   "cues": ["Stay tall enough to move, low enough to connect.", "Pressure through the hip, not through the knee."],
   "metrics": ["Successful passes", "Knee-touches (top errors)", "Pin time"],
   "common_errors": ["Bending at the waist; parking weight over posted hands."],
   "safety_notes": "Avoid weight crashing onto twisted knees during dynamic redirections.",
   "progression": "Add gripping offense from bottom.",
   "regression": "Bottom limited to a narrower guard form.",
   "source": "JPJJ public lesson plans",
   "roulette_eligible": true
 }$$::jsonb),

('X-Guard: Same-Side Pass', 'passing',
 ARRAY['x-guard pass', 'feet to one side'],
 'Top wins by getting both legs to the same side of the body; bottom wins by putting top hips on the mat.',
 $${
   "family": "X-Guard Same-Side Pass",
   "full_label": "X-Guard: top legs same side, bottom hips-on-mat",
   "your_role": "top_passer",
   "start_position": "Established x-guard",
   "continuous_goals": {
     "top": "Control the feet",
     "bottom": "Force top hand-posts on the mat"
   },
   "terminal_goals": {
     "top": "Both legs to the same side of bottom''s body",
     "bottom": "Top hips on the mat"
   },
   "reset_condition": "Either terminal goal achieved",
   "difficulty": "medium",
   "recommended_level": "blue+",
   "duration_minutes": 2,
   "cues": ["Watch the feet, not the torso.", "Provoke the post before chasing the sweep."],
   "metrics": ["Same-side leg passes", "Hip-to-mat finishes from bottom", "Hand-posts forced"],
   "common_errors": ["Top staring at the torso instead of the feet."],
   "safety_notes": "Keep rotational pressure controlled at the knee line.",
   "progression": "More dynamic entry into x-guard.",
   "regression": "Pre-established x-guard with stable grips.",
   "source": "Public BJJ CLA coaching essays",
   "roulette_eligible": true
 }$$::jsonb),

('Half Guard: Free Trapped Leg', 'passing',
 ARRAY['half guard pass', 'double unders pass'],
 'Top has double underhooks already; wins by freeing the trapped leg.',
 $${
   "family": "Half-Guard Chest-to-Chest Pass",
   "full_label": "Half guard: top has double underhooks, frees the trapped leg",
   "your_role": "top_passer",
   "start_position": "Top in half guard with double underhooks established",
   "continuous_goals": {
     "top": "Maintain underhook depth and chest connection",
     "bottom": "Strip an underhook OR insert a knee-shield/inside hook"
   },
   "terminal_goals": {
     "top": "Free the trapped leg into side control",
     "bottom": "Knee shield OR inside hook recovered"
   },
   "reset_condition": "Pass complete OR bottom recovers shield",
   "difficulty": "medium",
   "recommended_level": "white+",
   "duration_minutes": 3,
   "cues": ["Flatten first, free the leg second.", "Don''t trade the underhook to grab the leg."],
   "metrics": ["Pass completions", "Knee-shield recoveries", "Round time"],
   "common_errors": ["Trying to free the leg before winning upper-body control."],
   "safety_notes": "Protect bottom''s neck under cross-face; moderate knee torque.",
   "progression": "Top with one underhook only.",
   "regression": "Pure underhook maintenance, no leg extraction yet.",
   "source": "JPJJ public lesson plans",
   "roulette_eligible": true
 }$$::jsonb),

('Half Guard: Build to Double Unders', 'passing',
 ARRAY['half guard pass progression', 'one underhook'],
 'Top has one underhook; wins by upgrading to double underhooks. Bottom wins with knee shield or inside hook.',
 $${
   "family": "Half-Guard Chest-to-Chest Pass",
   "full_label": "Half guard: top has one underhook, builds to double underhooks",
   "your_role": "top_passer",
   "start_position": "Top in half guard with single underhook",
   "continuous_goals": {
     "top": "Upgrade to double underhooks while maintaining chest pressure",
     "bottom": "Strip the underhook or recover a frame"
   },
   "terminal_goals": {
     "top": "Both underhooks established",
     "bottom": "Knee shield OR inside hook"
   },
   "reset_condition": "Either terminal goal",
   "difficulty": "medium",
   "recommended_level": "white+",
   "duration_minutes": 3,
   "cues": ["Underhooks before leg freedom.", "Cross-face seals the path to the second underhook."],
   "metrics": ["Double-underhook builds", "Knee shield recoveries"],
   "common_errors": ["Reaching for the leg while only one underhook is in."],
   "safety_notes": "Avoid wrenching trapped knees.",
   "progression": "Free the trapped leg.",
   "regression": "Top with hip access only.",
   "source": "JPJJ public lesson plans",
   "roulette_eligible": true
 }$$::jsonb),

('Half Guard: Flatten & Free', 'passing',
 ARRAY['half guard hip access', 'flatten then pass'],
 'Top has hip access; bottom is on side. Top flattens, gets chest-to-chest + underhook, then frees the leg.',
 $${
   "family": "Half-Guard Chest-to-Chest Pass",
   "full_label": "Half guard: top has hip access, flattens then frees",
   "your_role": "top_passer",
   "start_position": "Top in half guard, bottom on their side",
   "continuous_goals": {
     "top": "Flatten bottom and establish chest-to-chest with at least one underhook",
     "bottom": "Re-create a knee shield or inside-hook frame"
   },
   "terminal_goals": {
     "top": "Bottom flat + chest-to-chest + underhook + leg freed",
     "bottom": "Recover any usable frame"
   },
   "reset_condition": "Pass complete OR bottom resets to side",
   "difficulty": "medium",
   "recommended_level": "blue+",
   "duration_minutes": 3,
   "cues": ["Three problems in order: flatten, connect, free.", "Skipping a step gives the frame back."],
   "metrics": ["Pass completions", "Frames recovered"],
   "common_errors": ["Treating it as one motion."],
   "safety_notes": "Watch lower-back hyperextension on flatten.",
   "progression": "Same start, smaller gap between stages.",
   "regression": "Top already flat + connected.",
   "source": "JPJJ public lesson plans",
   "roulette_eligible": true
 }$$::jsonb),

('Side Control: Isolate', 'pins',
 ARRAY['side control attack prep', 'isolate to attack'],
 'Top in side control wins by isolating a limb to attack: figure-four, mount-with-arm, or back exposure.',
 $${
   "family": "Side-Control Attack-Prep",
   "full_label": "Side control: top wins by limb isolation toward an attack",
   "your_role": "pin_holder",
   "start_position": "Chest-to-chest side control",
   "continuous_goals": {
     "top": "Pin center mass while isolating the periphery",
     "bottom": "Insert feet/knees between bodies or reverse"
   },
   "terminal_goals": {
     "top": "Figure-four grip OR mount with arm extended OR back with seatbelt",
     "bottom": "Knee/foot insertion OR reversal"
   },
   "reset_condition": "Either terminal goal",
   "difficulty": "medium",
   "recommended_level": "blue+",
   "duration_minutes": 3,
   "cues": ["Pin center, isolate periphery.", "Don''t trade chest connection for a limb."],
   "metrics": ["Figure-four entries", "Mount + arm captures", "Back exposures"],
   "common_errors": ["Losing chest connection while reaching for limbs."],
   "safety_notes": "Don''t wrench the shoulder when hunting the figure four.",
   "progression": "Allow the finish after isolation.",
   "regression": "Pure side-control maintenance, no attacks.",
   "source": "JPJJ public lesson plans",
   "roulette_eligible": true
 }$$::jsonb),

('Pin: Transition Around', 'pins',
 ARRAY['side to north south', 'pin movement'],
 'Top moves from side to north-south or to opposite-side control with a 3-second stabilization. Bottom wins on insertion or reversal.',
 $${
   "family": "Chest-to-Chest Transition",
   "full_label": "Pin transitions: side ↔ north-south ↔ opposite side, with 3s stabilization",
   "your_role": "pin_holder",
   "start_position": "Chest-to-chest side control",
   "continuous_goals": {
     "top": "Move around the torso without abandoning the torso",
     "bottom": "Break the chest connection during transitions"
   },
   "terminal_goals": {
     "top": "3-second stabilization in the new pin",
     "bottom": "Insert feet/knees OR reverse during a transition"
   },
   "reset_condition": "Stabilization timer hits 3s OR bottom recovers",
   "difficulty": "medium",
   "recommended_level": "white+",
   "duration_minutes": 3,
   "cues": ["Move around the torso without ever abandoning the torso."],
   "metrics": ["Stabilization completions", "Escapes during transit"],
   "common_errors": ["Hopping around the body and losing chest contact."],
   "safety_notes": "Slow down around the cervical line in north-south entries.",
   "progression": "Allow attack-prep after the new stabilization.",
   "regression": "Static pin-maintenance only.",
   "source": "JPJJ public lesson plans",
   "roulette_eligible": true
 }$$::jsonb),

('Front Headlock: Stabilize', 'submissions',
 ARRAY['front headlock no subs', 'cover and control'],
 'Top covers chin + elbow on a turtled partner. Submissions banned. Top wins by keeping bottom''s hands on the mat and the head covered.',
 $${
   "family": "Front Headlock Stabilization",
   "full_label": "Front headlock: cover head, hands on mat, no submissions",
   "your_role": "turtle_attacker",
   "start_position": "Front headlock on a turtled partner; one hand on chin, one on elbow",
   "continuous_goals": {
     "top": "Keep bottom''s hands on the mat and the head covered",
     "bottom": "Free the head"
   },
   "terminal_goals": {
     "top": "Bottom''s hands stay on the mat for the round",
     "bottom": "Head freed"
   },
   "reset_condition": "Head freed OR round time",
   "difficulty": "medium",
   "recommended_level": "white+",
   "duration_minutes": 3,
   "cues": ["Cover the head, own the mat with their hands.", "No submissions yet — control first."],
   "metrics": ["Hand-on-mat time", "Head escapes per round"],
   "common_errors": ["Reaching for chokes before head control is real."],
   "safety_notes": "Avoid abrupt cervical snaps.",
   "progression": "Capture-to-back or strangle finish.",
   "regression": "Static start with longer rest.",
   "source": "JPJJ public lesson plans",
   "roulette_eligible": true
 }$$::jsonb),

('Front Headlock: Capture', 'submissions',
 ARRAY['head and arm', 'destabilize back'],
 'Top locks head + arm together and destabilizes defender to their back. Submissions still banned.',
 $${
   "family": "Head-and-Arm Capture",
   "full_label": "Front headlock: lock head + arm, destabilize to back, no finish",
   "your_role": "turtle_attacker",
   "start_position": "Front headlock; chin + elbow connected",
   "continuous_goals": {
     "top": "Bind head and arm together",
     "bottom": "Free the head or arm"
   },
   "terminal_goals": {
     "top": "Bottom destabilized to their back with head + arm still bound",
     "bottom": "Free either head or arm"
   },
   "reset_condition": "Either terminal goal",
   "difficulty": "medium",
   "recommended_level": "blue+",
   "duration_minutes": 3,
   "cues": ["Head covered, arm connected, then compress."],
   "metrics": ["Back-destabilizations", "Head/arm frees"],
   "common_errors": ["Compressing before connection."],
   "safety_notes": "Conservative squeeze; ban head-cranks.",
   "progression": "Add the finish (figure-four strangle).",
   "regression": "Front-headlock stabilization only.",
   "source": "JPJJ public lesson plans",
   "roulette_eligible": true
 }$$::jsonb),

('Front Headlock: Strangle', 'submissions',
 ARRAY['arm-in choke', 'head and arm finish'],
 'Same head-and-arm capture, but now the figure-four strangle finish is allowed.',
 $${
   "family": "Head-and-Arm Capture",
   "full_label": "Front headlock: head + arm capture WITH the strangle finish",
   "your_role": "turtle_attacker",
   "start_position": "Front headlock; chin + elbow connected",
   "continuous_goals": {
     "top": "Bind head and arm; flow into figure-four",
     "bottom": "Free or recover posture"
   },
   "terminal_goals": {
     "top": "Strangle finish (tap)",
     "bottom": "Escape OR recover posture"
   },
   "reset_condition": "Tap OR escape",
   "difficulty": "high",
   "recommended_level": "blue+",
   "duration_minutes": 3,
   "cues": ["Connection before pressure."],
   "metrics": ["Strangle finishes", "Escapes conceded"],
   "common_errors": ["Squeeze without configuration."],
   "safety_notes": "Immediate tap respect; conservative pressure.",
   "progression": "Live front-headlock open round.",
   "regression": "Capture without finish.",
   "source": "JPJJ public lesson plans",
   "roulette_eligible": true
 }$$::jsonb),

('Back: No-Hands Maintenance', 'submissions',
 ARRAY['back control no grips', 'chest to back only'],
 'Top maintains chest-to-back with NO connected hands. Bottom wins by turning to face.',
 $${
   "family": "Chest-to-Back Maintenance",
   "full_label": "Back: maintain chest-to-back without locking hands",
   "your_role": "back_attacker",
   "start_position": "Behind a turtled or kneeling defender",
   "continuous_goals": {
     "top": "Sternum follows the defender''s spine",
     "bottom": "Turn and face"
   },
   "terminal_goals": {
     "top": "Maintain chest-to-back for the round",
     "bottom": "Turn and face"
   },
   "reset_condition": "Defender faces OR round time",
   "difficulty": "medium",
   "recommended_level": "white+",
   "duration_minutes": 3,
   "cues": ["Your sternum follows their spine.", "No hands — earn it with shoulder and hip."],
   "metrics": ["Chest-to-back time", "Faces prevented"],
   "common_errors": ["Hanging on the waist while losing upper-body connection."],
   "safety_notes": "Avoid face-cranks and rotational dumping in turtle.",
   "progression": "Add hand connection.",
   "regression": "Static turtle start, no movement.",
   "source": "JPJJ public lesson plans",
   "roulette_eligible": true
 }$$::jsonb),

('Back: Locked-Hands Control', 'submissions',
 ARRAY['back control no hooks', 'shoulder hip control'],
 'Top locks hands at the waist; no hooks, no submissions. Wins by controlling shoulders + hips simultaneously.',
 $${
   "family": "Chest-to-Back Maintenance",
   "full_label": "Back: locked hands at waist, no hooks, control shoulders and hips",
   "your_role": "back_attacker",
   "start_position": "Behind a turtled defender; locked hands at waist",
   "continuous_goals": {
     "top": "Shoulders AND hips controlled at the same time",
     "bottom": "Turn and face"
   },
   "terminal_goals": {
     "top": "Hold simultaneous shoulder + hip control for the round",
     "bottom": "Break the simultaneous control"
   },
   "reset_condition": "Defender faces OR control breaks for >3s OR round time",
   "difficulty": "medium",
   "recommended_level": "white+",
   "duration_minutes": 3,
   "cues": ["Shoulders and hips together or nothing.", "Don''t race for hooks before connection is real."],
   "metrics": ["Simultaneous-control duration", "Defender faces"],
   "common_errors": ["Locking hands while letting the upper body float."],
   "safety_notes": "Watch rib pressure under tight body lock.",
   "progression": "Score-the-hook game.",
   "regression": "No-hands maintenance.",
   "source": "JPJJ public lesson plans",
   "roulette_eligible": true
 }$$::jsonb),

('Back: Score the Hook', 'submissions',
 ARRAY['first hook back take'],
 'Top wins by inserting a hook AND getting chest connection close enough that the defender can''t simply face.',
 $${
   "family": "Scoring-Hook & Single-Hook Back",
   "full_label": "Back: score one hook with chest connection",
   "your_role": "back_attacker",
   "start_position": "Behind defender, partial back exposure",
   "continuous_goals": {
     "top": "Earn the first hook in a position that anchors",
     "bottom": "Deny hook entry by hip line management"
   },
   "terminal_goals": {
     "top": "Hook inserted + chest connection close enough that face-turn is denied",
     "bottom": "Face the attacker"
   },
   "reset_condition": "Either terminal goal",
   "difficulty": "medium",
   "recommended_level": "blue+",
   "duration_minutes": 3,
   "cues": ["Hook late enough to matter, early enough to anchor."],
   "metrics": ["Anchored hooks", "Faces"],
   "common_errors": ["Punching a hook in before connection is established."],
   "safety_notes": "Watch ribs and twisted torso under shallow hooks.",
   "progression": "Single-hook submission hunt.",
   "regression": "Locked-hands control.",
   "source": "Public CLA coaching notes (Frank Chen)",
   "roulette_eligible": true
 }$$::jsonb),

('Back: Single-Hook Sub Hunt', 'submissions',
 ARRAY['one hook submission', 'no second hook'],
 'Top has one hook + seatbelt, hunts a submission. The second hook is forbidden — earn the tap from a single hook.',
 $${
   "family": "Scoring-Hook & Single-Hook Back",
   "full_label": "Back: hunt submission from one hook + seatbelt; no second hook",
   "your_role": "back_attacker",
   "start_position": "Behind defender, single hook around torso, seatbelt grip",
   "continuous_goals": {
     "top": "Hunt the submission with the upper-body threat as the primary lever",
     "bottom": "Escape OR force the second hook into existence"
   },
   "terminal_goals": {
     "top": "Submission tap from single-hook control",
     "bottom": "Face / hide back / stand up"
   },
   "reset_condition": "Tap OR escape",
   "difficulty": "high",
   "recommended_level": "blue+",
   "duration_minutes": 3,
   "cues": ["One hook, one upper-body threat — keep them coupled."],
   "metrics": ["Submissions from single hook", "Escapes"],
   "common_errors": ["Chasing the second hook before upper-body control exists."],
   "safety_notes": "Strict tap respect; keep neck pressure progressive.",
   "progression": "Full back finishing cluster.",
   "regression": "Score-the-hook game.",
   "source": "JPJJ + Frank Chen public notes",
   "roulette_eligible": true
 }$$::jsonb),

('Back: Retain (No Sub)', 'submissions',
 ARRAY['back control retention', 'no submissions back'],
 'Top has full back: seatbelt + both feet covering hips. Submissions banned. Wins by retaining the round.',
 $${
   "family": "Full-Back Finishing",
   "full_label": "Back: full retention with seatbelt + both feet over hips, no submissions",
   "your_role": "back_attacker",
   "start_position": "Full back control: seatbelt + both feet covering the hips",
   "continuous_goals": {
     "top": "Anchor the back through control adjustments",
     "bottom": "Hide the back / turn / stand"
   },
   "terminal_goals": {
     "top": "Hold full back for the round",
     "bottom": "Escape"
   },
   "reset_condition": "Escape OR round time",
   "difficulty": "high",
   "recommended_level": "blue+",
   "duration_minutes": 3,
   "cues": ["Control decisions before tap chasing."],
   "metrics": ["Retention time", "Escapes"],
   "common_errors": ["Opening the shell to chase the choke."],
   "safety_notes": "Body-triangle pressure: progressive only.",
   "progression": "Sub-transition variant.",
   "regression": "Single-hook hunt.",
   "source": "JPJJ public lesson plans",
   "roulette_eligible": true
 }$$::jsonb),

('Back: Sub Transition', 'submissions',
 ARRAY['choke transition', 'submission flow back'],
 'Start in an RNC configuration; the round is won by transitioning to a DIFFERENT submission. The starting choke cannot be the finish.',
 $${
   "family": "Full-Back Finishing",
   "full_label": "Back: transition from RNC to a different submission",
   "your_role": "back_attacker",
   "start_position": "RNC configuration on the back",
   "continuous_goals": {
     "top": "Stay attached while reading the next opening",
     "bottom": "Defend the choke and create exits"
   },
   "terminal_goals": {
     "top": "Tap with a NON-RNC submission",
     "bottom": "Escape"
   },
   "reset_condition": "Tap OR escape",
   "difficulty": "high",
   "recommended_level": "purple+",
   "duration_minutes": 3,
   "cues": ["Threats are levers — keep them unconsumed until they''re needed."],
   "metrics": ["Alternate-submission taps", "Escapes"],
   "common_errors": ["Squeezing the RNC instead of using it as a setup."],
   "safety_notes": "Tap respect; avoid stacking pressure.",
   "progression": "Open back round.",
   "regression": "Retention-only round.",
   "source": "JPJJ public lesson plans",
   "roulette_eligible": true
 }$$::jsonb),

('Triangle: Force Hand Post', 'submissions',
 ARRAY['triangle setup', 'provoke post'],
 'Bottom in guard wins by forcing top to post a hand on the mat.',
 $${
   "family": "Triangle Attack",
   "full_label": "Triangle setup #1: bottom forces a top hand-post",
   "your_role": "guard_player",
   "start_position": "Closed or open guard",
   "continuous_goals": {
     "top": "Avoid posting hands by managing posture and angle",
     "bottom": "Provoke the post via off-balance"
   },
   "terminal_goals": {
     "top": "Maintain hand-position for the round",
     "bottom": "Force a hand to the mat"
   },
   "reset_condition": "Post OR round time",
   "difficulty": "medium",
   "recommended_level": "white+",
   "duration_minutes": 2,
   "cues": ["The post is the door. Open it before walking through."],
   "metrics": ["Posts forced"],
   "common_errors": ["Reaching for the leg before the post exists."],
   "safety_notes": "—",
   "progression": "Capture an underhook on each post.",
   "regression": "—",
   "source": "Public CLA triangle progression",
   "roulette_eligible": true
 }$$::jsonb),

('Triangle: Capture Underhook', 'submissions',
 ARRAY['triangle hook setup'],
 'Each time top posts, bottom secures an underhook or overhook on that arm.',
 $${
   "family": "Triangle Attack",
   "full_label": "Triangle setup #2: bottom captures underhook on every post",
   "your_role": "guard_player",
   "start_position": "Closed or open guard",
   "continuous_goals": {
     "top": "Limit post-and-recover cycles",
     "bottom": "Convert every post into a hook"
   },
   "terminal_goals": {
     "top": "Reset posture without giving a hook",
     "bottom": "Secure the hook on the posted arm"
   },
   "reset_condition": "Hook secured OR posture reset",
   "difficulty": "medium",
   "recommended_level": "white+",
   "duration_minutes": 2,
   "cues": ["Capture closes options. Posture re-opens them."],
   "metrics": ["Hook captures per post"],
   "common_errors": ["Letting the post recover before capture."],
   "safety_notes": "—",
   "progression": "Force arm-in/out.",
   "regression": "Force the post only.",
   "source": "Public CLA triangle progression",
   "roulette_eligible": true
 }$$::jsonb),

('Triangle: Arm-In/Out', 'submissions',
 ARRAY['arm in arm out', 'isolate for triangle'],
 'Bottom starts with under/overhook; wins by isolating one arm + the head into the arm-in/arm-out configuration.',
 $${
   "family": "Triangle Attack",
   "full_label": "Triangle setup #3: isolate arm and head into arm-in/arm-out",
   "your_role": "guard_player",
   "start_position": "Closed/open guard with under or overhook secured",
   "continuous_goals": {
     "top": "Defend by collecting the second arm and resetting",
     "bottom": "Isolate one arm with the head"
   },
   "terminal_goals": {
     "top": "Recover both arms",
     "bottom": "Achieve arm-in/arm-out"
   },
   "reset_condition": "Arm-in/out reached OR top recovers",
   "difficulty": "medium",
   "recommended_level": "blue+",
   "duration_minutes": 2,
   "cues": ["Pull the elbow across, not the wrist down."],
   "metrics": ["Arm-in/out entries"],
   "common_errors": ["Trying to lock before isolating."],
   "safety_notes": "—",
   "progression": "Lock the triangle without finishing.",
   "regression": "Capture underhook only.",
   "source": "Public CLA triangle progression",
   "roulette_eligible": true
 }$$::jsonb),

('Triangle: Fully Locked', 'submissions',
 ARRAY['locked triangle finish', 'finish only'],
 'Both players start in a fully locked triangle. The round is only finishing mechanics.',
 $${
   "family": "Triangle Attack",
   "full_label": "Triangle finish #1: start fully locked, work the finish",
   "your_role": "guard_player",
   "start_position": "Fully locked triangle",
   "continuous_goals": {
     "top": "Posture, stack, frame, and survive",
     "bottom": "Cut the angle and finish"
   },
   "terminal_goals": {
     "top": "Escape and posture",
     "bottom": "Tap"
   },
   "reset_condition": "Tap OR escape",
   "difficulty": "medium",
   "recommended_level": "white+",
   "duration_minutes": 2,
   "cues": ["Cut the angle, pull the head, squeeze the knees."],
   "metrics": ["Finishes", "Escapes"],
   "common_errors": ["Squeezing without angle."],
   "safety_notes": "Conservative squeeze pressure; immediate taps.",
   "progression": "Lock without finish.",
   "regression": "Finish from a deeper lock with no defense.",
   "source": "Public CLA triangle progression",
   "roulette_eligible": true
 }$$::jsonb),

('Triangle: Lock Without Finish', 'submissions',
 ARRAY['posture break to lock', 'lock no finish'],
 'Start in arm-in/arm-out. Win by breaking posture and locking the triangle. Finishing is forbidden.',
 $${
   "family": "Triangle Attack",
   "full_label": "Triangle finish #2: from arm-in/out, break posture and lock — no finish",
   "your_role": "guard_player",
   "start_position": "Arm-in/arm-out",
   "continuous_goals": {
     "top": "Maintain posture",
     "bottom": "Break posture and lock"
   },
   "terminal_goals": {
     "top": "Escape arm-in/out",
     "bottom": "Locked triangle"
   },
   "reset_condition": "Lock OR escape",
   "difficulty": "medium",
   "recommended_level": "blue+",
   "duration_minutes": 2,
   "cues": ["Break the posture before reaching for the lock."],
   "metrics": ["Locks", "Posture recoveries"],
   "common_errors": ["Reaching for the lock with intact posture."],
   "safety_notes": "—",
   "progression": "Add the finish.",
   "regression": "Arm-in/out setup only.",
   "source": "Public CLA triangle progression",
   "roulette_eligible": true
 }$$::jsonb),

('Triangle: Overhook Setup', 'submissions',
 ARRAY['overhook + biceps', 'triangle from overhook'],
 'Bottom starts with overhook + biceps post. Wins by isolating the arm/head line.',
 $${
   "family": "Triangle Attack",
   "full_label": "Triangle setup #6: from overhook + biceps post",
   "your_role": "guard_player",
   "start_position": "Closed/open guard with overhook + biceps post on far arm",
   "continuous_goals": {
     "top": "Strip either grip",
     "bottom": "Convert the configuration into arm-in/out"
   },
   "terminal_goals": {
     "top": "Strip the configuration",
     "bottom": "Arm-in/out reached"
   },
   "reset_condition": "Either",
   "difficulty": "medium",
   "recommended_level": "blue+",
   "duration_minutes": 2,
   "cues": ["The biceps post commits one arm; the overhook commits the other."],
   "metrics": ["Conversions to arm-in/out"],
   "common_errors": ["Letting the biceps post drift."],
   "safety_notes": "—",
   "progression": "Lock without finish.",
   "regression": "Static overhook hold.",
   "source": "Public CLA triangle progression",
   "roulette_eligible": true
 }$$::jsonb),

-- ─────────────────────────────────────────────────────────────────────────
-- NUMBER THREE — Defensive / recovery games
-- ─────────────────────────────────────────────────────────────────────────

('Seated Guard: Posts Only', 'guard',
 ARRAY['posts and frames retention', 'seated guard defense'],
 'Bottom uses ONLY posts and frames to keep seated structure against a standing passer.',
 $${
   "family": "Standing vs Seated Force-Supine",
   "full_label": "Seated/open guard retention with posts and frames only",
   "your_role": "guard_player",
   "start_position": "Bottom seated/open guard, top standing",
   "continuous_goals": {
     "top": "Connect and force flatten",
     "bottom": "Preserve seated/open structure"
   },
   "terminal_goals": {
     "top": "Bottom flat",
     "bottom": "Maintain seated for the round"
   },
   "reset_condition": "Flatten OR round",
   "difficulty": "low",
   "recommended_level": "white+",
   "duration_minutes": 2,
   "cues": ["Don''t concede your back to the mat without a fight.", "Posts create time."],
   "metrics": ["Time seated", "Forced-flatten count", "Resets"],
   "common_errors": ["Posting too far behind and self-flattening."],
   "safety_notes": "Watch wrist/shoulder loading on extended posts.",
   "progression": "Add grips and hooks.",
   "regression": "Bottom can also score by sitting up and grabbing leg.",
   "source": "JPJJ public lesson plans",
   "roulette_eligible": true
 }$$::jsonb),

('Seated Guard: Active Retain', 'guard',
 ARRAY['retention with grips', 'open guard retention'],
 'Bottom now allowed grips, hooks, and off-balancing to retain seated/open guard.',
 $${
   "family": "Standing vs Seated Force-Supine",
   "full_label": "Seated/open guard retention with grips and hooks",
   "your_role": "guard_player",
   "start_position": "Bottom seated or open guard",
   "continuous_goals": {
     "top": "Pin or pass",
     "bottom": "Connect, off-balance, retain"
   },
   "terminal_goals": {
     "top": "Pass / pin",
     "bottom": "Maintain or sweep"
   },
   "reset_condition": "Pass OR sweep OR round time",
   "difficulty": "medium",
   "recommended_level": "white+",
   "duration_minutes": 2,
   "cues": ["Retention is not passive; make the passer pay for pressure."],
   "metrics": ["Posts forced", "Retentions", "Pin denials"],
   "common_errors": ["Reaching with hands while disconnecting with the feet."],
   "safety_notes": "—",
   "progression": "Add sweeping offense.",
   "regression": "Posts/frames only.",
   "source": "JPJJ public lesson plans",
   "roulette_eligible": true
 }$$::jsonb),

('X-Guard Defense: Posture', 'guard',
 ARRAY['x-guard defense', 'square the legs'],
 'Defender against x-guard: keep hands off mat, maintain posture, return legs to one side.',
 $${
   "family": "X-Guard Same-Side Pass",
   "full_label": "X-Guard defense: posture, square the legs back to the body",
   "your_role": "top_passer",
   "start_position": "Established x-guard from the defender''s side",
   "continuous_goals": {
     "top": "Hands on opponent or body, posture intact",
     "bottom": "Force a post and the hips down"
   },
   "terminal_goals": {
     "top": "Same-side leg squared back, posture maintained",
     "bottom": "Hips on mat OR hand post"
   },
   "reset_condition": "Either",
   "difficulty": "medium",
   "recommended_level": "blue+",
   "duration_minutes": 2,
   "cues": ["Control the feet, keep your posture, square the legs."],
   "metrics": ["Hands kept off mat", "Same-side recoveries"],
   "common_errors": ["Backing away with uncontrolled feet."],
   "safety_notes": "Respect lateral knee pressure.",
   "progression": "More dynamic entry.",
   "regression": "Pre-set x-guard with stable grips.",
   "source": "Public CLA coaching essays",
   "roulette_eligible": true
 }$$::jsonb),

('Standing: Disengage to Turtle', 'standup',
 ARRAY['takedown defense', 'disengage and turtle'],
 'Standing defender wins by disconnecting, turtling, or standing up before chest-over-head settles.',
 $${
   "family": "Takedown-Avoidance",
   "full_label": "Standing: disengage to turtle / stand-up before pin",
   "your_role": "standing",
   "start_position": "Neutral standing with takedown threat",
   "continuous_goals": {
     "top": "Settle chest-over-head control",
     "bottom": "Disengage / turtle / stand"
   },
   "terminal_goals": {
     "top": "Chest-over-head pin",
     "bottom": "Disconnect cleanly"
   },
   "reset_condition": "Either",
   "difficulty": "medium",
   "recommended_level": "white+",
   "duration_minutes": 2,
   "cues": ["Deny chest-over-head first."],
   "metrics": ["Clean disengages", "Safe turtles", "Stand-ups"],
   "common_errors": ["Accepting the takedown fully before building the second layer."],
   "safety_notes": "Clear the mat; control collisions; moderate pace with beginners.",
   "progression": "More dynamic wrestling tempo.",
   "regression": "Static single-attack start.",
   "source": "Public CLA coaching notes (Frank Chen)",
   "roulette_eligible": true
 }$$::jsonb),

('Avoid Pass to Turtle', 'guard',
 ARRAY['guard recovery via turtle', '3-second turtle hold'],
 'Bottom is nearly passed; wins by turtling or recovering enough to hold for 3 seconds.',
 $${
   "family": "Passing-Avoidance to Turtle",
   "full_label": "Bottom near-passed: recover via turtle / 3-second hold",
   "your_role": "pin_escaper",
   "start_position": "Bottom near-passed, top close to consolidating",
   "continuous_goals": {
     "top": "Consolidate the pass",
     "bottom": "Find any defensible intermediary position"
   },
   "terminal_goals": {
     "top": "Pin",
     "bottom": "3-second turtle hold OR re-guard"
   },
   "reset_condition": "Pin OR 3s turtle OR re-guard",
   "difficulty": "medium",
   "recommended_level": "white+",
   "duration_minutes": 2,
   "cues": ["First, stay alive; second, build structure."],
   "metrics": ["Pass denials", "Turtle holds", "Re-guards"],
   "common_errors": ["Recovering the prettiest guard instead of the first safe one."],
   "safety_notes": "Protect neck during desperate turtling.",
   "progression": "Live pass attempts.",
   "regression": "Less-passed starting geometry.",
   "source": "Public CLA notes (Frank Chen)",
   "roulette_eligible": true
 }$$::jsonb),

('Turtle: Build Base (No Hands)', 'guard',
 ARRAY['turtle defense no grip', 'stand from turtle'],
 'Attacker may NOT lock hands. Defender wins by standing up, reversing, or pulling guard.',
 $${
   "family": "Turtle Base-Preservation",
   "full_label": "Turtle defense: attacker can''t lock hands; defender stands / reverses / pulls",
   "your_role": "turtle_defender",
   "start_position": "Defender turtled, attacker behind",
   "continuous_goals": {
     "top": "Maintain pressure without locked hands",
     "bottom": "Reach a defensible exit"
   },
   "terminal_goals": {
     "top": "Force back exposure",
     "bottom": "Stand / reverse / pull guard"
   },
   "reset_condition": "Either",
   "difficulty": "medium",
   "recommended_level": "white+",
   "duration_minutes": 2,
   "cues": ["Elbows and knees must cooperate.", "Stand only when head and hips are aligned."],
   "metrics": ["Stand-ups", "Reversals", "Guard pulls"],
   "common_errors": ["Extending arms under pressure."],
   "safety_notes": "Cervical posture; ban violent mat returns.",
   "progression": "Allow attacker to lock hands.",
   "regression": "Static start, no top movement.",
   "source": "Public CLA notes (Frank Chen)",
   "roulette_eligible": true
 }$$::jsonb),

('Turtle: Build Base (Locked Hands)', 'guard',
 ARRAY['turtle defense locked hands'],
 'Attacker can lock hands and connect more aggressively. Same defender goals: stand, reverse, or face.',
 $${
   "family": "Turtle Base-Preservation",
   "full_label": "Turtle defense: attacker can lock hands; defender stands / reverses / faces",
   "your_role": "turtle_defender",
   "start_position": "Defender turtled, attacker connected with locked hands",
   "continuous_goals": {
     "top": "Use the locked-hands connection to reach back exposure",
     "bottom": "Defeat the connection sequence first"
   },
   "terminal_goals": {
     "top": "Hooks / back / chest-over-head",
     "bottom": "Stand / reverse / face"
   },
   "reset_condition": "Either",
   "difficulty": "medium",
   "recommended_level": "blue+",
   "duration_minutes": 2,
   "cues": ["One connection at a time."],
   "metrics": ["Faces", "Stand-ups", "Reversals"],
   "common_errors": ["Trying to stand with disconnected hips."],
   "safety_notes": "—",
   "progression": "Front-headlock alignment fight.",
   "regression": "No-hands version.",
   "source": "Public CLA notes (Frank Chen)",
   "roulette_eligible": true
 }$$::jsonb),

('Front Headlock: Free Head', 'guard',
 ARRAY['head escape', 'free head from front headlock'],
 'Defender is in front headlock. Goal: free the head before anything else.',
 $${
   "family": "Front Headlock Free-Head Escape",
   "full_label": "Front headlock: defender wins by freeing the head only",
   "your_role": "turtle_defender",
   "start_position": "Turtled defender, top covers chin + elbow",
   "continuous_goals": {
     "top": "Maintain head cover",
     "bottom": "Free the head"
   },
   "terminal_goals": {
     "top": "Hold the head for the round",
     "bottom": "Head free"
   },
   "reset_condition": "Free OR round time",
   "difficulty": "medium",
   "recommended_level": "white+",
   "duration_minutes": 3,
   "cues": ["Free the head first, then improve."],
   "metrics": ["Head frees", "Time under control"],
   "common_errors": ["Reaching with arms and exposing the neck further."],
   "safety_notes": "No snapping the neck to test the hold.",
   "progression": "Free head + reverse / face.",
   "regression": "Static start, longer rests.",
   "source": "JPJJ public lesson plans",
   "roulette_eligible": true
 }$$::jsonb),

('Front Headlock: Re-Align', 'guard',
 ARRAY['front headlock alignment escape'],
 'Stronger top connection / dynamic start. Defender wins by re-aligning before chest-over-head settles.',
 $${
   "family": "Front Headlock Alignment",
   "full_label": "Front headlock: defender wins by alignment + disconnect against stronger connection",
   "your_role": "turtle_defender",
   "start_position": "Turtle / semi-turtle, attacker threatens chest-over-head",
   "continuous_goals": {
     "top": "Bind head + arm",
     "bottom": "Alignment recovery: head, hips, base"
   },
   "terminal_goals": {
     "top": "Lock head + arm",
     "bottom": "Re-face / stand / disconnect"
   },
   "reset_condition": "Either",
   "difficulty": "medium",
   "recommended_level": "blue+",
   "duration_minutes": 3,
   "cues": ["Don''t let chest-over-head settle.", "Solve the head before the hips."],
   "metrics": ["Re-faces", "Stand-ups", "Disconnects"],
   "common_errors": ["Conceding the elbow line while fighting only hands."],
   "safety_notes": "Cervical caution.",
   "progression": "Add live attack entries.",
   "regression": "Free-head escape only.",
   "source": "JPJJ + Frank Chen",
   "roulette_eligible": true
 }$$::jsonb),

('Side Control: Recover', 'guard',
 ARRAY['side control escape', 'recover guard'],
 'Bottom is in side control or N-S. Wins by inserting feet/knees, sitting up, facing, or reversing.',
 $${
   "family": "Side-Control & North-South Recovery",
   "full_label": "Pin escape: side control or N-S, recover guard or face",
   "your_role": "pin_escaper",
   "start_position": "Chest-to-chest side control or north-south",
   "continuous_goals": {
     "top": "Maintain chest connection",
     "bottom": "Frame, angle, then insert"
   },
   "terminal_goals": {
     "top": "Hold the pin for the round",
     "bottom": "Knee/foot insertion / face / stand / reverse"
   },
   "reset_condition": "Recovery OR round",
   "difficulty": "medium",
   "recommended_level": "white+",
   "duration_minutes": 3,
   "cues": ["Frames make angle; angle makes knees."],
   "metrics": ["Insertions", "Re-faces", "Stand-ups", "Reversals"],
   "common_errors": ["Bench-pressing the chest instead of redirecting it."],
   "safety_notes": "Protect shoulders and neck in N-S scrambles.",
   "progression": "Defend transitions during top movement.",
   "regression": "Side-control recovery only.",
   "source": "JPJJ public lesson plans",
   "roulette_eligible": true
 }$$::jsonb),

('Half Guard: Strip Underhooks', 'guard',
 ARRAY['strip double unders', 'half guard recovery'],
 'Top has double underhooks. Bottom wins by stripping at least one.',
 $${
   "family": "Half-Guard Recovery",
   "full_label": "Half guard recovery: against top double underhooks, strip one",
   "your_role": "pin_escaper",
   "start_position": "Bottom flattened in half guard, top has double underhooks",
   "continuous_goals": {
     "top": "Maintain underhook depth",
     "bottom": "Find frame to strip an underhook"
   },
   "terminal_goals": {
     "top": "Free the trapped leg",
     "bottom": "Strip an underhook"
   },
   "reset_condition": "Either",
   "difficulty": "medium",
   "recommended_level": "white+",
   "duration_minutes": 3,
   "cues": ["Strip the upper-body control before solving the leg."],
   "metrics": ["Underhooks stripped"],
   "common_errors": ["Chasing sweeping mechanics while still flattened."],
   "safety_notes": "Moderate cross-face pressure.",
   "progression": "Recover knee shield from one underhook.",
   "regression": "Static double-underhook hold.",
   "source": "JPJJ public lesson plans",
   "roulette_eligible": true
 }$$::jsonb),

('Half Guard: Recover Knee Shield', 'guard',
 ARRAY['knee shield recovery', 'inside hook'],
 'Top has one underhook + chest pressure. Bottom wins by reaching knee shield or inside hook.',
 $${
   "family": "Half-Guard Recovery",
   "full_label": "Half guard recovery: from one-underhook loss, recover shield/hook",
   "your_role": "pin_escaper",
   "start_position": "Bottom in half guard, top has single underhook + chest pressure",
   "continuous_goals": {
     "top": "Build to double underhooks",
     "bottom": "Recover frame"
   },
   "terminal_goals": {
     "top": "Build to double underhooks OR pass",
     "bottom": "Knee shield OR inside hook"
   },
   "reset_condition": "Either",
   "difficulty": "medium",
   "recommended_level": "white+",
   "duration_minutes": 3,
   "cues": ["Frame to angle; angle to knee shield."],
   "metrics": ["Knee-shield recoveries", "Inside-hook recoveries"],
   "common_errors": ["Bench-pressing instead of angling."],
   "safety_notes": "—",
   "progression": "Recover from full hip exposure.",
   "regression": "Strip underhooks only.",
   "source": "JPJJ public lesson plans",
   "roulette_eligible": true
 }$$::jsonb),

('Half Guard: Recover from Hip Loss', 'guard',
 ARRAY['half guard side exposure', 'recover from flatten'],
 'Top has hip access; bottom is on side. Bottom wins by recovering shield or hook.',
 $${
   "family": "Half-Guard Recovery",
   "full_label": "Half guard recovery: from hip-access loss, recover shield/hook",
   "your_role": "pin_escaper",
   "start_position": "Bottom on side, top has hip access",
   "continuous_goals": {
     "top": "Flatten and connect",
     "bottom": "Frame and recover"
   },
   "terminal_goals": {
     "top": "Flatten + chest-to-chest + underhook + leg freed",
     "bottom": "Knee shield OR inside hook"
   },
   "reset_condition": "Either",
   "difficulty": "high",
   "recommended_level": "blue+",
   "duration_minutes": 3,
   "cues": ["Three problems in order: hip line, frame, knee shield."],
   "metrics": ["Recoveries by stage"],
   "common_errors": ["Skipping the frame to chase the shield."],
   "safety_notes": "—",
   "progression": "Live half-guard recovery round.",
   "regression": "Recover knee shield from one underhook.",
   "source": "JPJJ public lesson plans",
   "roulette_eligible": true
 }$$::jsonb),

('Back Escape: No Hands', 'guard',
 ARRAY['back escape chest connection'],
 'Top has chest-to-back contact, no connected hands. Bottom wins by turning to face.',
 $${
   "family": "Back Escape",
   "full_label": "Back escape #1: against chest-to-back, no connected hands",
   "your_role": "back_escaper",
   "start_position": "Defender chest-to-back exposed, attacker hands free",
   "continuous_goals": {
     "top": "Maintain chest-to-back",
     "bottom": "Turn and face"
   },
   "terminal_goals": {
     "top": "Maintain for the round",
     "bottom": "Face the attacker"
   },
   "reset_condition": "Face OR round",
   "difficulty": "medium",
   "recommended_level": "white+",
   "duration_minutes": 2,
   "cues": ["Shorten the line they can ride."],
   "metrics": ["Faces"],
   "common_errors": ["Fighting hands that aren''t there."],
   "safety_notes": "Avoid rotational cranks.",
   "progression": "Against locked-hands waist control.",
   "regression": "Static turtle start.",
   "source": "JPJJ public lesson plans",
   "roulette_eligible": true
 }$$::jsonb),

('Back Escape: Waist Connection', 'guard',
 ARRAY['back escape locked hands'],
 'Top has locked hands at the waist; no hooks, no submissions. Bottom escapes by breaking the connection.',
 $${
   "family": "Back Escape",
   "full_label": "Back escape #2: against locked-hands waist control, no hooks",
   "your_role": "back_escaper",
   "start_position": "Defender chest-to-back, attacker hands locked at waist",
   "continuous_goals": {
     "top": "Keep shoulders + hips simultaneously",
     "bottom": "Break ONE connection at a time"
   },
   "terminal_goals": {
     "top": "Maintain control",
     "bottom": "Face / hide back / stand"
   },
   "reset_condition": "Either",
   "difficulty": "medium",
   "recommended_level": "white+",
   "duration_minutes": 2,
   "cues": ["Win one connection at a time."],
   "metrics": ["Escapes by stage"],
   "common_errors": ["Fighting the hands while ignoring the chest."],
   "safety_notes": "Body-triangle pressure: progressive.",
   "progression": "Against single hook.",
   "regression": "No-hands version.",
   "source": "JPJJ public lesson plans",
   "roulette_eligible": true
 }$$::jsonb),

('Back Escape: Single Hook', 'guard',
 ARRAY['back escape one hook', 'single hook defense'],
 'Top has single-hook submission control. Bottom escapes by alignment and hand-fighting.',
 $${
   "family": "Back Escape",
   "full_label": "Back escape #3: against single-hook submission hunt",
   "your_role": "back_escaper",
   "start_position": "Single hook + seatbelt control on the back",
   "continuous_goals": {
     "top": "Tap from single-hook control",
     "bottom": "Align, hand-fight, escape before the second hook lands"
   },
   "terminal_goals": {
     "top": "Tap",
     "bottom": "Face / hide back / stand"
   },
   "reset_condition": "Tap OR escape",
   "difficulty": "high",
   "recommended_level": "blue+",
   "duration_minutes": 2,
   "cues": ["Defeat exposure before connection; defeat connection before hook."],
   "metrics": ["Escapes", "Taps conceded"],
   "common_errors": ["Forgetting that the seatbelt is the threat, not the hook."],
   "safety_notes": "Tap respect.",
   "progression": "Against full back.",
   "regression": "Locked-hands waist version.",
   "source": "JPJJ public lesson plans",
   "roulette_eligible": true
 }$$::jsonb),

('Back Escape: No-Hooks Choke', 'guard',
 ARRAY['hooks-less choke escape'],
 'Top has choke configuration without hooks. Bottom escapes by alignment.',
 $${
   "family": "Back Escape",
   "full_label": "Back escape #4: against choke control without hooks",
   "your_role": "back_escaper",
   "start_position": "Choke configuration on the back, no hooks inserted",
   "continuous_goals": {
     "top": "Finish the choke",
     "bottom": "Defeat the configuration before pressure rises"
   },
   "terminal_goals": {
     "top": "Tap",
     "bottom": "Escape configuration"
   },
   "reset_condition": "Tap OR escape",
   "difficulty": "high",
   "recommended_level": "blue+",
   "duration_minutes": 2,
   "cues": ["Hands defend the line, body defends the hooks."],
   "metrics": ["Escapes"],
   "common_errors": ["Neglecting alignment in favor of hand-fighting."],
   "safety_notes": "Tap respect.",
   "progression": "Full back submission round.",
   "regression": "Single-hook version.",
   "source": "JPJJ public lesson plans",
   "roulette_eligible": true
 }$$::jsonb),

('Back Escape: Full Back', 'guard',
 ARRAY['full back escape', 'turn hide stand'],
 'Top has full back: seatbelt + both feet. Bottom wins by turning to face, hiding the back, or standing.',
 $${
   "family": "Back Escape",
   "full_label": "Back escape #5: full back — turn / hide / stand",
   "your_role": "back_escaper",
   "start_position": "Full back: seatbelt + both feet covering hips",
   "continuous_goals": {
     "top": "Hold full back",
     "bottom": "Turn / hide / stand"
   },
   "terminal_goals": {
     "top": "Maintain for the round",
     "bottom": "Any of: turn-and-face / hide back / stand"
   },
   "reset_condition": "Escape OR round",
   "difficulty": "high",
   "recommended_level": "blue+",
   "duration_minutes": 3,
   "cues": ["Defeat exposure → connection → hooks → submissions."],
   "metrics": ["Escapes by stage"],
   "common_errors": ["Trying to escape before alignment."],
   "safety_notes": "Body-triangle pressure: progressive.",
   "progression": "Open back round.",
   "regression": "No-hooks choke version.",
   "source": "JPJJ public lesson plans",
   "roulette_eligible": true
 }$$::jsonb),

('Spiderweb Escape', 'guard',
 ARRAY['armbar escape', 'late armbar defense'],
 'Defender in spiderweb / late armbar. Wins by aligning parallel and freeing the head/shoulder before the arm is fully isolated.',
 $${
   "family": "Spiderweb Escape",
   "full_label": "Late armbar / spiderweb escape: alignment recovery",
   "your_role": "pin_escaper",
   "start_position": "Spiderweb / late armbar configuration",
   "continuous_goals": {
     "top": "Consolidate the arm line",
     "bottom": "Recover body alignment before extraction"
   },
   "terminal_goals": {
     "top": "Tap",
     "bottom": "Get parallel + free head/shoulder"
   },
   "reset_condition": "Tap OR escape",
   "difficulty": "high",
   "recommended_level": "blue+",
   "duration_minutes": 2,
   "cues": ["Alignment before extraction."],
   "metrics": ["Escapes after alignment"],
   "common_errors": ["Pulling the arm linearly before alignment is restored."],
   "safety_notes": "Slow rounds, immediate taps. The most safety-sensitive game in the set.",
   "progression": "Live armbar finishing round.",
   "regression": "Partial spiderweb start.",
   "source": "Frank Chen + Iturriaga public material",
   "roulette_eligible": true
 }$$::jsonb)

ON CONFLICT (name) DO UPDATE SET
    parent_pillar = EXCLUDED.parent_pillar,
    aliases = EXCLUDED.aliases,
    description = EXCLUDED.description,
    details = EXCLUDED.details;
