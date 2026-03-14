export const SKILL_TAGS = [
  { value: 'standup',         label: 'Stand-up'        },
  { value: 'guard_retention', label: 'Guard Retention' },
  { value: 'submissions',     label: 'Submissions'     },
  { value: 'pin_escapes',     label: 'Pin Escapes'     },
  { value: 'guard_passing',   label: 'Guard Passing'   },
] as const;

export type SkillTag = typeof SKILL_TAGS[number]['value'];
