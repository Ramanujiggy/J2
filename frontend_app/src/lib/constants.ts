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
  presence:    '#52B56C',
};

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
