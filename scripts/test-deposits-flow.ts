/**
 * End-to-end test for the customer-deposits feature.
 *
 * Exercises the three-day scenario we designed around:
 *   1. Take a deposit (real cash by method)         → customer.depositBalance up
 *   2. Pickup sale paid by deposit (internal xfer)  → deposit drawn down, stock out
 *   3. Mixed sale (deposit + cash)                  → both totals move correctly
 *   4. Refund the remaining deposit                 → cash outflow, balance to 0
 *   5. Fetch the end-of-day report                   → deposit sections populated
 *
 * Run against your dev server (npm run dev in another terminal):
 *   npx tsx scripts/test-deposits-flow.ts
 *
 * Reads credentials + base URL from env (defaults shown):
 *   DEPOSIT_TEST_BASE_URL  (default http://localhost:3000)
 *   DEPOSIT_TEST_EMAIL     (default admin@example.com)
 *   DEPOSIT_TEST_PASSWORD  (default admin)
 *
 * The script creates its own throwaway customer ("Deposit-Test <timestamp>") so
 * it won't pollute real data. Delete it afterwards if you like.
 */

const BASE = process.env.DEPOSIT_TEST_BASE_URL || 'http://localhost:3000'
const EMAIL = process.env.DEPOSIT_TEST_EMAIL || 'admin@example.com'
const PASSWORD = process.env.DEPOSIT_TEST_PASSWORD || 'admin'

// ── tiny HTTP client with a cookie jar ──────────────────────────────────────
const cookies: string[] = []
async function api(path: string, opts: RequestInit = {}): Promise<any> {
  const headers: Record<string, string> = { ...(opts.headers as any) }
  if (cookies.length) headers['cookie'] = cookies.join('; ')
  const res = await fetch(BASE + path, { ...opts, headers })
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) {
    // Node collapses multiple Set-Cookie into one header separated by commas;
    // grab just the name=value part of each.
    setCookie.split(/,(?=\s*[A-Za-z_-]+=)/).forEach((c) => {
      const kv = c.split(';')[0].trim()
      if (kv) {
        const name = kv.split('=')[0]
        const idx = cookies.findIndex((c) => c.startsWith(name + '='))
        if (idx >= 0) cookies[idx] = kv
        else cookies.push(kv)
      }
    })
  }
  const body = await res.json().catch(() => ({}))
  return { status: res.status, body }
}

let pass = 0
let fail = 0
function check(label: string, cond: boolean, detail?: any) {
  if (cond) {
    pass++
    console.log(`  ✓ ${label}`)
  } else {
    fail++
    console.log(`  ✗ ${label}`)
    if (detail !== undefined) console.log(`      got: ${JSON.stringify(detail)}`)
  }
}
const money = (n: number) => `KSh ${n.toLocaleString()}`

async function main() {
  console.log(`\n Deposits end-to-end test`)
  console.log(`  base: ${BASE}`)
  console.log(`  user: ${EMAIL}\n`)

  // ── 0. Login ────────────────────────────────────────────────────────────────
  console.log('[0] Login')
  const login = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (login.status !== 200) {
    console.log(`  ✗ login failed (${login.status}): ${JSON.stringify(login.body)}`)
    return
  }
  console.log('  ✓ logged in')

  // Resolve a branch (deposits + sales + report all need branch context)
  const me = await api('/api/auth/me')
  const branches = me.body?.user?.branches || me.body?.branches || []
  let branchId = ''
  if (branches.length > 0) {
    branchId = branches[0]._id || branches[0].id || ''
    await api('/api/auth/select-branch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId }),
    })
    console.log(`  ✓ branch selected: ${branchId}`)
  } else {
    console.log('  ! no branches found — tests may fail without branch context')
  }

  // ── 1. Create a throwaway customer ─────────────────────────────────────────
  console.log('\n[1] Create test customer')
  const custName = `Deposit-Test ${Date.now()}`
  const custRes = await api('/api/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: custName, phone: '0700000000' }),
  })
  check('customer created', custRes.status === 201, custRes.body)
  const customerId = custRes.body?.customer?._id
  if (!customerId) {
    console.log('  ✗ cannot proceed without a customer id')
    return
  }

  // ── 2. Take a deposit of 5000 via cash ──────────────────────────────────────
  console.log('\n[2] Take deposit KSh 5,000 (cash)')
  const depRes = await api('/api/deposits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId, amount: 5000, method: 'cash', note: 'e2e test deposit' }),
  })
  check('deposit created (201)', depRes.status === 201, depRes.body)
  check('deposit amount 5000', depRes.body?.deposit?.amount === 5000, depRes.body?.deposit?.amount)
  check('deposit balance 5000', depRes.body?.deposit?.balance === 5000, depRes.body?.deposit?.balance)
  check('deposit status active', depRes.body?.deposit?.status === 'active', depRes.body?.deposit?.status)
  check('customer depositBalance 5000', depRes.body?.customerBalance === 5000, depRes.body?.customerBalance)
  check('receiptNo looks like DEP-YYYY-NNNN', /^DEP-\d{4}-\d{4}$/.test(depRes.body?.deposit?.receiptNo || ''), depRes.body?.deposit?.receiptNo)
  const depositId = depRes.body?.deposit?._id

  // ── 3. Pickup sale: total 3000, paid fully by deposit ───────────────────────
  console.log('\n[3] Pickup sale KSh 3,000 paid by deposit')
  const saleRes = await api('/api/sales', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ productId: null, productName: 'Test item (no stock)', quantity: 1, price: 3000, discount: 0 }],
      subtotal: 3000,
      discount: 0,
      total: 3000,
      customerId,
      payments: [{ method: 'deposit', amount: 3000, depositId }],
    }),
  })
  check('sale created (201)', saleRes.status === 201, saleRes.body)
  check('sale paymentStatus paid', saleRes.body?.sale?.paymentStatus === 'paid', saleRes.body?.sale?.paymentStatus)
  check('depositDrawn 3000', saleRes.body?.paymentBreakdown?.depositDrawn === 3000, saleRes.body?.paymentBreakdown?.depositDrawn)
  check('customer depositBalance now 2000', saleRes.body?.depositBalance === 2000, saleRes.body?.depositBalance)

  // Verify the deposit doc itself reflects the drawdown
  const depAfter = await api(`/api/deposits/${depositId}`)
  check('deposit balance 2000 after pickup', depAfter.body?.deposit?.balance === 2000, depAfter.body?.deposit?.balance)
  check('deposit status partial after pickup', depAfter.body?.deposit?.status === 'partial', depAfter.body?.deposit?.status)
  check('one consumption recorded', (depAfter.body?.deposit?.consumptions || []).length === 1, (depAfter.body?.deposit?.consumpositions || []).length)

  // ── 4. Refund the remaining 2000 via original method (cash) ─────────────────
  console.log('\n[4] Refund remaining KSh 2,000 (cash, original method)')
  const refundRes = await api(`/api/deposits/${depositId}/refund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'e2e test refund', approvedBy: customerId /* placeholder */ }),
  })
  check('refund processed (201)', refundRes.status === 201, refundRes.body)
  check('refund amount 2000', refundRes.body?.refund?.amount === 2000, refundRes.body?.refund?.amount)
  check('customer depositBalance 0 after refund', refundRes.body?.customerBalance === 0, refundRes.body?.customerBalance)

  const depFinal = await api(`/api/deposits/${depositId}`)
  check('deposit balance 0 after refund', depFinal.body?.deposit?.balance === 0, depFinal.body?.deposit?.balance)
  check('deposit status refunded', depFinal.body?.deposit?.status === 'refunded', depFinal.body?.deposit?.status)
  check('one refund recorded', (depFinal.body?.deposit?.refunds || []).length === 1, (depFinal.body?.deposit?.refunds || []).length)

  // ── 5. End-of-day report shows deposit activity ─────────────────────────────
  console.log('\n[5] End-of-day report')
  const today = new Date().toISOString().split('T')[0]
  const reportRes = await api(`/api/reports/end-of-day?date=${today}`)
  check('report fetched (200)', reportRes.status === 200, reportRes.body?.error)
  const r = reportRes.body?.report
  if (r) {
    const depReceived = (r.depositsReceived || []).filter((d: any) => d.customerId === customerId)
    const depUsed = (r.depositsUsed || []).filter((d: any) => d._id === saleRes.body?.sale?._id)
    check('report lists our deposit received', depReceived.length === 1, depReceived.length)
    check('report lists our deposit-used sale', depUsed.length === 1, depUsed.length)
    check('report has outstanding-deposits field', typeof r.summary?.totalOutstandingDeposits === 'number', r.summary?.totalOutstandingDeposits)
    console.log(`      Cash in totalsByMethod: ${money(r.paymentMethods?.totalsByMethod?.Cash || 0)}`)
    console.log(`      Outstanding deposits held: ${money(r.summary?.totalOutstandingDeposits || 0)}`)
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${'='.repeat(60)}`)
  console.log(`  Passed: ${pass}   Failed: ${fail}`)
  console.log(`${'='.repeat(60)}\n`)
  if (fail > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error('\nTest crashed:', err)
  process.exit(1)
})
