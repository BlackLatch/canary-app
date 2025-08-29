# Wizard Style Guide

## Overview
This style guide defines the consistent layout and presentation standards for all wizard steps in the Canary application. Each step should follow a card-based layout with clear visual hierarchy and informative content.

## Layout Structure

### Overall Container
- Each wizard step should use a two-column grid layout on large screens
- Mobile responsive: stacks to single column on smaller screens
- Grid specification: `grid grid-cols-1 lg:grid-cols-2 gap-8`

### Card Components

#### Primary Card (Left Column)
Contains the main interactive elements and form fields for the step.

**Styling:**
```css
Light theme: bg-white border-gray-200
Dark theme: bg-black/40 border-gray-700
Padding: p-6
Border radius: rounded-lg
Border: border
```

**Structure:**
- Optional header with uppercase label
- Form fields or interactive elements
- Clear visual grouping of related elements

#### Explainer Card (Right Column)  
Provides contextual information, guidance, and help text for the current step.

**Styling:**
```css
Light theme: bg-gray-50 border-gray-200
Dark theme: bg-white/5 border-gray-700
Padding: p-6
Border radius: rounded-lg
Border: border
```

**Structure:**
- Informative title (h4 element)
- Explanatory paragraphs
- Bullet points or numbered lists for step-by-step guidance
- Optional sections with dividers for different topics

## Typography

### Headers
- Step title: `editorial-header text-2xl font-bold`
- Card headers: `editorial-label-small uppercase tracking-wider`
- Explainer titles: `text-sm font-semibold`

### Body Text
- Primary text: `editorial-body`
- Secondary text: `text-sm` with appropriate color classes
- Labels: `editorial-label-small`

### Color Scheme
- Light theme primary text: `text-gray-900`
- Light theme secondary text: `text-gray-600` or `text-gray-700`
- Dark theme primary text: `text-gray-100`
- Dark theme secondary text: `text-gray-300` or `text-gray-400`

## Step Components

### Step Header
Each step should have a centered header with:
- Step name (h3)
- Step number indicator (e.g., "Step 2 of 5")
- Consistent spacing: `mb-6` or `mb-8`

### Navigation Buttons
- Place below the card grid
- Full width on mobile, appropriate sizing on desktop
- Clear primary and secondary action distinction
- Disabled states when validation fails

## Content Guidelines

### Explainer Content
Each explainer should:
1. Start with a clear, concise title
2. Provide context for why this step is important
3. Give specific guidance on how to complete the step
4. Include any warnings or important notes
5. Use formatting (bold, lists) to improve readability

### Form Fields
- Clear, descriptive labels
- Helpful placeholder text
- Inline validation messages
- Appropriate input types and constraints

## Accessibility
- Maintain proper heading hierarchy
- Use semantic HTML elements
- Ensure sufficient color contrast
- Provide clear focus states
- Include appropriate ARIA labels where needed

## Examples

### Step 2 (Visibility) - Correct Implementation
- Two distinct cards with clear separation
- Left card contains radio button options
- Right card explains the implications of each choice
- Both cards have consistent padding and borders

### Step 3 (Schedule) - Correct Implementation  
- Left card contains interval selection options
- Right card provides detailed explanation of check-in process
- Visual hierarchy with proper typography classes

### Step 4 (Encrypt) - Correct Implementation
- Left card contains file upload interface
- Right card explains encryption process and technical details
- Clear separation between action and information

## Common Patterns

### Radio Button Groups
```jsx
<div className="space-y-3">
  <label className="flex items-start gap-3 cursor-pointer group">
    <input type="radio" ... />
    <div>
      <div className="font-medium">Option Title</div>
      <div className="text-sm opacity-75">Option description</div>
    </div>
  </label>
</div>
```

### Information Lists
```jsx
<ul className="space-y-2 ml-4">
  <li className="flex items-start">
    <span className="mr-2">•</span>
    <span>List item content</span>
  </li>
</ul>
```

### Section Dividers
```jsx
<div className={`pt-3 mt-3 border-t ${
  theme === 'light' ? 'border-gray-200' : 'border-gray-700'
}`}>
```

## Consistency Checklist
- [ ] Two-column grid layout on desktop
- [ ] Primary card with main content on left
- [ ] Explainer card with guidance on right
- [ ] Consistent card styling (borders, backgrounds, padding)
- [ ] Proper typography classes for all text elements
- [ ] Theme-aware color classes
- [ ] Responsive design for mobile devices
- [ ] Clear visual hierarchy
- [ ] Accessible markup and interactions