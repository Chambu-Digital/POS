# Bar Inventory System - Deployment Checklist

## Pre-Deployment (Dev/Staging)

### Data Audit & Fixes
- [ ] Run data audit for all tenants: `npm run audit:bar:all`
- [ ] Review audit report for critical issues
- [ ] Run data fixes if needed: `npm run fix:bar <tenantId>`
- [ ] Verify fixes resolved issues

### Database Indexes
- [ ] Add performance indexes: `npm run indexes:bar:all`
- [ ] Verify indexes created successfully
- [ ] Test query performance improvement

### Testing
- [ ] Run comprehensive test suite for each tenant
  ```bash
  npm run test:complete <tenant1Id>
  npm run test:complete <tenant2Id>
  npm run test:complete <tenant3Id>
  ```
- [ ] Verify pass rate ≥ 80% for all tenants
- [ ] Review failed tests and address issues
- [ ] Test specific features:
  - [ ] Inventory list shows correct open bottle counts
  - [ ] Serving sales report displays
  - [ ] Products sold report shows serving details
  - [ ] Open bottle timeline shows capacity projections
  - [ ] Close a test bottle and verify variance tracking

### Code Review
- [ ] Review all modified files:
  - [ ] `lib/models/schemas.ts` - BarBottleAudit schema
  - [ ] `lib/tenant/get-models.ts` - Model registration
  - [ ] `lib/bar/inventory-engine.ts` - Variance calculation
  - [ ] `app/api/bar/inventory-items/route.ts` - Fixed aggregation
  - [ ] `app/api/bar/bottles/[id]/route.ts` - Capacity projections
  - [ ] `app/api/bar/bottles/[id]/variance/route.ts` - New endpoint
  - [ ] `app/api/bar/reports/serving-sales/route.ts` - New report
  - [ ] `app/api/bar/reports/products-sold/route.ts` - Updated report
  - [ ] `components/bar/bottles/BottleTimelineDrawer.tsx` - UI updates
  - [ ] `components/bar/reports/serving-sales-report.tsx` - New component
- [ ] Verify no breaking changes in API responses
- [ ] Check error handling in all new code
- [ ] Verify TypeScript types are correct

### Documentation
- [ ] Read through PHASE-4-5-6-COMPLETE.md
- [ ] Understand rollback procedures
- [ ] Review monitoring queries
- [ ] Prepare staff training materials

---

## Deployment Day

### Backup
- [ ] **CRITICAL:** Backup production database
  ```bash
  mongodump --uri="mongodb://..." --out=/backup/$(date +%Y%m%d)
  ```
- [ ] Verify backup completed successfully
- [ ] Test backup restore in non-production environment

### Deployment
- [ ] Create deployment branch
  ```bash
  git checkout -b deploy/bar-inventory-v2
  git merge main
  ```
- [ ] Build and test locally
  ```bash
  npm install
  npm run build
  ```
- [ ] Deploy to production
  ```bash
  git pull origin main
  npm install
  npm run build
  pm2 restart all
  ```
- [ ] Verify application started successfully
  ```bash
  pm2 logs
  ```

### Immediate Verification (5 minutes)
- [ ] Application loads without errors
- [ ] No 500 errors in logs
- [ ] Database connections stable
- [ ] Health check endpoint responds

---

## Post-Deployment (30 minutes)

### Smoke Tests - Each Tenant
- [ ] **Inventory List:**
  - [ ] Navigate to bar inventory page
  - [ ] Verify page loads without errors
  - [ ] Check open bottle counts (should show > 1 if multiple open)
  - [ ] Verify total bottles = sealed + open
  - [ ] Check low stock alerts display

- [ ] **Reports:**
  - [ ] Navigate to bar reports
  - [ ] Open "Serving Sales" tab - verify displays
  - [ ] Open "Products Sold" tab - verify "Product - Serving" format
  - [ ] Verify revenue numbers are consistent

- [ ] **Bottle Timeline:**
  - [ ] Click on an open bottle
  - [ ] Verify "Remaining Capacity" section shows
  - [ ] Check capacity projections display correctly
  - [ ] Close drawer

### Functional Tests - Single Tenant
- [ ] **Close a Bottle:**
  - [ ] Open bottle timeline for an open bottle
  - [ ] Click "Close Bottle"
  - [ ] Verify success message
  - [ ] Reopen bottle timeline
  - [ ] Verify "Variance Analysis" section appears
  - [ ] Check variance flag (normal/warning/critical)

- [ ] **Check Audit Record:**
  ```bash
  # In MongoDB
  db.bar_bottle_audits.findOne()
  ```
  - [ ] Verify record has all required fields
  - [ ] Check expectedServings array populated
  - [ ] Check actualServings array populated
  - [ ] Verify varianceFlag is set

### Performance Check
- [ ] Run inventory query and check response time
  ```bash
  time curl "https://api.../bar/inventory-items"
  ```
  - [ ] Should be < 1 second with indexes
- [ ] Check database slow query log
- [ ] Verify no N+1 query issues

---

## Post-Deployment (24 hours)

### Monitoring
- [ ] Check application logs for errors
  ```bash
  pm2 logs | grep ERROR
  ```
- [ ] Monitor database CPU/memory usage
- [ ] Check API response times
- [ ] Review user activity logs

### Data Quality Checks
- [ ] Run comprehensive test suite
  ```bash
  npm run test:complete <tenantId>
  ```
- [ ] Check variance flag distribution
  ```javascript
  db.bar_bottle_audits.aggregate([
    { $group: { _id: "$varianceFlag", count: { $sum: 1 }}}
  ])
  ```
  - [ ] Normal: should be 70-85%
  - [ ] Warning: should be 10-25%
  - [ ] Critical: should be < 10%

- [ ] Check bottle tracking coverage
  ```javascript
  db.bar_tab_lines.aggregate([
    { $match: { servingId: { $ne: null }, voided: false }},
    { $group: {
        _id: null,
        total: { $sum: 1 },
        withBottle: { $sum: { $cond: ["$bottleId", 1, 0] }}
    }},
    { $project: {
        coverage: { $multiply: [
          { $divide: ["$withBottle", "$total"] }, 100
        ]}
    }}
  ])
  ```
  - [ ] Coverage should be > 80%

### User Feedback
- [ ] Check with bartenders using the system
- [ ] Verify capacity projections make sense
- [ ] Ask about variance accuracy
- [ ] Note any confusion points for training

---

## Post-Deployment (7 days)

### Analytics
- [ ] Total bottles closed with variance tracking: __________
- [ ] Variance flag distribution:
  - Normal: _________%
  - Warning: _________%
  - Critical: _________%
- [ ] Average variance percentage: _________%
- [ ] Products with high variance: __________
- [ ] Staff with high variance: __________

### Issues Log
- [ ] Document any issues encountered
- [ ] Note resolution steps taken
- [ ] Update documentation if needed

### Training Needs
- [ ] Identify features needing more training
- [ ] Schedule training sessions if needed
- [ ] Update training materials based on feedback

---

## Rollback Procedure (If Needed)

### When to Rollback
- Critical bugs affecting operations
- Database performance degradation > 50%
- Data corruption detected
- User operations blocked

### Rollback Steps
1. [ ] Stop application
   ```bash
   pm2 stop all
   ```

2. [ ] Revert code
   ```bash
   git revert <deployment-commit>
   npm run build
   ```

3. [ ] Restore database (only if data corruption)
   ```bash
   mongorestore --uri="mongodb://..." /backup/<backup-date>
   ```

4. [ ] Restart application
   ```bash
   pm2 restart all
   ```

5. [ ] Verify rollback successful
   - [ ] Application loads
   - [ ] Core features working
   - [ ] No errors in logs

6. [ ] **Optional:** Drop new collection if needed
   ```javascript
   // Only if collection causing issues
   db.bar_bottle_audits.drop()
   ```

### Post-Rollback
- [ ] Document rollback reason
- [ ] Analyze root cause
- [ ] Create fix plan
- [ ] Schedule re-deployment

---

## Success Criteria

### Immediate (Day 1)
- ✅ Application deployed without errors
- ✅ All smoke tests passed
- ✅ No critical bugs reported
- ✅ Performance acceptable (< 1s response times)

### Short-term (Week 1)
- ✅ Test suite pass rate ≥ 80%
- ✅ Bottle tracking coverage > 80%
- ✅ Variance tracking working for new closures
- ✅ No data quality regressions

### Medium-term (Month 1)
- ✅ Variance flag distribution healthy (< 10% critical)
- ✅ Staff comfortable with new features
- ✅ Capacity projections being used
- ✅ Variance patterns identified for investigation

---

## Contact Information

**Technical Issues:**
- Developer: __________
- Database Admin: __________

**Business Questions:**
- Product Owner: __________
- Operations Manager: __________

**Emergency Contact:**
- On-call Engineer: __________

---

## Notes

_Use this section to document any deployment-specific notes, environment details, or special considerations._

---

**Checklist Version:** 1.0  
**Last Updated:** 2026-08-27  
**Deployment Date:** __________  
**Deployed By:** __________
