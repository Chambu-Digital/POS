# Sidebar Navigation Structure

## Final Layout

```
┌─────────────────────────────┐
│  [Shop Logo]                │
│  Shop Name                  │
│  Powered by Chambu Digital  │
├─────────────────────────────┤
│  [Branch Selector]          │ (if multi-branch)
├─────────────────────────────┤
│                             │
│  📊 Dashboard               │ ← Static top item
│                             │
│  ▾ Retail                   │ ← Business module (collapsible)
│    ├─ Make Sale             │
│    ├─ Orders                │
│    ├─ Inventory             │
│    ├─ Stock Movements       │
│    ├─ Reports               │
│    └─ Expenses              │
│                             │
│  ▾ Service                  │ ← Business module (collapsible)
│    ├─ ▾ Kitchen             │   ← Sub-domain
│    │   ├─ Orders            │
│    │   ├─ Chef Display      │
│    │   ├─ Waiter View       │
│    │   ├─ History           │
│    │   ├─ Menu Management   │
│    │   └─ Inventory         │
│    └─ ▾ Bar                 │   ← Sub-domain
│        ├─ Tabs              │
│        ├─ Inventory         │
│        ├─ Reports           │
│        └─ Admin             │
│                             │
│  ▸ Rentals                  │ ← Business module (collapsed)
│                             │
│  ▸ Pharmacy                 │ ← Business module (collapsed)
│                             │
│  ─────────────────────────  │ ← Separator
│                             │
│  👥 Customers               │ ← Core feature (flat)
│  🚚 Suppliers               │ ← Core feature (flat)
│  👤 Staff                   │ ← Core feature (flat, admin-only)
│  ⚙️ Settings                │ ← Core feature (flat, admin-only)
│                             │
├─────────────────────────────┤
│  → Logout                   │
└─────────────────────────────┘
```

## Hierarchy Breakdown

### 1. Static Top Section
- **Dashboard**: Always visible, single flat item

### 2. Business Modules Section
- **Retail**: Collapsible group with 6 features
- **Service**: Collapsible group with 2 sub-domains (Kitchen & Bar)
- **Rentals**: Collapsible group with 2 features
- **Pharmacy**: Collapsible group with 5 features

**Characteristics:**
- Optional (can be disabled per tenant)
- Collapsible to save space
- Grouped by business workflow
- May have sub-domains (like Service)

### 3. Separator
- Visual divider (border-t)
- Indicates transition to core features

### 4. Core Features Section (Bottom)
- **Customers**: Customer management
- **Suppliers**: Supplier management
- **Staff**: Employee management (admin-only)
- **Settings**: Business settings (admin-only)

**Characteristics:**
- Always enabled by default
- Always visible (no collapse)
- Flat items (no grouping)
- Quick access from bottom
- Essential business resources

### 5. Static Bottom Section
- **Logout**: Always at the very bottom

## Visibility Rules

### Business Owner (type: 'user')
✅ Sees everything
- Dashboard
- All enabled business modules
- All core features

### Staff (type: 'staff')
✅ Sees based on permissions:
- Dashboard (always)
- Business module features they have permission for
- Core features they have permission for:
  - ✅ Customers (if `core.customers` = true)
  - ✅ Suppliers (if `core.suppliers` = true)
  - ❌ Staff (never - admin-only)
  - ❌ Settings (never - admin-only)

### Guest (not logged in)
- Not applicable (redirected to login)

## Responsive Behavior

### Desktop (lg: breakpoint)
- Sidebar always visible (static)
- Fixed width: 16rem (w-64)
- Scrollable if content overflows

### Mobile (< lg)
- Sidebar hidden by default
- Hamburger menu button (top-left)
- Slides in from left when opened
- Dark overlay behind sidebar
- Tapping overlay closes sidebar

## State Management

### Collapse States
Each collapsible module tracks its own state:
```typescript
const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
  retail: false,    // Expanded by default if active
  service: false,
  rentals: true,    // Collapsed by default
  pharmacy: true,
})
```

### Service Sub-domain States
Kitchen and Bar track separately:
```typescript
const [serviceCollapsed, setServiceCollapsed] = useState<Record<string, boolean>>({
  kitchen: false,
  bar: false,
})
```

## Active State Highlighting

### Current Route
- Active item highlighted with `bg-[hsl(var(--sidebar-accent))]`
- Active text: `text-[hsl(var(--sidebar-accent-foreground))]`
- Inactive text: `text-[hsl(var(--sidebar-foreground))]/80`

### Live Indicators
Certain routes show animated dot when active:
- Kitchen Display (`/dashboard/service/kitchen`)
- Bar POS (`/dashboard/service/bar`)

## Implementation Details

### Core Features Rendering
```typescript
function renderCoreFeatures() {
  const coreModule = MODULES.find(m => m.key === 'core')
  if (!coreModule) return null

  const visibleFeatures = coreModule.features.filter(
    f => features[f.key] === true && canSeeFeature(f)
  )

  return visibleFeatures.map(renderNavItem)
}
```

### Module Rendering
```typescript
function renderModule(mod: ModuleDefinition) {
  // Skip core (rendered separately at bottom)
  if (mod.key === 'core') return null
  
  // Service gets special sub-domain treatment
  if (mod.key === 'service') return renderServiceModule()
  
  // Other modules render as standard collapsible groups
  // ...
}
```

### Render Flow
```typescript
<nav>
  {/* 1. Dashboard */}
  {STATIC_TOP.map(renderNavItem)}
  
  {/* 2. Business Modules */}
  <div className="space-y-1 py-1">
    {MODULES.map(renderModule)}
  </div>
  
  {/* 3. Core Features with separator */}
  <div className="pt-3 mt-3 border-t space-y-0.5">
    {renderCoreFeatures()}
  </div>
</nav>
```

## Design Rationale

### Why Core Features at Bottom?

1. **Always Accessible**: Core features don't compete for attention with workflow-specific modules
2. **Footer Pattern**: Users expect settings/account items at bottom (common UI pattern)
3. **Workspace Priority**: Business modules (Retail, Service) are primary workflows - should be prominent
4. **Visual Hierarchy**: 
   - Top = Current work (Dashboard)
   - Middle = Workflows (Business modules)
   - Bottom = Resources (Core features)
5. **Scroll Behavior**: Business modules expand/collapse; core features stay anchored at bottom

### Why Flat (Not Collapsible)?

1. **Essential Resources**: Always needed, shouldn't require extra click
2. **Low Count**: Only 4 items (Customers, Suppliers, Staff, Settings)
3. **Quick Access**: Frequently used features benefit from immediate access
4. **Visual Weight**: Flat items feel more permanent/essential than nested items

### Why Separator Line?

1. **Visual Distinction**: Clearly separates workflows from resources
2. **Mental Model**: Reinforces "business modules" vs "core features"
3. **Subtle**: Border-t with low opacity doesn't distract

## Testing Checklist

- [ ] Dashboard appears at top
- [ ] Business modules render as collapsible groups
- [ ] Expanding/collapsing modules works
- [ ] Service module shows Kitchen/Bar sub-domains
- [ ] Separator appears before core features
- [ ] Core features render as flat items at bottom
- [ ] Core features respect permissions (staff view)
- [ ] Admin-only core features hidden for staff
- [ ] Active states highlight correctly
- [ ] Mobile hamburger menu works
- [ ] Sidebar scrolls if content overflows
- [ ] Logout button stays at very bottom
