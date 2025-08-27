# Fonts Report - Canary Website

## Font Families Used

### 1. System Font Stack (Primary)
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
```
**Usage Locations:**
- Hero typewriter text (app/globals.module.css:294)
- Description text (app/globals.module.css:334)
- CTA buttons (app/globals.module.css:358)
- Desktop layouts (app/globals.module.css:1411-2682)
- Primary content throughout desktop view

**Purpose:** Native system fonts for optimal performance and platform consistency

### 2. Arial Font Stack (Secondary)
```css
font-family: Arial, Helvetica, sans-serif;
```
**Usage Locations:**
- Main container (app/globals.module.css:3)
- Logo title (app/globals.module.css:119)
- Headers (app/page.module.css:119)
- Small navigation text (app/globals.module.css:159)
- Feature titles and descriptions (app/globals.module.css:553-593)
- Newsletter title (app/globals.module.css:1339)
- All mobile layouts (app/page.module.css:274-1028)

**Purpose:** Fallback sans-serif for consistent cross-platform rendering

### 3. Arial Sans-Serif (Simplified)
```css
font-family: Arial, sans-serif;
```
**Usage Locations:**
- Title element (app/globals.module.css:119)

**Purpose:** Minimal fallback stack for branding elements

### 4. Inter Font Stack
```css
font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
```
**Usage Locations:**
- Hover explanations (app/globals.module.css:241)
- Newsletter descriptions (app/globals.module.css:1095, 1349)

**Purpose:** Modern, refined typography for special UI elements

### 5. Courier New (Monospace)
```css
font-family: 'Courier New', monospace;
```
**Usage Locations:**
- Step markers (app/globals.module.css:942, 1258)
- Desktop step numbers (app/globals.module.css:2449)

**Purpose:** Technical/code-like appearance for numbered elements

### 6. Generic Serif
```css
font-family: serif;
```
**Usage Locations:**
- Ethereum icon (app/globals.module.css:1485, 2624)

**Purpose:** Decorative element for cryptocurrency symbol

## Font Loading Strategy

### Current Implementation
- **No custom web fonts loaded** - Zero external font dependencies
- **100% system fonts** - Instant rendering, no FOUT/FOIT
- **No @font-face declarations** - No custom font files
- **No font CDN links** - No Google Fonts, Adobe Fonts, etc.

### Performance Benefits
1. **Zero font download time**
2. **No render blocking**
3. **Native OS rendering** - Optimal for each platform
4. **Smallest possible bundle** - No font files in assets

## Font Weights Used

| Weight | Value | Usage Count | Primary Use Cases |
|--------|-------|-------------|-------------------|
| Light | 300 | 3 | Hover explanations, newsletter descriptions |
| Regular | 400 | 44 | Body text, descriptions, most UI elements |
| Medium | 500 | 2 | CTA buttons |
| Semi-Bold | 600 | 8 | Hero text, step labels, headings |
| Bold | 700 | 10 | Desktop titles, navigation emphasis |
| Extra-Bold | 800 | 3 | Special links with emphasis |
| Black | 900 | 1 | Desktop step numbers |

## Font Sizes Distribution

### Display Sizes (>48px)
- 100px - Logo title
- 72px - Magazine layout title
- 64px - Feature titles, section headers
- 56px - Mobile hero text
- 48px - Cursors, major headings

### Heading Sizes (24-48px)
- 42px - Desktop hero typewriter
- 36px - Mobile variants
- 32px - Subsection headers
- 28px - Small screen headings
- 24px - Flow icons

### Body Sizes (14-20px)
- 18px - Primary descriptions
- 16px - Standard body text
- 14px - Buttons, navigation, secondary text

### Small Sizes (<14px)
- 13px - Navigation links
- 12px - Flow text, micro labels
- 11px - Feature subtext
- 10px - Flow subtext

## Font Rendering Properties

### Letter Spacing
- **Tight:** -1px to -0.03em (headlines)
- **Normal:** 0 to 0.3px (body)
- **Wide:** 0.5px to 1px (labels)
- **Extra Wide:** 5px (logo only)

### Line Heights
- **Compressed:** 0.9 (logo)
- **Tight:** 1.1 - 1.15 (headlines)
- **Normal:** 1.3 - 1.5 (body)
- **Relaxed:** 1.6 - 1.7 (reading text)

### Text Transforms
- **uppercase:** Navigation, labels, small text
- **capitalize:** Hero typewriter text
- **none:** Body content

## Platform-Specific Rendering

### macOS/iOS
- Primary: `-apple-system` (San Francisco)
- Fallback: `Helvetica, Arial`

### Windows
- Primary: `Segoe UI`
- Fallback: `Arial`

### Android
- Primary: `Roboto`
- Fallback: `Arial, sans-serif`

### Linux
- Primary: System default
- Fallback: `Arial, sans-serif`

## Accessibility Considerations

### Minimum Font Sizes
- Desktop: 10px (sparingly used)
- Mobile: 14px (body minimum)
- Interactive: 14px (buttons/links)

### Font Weight Contrast
- Regular (400) for body
- Semi-bold (600) for emphasis
- Bold (700) for headers
- Ensures clear visual hierarchy

## Recommendations

### Current Strengths
1. **Excellent performance** - No external fonts
2. **Platform consistency** - Native rendering
3. **Clear hierarchy** - Well-defined weight/size system
4. **Good fallback chain** - Progressive enhancement

### Potential Optimizations
1. Consider CSS custom properties for font stacks
2. Implement `font-display: swap` if adding web fonts
3. Use `size-adjust` for font stack consistency
4. Consider variable fonts if custom fonts needed

## Summary

The Canary website uses a **100% system font strategy** with no external font dependencies. This approach prioritizes:
- **Performance** - Zero font loading time
- **Consistency** - Native OS rendering
- **Accessibility** - System fonts respect user preferences
- **Maintainability** - No font licensing or hosting concerns

Total unique font families: **6** (all system/generic)
Total custom web fonts: **0**
External font dependencies: **None**
