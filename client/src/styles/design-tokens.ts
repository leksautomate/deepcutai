/**
 * Design tokens for DeepCut AI
 * Following frontend-design skill: unique, distinctive, premium aesthetic
 */

// Typography - Distinctive font pairings (NOT generic Inter/Roboto)
export const typography = {
    fonts: {
        display: "'Space Grotesk', 'Inter', system-ui, sans-serif", // Distinctive geometric sans
        body: "'Inter', system-ui, sans-serif", // Clean, readable
        mono: "'JetBrains Mono', 'Fira Code', monospace", // Code and technical content
    },

    sizes: {
        xs: '0.75rem',    // 12px
        sm: '0.875rem',   // 14px
        base: '1rem',     // 16px
        lg: '1.125rem',   // 18px
        xl: '1.25rem',    // 20px
        '2xl': '1.5rem',  // 24px
        '3xl': '1.875rem', // 30px
        '4xl': '2.25rem', // 36px
        '5xl': '3rem',    // 48px
    },

    weights: {
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
    },

    lineHeights: {
        tight: 1.25,
        normal: 1.5,
        relaxed: 1.75,
    },
};

// Color palette - Custom, cohesive scheme (not generic purple gradients)
// Using HSL for easier manipulation
export const colors = {
    // Primary - Deep electric blue (distinctive, tech-forward)
    primary: {
        50: 'hsl(210, 100%, 97%)',
        100: 'hsl(210, 100%, 94%)',
        200: 'hsl(210, 100%, 88%)',
        300: 'hsl(210, 100%, 78%)',
        400: 'hsl(210, 100%, 65%)',
        500: 'hsl(210, 100%, 50%)', // Main
        600: 'hsl(210, 100%, 42%)',
        700: 'hsl(210, 100%, 35%)',
        800: 'hsl(210, 100%, 28%)',
        900: 'hsl(210, 100%, 20%)',
    },

    // Accent - Vibrant cyan (energy, creativity)
    accent: {
        50: 'hsl(180, 100%, 97%)',
        100: 'hsl(180, 100%, 92%)',
        200: 'hsl(180, 90%, 82%)',
        300: 'hsl(180, 85%, 68%)',
        400: 'hsl(180, 80%, 55%)',
        500: 'hsl(180, 75%, 45%)', // Main
        600: 'hsl(180, 70%, 38%)',
        700: 'hsl(180, 65%, 30%)',
        800: 'hsl(180, 60%, 22%)',
        900: 'hsl(180, 55%, 15%)',
    },

    // Success - Emerald green
    success: {
        500: 'hsl(142, 76%, 45%)',
        600: 'hsl(142, 76%, 38%)',
    },

    // Warning - Amber
    warning: {
        500: 'hsl(38, 92%, 50%)',
        600: 'hsl(38, 92%, 42%)',
    },

    // Danger - Crimson red
    danger: {
        500: 'hsl(350, 89%, 60%)',
        600: 'hsl(350, 89%, 52%)',
    },

    // Neutrals - Sophisticated dark theme
    dark: {
        50: 'hsl(220, 15%, 95%)',
        100: 'hsl(220, 15%, 90%)',
        200: 'hsl(220, 15%, 80%)',
        300: 'hsl(220, 15%, 65%)',
        400: 'hsl(220, 15%, 50%)',
        500: 'hsl(220, 15%, 35%)',
        600: 'hsl(220, 20%, 25%)',
        700: 'hsl(220, 25%, 18%)',
        800: 'hsl(220, 30%, 12%)',
        900: 'hsl(220, 35%, 8%)',
        950: 'hsl(220, 40%, 5%)',
    },
};

// Spacing - Consistent rhythm
export const spacing = {
    px: '1px',
    0: '0',
    0.5: '0.125rem',  // 2px
    1: '0.25rem',     // 4px
    2: '0.5rem',      // 8px
    3: '0.75rem',     // 12px
    4: '1rem',        // 16px
    5: '1.25rem',     // 20px
    6: '1.5rem',      // 24px
    8: '2rem',        // 32px
    10: '2.5rem',     // 40px
    12: '3rem',       // 48px
    16: '4rem',       // 64px
    20: '5rem',       // 80px
    24: '6rem',       // 96px
};

// Shadows - Depth and elevation
export const shadows = {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',

    // Glow effects for interactive elements
    glow: {
        primary: '0 0 20px hsla(210, 100%, 50%, 0.4)',
        accent: '0 0 20px hsla(180, 75%, 45%, 0.4)',
        success: '0 0 20px hsla(142, 76%, 45%, 0.4)',
    },
};

// Border radius - Smooth, modern curves
export const radius = {
    none: '0',
    sm: '0.25rem',    // 4px
    md: '0.375rem',   // 6px
    lg: '0.5rem',     // 8px
    xl: '0.75rem',    // 12px
    '2xl': '1rem',    // 16px
    '3xl': '1.5rem',  // 24px
    full: '9999px',
};

// Animation - Smooth, purposeful motion
export const animations = {
    durations: {
        fast: '150ms',
        normal: '250ms',
        slow: '350ms',
        slower: '500ms',
    },

    easings: {
        easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
        easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
        easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
        spring: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)', // Elastic spring
    },

    transitions: {
        fast: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
        normal: 'all 250ms cubic-bezier(0.4, 0, 0.2, 1)',
        slow: 'all 350ms cubic-bezier(0.4, 0, 0.2, 1)',
    },
};

// Breakpoints - Responsive design
export const breakpoints = {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
};

// Z-index layers - Consistent stacking
export const zIndex = {
    base: 0,
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modalBackdrop: 1040,
    modal: 1050,
    popover: 1060,
    tooltip: 1070,
    toast: 1080,
};

// Gradients - Premium, distinctive backgrounds
export const gradients = {
    primary: 'linear-gradient(135deg, hsl(210, 100%, 50%) 0%, hsl(180, 75%, 45%) 100%)',
    primaryRadial: 'radial-gradient(circle at top right, hsl(210, 100%, 50%), hsl(180, 75%, 45%))',
    dark: 'linear-gradient(180deg, hsl(220, 30%, 12%) 0%, hsl(220, 40%, 5%) 100%)',
    glass: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
    mesh: `
    radial-gradient(at 40% 20%, hsla(210, 100%, 50%, 0.3) 0px, transparent 50%),
    radial-gradient(at 80% 0%, hsla(180, 75%, 45%, 0.2) 0px, transparent 50%),
    radial-gradient(at 0% 50%, hsla(210, 100%, 30%, 0.2) 0px, transparent 50%)
  `,
};

// Glassmorphism effects
export const glass = {
    light: {
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px) saturate(180%)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
    },
    dark: {
        background: 'rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(10px) saturate(180%)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
    },
};

// Export all as a cohesive design system
export const designTokens = {
    typography,
    colors,
    spacing,
    shadows,
    radius,
    animations,
    breakpoints,
    zIndex,
    gradients,
    glass,
};

export default designTokens;
