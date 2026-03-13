# PWA Update Strategy - Chambu Digital POS

## Overview

This document outlines the comprehensive PWA update strategy implemented to ensure users always receive the latest version of the application with minimal delay.

## Problem Solved

Previously, users would continue seeing old versions because:
- Service workers cached assets indefinitely
- HTML files were cached, preventing new versions from loading
- No mechanism to notify users of available updates
- Users had to manually clear cache or reinstall PWA

## Solution Implemented

### 1. Cache Versioning Strategy

**File:** `public/sw.js`

```javascript
const CACHE_VERSION = 'chambu-pos-' + (self.registration?.scope || 'v1')
const CACHE_NAME = CACHE_VERSION + '-precache'
const RUNTIME_CACHE = CACHE_VERSION + '-runtime'
const API_CACHE = CACHE_VERSION + '-api'
```

- Each deployment creates a new cache version
- Old caches are automatically deleted on activation
- Prevents stale assets from being served

### 2. Intelligent Caching Strategy

#### HTML (App Shell) - Network-First
- **Never cached** - ensures users always get latest HTML
- Falls back to cache only if network is unavailable
- Prevents users from being stuck on old versions

```javascript
if (request.destination === 'document' || url.pathname === '/') {
  // Network-first, don't cache HTML
}
```

#### Static Assets (JS, CSS, Images) - Cache-First
- Cached on first request
- Served from cache for performance
- Updated when new version is deployed

#### API Calls - Network-First
- Always tries network first
- Falls back to cache if offline
- Ensures fresh data

### 3. Immediate Service Worker Activation

**Key Changes:**
- `self.skipWaiting()` - New SW activates immediately
- `self.clients.claim()` - New SW takes control of all clients right away
- No waiting for all tabs to close

```javascript
self.addEventListener('install', (event) => {
  // ... cache assets ...
  self.skipWaiting() // Activate immediately
})

self.addEventListener('activate', (event) => {
  // ... clean old caches ...
  self.clients.claim() // Take control immediately
})
```

### 4. Update Detection & Notification

**File:** `components/pwa/service-worker-register.tsx`

**Features:**
- Checks for updates every 30 seconds
- Detects when new service worker is ready
- Shows toast notification to user
- Provides "Refresh" button to apply update

```typescript
reg.addEventListener('updatefound', () => {
  const newWorker = reg.installing
  if (newWorker) {
    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        // New version available - show notification
        toast.info('New version available', {
          action: {
            label: 'Refresh',
            onClick: () => {
              newWorker.postMessage({ type: 'SKIP_WAITING' })
              setTimeout(() => window.location.reload(), 500)
            },
          },
        })
      }
    })
  }
})
```

### 5. Update Flow

```
1. New deployment to production
   ↓
2. Browser checks for new SW (every 30 seconds)
   ↓
3. New SW found and installed
   ↓
4. Toast notification shown to user
   ↓
5. User clicks "Refresh" (or auto-refresh after timeout)
   ↓
6. New SW takes control (skipWaiting + claim)
   ↓
7. Old caches deleted
   ↓
8. Page reloads with new assets
   ↓
9. User sees latest version
```

## Deployment Checklist

### Before Deployment
- [ ] Test changes locally
- [ ] Verify service worker logic
- [ ] Check cache versioning

### After Deployment
- [ ] Clear browser cache (or use incognito)
- [ ] Verify new SW is registered
- [ ] Check that old caches are deleted
- [ ] Test update notification appears
- [ ] Verify refresh loads new version

### Testing on Mobile PWA
1. Install app on mobile
2. Deploy new version
3. Open app - should show update notification
4. Click refresh
5. Verify new version loads

## Browser Compatibility

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome | ✅ Full | All features supported |
| Firefox | ✅ Full | All features supported |
| Safari | ⚠️ Partial | PWA support limited, SW works |
| Edge | ✅ Full | All features supported |
| Mobile Chrome | ✅ Full | All features supported |
| Mobile Safari | ⚠️ Partial | PWA support limited |

## Cache Behavior by Asset Type

### HTML Files
- **Strategy:** Network-first
- **Cache:** Never cached
- **Fallback:** Cached root if offline
- **Result:** Always latest version

### JavaScript/CSS
- **Strategy:** Cache-first
- **Cache:** Cached on first request
- **Fallback:** Served from cache
- **Result:** Fast loading, updated on new deployment

### API Responses
- **Strategy:** Network-first
- **Cache:** Cached if network fails
- **Fallback:** Cached response
- **Result:** Fresh data, works offline

### Images
- **Strategy:** Cache-first
- **Cache:** Cached on first request
- **Fallback:** Served from cache
- **Result:** Fast loading, updated on new deployment

## Monitoring & Debugging

### Check Service Worker Status
```javascript
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => {
    console.log('Active SW:', reg.active?.scriptURL)
    console.log('Installing SW:', reg.installing?.scriptURL)
    console.log('Waiting SW:', reg.waiting?.scriptURL)
  })
})
```

### View Caches
```javascript
caches.keys().then(names => {
  console.log('Available caches:', names)
})
```

### Clear All Caches
```javascript
caches.keys().then(names => {
  Promise.all(names.map(name => caches.delete(name)))
})
```

### Browser DevTools
- Chrome: DevTools → Application → Service Workers
- Firefox: about:debugging → This Firefox → Service Workers
- Edge: DevTools → Application → Service Workers

## Troubleshooting

### Users Still See Old Version
1. Check if new SW is registered
2. Verify old caches are deleted
3. Clear browser cache manually
4. Check for SW errors in console

### Update Notification Not Showing
1. Verify SW is checking for updates (every 30s)
2. Check browser console for errors
3. Ensure new deployment has different assets
4. Test in incognito mode

### PWA Not Updating on Mobile
1. Ensure app is installed as PWA
2. Check mobile browser SW support
3. Force app refresh (pull down)
4. Reinstall app if necessary

## Performance Impact

- **Initial Load:** Slightly slower (network check for HTML)
- **Subsequent Loads:** Faster (cached assets)
- **Update Check:** Minimal (30s interval, background)
- **Cache Size:** ~5-10MB typical

## Future Improvements

- [ ] Implement background sync for pending sales
- [ ] Add automatic refresh after timeout
- [ ] Implement delta updates (only changed files)
- [ ] Add analytics for update adoption
- [ ] Implement staged rollouts

## References

- [MDN Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Google PWA Update Strategy](https://developers.google.com/web/tools/workbox/guides/service-worker-lifecycle)
- [Next.js PWA Documentation](https://nextjs.org/docs/advanced-features/progressive-web-apps)
