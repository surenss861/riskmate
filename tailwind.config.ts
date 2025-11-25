import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#0A0A0A', // Minimal black
          accent: '#121212', // Surface/card background
          surface: '#121212', // Card sections
        },
        brand: {
          orange: '#F97316', // Primary accent
          'orange-light': '#FB923C',
          'orange-dark': '#EA580C',
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#A1A1A1',
          muted: '#9CA3AF',
        },
        steel: {
          900: '#000000',
          800: '#0E0E0E',
          700: '#1A1A1A',
          600: '#262626',
          500: '#333333',
          DEFAULT: '#0E0E0E',
        },
        accent: {
          orange: '#FF6B35',
          cyan: '#00D4FF',
          DEFAULT: '#00D4FF',
        },
        gray: {
          50: '#FFFFFF',
          100: '#F5F5F5',
          200: '#E5E5E5',
          300: '#D4D4D4',
          400: '#A0A0A0', // text-dim
          500: '#737373',
          600: '#666666', // text-muted
          700: '#525252',
          800: '#404040',
          900: '#262626',
        },
        navy: {
          900: '#05070C', // Updated to match background
          800: '#0B0F17', // Updated to match accent
          700: '#111A29', // Updated to match card
          600: '#1A2438', // Subtle blue highlights
          500: '#1A2F47',
          400: '#0F1A2E',
          DEFAULT: '#05070C',
          2: '#101C2E',
        },
        orange: {
          600: '#F57C00', // Primary accent (refined)
          500: '#FF8C32',
          400: '#FF9D42',
          300: '#FFB347',
          DEFAULT: '#F57C00',
        },
        cyan: {
          500: '#00CFE8', // Safety tech accent (refined)
          400: '#00E0FF',
          300: '#7FFFD4',
          DEFAULT: '#00CFE8',
        },
        muted: {
          DEFAULT: '#A9B4C7', // Muted gray text
        },
        slate: {
          200: '#C7D2E0',
          300: '#A8B4C5',
          400: '#8A94A3',
          500: '#6B7280',
          600: '#4B5563',
        },
        graphite: {
          DEFAULT: '#1B1F2A', // Graphite Grey - Surfaces, cards, dashboard panels
        },
        neutral: {
          light: '#F7FAFF', // Neutral Light - Text on dark backgrounds
        },
        primary: {
          text: '#F5F7FA', // Soft white for primary text
          muted: 'rgba(255, 255, 255, 0.6)', // Muted text
        },
        success: '#29CC6A',
        warn: '#FFC53D',
        danger: '#FF4D4F',
        white: {
          DEFAULT: '#F9F9F9',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'], // Using Inter for now, can swap to Clash Display/Satoshi later
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'display-1': ['72px', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        'display-2': ['64px', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        'h1': ['48px', { lineHeight: '1.1', letterSpacing: '-0.01em' }],
        'h2': ['36px', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'body-lg': ['20px', { lineHeight: '1.6' }],
        'body': ['18px', { lineHeight: '1.6' }],
      },
      borderRadius: {
        xl: '14px',
        '2xl': '18px',
        '3xl': '26px',
      },
      boxShadow: {
        'soft': '0 4px 20px rgba(0,0,0,0.5)',
        'medium': '0 8px 40px rgba(0,0,0,0.7)',
        'deep': '0 16px 80px rgba(0,0,0,0.9)',
      },
      backgroundImage: {
        'gradient-heat-cool': 'linear-gradient(135deg, #FF7A1A 0%, #00D2FF 100%)',
        'gradient-hero': 'radial-gradient(circle at 50% 50%, #0A101E 0%, #030509 100%)',
        'gradient-overlay': `
          radial-gradient(circle at 60% 20%, rgba(255, 120, 0, 0.2), transparent 70%),
          radial-gradient(circle at 20% 80%, rgba(0, 200, 255, 0.15), transparent 70%)
        `,
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      backdropBlur: {
        lg: '14px',
        xl: '20px',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'gauge-fill': 'gaugeFill 1s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        gaugeFill: {
          '0%': { strokeDashoffset: '100%' },
          '100%': { strokeDashoffset: 'var(--gauge-offset)' },
        },
      },
    },
  },
  plugins: [],
}
export default config

