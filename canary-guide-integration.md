# Canary Guide - Standalone Integration

This package provides a completely portable and standalone version of the Canary guide that can be integrated into any application without dependencies or merge conflicts.

## 📦 What's Included

- `standalone-guide.html` - Complete HTML file with embedded CSS and JavaScript
- `CanaryGuideStandalone.jsx` - React component version
- `canary-guide-integration.md` - This integration guide

## 🚀 Integration Options

### Option 1: HTML Integration (Zero Dependencies)

The simplest way to integrate - just include the HTML file:

```html
<!-- Direct inclusion -->
<iframe src="path/to/standalone-guide.html" width="100%" height="100vh" frameborder="0"></iframe>

<!-- Or embed the content directly -->
<div id="canary-guide-container">
  <!-- Copy content from standalone-guide.html -->
</div>
```

### Option 2: React Component Integration

For React applications:

```jsx
import CanaryGuideStandalone from './CanaryGuideStandalone';

function App() {
  return (
    <div>
      <CanaryGuideStandalone />
    </div>
  );
}
```

### Option 3: Vue.js Integration

Convert to Vue component:

```vue
<template>
  <div class="canary-guide" :style="containerStyle">
    <!-- Component content here -->
  </div>
</template>

<script>
export default {
  name: 'CanaryGuide',
  data() {
    return {
      containerStyle: {
        // Copy styles from React component
      }
    }
  }
}
</script>
```

### Option 4: Angular Integration

Create Angular component:

```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-canary-guide',
  template: `
    <div class="canary-guide" [ngStyle]="containerStyle">
      <!-- Component content here -->
    </div>
  `,
  styles: [`
    /* Copy styles from standalone version */
  `]
})
export class CanaryGuideComponent {
  containerStyle = {
    // Copy styles here
  };
}
```

## 🎨 Customization

### Colors and Branding

The guide uses CSS custom properties for easy theming:

```css
:root {
  --canary-bg-color: #2a2a2a;
  --canary-card-bg: #ffffff;
  --canary-text-primary: #333;
  --canary-text-secondary: #666;
  --canary-accent: #f5f5f5;
}
```

### Logo Replacement

Replace the placeholder logo with your own:

```html
<!-- In HTML version -->
<div class="logo">
  <img src="your-logo.png" alt="Your Logo" />
</div>
```

```jsx
// In React version
<div style={styles.logo}>
  <img src="your-logo.png" alt="Your Logo" style={{width: '120px', height: 'auto'}} />
</div>
```

### Content Customization

All text content can be easily modified by changing the text in the respective sections:

- Sidebar content
- Feature descriptions
- Step descriptions
- Tags and labels

## 📱 Responsive Design

The guide includes responsive breakpoints:

- Desktop: Full layout with sidebar
- Tablet (< 1200px): Stacked layout
- Mobile (< 768px): Single column layout

## 🔧 Configuration Options

### Environment Variables

```javascript
const CANARY_CONFIG = {
  showLogo: true,
  showSidebar: true,
  enableAnimations: true,
  theme: 'dark', // 'dark' | 'light'
  customColors: {
    primary: '#2a2a2a',
    secondary: '#ffffff',
    accent: '#f5f5f5'
  }
};
```

### Feature Toggles

```javascript
const FEATURES = {
  circularDesign: true,
  stepBlocks: true,
  animatedGrid: true,
  connectionLines: true
};
```

## 🚀 Deployment

### Static Hosting

1. Upload `standalone-guide.html` to your web server
2. Access via direct URL: `https://yoursite.com/canary-guide.html`

### CDN Integration

```html
<script src="https://cdn.yoursite.com/canary-guide.js"></script>
<div id="canary-guide-mount"></div>
<script>
  CanaryGuide.mount('#canary-guide-mount');
</script>
```

### Docker Container

```dockerfile
FROM nginx:alpine
COPY standalone-guide.html /usr/share/nginx/html/index.html
EXPOSE 80
```

## 🔒 Security Considerations

- No external dependencies = reduced attack surface
- All assets embedded = no external requests
- CSP-friendly = no inline scripts in production version
- GDPR compliant = no tracking or analytics

## 🧪 Testing

### Browser Compatibility

Tested on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Performance

- Initial load: < 50KB
- No external dependencies
- Optimized animations
- Mobile-friendly

## 📋 Migration Checklist

- [ ] Choose integration method (HTML/React/Vue/Angular)
- [ ] Replace placeholder logo with your branding
- [ ] Customize colors and theme
- [ ] Test responsive design
- [ ] Verify animations work
- [ ] Test in target browsers
- [ ] Deploy to staging environment
- [ ] Performance test
- [ ] Deploy to production

## 🆘 Troubleshooting

### Common Issues

**Animations not working:**
- Check CSS keyframes are included
- Verify browser supports CSS animations

**Layout broken on mobile:**
- Ensure viewport meta tag is present
- Check responsive CSS is loaded

**Logo not displaying:**
- Verify image path is correct
- Check image format is supported

**Styling conflicts:**
- Use CSS specificity or CSS modules
- Prefix all classes with unique namespace

## 📞 Support

For integration support:
- Check this documentation first
- Review the source code comments
- Test in isolation before integrating

## 🔄 Updates

This standalone version is designed to be:
- **Stable**: No breaking changes to the API
- **Portable**: Works across different environments
- **Maintainable**: Easy to update content without code changes

## 📄 License

This standalone guide package is designed for easy integration and can be modified as needed for your specific use case. 