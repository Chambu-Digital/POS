# Number Input Fix - Complete Solution

## Problem
Number inputs caused poor UX when editing:
- Typing "9" in a field with "6" → becomes "69" instead of "9"
- User had to manually select/delete before typing

## Solution Applied

### Two Different Approaches Based on Context:

#### 1. **Empty Fields (Configuration Inputs)** → Use Placeholders
For fields that start empty (Lead Time, Safety Buffer, Budget):
- Changed default from `'7'` to `''` (empty string)
- Placeholder shows suggested value: `placeholder="7"`
- API calls use fallback: `parseInt(leadTime) || 7`

#### 2. **Existing Values (Editing Inputs)** → Auto-select on Focus
For fields editing existing values (Basket prices, PO quantities):
- Added `onFocus={(e) => e.target.select()}`
- When clicked, all text is selected
- Typing replaces the selected text
- Standard spreadsheet/form behavior

## Changes Made

### 1. Restocking Configuration Inputs ✅

**File:** `app/dashboard/restocking/page.tsx`

#### State Initialization
```typescript
// Changed to empty strings
const [leadTime, setLeadTime] = useState('')
const [safetyBuffer, setSafetyBuffer] = useState('')
```

#### API Calls with Fallbacks
```typescript
leadTimeDays: parseInt(leadTime) || 7,
safetyBufferDays: parseInt(safetyBuffer) || 2,
```

### 2. Basket Editing Inputs ✅

**File:** `app/dashboard/restocking/page.tsx`

#### Quantity Input
```tsx
<Input
  type="number"
  min="1"
  value={item.quantity || ''}
  onChange={(e) => {
    const val = parseInt(e.target.value) || 1
    if (val > 0) {
      handleUpdateBasketQuantity(item.moduleItemId, item.module, val)
    }
  }}
  onFocus={(e) => e.target.select()}  // ← Auto-select on focus
  className="h-6 w-16 text-center text-sm p-1"
/>
```

#### Price Input
```tsx
<Input
  type="number"
  min="0"
  step="0.01"
  value={item.unitPrice || ''}
  onChange={(e) => {
    const val = parseFloat(e.target.value) || 0
    if (val >= 0) {
      handleUpdateBasketPrice(item.moduleItemId, item.module, val)
    }
  }}
  onFocus={(e) => e.target.select()}  // ← Auto-select on focus
  className="h-6 w-24 text-sm p-1"
/>
```

### 3. PO Detail Desktop Edit Mode ✅

**File:** `app/dashboard/restocking/purchase-orders/[id]/page.tsx`

#### Quantity Input
```tsx
<Input
  type="number"
  min="1"
  value={item.quantity || ''}
  onChange={(e) => updateEditedItem(index, 'quantity', e.target.value)}
  onFocus={(e) => e.target.select()}  // ← Auto-select on focus
  className="w-20 h-8 text-right ml-auto"
/>
```

#### Unit Price Input
```tsx
<Input
  type="number"
  min="0"
  step="0.01"
  value={item.unitPrice || ''}
  onChange={(e) => updateEditedItem(index, 'unitPrice', e.target.value)}
  onFocus={(e) => e.target.select()}  // ← Auto-select on focus
  className="w-28 h-8 text-right ml-auto"
/>
```

### 4. PO Detail Mobile Edit Mode ✅

**File:** `app/dashboard/restocking/purchase-orders/[id]/page.tsx`

#### Mobile Card Quantity Input
```tsx
<Input
  type="number"
  min="1"
  value={item.quantity || ''}
  onChange={(e) => updateEditedItem(index, 'quantity', e.target.value)}
  onFocus={(e) => e.target.select()}  // ← Auto-select on focus
  className="w-full h-10"
/>
```

#### Mobile Card Price Input
```tsx
<Input
  type="number"
  min="0"
  step="0.01"
  value={item.unitPrice || ''}
  onChange={(e) => updateEditedItem(index, 'unitPrice', e.target.value)}
  onFocus={(e) => e.target.select()}  // ← Auto-select on focus
  className="w-full h-10"
/>
```

## Summary of Fixed Inputs

| Location | Input Type | Fix Applied |
|----------|-----------|-------------|
| Generate Restock → Lead Time | Config | Placeholder |
| Generate Restock → Safety Buffer | Config | Placeholder |
| Assisted Restock → Budget | Config | Placeholder |
| Assisted Restock → Lead Time | Config | Placeholder |
| Assisted Restock → Safety Buffer | Config | Placeholder |
| Basket → Quantity | Edit | Auto-select |
| Basket → Unit Price | Edit | Auto-select |
| PO Detail Desktop → Quantity | Edit | Auto-select |
| PO Detail Desktop → Unit Price | Edit | Auto-select |
| PO Detail Mobile → Quantity | Edit | Auto-select |
| PO Detail Mobile → Unit Price | Edit | Auto-select |

## Already Correct (No Changes Needed)

- Min/Max quantity filters → Already use empty strings ✅
- Settings page → Uses database values ✅

## Benefits

1. **Configuration inputs**: Empty field = ready to type, placeholder shows suggestion
2. **Editing inputs**: Click selects all → type to replace (standard UX)
3. **No more "09"**: Typing "9" now properly shows "9"
4. **Consistent behavior**: Same pattern across all restocking pages

## Testing Checklist

### Configuration Inputs
- [ ] Leave Lead Time empty → defaults to 7
- [ ] Leave Safety Buffer empty → defaults to 2
- [ ] Type in empty field → shows typed value

### Basket Editing
- [ ] Click price "6" → selects "6"
- [ ] Type "9" → replaces with "9" (not "69")
- [ ] Click quantity → selects all
- [ ] Type replaces selected value

### PO Editing (Desktop)
- [ ] Click quantity in table → selects all
- [ ] Type replaces value
- [ ] Click unit price → selects all
- [ ] Type replaces value

### PO Editing (Mobile)
- [ ] Tap quantity input → selects all
- [ ] Type replaces value
- [ ] Tap price input → selects all
- [ ] Type replaces value
