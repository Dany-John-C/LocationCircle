import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // "navy" tokens repurposed to a WhatsApp-style dark palette
        navy: {
          DEFAULT: '#202c33',   // panels / cards / header
          dark: '#0b141a',      // app background
          light: '#2a3942',     // inputs / hover surfaces
          muted: '#2a3942',
        },
        // "teal" tokens repurposed to WhatsApp green (primary accent)
        teal: {
          DEFAULT: '#00a884',
          light: '#06cf9c',
          dark: '#008069',
          glow: 'rgba(0, 168, 132, 0.3)',
        },
        // Gold kept for the Group Head highlight (distinct, accessible cue)
        accent: {
          DEFAULT: '#F0A500',
          light: '#F5C035',
          dark: '#C08800',
          glow: 'rgba(240, 165, 0, 0.3)',
        },
        surface: {
          DEFAULT: 'rgba(32, 44, 51, 0.6)',
          solid: '#202c33',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-navy': 'linear-gradient(180deg, #0b141a 0%, #111b21 100%)',
      },
      boxShadow: {
        'glow-teal': '0 0 20px rgba(0, 168, 132, 0.4)',
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
