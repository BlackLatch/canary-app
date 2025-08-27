# Typography Style Guide

## Overview
This document defines the typography standards used across the Canary website. The design emphasizes clean, modern typography with strong hierarchy and excellent readability across all devices.

## Type Scale

### Display Typography
Used for major hero statements and landing page headlines.

| Element | Font Size | Font Weight | Line Height | Letter Spacing | Usage |
|---------|-----------|-------------|-------------|---------------|-------|
| Hero Title | 42px (mobile: 28-36px) | 600 | 1.15 | -0.03em | Main typewriter text on landing |
| Page Title | 100px (mobile: scaled) | Bold | 0.9 | 5px | "CANARY" logo text |
| Display Large | 72px (mobile: 36-48px) | 400 | 1.1 | -1px | Major section headers |

### Headings

| Level | Font Size | Font Weight | Line Height | Letter Spacing | Usage |
|-------|-----------|-------------|-------------|---------------|-------|
| H1 | 64px (mobile: 36px) | 400 | 1.1 | -1px | Feature section titles |
| H2 | 48px (mobile: 28px) | 400-600 | 1.1-1.2 | -1px | Section headers, newsletter title |
| H3 | 32px | 600 | 1.2 | -0.5px | Subsection headers |
| H4 | 24px | 600 | 1.3 | 0 | Card headers |

### Body Text

| Style | Font Size | Font Weight | Line Height | Letter Spacing | Usage |
|-------|-----------|-------------|-------------|---------------|-------|
| Body Large | 18px | 400 | 1.6-1.7 | 0.01-0.5px | Primary descriptive text |
| Body Default | 16px | 300-400 | 1.5-1.65 | 0.01-0.3px | Standard paragraph text |
| Body Small | 14px | 400 | 1.3-1.5 | 0.5-1px | Secondary text, CTAs |
| Caption | 12-13px | 400 | 1.3 | 0.5px | Small labels, metadata |
| Micro | 10-11px | 400 | 1.2-1.4 | 0.3px | Annotations, fine print |

## Font Families

### Primary Font Stack
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
```
Used for: Hero content, primary headings, body text

### Secondary Font Stack
```css
font-family: Arial, Helvetica, sans-serif;
```
Used for: Navigation, buttons, general UI elements

### Accent Font Stack
```css
font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
```
Used for: Special callouts, newsletter descriptions

### Monospace Font
```css
font-family: 'Courier New', monospace;
```
Used for: Step markers, technical indicators

## Color Palette

| Color | Hex Value | Usage |
|-------|-----------|--------|
| Primary Black | #000000 | Main text, high emphasis |
| Dark Gray | #333333 | Body text, secondary headings |
| Medium Gray | #666666 | Supporting text, labels |
| Light Gray | #888888 | Disabled states, tertiary text |
| Soft Gray | #cccccc | Muted text on dark backgrounds |
| Accent Red | #e53e3e | Links, highlights, CTAs |
| White | #ffffff | Text on dark backgrounds |

## Text Styles

### Uppercase Treatment
- Navigation links: `text-transform: uppercase`
- Small labels: `text-transform: uppercase`
- Step labels: `text-transform: uppercase`
- Button text: Often uppercase with increased letter-spacing

### Letter Spacing Guidelines
- Tight (-1px to -0.03em): Large display text
- Normal (0 to 0.3px): Body text
- Wide (0.5px to 1px): Small uppercase labels
- Extra Wide (1px to 5px): Special branding elements

### Line Height Principles
- Tight (0.9 - 1.15): Display text, headlines
- Normal (1.3 - 1.5): Body text, descriptions
- Loose (1.6 - 1.7): Long-form reading text

## Responsive Typography

### Breakpoints
- Desktop: > 1199px (full scale)
- Tablet: 768px - 1199px (90% scale)
- Mobile: < 768px (75-80% scale)
- Small Mobile: < 480px (65-70% scale)

### Scaling Strategy
1. **Hero Title**: 42px → 36px → 28px
2. **Section Headers**: 64px → 48px → 36px → 28px
3. **Body Text**: 18px → 16px → 14px
4. **CTAs**: Maintain minimum 14px for accessibility

## Special Typography Effects

### Typewriter Animation
- Applied to hero text
- Sequential character reveal
- Blinking cursor element
- Capitalize first letter of each word

### Hover States
- Links: Color transition to #e53e3e
- Small navigation text: Scale(1.1) with color change
- Underline animations with ::after pseudo-elements

### Text Shadows
- Feature titles on dark: `text-shadow: 4px 4px 8px rgba(0, 0, 0, 1)`
- Improves legibility on image backgrounds

## Typography Components

### CTA Buttons
```css
font-size: 14px;
font-weight: 400-500;
letter-spacing: 0.02em-1px;
text-transform: none/uppercase (varies);
```

### Navigation Links
```css
font-size: 13-14px;
font-weight: 400;
letter-spacing: 0.5px;
text-transform: uppercase;
```

### Feature Cards
```css
Title: 16-18px, weight: 600
Description: 14px, weight: 400
Subtext: 10-11px, italic
```

### Flow Diagrams
```css
Icons: 14px
Text: 12px, weight: 400
Subtext: 10px, italic
```

## Accessibility Guidelines

### Minimum Sizes
- Body text: Never below 14px
- Interactive elements: Minimum 14px
- Captions: Minimum 10px (use sparingly)

### Contrast Ratios
- Primary text on white: #000000 (21:1)
- Secondary text on white: #333333 (12.6:1)
- Tertiary text on white: #666666 (5.7:1)
- White text on black: #ffffff (21:1)

### Readability
- Maximum line length: ~75 characters for body text
- Adequate line spacing for long text (1.5-1.7)
- Clear hierarchy through size and weight variations

## Implementation Notes

### CSS Variables (Recommended)
```css
:root {
  --font-display: 72px;
  --font-h1: 64px;
  --font-h2: 48px;
  --font-h3: 32px;
  --font-body-lg: 18px;
  --font-body: 16px;
  --font-small: 14px;
  --font-micro: 12px;
  
  --weight-light: 300;
  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;
  --weight-extrabold: 800;
  
  --leading-tight: 1.1;
  --leading-normal: 1.5;
  --leading-loose: 1.7;
  
  --tracking-tight: -0.03em;
  --tracking-normal: 0;
  --tracking-wide: 0.05em;
}
```

### Font Loading Strategy
1. Use system fonts as primary stack for fast loading
2. Optional web fonts loaded asynchronously
3. Font-display: swap for custom fonts
4. Preload critical font files

## Usage Examples

### Hero Section
```css
.hero-title {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 42px;
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.03em;
  color: #000000;
}
```

### Body Paragraph
```css
.body-text {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 16px;
  font-weight: 400;
  line-height: 1.65;
  letter-spacing: 0.01em;
  color: #333333;
}
```

### Button Text
```css
.button {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.02em;
  text-transform: none;
}
```

## Maintenance

This style guide should be updated when:
- New typography patterns are introduced
- Accessibility standards change
- Design system evolves
- Performance optimizations require font changes

Last Updated: 2025-08-26