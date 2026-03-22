export const ROULETTE_DRILLS = [
  { name: 'Hip Escape Drill',        focus: 'Guard Retention', suggestion: '3 × 10 each side'        },
  { name: 'Penetration Step',        focus: 'Stand-up',        suggestion: '3 × 15 each side'        },
  { name: 'Upa Bridge & Roll',       focus: 'Pin Escapes',     suggestion: '3 × 10 each side'        },
  { name: 'Guard Pass Flow',         focus: 'Guard Passing',   suggestion: '5 min continuous'         },
  { name: 'Triangle Finish',         focus: 'Submissions',     suggestion: '3 × 10 each side'        },
  { name: 'Arm Drag to Back Take',   focus: 'Stand-up',        suggestion: '3 × 10 each side'        },
  { name: 'Torreando Pass',          focus: 'Guard Passing',   suggestion: '3 × 10 each side'        },
  { name: 'Scissor Sweep',           focus: 'Guard Retention', suggestion: '3 × 10 each side'        },
  { name: 'Rear Naked Choke Entry',  focus: 'Submissions',     suggestion: '3 × 10'                  },
  { name: 'Technical Stand-Up',      focus: 'Pin Escapes',     suggestion: '3 × 15'                  },
  { name: 'Double Leg Setups',       focus: 'Stand-up',        suggestion: '3 × 10 each side'        },
  { name: 'Knee Cut Pass',           focus: 'Guard Passing',   suggestion: '3 × 10 each side'        },
  { name: 'Armbar from Guard',       focus: 'Submissions',     suggestion: '3 × 10 each side'        },
  { name: 'Granby Roll',             focus: 'Guard Retention', suggestion: '3 × 10 each direction'   },
  { name: 'Elbow-Knee Escape',       focus: 'Pin Escapes',     suggestion: '3 × 10 each side'        },
] as const;

export const SKILL_TAGS = [
  { value: 'standup',         label: 'Stand-up'        },
  { value: 'guard_retention', label: 'Guard Retention' },
  { value: 'submissions',     label: 'Submissions'     },
  { value: 'pin_escapes',     label: 'Pin Escapes'     },
  { value: 'guard_passing',   label: 'Guard Passing'   },
] as const;

export type SkillTag = typeof SKILL_TAGS[number]['value'];
