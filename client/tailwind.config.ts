import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#1A2E4A',
          dark: '#0A1628',
          light: '#243d5f',
          muted: '#2d4a6b',
        },
        teal: {
          DEFAULT: '#0D7377',
          light: '#14a3a8',
          dark: '#095155',
          glow: 'rgba(13, 115, 119, 0.3)',
        },
        accent: {
          DEFAULT: '#F0A500',
          light: '#F5C035',
          dark: '#C08800',
          glow: 'rgba(240, 165, 0, 0.3)',
        },
        surface: {
          DEFAULT: 'rgba(26, 46, 74, 0.6)',
          solid: '#1a2e4a',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-navy': 'linear-gradient(135deg, #0A1628 0%, #1A2E4A 100%)',
      },
      boxShadow: {
        'glow-teal': '0 0 20px rgba(13, 115, 119, 0.4)',
        'glow-accent': '0 0 20px rgba(240, 165, 0, 0.4)',
        'card': '0 4px 24px rgba(0, 0, 0, 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-dot': 'pulseDot 2s infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { transform: 'translateY(20px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        pulseDot: { '0%, 100%': { transform: 'scale(1)', opacity: '1' }, '50%': { transform: 'scale(1.5)', opacity: '0.5' } },
      }
    },
  },
  plugins: [],
}

export default config
