import { PALE_YELLOW, GLOW_SOFT } from '../lib/theme.ts';

interface Props {
  name: string | null;
}

export default function HomeHeader({ name }: Props) {
  const hours = new Date().getHours();
  const greeting = hours < 12 ? 'Good morning' : hours < 17 ? 'Good afternoon' : 'Good evening';
  const displayGreeting = name ? `${greeting}, ${name}` : greeting;

  const dateStr = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  return (
    <div className="flex flex-col gap-0.5">
      <h2
        className="text-xl font-display font-semibold tracking-tight"
        style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}
      >
        {displayGreeting}
      </h2>
      <span className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
        {dateStr}
      </span>
    </div>
  );
}
