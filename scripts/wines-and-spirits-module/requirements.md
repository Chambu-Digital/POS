# Requirements Document

## Introduction

This document specifies the requirements for a comprehensive Wines & Spirits Module designed for hospitality businesses. The module refactors and extends the existing bar functionality to provide a complete solution for managing bar tabs, liquor inventory, bottle tracking, and service operations. The design philosophy emphasizes speed, minimal clicks, flexible configuration, and strong inventory accountability to match real-world bar operations.

## Glossary

- **System**: The Wines & Spirits Module as a whole
- **Landing_Page**: The main entry point showing open tabs and quick actions
- **Tab**: A running account of drinks served to a customer or table
- **Quick_Sale**: A fast single-transaction sale without opening a tab
- **Brand**: A liquor product brand (e.g., John Walker)
- **Inventory_Item**: A specific size/variant of a brand (e.g., John Walker 1L)
- **Serving**: A configured portion sold from an open bottle
- **Bottle**: Physical liquor bottle with states (Full, Open, Closed)
- **Tab_Manager**: Component that handles tab operations
- **Inventory_Engine**: Component that manages stock and bottle tracking
- **Serving_Engine**: Component that calculates and tracks servings
- **Payment_Handler**: Component that processes tab payments
- **Business_Owner**: User with shop owner privileges
- **Staff_Member**: User with bar staff privileges
- **Bar_Module**: The combined wines and spirits functionality

## Requirements

### Requirement 1: Landing Page

**User Story:** As a bar staff member, I want to see open tabs and quick actions on the landing page, so that I can quickly access the most relevant information and start work immediately.

#### Acceptance Criteria

1. WHEN the Bar_Module loads, THE Landing_Page SHALL display all Open Tabs as the primary workspace
2. WHEN the Bar_Module loads, THE Landing_Page SHALL display the Total Outstanding Amount across all Open Tabs
3. WHEN the Bar_Module loads, THE Landing_Page SHALL display Recently Closed Tabs
4. THE Landing_Page SHALL provide a Quick Sale button for immediate single transactions
5. THE Landing_Page SHALL provide a New Tab button to open a new customer tab
6. THE Landing_Page SHALL NOT display a product search interface at the landing level

### Requirement 2: Open Tab Creation

**User Story:** As a bar staff member, I want to open a new tab with minimal information, so that I can quickly start serving customers without interruption.

#### Acceptance Criteria

1. WHEN a Staff_Member clicks New Tab, THE Tab_Manager SHALL prompt for Customer Name
2. WHEN a Staff_Member clicks New Tab, THE Tab_Manager SHALL prompt for Table Number
3. WHEN a Staff_Member clicks New Tab, THE Tab_Manager SHALL prompt for Notes
4. THE Tab_Manager SHALL accept empty values for Customer Name, Table Number, and Notes
5. WHEN a Tab is created, THE Tab_Manager SHALL assign a unique Tab identifier
6. WHEN a Tab is created, THE Tab_Manager SHALL set the Tab status to Open
7. WHEN a Tab is created, THE Tab_Manager SHALL initialize the Running Balance to zero

### Requirement 3: Quick Sale Workflow

**User Story:** As a bar staff member, I want to make a quick sale without creating a tab, so that I can serve walk-up customers efficiently.

#### Acceptance Criteria

1. WHEN a Staff_Member clicks Quick Sale, THE System SHALL prompt for Product search
2. WHEN a Product is searched, THE System SHALL display all matching Inventory_Items for the selected Brand
3. WHEN an Inventory_Item is selected, THE System SHALL offer Sell Bottle and Serve options
4. WHEN Sell Bottle is selected, THE System SHALL proceed directly to Payment
5. WHEN Serve is selected, THE System SHALL display configured Serving options for the selected Inventory_Item
6. WHEN Payment is completed, THE System SHALL generate a Receipt
7. WHEN a Quick Sale is completed, THE System SHALL close the transaction without creating a Tab

### Requirement 4: Product Structure

**User Story:** As a business owner, I want to organize products by Brand and Inventory Item, so that I can manage different sizes and variants independently.

#### Acceptance Criteria

1. THE System SHALL support Brand entities with a unique Brand name
2. THE System SHALL support Inventory_Item entities linked to a Brand
3. WHEN an Inventory_Item is created, THE System SHALL require a Size specification
4. WHEN an Inventory_Item is created, THE System SHALL require a Buying Price
5. WHEN an Inventory_Item is created, THE System SHALL require a Selling Price for bottle sales
6. THE System SHALL maintain separate stock quantities for each Inventory_Item
7. THE System SHALL allow multiple Inventory_Items per Brand

### Requirement 5: Dynamic Serving Configuration

**User Story:** As a business owner, I want to configure custom serving options per inventory item, so that I can match my business's unique serving practices without hardcoded limitations.

#### Acceptance Criteria

1. THE System SHALL allow Business_Owner to define Serving options for each Inventory_Item
2. WHEN a Serving is defined, THE System SHALL require a Serving Name
3. WHEN a Serving is defined, THE System SHALL require a Selling Price
4. WHEN a Serving is defined, THE System SHALL require Units Produced per bottle
5. THE System SHALL NOT calculate Units Produced from milliliter values
6. THE System SHALL accept Business_Owner-specified Units Produced values
7. THE System SHALL allow unlimited Serving options per Inventory_Item
8. THE System SHALL store Serving configurations independently per Inventory_Item

### Requirement 6: Selling Workflow

**User Story:** As a bar staff member, I want a clear workflow for selling bottles or servings, so that I can process sales accurately and quickly.

#### Acceptance Criteria

1. WHEN a Staff_Member searches for a Product, THE System SHALL display matching Brands
2. WHEN a Brand is selected, THE System SHALL display all associated Inventory_Items
3. WHEN an Inventory_Item is selected, THE System SHALL offer Sell Bottle option
4. WHEN an Inventory_Item is selected, THE System SHALL offer Serve option
5. WHEN Sell Bottle is selected, THE Inventory_Engine SHALL deduct one sealed bottle from stock immediately
6. WHEN Sell Bottle is selected, THE System SHALL proceed to payment or add to tab
7. WHEN Serve is selected, THE System SHALL display all configured Serving options for the selected Inventory_Item

### Requirement 7: Bottle State Tracking

**User Story:** As a bar manager, I want to track bottle states and transitions, so that I can maintain inventory accountability and detect losses.

#### Acceptance Criteria

1. THE System SHALL track Bottle states as Full, Open, or Closed
2. WHEN a Serving is first sold from an Inventory_Item with no Open Bottle, THE System SHALL prompt to Open New Bottle
3. WHEN a Staff_Member opens a new Bottle, THE Inventory_Engine SHALL create an Open Bottle record
4. WHEN a Staff_Member opens a new Bottle, THE Inventory_Engine SHALL record the Staff_Member identifier
5. WHEN a Staff_Member opens a new Bottle, THE Inventory_Engine SHALL record the timestamp
6. WHEN a Staff_Member opens another Bottle, THE Inventory_Engine SHALL close the previous Open Bottle
7. WHEN a Bottle is closed, THE Inventory_Engine SHALL record the Actual Units Sold
8. WHEN a Bottle is closed, THE Inventory_Engine SHALL calculate the Difference between Expected Units and Actual Units Sold
9. THE System SHALL allow only one Open Bottle per Inventory_Item at any time

### Requirement 8: Bottle Difference Tracking

**User Story:** As a bar manager, I want to see differences between expected and actual servings per bottle, so that I can identify losses, spillage, or theft.

#### Acceptance Criteria

1. WHEN a Bottle is closed, THE Inventory_Engine SHALL calculate Expected Units from the Inventory_Item configuration
2. WHEN a Bottle is closed, THE Inventory_Engine SHALL retrieve Actual Units Sold from transaction records
3. WHEN a Bottle is closed, THE Inventory_Engine SHALL compute Difference as Expected Units minus Actual Units Sold
4. THE Inventory_Engine SHALL store Bottle Number, Product, Opened By, Opened At, Closed At, Expected Units, Actual Units, and Difference
5. WHEN a Staff_Member attempts to open another Bottle, THE System SHALL display remaining units in the current Open Bottle
6. WHEN remaining units exceed a threshold, THE System SHALL prompt for confirmation before opening another Bottle

### Requirement 9: Inventory Deduction Rules

**User Story:** As a bar manager, I want inventory to reflect real-time physical operations, so that stock levels are accurate at all times.

#### Acceptance Criteria

1. WHEN a sealed Bottle is sold, THE Inventory_Engine SHALL deduct one unit from sealed bottle stock immediately
2. WHEN a Serving is sold from an Open Bottle, THE Inventory_Engine SHALL deduct the serving units from the Open Bottle units immediately
3. WHEN a Staff_Member opens another Bottle, THE Inventory_Engine SHALL close the previous Bottle and update Actual Units Sold
4. WHEN a Staff_Member opens a new Bottle, THE Inventory_Engine SHALL deduct one sealed bottle from stock
5. THE Inventory_Engine SHALL maintain separate counts for sealed bottles and open bottle units
6. WHEN an item is added to a Tab, THE Inventory_Engine SHALL deduct inventory immediately

### Requirement 10: Tab Operations

**User Story:** As a bar staff member, I want to manage multiple tabs simultaneously with unlimited items and running balances, so that I can handle busy service periods efficiently.

#### Acceptance Criteria

1. THE Tab_Manager SHALL support multiple Open Tabs simultaneously
2. THE Tab_Manager SHALL maintain a Running Balance for each Tab
3. WHEN an item is added to a Tab, THE Tab_Manager SHALL update the Running Balance immediately
4. THE Tab_Manager SHALL allow unlimited items to be added to a Tab
5. THE Tab_Manager SHALL support adding liquor, beer, food, soft drinks, and other product categories to a Tab
6. WHEN an item is added to a Tab, THE Inventory_Engine SHALL deduct inventory immediately
7. THE Tab_Manager SHALL allow Tab closure only after Payment is recorded

### Requirement 11: Partial Payments Architecture

**User Story:** As a business owner, I want the system to support partial payments in the future, so that I can accommodate customers who pay in multiple installments.

#### Acceptance Criteria

1. THE Payment_Handler SHALL store Payment records with Amount and Payment Method
2. THE Payment_Handler SHALL support multiple Payment records per Tab
3. THE Tab_Manager SHALL compute Remaining Balance as Total Amount minus sum of Payment amounts
4. THE System SHALL reserve the partial payments interface for future implementation
5. THE System SHALL NOT enforce single-payment-only constraint in the data model

### Requirement 12: Tab Status Management

**User Story:** As a bar staff member, I want to control tab status transitions, so that I can manage customer billing workflow smoothly.

#### Acceptance Criteria

1. THE Tab_Manager SHALL support Tab statuses: Open, Hold, Billing, and Paid
2. WHEN a Tab is created, THE Tab_Manager SHALL set status to Open
3. WHEN a Staff_Member places a Tab on Hold, THE Tab_Manager SHALL set status to Hold
4. WHEN a Staff_Member resumes a Tab from Hold, THE Tab_Manager SHALL set status to Open
5. WHEN a Staff_Member requests a Bill, THE Tab_Manager SHALL set status to Billing
6. WHEN Payment is completed, THE Tab_Manager SHALL set status to Paid
7. WHILE a Tab status is Hold, THE Tab_Manager SHALL prevent adding new items
8. WHILE a Tab status is Billing, THE Tab_Manager SHALL prevent adding new items
9. WHILE a Tab status is Paid, THE Tab_Manager SHALL prevent any modifications

### Requirement 13: Payment Processing

**User Story:** As a bar staff member, I want to process payments via multiple methods, so that I can accommodate customer preferences.

#### Acceptance Criteria

1. THE Payment_Handler SHALL support Cash payment method
2. THE Payment_Handler SHALL support Card payment method
3. THE Payment_Handler SHALL support Mobile Money payment method
4. WHEN Cash payment is selected, THE Payment_Handler SHALL prompt for Amount Given
5. WHEN Amount Given exceeds Total Amount, THE Payment_Handler SHALL calculate and display Change
6. WHEN Mobile Money payment is selected, THE Payment_Handler SHALL prompt for Transaction Code
7. WHEN Mobile Money payment is selected, THE Payment_Handler SHALL prompt for Customer Phone Number
8. WHEN Payment is completed, THE Payment_Handler SHALL record Payment Method, Amount, and Transaction identifiers

### Requirement 14: Reports

**User Story:** As a bar manager, I want comprehensive reports on sales, inventory, and bottle differences, so that I can monitor performance and accountability.

#### Acceptance Criteria

1. THE System SHALL provide an Open Tabs report showing all tabs with Open status
2. THE System SHALL provide a Closed Tabs report showing all tabs with Paid status
3. THE System SHALL provide an Outstanding Balances report showing sum of unpaid tab balances
4. THE System SHALL provide a Bottle Differences report showing all closed bottles with Expected, Actual, and Difference values
5. THE System SHALL provide a Products Sold report showing quantity and revenue per product
6. THE System SHALL provide a Top Selling Brands report showing products ranked by sales volume
7. THE System SHALL provide a Bottle History report showing open and close events per bottle
8. THE System SHALL provide a Staff Difference Report showing total differences per Staff_Member

### Requirement 15: User Experience

**User Story:** As a bar staff member, I want a fast, touch-friendly interface with minimal popups, so that I can work efficiently during busy service periods.

#### Acceptance Criteria

1. THE System SHALL use large touch-friendly buttons with minimum target size of 44 pixels
2. THE System SHALL minimize popup dialogs to critical workflows only
3. THE System SHALL provide fast navigation between tabs, menu, and order screens
4. THE System SHALL minimize typing requirements by offering selection-based inputs
5. THE System SHALL use consistent dialog patterns across all workflows
6. THE System SHALL provide responsive layouts optimized for tablets and desktop
7. THE System SHALL support keyboard shortcuts for common actions
8. WHEN on mobile devices, THE System SHALL adapt layouts to single-column views

### Requirement 16: Brand Management

**User Story:** As a business owner, I want to create and manage liquor brands independently of inventory items, so that I can organize my product catalog logically.

#### Acceptance Criteria

1. THE System SHALL provide a Brand creation interface
2. WHEN creating a Brand, THE System SHALL require a Brand Name
3. WHEN creating a Brand, THE System SHALL accept optional Description
4. WHEN creating a Brand, THE System SHALL accept optional Category
5. THE System SHALL prevent duplicate Brand Names
6. THE System SHALL allow editing Brand details
7. THE System SHALL allow archiving Brands without deleting historical data

### Requirement 17: Inventory Item Management

**User Story:** As a business owner, I want to manage inventory items with independent stock tracking, so that I can handle different bottle sizes and pricing.

#### Acceptance Criteria

1. THE System SHALL provide an Inventory_Item creation interface linked to a Brand
2. WHEN creating an Inventory_Item, THE System SHALL require Size specification
3. WHEN creating an Inventory_Item, THE System SHALL require Buying Price
4. WHEN creating an Inventory_Item, THE System SHALL require Bottle Selling Price
5. WHEN creating an Inventory_Item, THE System SHALL require initial Stock Quantity
6. THE System SHALL track Stock Quantity independently per Inventory_Item
7. THE System SHALL provide low stock alerts when Stock Quantity falls below a threshold
8. THE System SHALL allow editing Inventory_Item details except historical transaction data

### Requirement 18: Serving Option Management

**User Story:** As a business owner, I want to configure serving options for each inventory item with custom names and prices, so that I can match my business's serving practices exactly.

#### Acceptance Criteria

1. THE System SHALL provide a Serving configuration interface per Inventory_Item
2. WHEN adding a Serving, THE System SHALL require a Name
3. WHEN adding a Serving, THE System SHALL require a Selling Price
4. WHEN adding a Serving, THE System SHALL require Units Produced per bottle
5. THE System SHALL NOT auto-calculate Units Produced from volume measurements
6. THE System SHALL accept any positive integer for Units Produced
7. THE System SHALL allow multiple Servings per Inventory_Item
8. THE System SHALL allow editing and deleting Servings
9. THE System SHALL prevent deleting Servings with historical transaction data

### Requirement 19: Bottle Opening Workflow

**User Story:** As a bar staff member, I want a clear workflow for opening bottles when servings are requested, so that inventory tracking remains accurate.

#### Acceptance Criteria

1. WHEN a Serving is requested for an Inventory_Item with no Open Bottle, THE System SHALL display an Open New Bottle prompt
2. WHEN a Staff_Member confirms Open New Bottle, THE Inventory_Engine SHALL deduct one sealed bottle from stock
3. WHEN a Staff_Member confirms Open New Bottle, THE Inventory_Engine SHALL create an Open Bottle record with Expected Units from Serving configuration
4. WHEN an Open Bottle exists, THE System SHALL deduct servings from the Open Bottle units
5. WHEN a Staff_Member requests to open another Bottle, THE System SHALL display current Open Bottle remaining units
6. WHEN remaining units exceed a configurable threshold, THE System SHALL prompt for confirmation
7. WHEN a Staff_Member confirms opening another Bottle, THE Inventory_Engine SHALL close the current Bottle and open a new one

### Requirement 20: Access Control

**User Story:** As a business owner, I want to control which staff members can access bar module features, so that I can enforce security and accountability.

#### Acceptance Criteria

1. THE System SHALL integrate with the existing Staff permissions model
2. THE System SHALL check Staff_Member permissions before allowing access to Bar_Module features
3. THE System SHALL restrict Bottle Difference reports to Business_Owner and Manager roles
4. THE System SHALL restrict Serving configuration to Business_Owner role
5. THE System SHALL allow Staff_Member role to process sales and manage tabs
6. THE System SHALL log Staff_Member identifier for all inventory and sales operations

### Requirement 21: Module Integration

**User Story:** As a business owner, I want the bar module to integrate seamlessly with existing POS features, so that I can use shared customers, payments, and reporting.

#### Acceptance Criteria

1. THE System SHALL integrate with the existing Customer model for tab customer selection
2. THE System SHALL integrate with the existing Sale model for transaction recording
3. THE System SHALL mark bar sales with source field set to 'bar'
4. THE System SHALL support existing payment methods: Cash, Card, and Mobile Money
5. THE System SHALL contribute bar sales to existing dashboard statistics
6. THE System SHALL use existing Branch model for multi-branch inventory tracking
7. THE System SHALL integrate with the existing Staff model for permissions and audit trails

### Requirement 22: Data Model Requirements

**User Story:** As a developer, I want clear data schemas for brands, inventory items, servings, bottles, and tabs, so that I can implement the system correctly.

#### Acceptance Criteria

1. THE System SHALL define a Brand schema with fields: name, description, category, createdAt, updatedAt
2. THE System SHALL define an InventoryItem schema with fields: brandId, size, buyingPrice, bottleSellingPrice, stock, lowStockThreshold
3. THE System SHALL define a Serving schema with fields: inventoryItemId, name, sellingPrice, unitsProduced
4. THE System SHALL define a Bottle schema with fields: inventoryItemId, state, openedBy, openedAt, closedAt, expectedUnits, actualUnitsSold, difference
5. THE System SHALL define a BarTab schema with fields: tabNumber, customerName, tableNumber, notes, status, lines, payments, openedAt, closedAt
6. THE System SHALL define a TabLine schema with fields: tabId, inventoryItemId, servingId, quantity, price, addedAt
7. THE System SHALL index all schemas by userId and branchId for multi-tenant and multi-branch support

### Requirement 23: Offline Resilience

**User Story:** As a bar staff member, I want the system to handle network interruptions gracefully, so that I can continue working during connectivity issues.

#### Acceptance Criteria

1. WHEN a Sale API call fails, THE System SHALL display an error notification
2. WHEN a Sale API call fails, THE System SHALL continue processing the sale locally
3. THE System SHALL mark failed sales with synced field set to false
4. THE System SHALL provide a background sync mechanism for unsynced sales
5. THE System SHALL not block Tab operations during network errors

### Requirement 24: Reusable Serving Engine

**User Story:** As a developer, I want the serving engine to be generic and reusable, so that it can support other portion-based industries in the future.

#### Acceptance Criteria

1. THE Serving_Engine SHALL operate on generic Unit and Portion abstractions
2. THE Serving_Engine SHALL not hardcode liquor-specific terminology
3. THE Serving_Engine SHALL accept Business_Owner-defined portion counts without domain assumptions
4. THE Serving_Engine SHALL support portion tracking for any divisible inventory item
5. THE Serving_Engine architecture SHALL be documented for reuse in pizza, cake, cheese, and other portion-based industries

### Requirement 25: Mobile Responsiveness

**User Story:** As a bar staff member using a tablet, I want the interface to adapt to my screen size, so that I can work comfortably on mobile devices.

#### Acceptance Criteria

1. WHEN the System is accessed on screens below 1024px width, THE System SHALL switch to mobile layout
2. WHEN in mobile layout, THE System SHALL provide navigation between Tabs, Menu, and Order panels
3. WHEN in mobile layout, THE System SHALL display one panel at a time
4. WHEN in mobile layout, THE System SHALL provide clear navigation indicators
5. THE System SHALL use viewport-relative sizing for touch targets
6. THE System SHALL prevent horizontal scrolling on mobile devices

### Requirement 26: Search and Filter

**User Story:** As a bar staff member, I want to search and filter products quickly, so that I can find items during busy service periods.

#### Acceptance Criteria

1. THE System SHALL provide a search input on the product menu screen
2. WHEN a Staff_Member types in the search input, THE System SHALL filter products by name in real-time
3. THE System SHALL provide category filter buttons for Spirits, Beer, Wine, Cocktails, Shots, and Soft Drinks
4. WHEN a category filter is selected, THE System SHALL display only products in that category
5. THE System SHALL combine search and category filters with AND logic
6. THE System SHALL display a count of filtered results

### Requirement 27: Transaction Audit Trail

**User Story:** As a bar manager, I want complete audit trails for all inventory and sales operations, so that I can investigate discrepancies and ensure accountability.

#### Acceptance Criteria

1. THE System SHALL log all bottle open and close events with Staff_Member identifier and timestamp
2. THE System SHALL log all serving transactions with Staff_Member identifier and timestamp
3. THE System SHALL log all tab operations with Staff_Member identifier and timestamp
4. THE System SHALL log all inventory adjustments with reason and Staff_Member identifier
5. THE System SHALL provide an audit log report filtered by date range, Staff_Member, and operation type
6. THE System SHALL prevent deletion or modification of audit log records

### Requirement 28: Discount and Adjustments

**User Story:** As a bar staff member, I want to apply discounts to tabs, so that I can accommodate promotions and customer requests.

#### Acceptance Criteria

1. THE Tab_Manager SHALL support percentage-based discounts on tabs
2. WHEN billing a Tab, THE System SHALL offer preset discount options: 0%, 5%, 10%, 15%, 20%
3. WHEN a discount is applied, THE Tab_Manager SHALL recalculate the Total Amount
4. WHEN a discount is applied, THE Tab_Manager SHALL record the discount percentage in the Tab record
5. THE System SHALL display subtotal, discount amount, and final total clearly
6. THE System SHALL record discounts in Sale records for reporting

### Requirement 29: Existing Code Migration

**User Story:** As a developer, I want to refactor the existing bar module incrementally, so that I can preserve working functionality and minimize risk.

#### Acceptance Criteria

1. THE System SHALL preserve the existing bar.tabs feature key in modules registry
2. THE System SHALL refactor the existing /api/bar/sale endpoint to support new data structures
3. THE System SHALL preserve existing Sale model integration
4. THE System SHALL reuse existing Customer, Staff, and Payment models
5. THE System SHALL migrate the existing BarPage component to new workflows
6. THE System SHALL maintain backward compatibility with existing bar sales data

### Requirement 30: Performance Requirements

**User Story:** As a bar staff member, I want fast response times for all operations, so that I can serve customers without delays.

#### Acceptance Criteria

1. WHEN a product search is performed, THE System SHALL display results within 200 milliseconds
2. WHEN a Tab is opened, THE System SHALL complete the operation within 300 milliseconds
3. WHEN an item is added to a Tab, THE System SHALL update the UI within 100 milliseconds
4. WHEN Payment is processed, THE System SHALL complete the operation within 500 milliseconds excluding external payment gateway delays
5. THE System SHALL load the Landing_Page within 1 second on standard tablet hardware

