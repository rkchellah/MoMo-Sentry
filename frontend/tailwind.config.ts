import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

/** Allow `bg-primary/50`-style utilities with full CSS variable colors (oklch). */
function withAlpha(variable: string) {
  return `color-mix(in oklch, var(${variable}) calc(<alpha-value> * 100%), transparent)`
}

const config = {
  darkMode: ['class'],
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        '4xl': '2rem',
      },
      colors: {
        background: withAlpha('--background'),
        foreground: withAlpha('--foreground'),
        card: {
          DEFAULT: withAlpha('--card'),
          foreground: withAlpha('--card-foreground'),
        },
        popover: {
          DEFAULT: withAlpha('--popover'),
          foreground: withAlpha('--popover-foreground'),
        },
        primary: {
          DEFAULT: withAlpha('--primary'),
          foreground: withAlpha('--primary-foreground'),
        },
        secondary: {
          DEFAULT: withAlpha('--secondary'),
          foreground: withAlpha('--secondary-foreground'),
        },
        muted: {
          DEFAULT: withAlpha('--muted'),
          foreground: withAlpha('--muted-foreground'),
        },
        accent: {
          DEFAULT: withAlpha('--accent'),
          foreground: withAlpha('--accent-foreground'),
        },
        destructive: {
          DEFAULT: withAlpha('--destructive'),
        },
        border: withAlpha('--border'),
        input: withAlpha('--input'),
        ring: withAlpha('--ring'),
        success: {
          DEFAULT: withAlpha('--success'),
          foreground: withAlpha('--success-foreground'),
        },
        warning: {
          DEFAULT: withAlpha('--warning'),
          foreground: withAlpha('--warning-foreground'),
        },
        chart: {
          1: withAlpha('--chart-1'),
          2: withAlpha('--chart-2'),
          3: withAlpha('--chart-3'),
          4: withAlpha('--chart-4'),
          5: withAlpha('--chart-5'),
        },
        sidebar: {
          DEFAULT: withAlpha('--sidebar'),
          foreground: withAlpha('--sidebar-foreground'),
          primary: withAlpha('--sidebar-primary'),
          'primary-foreground': withAlpha('--sidebar-primary-foreground'),
          accent: withAlpha('--sidebar-accent'),
          'accent-foreground': withAlpha('--sidebar-accent-foreground'),
          border: withAlpha('--sidebar-border'),
          ring: withAlpha('--sidebar-ring'),
        },
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config

export default config
