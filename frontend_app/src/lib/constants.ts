import { PRESTIGE_GREEN, PRESTIGE_GREEN_GLOW } from './theme';

// Daily reflection prompts — rotates one per day on the JournalEntryPage.
// Index = floor(unix_ms / 86_400_000) % length, so the same day gives the
// same prompt regardless of how many times the page is opened.
export const REFLECTION_PROMPTS = [
  "What moment from yesterday's roll still teaches you?",
  "Which opponent's pressure changed how you move?",
  "What's the smallest detail you're drilling this week?",
  "Where did your breath leave you last session?",
  "What technique are you quietly getting better at?",
  "When did the mat last surprise you?",
] as const;

export const ROULETTE_DRILLS = [
  { name: 'Hip Escape Drill',        focus: 'Guard',           suggestion: '3 × 10 each side',
    description: 'From bottom mount or side control, bridge to create space then shrimp your hips out to re-guard. Focus on explosive hip movement and keeping your frames tight.' },
  { name: 'Penetration Step',        focus: 'Stand-up',        suggestion: '3 × 15 each side',
    description: 'Drop your level, step your lead foot deep between your partner\'s feet, and drive forward with your head on the outside. Build the habit of changing levels before every shot.' },
  { name: 'Upa Bridge & Roll',       focus: 'Dynamic Pins',    suggestion: '3 × 10 each side',
    description: 'Trap your opponent\'s arm and same-side foot, bridge explosively at a 45-degree angle, and roll them over into your guard. Timing the bridge with their weight shift is key.' },
  { name: 'Guard Pass Flow',         focus: 'Guard Passing',   suggestion: '5 min continuous',
    description: 'Chain together 3-4 guard passes in sequence without stopping. When one pass is blocked, immediately transition to the next. Builds passing combinations and pressure.' },
  { name: 'Triangle Finish',         focus: 'Submissions',     suggestion: '3 × 10 each side',
    description: 'From closed guard, isolate one arm, throw your legs up into triangle position, and work the finish. Focus on cutting the angle, pulling the head down, and squeezing your knees.' },
  { name: 'Arm Drag to Back Take',   focus: 'Stand-up',        suggestion: '3 × 10 each side',
    description: 'From a collar tie or wrist grip, pull your partner\'s arm across their body, circle to their back, and secure a seatbelt grip. Speed and timing matter more than strength.' },
  { name: 'Torreando Pass',          focus: 'Guard Passing',   suggestion: '3 × 10 each side',
    description: 'Grip both pant legs or ankles, push your partner\'s legs to one side while you step around to the other. Drop your shoulder pressure immediately on the pass to secure side control.' },
  { name: 'Scissor Sweep',           focus: 'Guard',           suggestion: '3 × 10 each side',
    description: 'From closed guard, establish a cross-collar and sleeve grip. Open your guard, place your shin across their stomach, and scissor your legs to sweep them. Timing their weight forward is essential.' },
  { name: 'Rear Naked Choke Entry',  focus: 'Submissions',     suggestion: '3 × 10',
    description: 'From back control with hooks in, fight for the underhook, slide your choking arm under the chin, connect your hands, and apply the squeeze. Practice the hand-fighting entry slowly.' },
  { name: 'Technical Stand-Up',      focus: 'Dynamic Pins',    suggestion: '3 × 15',
    description: 'From seated on the ground, post one hand behind you, kick your opposite leg out, and rise to a standing base. Keep your posting hand back and your eyes on your opponent throughout.' },
  { name: 'Double Leg Setups',       focus: 'Stand-up',        suggestion: '3 × 10 each side',
    description: 'Practice the full double leg sequence: set up with a jab or snap-down, change levels, penetration step, wrap both legs, and drive through. Chain different setups into the shot.' },
  { name: 'Knee Cut Pass',           focus: 'Guard Passing',   suggestion: '3 × 10 each side',
    description: 'From half guard or knee shield, slide your knee across your partner\'s thigh, pin their far hip, and cut through to side control. Keep heavy chest pressure as you pass.' },
  { name: 'Armbar from Guard',       focus: 'Submissions',     suggestion: '3 × 10 each side',
    description: 'From closed guard, control one arm with a two-on-one grip, pivot your hips out, throw your leg over their head, and extend the arm. Pinch your knees and keep their thumb pointing up.' },
  { name: 'Granby Roll',             focus: 'Guard Retention', suggestion: '3 × 10 each direction',
    description: 'From turtle or a scramble, invert over your shoulder and roll through to re-guard or create a leg entanglement. Builds inverting confidence and scramble recovery.' },
  { name: 'Elbow-Knee Escape',       focus: 'Dynamic Pins',    suggestion: '3 × 10 each side',
    description: 'From bottom side control, frame against their neck and hip, create space by shrimping, and work your inside knee through to recover guard. Patience and small incremental movements win here.' },
] as const;

export const SKILL_TAGS = [
  { value: 'standup',     label: 'Stand-up'      },
  { value: 'passing',     label: 'Guard Passing' },
  { value: 'pins',        label: 'Dynamic Pins'  },
  { value: 'submissions', label: 'Submissions'   },
  { value: 'guard',       label: 'Guard'         },
] as const;

export type SkillTag = typeof SKILL_TAGS[number]['value'];

export const CATEGORY_COLORS: Record<string, string> = {
  technical:   '#60a5fa',
  physical:    '#f87171',
  mental:      '#a78bfa',
  positional:  '#34d399',
  competitive: '#fbbf24',
  presence:    '#4BA862',
};

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export const EIGHT_GATES = [
  { weeks: 2,  color: '#C4915F', glow: 'rgba(196,145,95,0.35)',  toast: 'Two weeks. The mat is starting to know you.',            burst: false },
  { weeks: 4,  color: '#C4915F', glow: 'rgba(196,145,95,0.40)',  toast: 'Four weeks straight. A habit lives here now.',            burst: false },
  { weeks: 6,  color: '#DA7422', glow: 'rgba(218,116,34,0.40)',  toast: 'Six weeks. The mat knows your schedule.',                 burst: false },
  { weeks: 8,  color: PRESTIGE_GREEN, glow: PRESTIGE_GREEN_GLOW,  toast: 'Eight weeks. You show up. That is the whole secret.',     burst: false },
  { weeks: 12, color: '#6FD08C', glow: 'rgba(111,208,140,0.45)', toast: 'Three months. Most stop here. You did not.',              burst: false },
  { weeks: 16, color: '#6FD08C', glow: 'rgba(111,208,140,0.50)', toast: 'Sixteen weeks. Your body knows the way now.',             burst: false },
  { weeks: 20, color: '#F2E4A8', glow: 'rgba(242,228,168,0.50)', toast: 'Five months on the mat. The technique is in your hands.', burst: false },
  { weeks: 26, color: '#F2E4A8', glow: 'rgba(242,228,168,0.55)', toast: 'Half a year. Every week. The mat remembers.',             burst: true  },
] as const;
