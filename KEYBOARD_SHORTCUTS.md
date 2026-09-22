# Keyboard Shortcuts - POS System

## Payment Page

### Main Actions (F-Keys)
| Key | Action | Description |
|-----|--------|-------------|
| `F1` | Cancel Order | Cancels current order and returns to sales page |
| `F2` | Hold Order | Saves order for later and returns to sales page |
| `F3` | Process Payment | Opens payment method dialog |

### Payment Method Selection (Number Keys)
| Key | Payment Method |
|-----|---------------|
| `1` | Cash |
| `2` | M-Pesa |
| `3` | Card |
| `4` | Credit (Pay Later) |

### Amount Field Shortcuts
| Key | Action | Description |
|-----|--------|-------------|
| `Ctrl + E` | Exact Amount | Auto-fills the exact cart total |
| `Ctrl + 0` | Zero | Sets amount to 0 (for credit sales) |
| `Enter` | Submit / Next | Submits payment or moves to next field |

### Dialog Navigation
| Key | Action |
|-----|--------|
| `Tab` | Move to next field |
| `Shift + Tab` | Move to previous field |
| `Esc` | Close dialog |
| `Enter` | Submit current action |

## Quick Cash Sale Workflow

**3 keystrokes to complete a cash sale:**
```
F3 → 1 → Enter
```

1. Press `F3` to open payment dialog
2. Press `1` to select Cash (amount auto-fills)
3. Press `Enter` to complete payment

## M-Pesa Sale Workflow

**STK Push:**
```
F3 → 2 → (type phone) → Enter
```

**Manual Entry:**
```
F3 → 2 → Tab → Tab → (type code) → Enter
```

## Sales Page (Main POS)

### Cart Navigation
| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate between cart items |
| `+` | Increase quantity of selected item |
| `-` | Decrease quantity of selected item |
| `Delete` | Remove selected item from cart |

### Completion
| Key | Action |
|-----|--------|
| `Enter` | Complete sale (when Complete Sale button focused) |

## Order Completion Dialog

| Key | Action |
|-----|--------|
| `←` / `→` | Navigate between Print / New Sale buttons |
| `Enter` | Select focused button |

## Tips for Cashiers

1. **Keep hands on keyboard** - All critical actions have keyboard shortcuts
2. **Use F3 liberally** - Opens payment dialog from anywhere on payment page
3. **Number keys are fastest** - Memorize 1-4 for payment methods
4. **Ctrl+E for exact change** - Quick way to fill exact amount
5. **ESC to cancel** - Closes dialogs without mouse

## Accessibility

All keyboard shortcuts work without mouse interaction, supporting:
- Fast cashier workflows during rush hours
- Touchscreen-less setups
- Users with motor disabilities
- Offline/low-resource environments

---

**Last Updated:** 2026-09-20
**Applies To:** Payment Page, Sales Page, Order Completion
