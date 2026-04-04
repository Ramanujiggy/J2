import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Existing brand tokens — unchanged
        brand: {
          orange:        '#DA7422',
          green:         '#6FD08C',
          'light-green': '#CDDFA0',
          dark:          '#0D1A14',
        },
        // shadcn CSS variable tokens
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input:  'hsl(var(--input))',
        ring:   'hsl(var(--ring))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['DM Serif Display', 'serif'],
      },
      transitionTimingFunction: {
        heavy:  'cubic-bezier(0.16, 1, 0.3, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        luxury: 'cubic-bezier(0.0, 0.55, 0.15, 1.0)',
      },
      keyframes: {
        'view-enter-up': {
          from: { transform: 'translateY(100%)', opacity: '0.6' },
          to:   { transform: 'translateY(0)',    opacity: '1'   },
        },
        'view-exit-up': {
          from: { transform: 'translateY(0)',     opacity: '1' },
          to:   { transform: 'translateY(-100%)', opacity: '0' },
        },
        'view-enter-down': {
          from: { transform: 'translateY(-100%)', opacity: '0.6' },
          to:   { transform: 'translateY(0)',     opacity: '1'   },
        },
        'view-exit-down': {
          from: { transform: 'translateY(0)',    opacity: '1' },
          to:   { transform: 'translateY(100%)', opacity: '0' },
        },
        'toggle-exit': {
          '0%':   { transform: 'scaleY(1) translateX(0)',       opacity: '1', borderRadius: '6px' },
          '40%':  { transform: 'scaleY(0.07) translateX(0)',    opacity: '1', borderRadius: '1px' },
          '100%': { transform: 'scaleY(0.07) translateX(120%)', opacity: '0', borderRadius: '1px' },
        },
        'toggle-enter': {
          '0%':   { transform: 'scaleY(0.07) translateX(120%)', opacity: '0', borderRadius: '1px' },
          '60%':  { transform: 'scaleY(0.07) translateX(0)',    opacity: '1', borderRadius: '1px' },
          '100%': { transform: 'scaleY(1) translateX(0)',        opacity: '1', borderRadius: '6px' },
        },
        'j2-card-enter': {
          from: { opacity: '0', transform: 'translateY(16px) scale(0.98)' },
          to:   { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'j2-page-in': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'j2-page-out': {
          from: { opacity: '1', transform: 'translateY(0)' },
          to:   { opacity: '0', transform: 'translateY(-8px)' },
        },
        'j2-modal-in': {
          from: { transform: 'scale(0.95) translateY(8px)' },
          to:   { transform: 'scale(1) translateY(0)' },
        },
        'j2-backdrop-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'j2-today-pulse': {
          '0%, 100%': { borderColor: 'rgba(196,145,95,0.7)', boxShadow: '0 0 16px rgba(196,145,95,0.2)' },
          '50%':      { borderColor: 'rgba(196,145,95,0.9)', boxShadow: '0 0 22px rgba(196,145,95,0.3)' },
        },
        'j2-shimmer': {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'view-exit-up':    'view-exit-up   500ms cubic-bezier(0, 0, 0.3, 1) both',
        'view-exit-down':  'view-exit-down 500ms cubic-bezier(0, 0, 0.3, 1) both',
        'view-enter-up':   'view-enter-up   560ms cubic-bezier(0.2, 1.1, 0.4, 1) 120ms both',
        'view-enter-down': 'view-enter-down 560ms cubic-bezier(0.2, 1.1, 0.4, 1) 120ms both',
        'toggle-exit':  'toggle-exit  420ms cubic-bezier(0.4, 0, 0.8, 0.2) both',
        'toggle-enter': 'toggle-enter 480ms cubic-bezier(0.2, 1.1, 0.4, 1) both',
        'j2-card-enter': 'j2-card-enter 500ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'j2-page-in':   'j2-page-in 350ms cubic-bezier(0.0, 0.55, 0.15, 1.0) both',
        'j2-page-out':  'j2-page-out 200ms ease-in both',
        'j2-modal-in':    'j2-modal-in 400ms cubic-bezier(0.16, 1, 0.3, 1) 80ms both',
        'j2-backdrop-in': 'j2-backdrop-in 250ms ease both',
        'j2-today-pulse': 'j2-today-pulse 4s ease-in-out infinite',
        'j2-shimmer':   'j2-shimmer 1.2s ease-out both',
      },
    },
  },
  plugins: [],
} satisfies Config;
