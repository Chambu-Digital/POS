# Offline/No Internet Error Handling - Testing Guide

## Overview
This document provides instructions for testing the offline error handling implementation across the POS application.

## What Was Fixed
Previously, when the internet connection was lost, pages would show "Page not found" or generic error messages. Now, the application properly detects offline state and shows clear "No Internet Connection" messages with retry functionality.

## Features Implemented

### 1. Network Detection Utilities (`lib/network.ts`)
- `isOnline()` - Check browser online status
- `isNetworkError()` - Detect network-related errors
- `parseNetworkError()` - Classify errors as network/server/unknown
- `onNetworkChange()` - Listen for online/offline events

### 2. Offline UI Components (`components/offline-indicator.tsx`)
- **Banner variant**: Thin persistent bar at top
- **Inline variant**: Card within page content
- **Fullpage variant**: Centered full-screen message
- **LoadingOrOffline wrapper**: Simplifies loading/offline state management

### 3. API Client Wrapper (`lib/api-client.ts`)
- Automatic network error detection
- Timeout handling (30s default)
- Retry functionality
- Structured error responses

### 4. Error Boundaries
- **Root error boundary** (`app/error.tsx`): Catches app-wide errors
- **Dashboard error boundary** (`app/dashboard/error.tsx`): Dashboard-specific errors

### 5. Global Network Status Provider
- Persistent banner when offline
- Toast notifications on connection changes
- Applied to all dashboard pages

### 6. Updated Pages
All major dashboard pages now handle offline state:
- Dashboard home (`/dashboard`)
- Orders (`/dashboard/orders`)
- Staff management (`/dashboard/staff`)
- Customers (`/dashboard/customers`)
- Settings (`/dashboard/settings`)

---

## Testing Instructions

### Prerequisites
- Development server running (`npm run dev`)
- Browser with DevTools (Chrome/Edge recommended)

### Test 1: Simulate Offline Mode (Chrome DevTools)

1. **Open the application** in Chrome
2. **Open DevTools** (F12 or Ctrl+Shift+I)
3. **Go to Network tab**
4. **Enable offline mode**:
   - Click the "No throttling" dropdown
   - Select "Offline"

#### Expected Results:
- ✅ A red banner appears at the top: "No internet connection. Some features may not work."
- ✅ A toast notification shows: "No internet connection - You are currently offline"

5. **Navigate to different pages**:
   - `/dashboard` - Dashboard home
   - `/dashboard/orders` - Orders page
   - `/dashboard/staff` - Staff page
   - `/dashboard/customers` - Customers page
   - `/dashboard/settings` - Settings page

#### Expected Results for Each Page:
- ✅ Shows loading spinner briefly
- ✅ Displays offline indicator with appropriate message
- ✅ Shows "Retry" button
- ✅ NO "Page not found" error
- ✅ NO generic error messages

6. **Click the Retry button** (while still offline)

#### Expected Results:
- ✅ Attempt to reload fails gracefully
- ✅ Offline message persists
- ✅ No crashes or console errors

7. **Go back online**:
   - In Network tab, change from "Offline" to "No throttling"

#### Expected Results:
- ✅ Red banner disappears
- ✅ Toast notification shows: "Connection restored - You are back online"
- ✅ Click "Retry" button now successfully loads data

---

### Test 2: Simulate Slow Network

1. **Open DevTools Network tab**
2. **Select "Slow 3G" throttling**
3. **Navigate to pages with data loading**:
   - `/dashboard/orders`
   - `/dashboard/staff`
   - `/dashboard/customers`

#### Expected Results:
- ✅ Loading spinner shows for longer
- ✅ Eventually loads successfully (no timeout errors for < 30s)
- ✅ If timeout occurs (>30s), shows appropriate timeout message

---

### Test 3: Disconnect Physical Network

1. **Disconnect your WiFi or unplug ethernet cable**
2. **Navigate to different dashboard pages**

#### Expected Results:
- ✅ Same behavior as Test 1
- ✅ Offline banner appears
- ✅ Pages show offline indicators instead of errors

3. **Reconnect network**

#### Expected Results:
- ✅ Banner disappears
- ✅ Toast shows "Connection restored"
- ✅ Retry buttons work

---

### Test 4: API Server Unavailable (500 Errors)

1. **Stop the API server** (if you can control it)
2. **Navigate to dashboard pages**

#### Expected Results:
- ✅ Should show "Server error" messages (NOT "No internet")
- ✅ Different error handling for server errors vs network errors
- ✅ Error boundaries catch and display appropriately

---

### Test 5: Mixed Scenarios

1. **Load a page successfully**
2. **Go offline while on the page**
3. **Try to perform an action** (e.g., create new staff, update settings)

#### Expected Results:
- ✅ Action fails with network error
- ✅ Toast notification shows connection issue
- ✅ User can retry after going back online

---

### Test 6: Error Boundary Fallback

1. **Go to any dashboard page**
2. **Simulate an unexpected error** (can be done by modifying code temporarily or using browser console)

#### Expected Results:
- ✅ Error boundary catches the error
- ✅ Shows appropriate error UI (not white screen)
- ✅ Provides retry/home navigation options

---

## Manual Testing Checklist

### Dashboard Home Page (`/dashboard`)
- [ ] Shows offline indicator when offline
- [ ] Retry button works when back online
- [ ] Loading state displays properly
- [ ] No "Page not found" error

### Orders Page (`/dashboard/orders`)
- [ ] Sales orders tab handles offline
- [ ] Kitchen orders tab handles offline
- [ ] Retry functionality works for both tabs
- [ ] Filters and search work after reconnection

### Staff Page (`/dashboard/staff`)
- [ ] Staff list shows offline indicator
- [ ] Create/Edit operations fail gracefully when offline
- [ ] Delete operations show network error
- [ ] Retry loads staff list successfully

### Customers Page (`/dashboard/customers`)
- [ ] Customer list handles offline
- [ ] Search continues to work offline with cached data
- [ ] Credit operations fail with proper message
- [ ] Retry button works

### Settings Page (`/dashboard/settings`)
- [ ] Settings load with offline handling
- [ ] Save operations show network error when offline
- [ ] All settings tabs handle offline state
- [ ] Retry reloads settings

---

## Browser Compatibility Testing

Test in multiple browsers:
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (if on Mac)
- [ ] Mobile browsers (Chrome/Safari on mobile)

---

## Success Criteria

✅ **Primary Goal**: No more "Page not found" errors when offline
✅ **User Experience**: Clear feedback about connection status
✅ **Functionality**: Retry mechanism works correctly
✅ **Consistency**: All major pages handle offline state
✅ **Visual Feedback**: Banner and toast notifications work
✅ **Graceful Degradation**: App doesn't crash when offline

---

## Known Limitations

1. **Some pages may not be updated yet**: Only critical dashboard pages were updated. Other modules (bar, pharmacy, rentals, etc.) may need similar updates.

2. **Cached data**: The POS sales page already has offline support via IndexedDB, so it behaves differently.

3. **Auto-retry**: Currently manual retry only. Future enhancement could add automatic retry when connection is restored.

4. **Background sync**: Only shows notification, doesn't automatically reload data. User must click retry.

---

## Troubleshooting

### Issue: Banner doesn't appear when offline
**Solution**: Check browser console for errors. Verify NetworkStatusProvider is wrapping the app in layout.tsx

### Issue: Retry button doesn't work
**Solution**: Check that the page is using apiGet/apiPost instead of raw fetch

### Issue: Still seeing "Page not found"
**Solution**: Page may not have been updated yet. Check if it's using LoadingOrOffline component

### Issue: Error boundaries not catching errors
**Solution**: Verify error.tsx files exist in app/ and app/dashboard/ directories

---

## Development Notes

### To add offline handling to a new page:

1. **Import utilities**:
```typescript
import { apiGet, handleApiError } from '@/lib/api-client'
import { LoadingOrOffline } from '@/components/offline-indicator'
```

2. **Add state**:
```typescript
const [loading, setLoading] = useState(true)
const [isOffline, setIsOffline] = useState(false)
```

3. **Update fetch function**:
```typescript
async function fetchData() {
  setLoading(true)
  setIsOffline(false)
  
  const result = await apiGet('/api/endpoint')
  
  if (result.success && result.data) {
    // Handle success
  } else if (result.error) {
    setIsOffline(result.error.isOffline)
    toast.error(handleApiError(result.error))
  }
  
  setLoading(false)
}
```

4. **Wrap render**:
```typescript
<LoadingOrOffline
  isLoading={loading}
  isOffline={isOffline}
  onRetry={fetchData}
>
  {/* Your content */}
</LoadingOrOffline>
```

---

## Next Steps / Future Enhancements

1. **Auto-retry**: Automatically retry failed requests when connection is restored
2. **Offline queue**: Queue mutations (create/update/delete) to execute when back online
3. **Service worker**: Enhanced offline caching with service workers
4. **Update remaining pages**: Apply offline handling to all modules
5. **Progressive enhancement**: Better offline experience with cached data
6. **Network quality indicator**: Show connection quality (slow/fast)
7. **Offline mode toggle**: Manual offline mode for testing

---

## Files Modified

### New Files:
- `lib/network.ts` - Network detection utilities
- `lib/api-client.ts` - API wrapper with offline detection
- `components/offline-indicator.tsx` - Offline UI components
- `components/network-status-provider.tsx` - Global status monitoring
- `app/error.tsx` - Root error boundary
- `app/dashboard/error.tsx` - Dashboard error boundary

### Modified Files:
- `app/dashboard/layout.tsx` - Added NetworkStatusProvider
- `app/dashboard/page.tsx` - Dashboard home with offline handling
- `app/dashboard/orders/page.tsx` - Orders with offline handling
- `app/dashboard/staff/page.tsx` - Staff with offline handling
- `app/dashboard/customers/page.tsx` - Customers with offline handling
- `app/dashboard/settings/page.tsx` - Settings with offline handling

---

## Testing Complete! ✅

After completing all tests above, the offline error handling feature is ready for production use.
