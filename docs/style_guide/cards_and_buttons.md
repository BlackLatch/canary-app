# Cards and Buttons Style Guide

## Cards

### Standard Card Style
Cards are the primary container elements used throughout the application for grouping related content.

#### Structure
```jsx
<div className={`border rounded-lg px-6 py-5 ${theme === 'light' ? 'border-gray-300 bg-white' : 'border-gray-600 bg-black/40'}`}>
  {/* Card content */}
</div>
```

#### Key Properties
- **Border**: `border` with `rounded-lg` for 8px border radius
- **Padding**: `px-6 py-5` for consistent internal spacing
- **Light mode**: `border-gray-300 bg-white`
- **Dark mode**: `border-gray-600 bg-black/40` (40% opacity black for subtle transparency)

#### Hover States
For interactive cards:
```jsx
className={`border rounded-lg px-6 py-5 cursor-pointer transition-all 
  ${theme === 'light' 
    ? 'border-gray-300 bg-white hover:bg-gray-50' 
    : 'border-gray-600 bg-black/40 hover:bg-white/5'
  }`}
```

#### Empty State Cards
For empty states (e.g., "No Public Releases Yet"):
- Use the same standard card styling
- Center content with `text-center`
- Add generous padding `py-24` for emphasis
- Include an icon or illustration

## Buttons

### Primary Buttons
Main action buttons with strong visual emphasis.

#### Structure
```jsx
<button className={`px-6 py-3 border rounded-lg font-medium transition-all
  ${theme === 'light' 
    ? 'bg-gray-900 text-white hover:bg-gray-700 border-gray-900' 
    : 'bg-white text-gray-900 hover:bg-gray-100 border-white'
  }`}>
  BUTTON TEXT
</button>
```

#### Key Properties
- **Padding**: `px-6 py-3` for standard size
- **Border**: Matching background color for solid appearance
- **Text**: ALL CAPS with `font-medium`
- **Light mode**: Dark background with white text
- **Dark mode**: White background with dark text (inverted)

### Secondary Buttons
Less prominent actions or alternative choices.

#### Structure
```jsx
<button className={`px-6 py-3 border rounded-lg transition-colors
  ${theme === 'light' 
    ? 'border-gray-300 bg-white hover:bg-gray-50 text-gray-900' 
    : 'border-gray-600 bg-black/40 hover:bg-white/10 text-gray-100'
  }`}>
  BUTTON TEXT
</button>
```

#### Key Properties
- **Border**: Visible border with transparent/subtle background
- **Hover**: Subtle background change
- **Same padding and border radius as primary buttons**

### Disabled States
```jsx
disabled:opacity-50 disabled:cursor-not-allowed
```

### Icon Buttons
For theme toggle, close buttons, etc.
```jsx
<button className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors">
  {/* Icon */}
</button>
```

## Navigation Links

### Structure
```jsx
<button className="nav-link nav-link-active">
  NAVIGATION ITEM
</button>
```

#### Properties (defined in globals.css)
- **Text**: ALL CAPS with letter-spacing
- **Active state**: Underline or different color
- **Hover**: Subtle color change

## Design Principles

1. **Consistency**: All cards and buttons follow the same spacing and border patterns
2. **Contrast**: Dark mode uses pure black (#000000) backgrounds with thin borders
3. **Transparency**: Dark mode cards use `bg-black/40` for subtle depth
4. **Typography**: All buttons and navigation use UPPERCASE text
5. **Accessibility**: Clear hover states and disabled states
6. **Minimalism**: Clean borders, generous padding, subtle interactions