# Tab Navigation - Payment Dialog

## How It Works

The payment dialog uses **focus trapping** (Radix UI Dialog standard behavior). This means:

✅ **Tab key cycles ONLY through elements inside the dialog**  
✅ **Cannot Tab to elements outside the dialog** (by design, for accessibility)  
✅ **Shift+Tab goes backwards** through the tab order

## Tab Order in Payment Dialog

### 1. Payment Method Dropdown
- **Focus:** Tab lands here first (or click to focus)
- **Open:** Press `Space` or `Enter` 
- **Navigate:** Use `↑` `↓` arrow keys
- **Select:** Press `Enter`
- **Close without selecting:** Press `Esc`

### 2. Amount Input Field
- **Focus:** Tab from payment method
- **Auto-focuses** after selecting payment method
- **Type** amount directly
- **Submit:** Press `Enter` (triggers payment)

### 3. M-Pesa Fields (if M-Pesa selected)
- **Phone Number Field** - Tab to focus
- **Transaction Code Field** - Tab to focus (if manual entry)

### 4. Process Payment Button
- **Focus:** Tab from last field
- **Submit:** Press `Enter` or `Space`

### 5. Close Button (X)
- **Focus:** Tab from Process Payment button
- **Close:** Press `Enter` or `Space`
- **Cycles back:** Tab again returns to Payment Method dropdown

## Quick Workflows

### Cash Payment (Keyboard Only)
```
1. Click "Process Payment" (or mouse to open dialog)
2. Tab → Focus on Payment Method dropdown
3. Space → Open dropdown
4. ↓ or C → Select "Cash" 
5. Enter → Confirm selection
6. (Amount auto-focuses)
7. Type amount (e.g., "5000")
8. Enter → Complete payment
```

### M-Pesa Payment (Keyboard Only)
```
1. Open dialog
2. Tab → Payment Method
3. Space → Open
4. ↓↓ or M → Select "M-Pesa"
5. Enter → Confirm
6. (Amount auto-focuses)
7. Type amount
8. Tab → Phone number field
9. Type phone
10. Tab → Process Payment button
11. Enter → Complete
```

## Why Tab Doesn't Move to Background

**This is intentional!** 

Radix UI Dialog implements **focus trap** to:
- ✅ Keep keyboard users inside the dialog
- ✅ Prevent accidental interaction with background
- ✅ Meet WCAG accessibility standards
- ✅ Ensure modal behavior is clear

If you need to cancel:
- Press `Esc` to close dialog
- Or Tab to Close button (X) and press Enter

## Testing Tab Navigation

1. Open payment dialog
2. Press `Tab` repeatedly
3. You should cycle through:
   - Payment Method dropdown
   - Amount field
   - M-Pesa fields (if M-Pesa selected)
   - Process Payment button
   - Close button (X)
   - Back to Payment Method dropdown

4. At NO point should Tab move to background elements

## Troubleshooting

**Tab does nothing:**
- Click inside the dialog first to ensure it has focus
- Check if another modal/popup is blocking

**Tab skips a field:**
- Field might be hidden or disabled
- Select a payment method first (amount field hidden until method selected)

**Can't select from dropdown:**
- Use `Space` or `Enter` to open (not Tab)
- Use arrow keys to navigate items
- Press `Enter` to select

---

**Last Updated:** 2026-09-20
**Component:** Payment Dialog
**Library:** Radix UI Dialog + Select
