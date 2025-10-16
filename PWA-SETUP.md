# PWA Setup Documentation

This project is now configured as a fully-compliant Progressive Web App (PWA).

## What Was Added

### 1. Web App Manifest (`public/manifest.json`)
- Complete PWA manifest with app name, description, and configuration
- Multiple icon sizes (72x72 to 512x512) for different devices
- Standalone display mode for app-like experience
- Proper categorization and metadata

### 2. App Icons
Generated from the existing `canary2.png` in multiple sizes:
- `icon-72x72.png`
- `icon-96x96.png`
- `icon-128x128.png`
- `icon-144x144.png`
- `icon-152x152.png`
- `icon-192x192.png`
- `icon-384x384.png`
- `icon-512x512.png`
- `apple-touch-icon.png` (180x180)
- `favicon-16x16.png`
- `favicon-32x32.png`

### 3. Service Worker
- Implemented using `next-pwa` package
- Automatic registration and activation
- Comprehensive caching strategies:
  - **CacheFirst**: Google Fonts, audio, video (long-term caching)
  - **StaleWhileRevalidate**: Images, fonts, JS, CSS (balance between speed and freshness)
  - **NetworkFirst**: JSON data, API responses, pages (prioritize fresh data)
- Configured to disable in development mode

### 4. PWA Metadata in Layout
Updated `app/layout.tsx` with:
- Proper viewport configuration
- Theme color support (light/dark mode)
- Apple Web App support
- Manifest link
- Favicons and touch icons

### 5. Next.js Configuration
Updated `next.config.js` with:
- `next-pwa` integration
- Runtime caching rules for various asset types
- Service worker configuration
- Static export compatibility

## PWA Features

### Installability
Users can install Canary as a standalone app on:
- Desktop (Chrome, Edge, Safari)
- iOS (Safari - Add to Home Screen)
- Android (Chrome, Firefox, Edge)

### Offline Support
The app will work offline with cached resources:
- Static pages and assets
- Images and fonts
- JavaScript and CSS files
- Previously visited content

### App-Like Experience
- Runs in standalone mode (without browser UI)
- Custom splash screen from icons
- Theme color integration with OS
- Fast loading with caching

## Testing PWA Compliance

### Using Chrome DevTools
1. Build and serve the app: `npm run build && npx serve out`
2. Open Chrome DevTools (F12)
3. Go to "Application" tab
4. Check "Manifest" section - should show all metadata
5. Check "Service Workers" - should show registered worker
6. Run Lighthouse audit (Performance, PWA, etc.)

### Using Lighthouse
```bash
npm install -g lighthouse
lighthouse http://localhost:3000 --view
```

The PWA audit should show:
- ✓ Installable
- ✓ PWA optimized
- ✓ Works offline
- ✓ Has manifest
- ✓ Has icons

### Testing Installation
1. Visit the site in Chrome/Edge
2. Look for install icon in address bar
3. Click "Install" to add to desktop/home screen
4. App should launch in standalone window

## Deployment

When deploying to production:
1. Ensure manifest.json is served with correct MIME type
2. Service worker must be served over HTTPS
3. Icons should be accessible at root level
4. All PWA assets should have proper cache headers

## Development Mode

The service worker is disabled in development mode to avoid caching issues during development. To test PWA features:

```bash
npm run build
npx serve out -l 3000
```

## Maintenance

### Updating Icons
To update app icons, replace `public/canary2.png` and regenerate:

```bash
cd public
for size in 72 96 128 144 152 192 384 512; do
  sips -z $size $size canary2.png --out icon-${size}x${size}.png
done
sips -z 180 180 canary2.png --out apple-touch-icon.png
sips -z 32 32 canary2.png --out favicon-32x32.png
sips -z 16 16 canary2.png --out favicon-16x16.png
```

### Updating Cache Strategy
Edit the `runtimeCaching` configuration in `next.config.js` to modify caching behavior for different asset types.

### Service Worker Updates
When you deploy updates:
1. Service worker will automatically detect changes
2. It will skip waiting and activate immediately
3. Users will get updates on next page load
4. No manual cache clearing needed

## Browser Support

PWA features supported in:
- ✓ Chrome/Edge (Desktop & Mobile) - Full support
- ✓ Safari (iOS 16.4+) - Full support
- ✓ Safari (macOS) - Full support
- ✓ Firefox (Desktop & Mobile) - Partial support
- ✓ Samsung Internet - Full support

## Resources

- [Next.js PWA Documentation](https://github.com/shadowwalker/next-pwa)
- [Web.dev PWA Guide](https://web.dev/progressive-web-apps/)
- [MDN PWA Documentation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
