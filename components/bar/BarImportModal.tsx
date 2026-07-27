'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Upload, AlertCircle, CheckCircle2, GlassWater } from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

// ─── Types ─────────────────────────────────────────────────────────────────────

type Step = 'upload' | 'mapping' | 'preview' | 'importing'

interface BarPreviewRow {
  type: string
  name: string
  size: string
  quantity: number
  buyingPrice: number
  bottleSellingPrice: number
  lowStockThreshold: number
  servings: { name: string; units: number; price: number }[]
  rowNum: number
  errors: string[]
}

interface ImportStats {
  imported: number
  servingsCreated: number
  total: number
  errors: string[]
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSuccess: () => void
}

// ─── Field registry ─────────────────────────────────────────────────────────────

const BAR_FIELDS = [
  { value: 'type',               label: 'Type / Category (brand group)' },
  { value: 'name',               label: 'Name  (e.g. Jameson)' },
  { value: 'size',               label: 'Size  (e.g. 750ml)' },
  { value: 'quantity',           label: 'Quantity — initial stock' },
  { value: 'buyingPrice',        label: 'Buying Price' },
  { value: 'bottleSellingPrice', label: 'Bottle Selling Price' },
  { value: 'lowStockThreshold',  label: 'Low Stock Threshold' },
  { value: 'serving1Name',  label: 'Serving 1 — Name' },
  { value: 'serving1Units', label: 'Serving 1 — Units per bottle' },
  { value: 'serving1Price', label: 'Serving 1 — Price' },
  { value: 'serving2Name',  label: 'Serving 2 — Name' },
  { value: 'serving2Units', label: 'Serving 2 — Units per bottle' },
  { value: 'serving2Price', label: 'Serving 2 — Price' },
  { value: 'serving3Name',  label: 'Serving 3 — Name' },
  { value: 'serving3Units', label: 'Serving 3 — Units per bottle' },
  { value: 'serving3Price', label: 'Serving 3 — Price' },
  { value: 'serving4Name',  label: 'Serving 4 — Name' },
  { value: 'serving4Units', label: 'Serving 4 — Units per bottle' },
  { value: 'serving4Price', label: 'Serving 4 — Price' },
]

// ─── Auto-detection ─────────────────────────────────────────────────────────────

const DETECT: Record<string, RegExp[]> = {
  type:               [/^type$/i, /^category$/i, /^drink.?type$/i, /^brand.?group$/i],
  name:               [/^name$/i, /^brand.?name$/i, /^label$/i, /^product.?name$/i, /^item.?name$/i],
  size:               [/^size$/i, /^bottle.?size$/i, /^volume$/i],
  quantity:           [/^quantity$/i, /^qty$/i, /^stock$/i, /^count$/i],
  buyingPrice:        [/^buying.?price$/i, /^cost$/i, /^cost.?price$/i, /^bp$/i],
  bottleSellingPrice: [/^bottle.?(selling.)?price$/i, /^selling.?price$/i, /^sp$/i],
  lowStockThreshold:  [/^low.?stock.?threshold$/i, /^threshold$/i, /^min.?stock$/i],
}

function detectBarMapping(headers: string[]): Record<string, string | null> {
  const mapping: Record<string, string | null> = {}
  const claimed = new Set<string>()

  for (const header of headers) {
    const h = header.trim()
    let matched: string | null = null

    // Template-exact serving columns: serving1Name, serving1Units, serving1Price …
    const servingMatch = h.match(/^(serving\d+)(name|units|price)$/i)
    if (servingMatch) {
      const part = servingMatch[2].charAt(0).toUpperCase() + servingMatch[2].slice(1).toLowerCase()
      matched = `${servingMatch[1].toLowerCase()}${part}`
    }

    if (!matched) {
      for (const [field, pats] of Object.entries(DETECT)) {
        if (claimed.has(field)) continue
        if (pats.some(p => p.test(h))) { matched = field; claimed.add(field); break }
      }
    }

    mapping[header] = matched
  }
  return mapping
}

// ─── CSV parser ─────────────────────────────────────────────────────────────────

function parseCSVText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  function parseLine(line: string): string[] {
    const fields: string[] = []
    let cur = ''; let inQ = false
    for (const ch of line) {
      if (ch === '"') inQ = !inQ
      else if (ch === ',' && !inQ) { fields.push(cur.trim()); cur = '' }
      else cur += ch
    }
    fields.push(cur.trim())
    return fields
  }
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (!lines.length) return { headers: [], rows: [] }
  const headers = parseLine(lines[0])
  const rows = lines.slice(1)
    .filter(l => !l.trim().startsWith('#'))
    .map(l => {
      const vals = parseLine(l)
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => { obj[h] = vals[i] ?? '' })
      return obj
    })
    .filter(r => Object.values(r).some(v => v.trim()))
  return { headers, rows }
}

// ─── Row validator ──────────────────────────────────────────────────────────────

function applyBarMapping(
  rows: Record<string, string>[],
  mapping: Record<string, string | null>,
): BarPreviewRow[] {
  return rows.map((row, idx) => {
    const flat: Record<string, string> = {}
    for (const [col, field] of Object.entries(mapping)) {
      if (field && (row[col] ?? '').trim()) flat[field] = row[col].trim()
    }

    const errors: string[] = []
    if (!flat.type) errors.push('type is required')
    if (!flat.name) errors.push('name is required')
    if (!flat.size) errors.push('size is required')

    const quantity    = parseInt(flat.quantity           ?? '0') || 0
    const buyingPrice = parseFloat(flat.buyingPrice      ?? '0') || 0
    const bottlePrice = parseFloat(flat.bottleSellingPrice ?? '0') || 0
    const threshold   = parseInt(flat.lowStockThreshold  ?? '3') || 3

    if (quantity < 0)    errors.push('quantity must be ≥ 0')
    if (buyingPrice < 0) errors.push('buyingPrice must be ≥ 0')

    const servings: { name: string; units: number; price: number }[] = []
    for (let s = 1; s <= 4; s++) {
      const sName  = flat[`serving${s}Name`]  || flat[`serving${s}name`]  || ''
      const sUnits = flat[`serving${s}Units`] || flat[`serving${s}units`] || ''
      const sPrice = flat[`serving${s}Price`] || flat[`serving${s}price`] || ''
      if (sName) {
        const units = parseInt(sUnits) || 0
        const price = parseFloat(sPrice) || 0
        if (units < 1) errors.push(`Serving ${s}: units must be ≥ 1`)
        else servings.push({ name: sName, units, price })
      }
    }

    return {
      type: flat.type ?? '', name: flat.name ?? '', size: flat.size ?? '',
      quantity, buyingPrice, bottleSellingPrice: bottlePrice,
      lowStockThreshold: threshold, servings,
      rowNum: idx + 2, errors,
    }
  })
}

// ─── Main component ─────────────────────────────────────────────────────────────

export function BarImportModal({ open, onOpenChange, onSuccess }: Props) {
  const [step,        setStep]        = useState<Step>('upload')
  const [file,        setFile]        = useState<File | null>(null)
  const [headers,     setHeaders]     = useState<string[]>([])
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([])
  const [mapping,     setMapping]     = useState<Record<string, string | null>>({})
  const [processed,   setProcessed]   = useState<BarPreviewRow[]>([])
  const [progress,    setProgress]    = useState(0)
  const [stats,       setStats]       = useState<ImportStats | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function reset() {
    setStep('upload'); setFile(null); setHeaders([]); setPreviewRows([])
    setMapping({}); setProcessed([]); setProgress(0); setStats(null); setShowConfirm(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  // ── File selection ──────────────────────────────────────────────────────────

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    const ext = f.name.split('.').pop()?.toLowerCase()

    if (ext === 'csv') {
      const reader = new FileReader()
      reader.onload = ev => {
        const { headers: h, rows } = parseCSVText(ev.target?.result as string)
        if (!h.length) { toast.error('Could not read CSV headers'); return }
        setHeaders(h); setPreviewRows(rows.slice(0, 5))
        setMapping(detectBarMapping(h)); setStep('mapping')
      }
      reader.readAsText(f)
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader()
      reader.onload = ev => {
        try {
          const wb   = XLSX.read(ev.target?.result, { type: 'binary' })
          const ws   = wb.Sheets[wb.SheetNames[0]]
          const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][]
          if (!data.length) { toast.error('Empty file'); return }
          const h    = data[0].map(c => String(c ?? ''))
          const rows = data.slice(1)
            .filter(r => r.some(v => String(v ?? '').trim()))
            .map(r => {
              const obj: Record<string, string> = {}
              h.forEach((hh, i) => { obj[hh] = String(r[i] ?? '') })
              return obj
            })
          setHeaders(h); setPreviewRows(rows.slice(0, 5))
          setMapping(detectBarMapping(h)); setStep('mapping')
        } catch { toast.error('Failed to parse Excel file') }
      }
      reader.readAsBinaryString(f)
    } else {
      toast.error('Unsupported format. Use .csv, .xlsx, or .xls')
    }
  }

  // ── Proceed to preview ──────────────────────────────────────────────────────

  function proceedToPreview() {
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()

    function process(rows: Record<string, string>[]) {
      const result   = applyBarMapping(rows, mapping)
      const invalid  = result.filter(r => r.errors.length > 0)
      if (invalid.length) toast.warning(`${invalid.length} row${invalid.length !== 1 ? 's' : ''} have errors and will be skipped`)
      if (!result.filter(r => !r.errors.length).length) {
        toast.error('No valid rows found. Check your mapping.')
        return
      }
      setProcessed(result); setStep('preview')
    }

    if (ext === 'csv') {
      const reader = new FileReader()
      reader.onload = ev => {
        const { rows } = parseCSVText(ev.target?.result as string)
        process(rows)
      }
      reader.readAsText(file)
    } else {
      const reader = new FileReader()
      reader.onload = ev => {
        try {
          const wb   = XLSX.read(ev.target?.result, { type: 'binary' })
          const ws   = wb.Sheets[wb.SheetNames[0]]
          const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][]
          const h    = data[0].map(c => String(c ?? ''))
          const rows = data.slice(1)
            .filter(r => r.some(v => String(v ?? '').trim()))
            .map(r => {
              const obj: Record<string, string> = {}
              h.forEach((hh, i) => { obj[hh] = String(r[i] ?? '') })
              return obj
            })
          process(rows)
        } catch { toast.error('Failed to re-parse file') }
      }
      reader.readAsBinaryString(file)
    }
  }

  // ── Submit import ───────────────────────────────────────────────────────────

  async function submitImport() {
    if (!file) return
    setShowConfirm(false); setStep('importing'); setProgress(0)
    const interval = setInterval(() => setProgress(p => Math.min(p + 8, 88)), 220)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/bar/inventory-items/import', { method: 'POST', body: fd })
      clearInterval(interval); setProgress(100)
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Import failed') }
      const data: ImportStats = await res.json()
      setStats(data)
      if (data.errors?.length) data.errors.forEach(e => toast.warning(e, { duration: 7000 }))
      setTimeout(() => { reset(); onOpenChange(false); onSuccess() }, 2500)
    } catch (err: any) {
      clearInterval(interval); toast.error(err.message || 'Import failed'); setStep('preview')
    }
  }

  const validRows      = processed.filter(r => r.errors.length === 0)
  const invalidRows    = processed.filter(r => r.errors.length > 0)
  const totalServings  = validRows.reduce((s, r) => s + r.servings.length, 0)

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-0">
        <DialogHeader className="pb-3 border-b">
          <DialogTitle>Import Bar Inventory</DialogTitle>
          <DialogDescription>
            {step === 'upload'    && 'Select a CSV or Excel file'}
            {step === 'mapping'   && 'Map your file columns to bar inventory fields'}
            {step === 'preview'   && 'Review items before importing'}
            {step === 'importing' && 'Importing…'}
          </DialogDescription>

          {/* Step breadcrumb */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1 flex-wrap">
            {(['upload', 'mapping', 'preview', 'importing'] as Step[]).map((s, i) => (
              <span key={s} className="flex items-center gap-1">
                {i > 0 && <span>›</span>}
                <span className={step === s ? 'text-primary font-semibold' : ''}>
                  {s === 'importing' ? 'Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
                </span>
              </span>
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* ── Step 1: Upload ─────────────────────────────────────────────── */}
          {step === 'upload' && (
            <div
              className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <GlassWater className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
              <p className="font-semibold text-base mb-1">Click to select file or drag and drop</p>
              <p className="text-sm text-muted-foreground">.csv · .xlsx · .xls</p>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect} className="hidden" />
            </div>
          )}

          {/* ── Step 2: Mapping ────────────────────────────────────────────── */}
          {step === 'mapping' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Each column from your file is listed below. Select the matching bar inventory field,
                or <strong>Skip</strong> to ignore it.
              </p>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {headers.map(header => (
                  <div key={header} className="flex gap-3 items-center">
                    <div className="w-44 shrink-0 px-3 py-2 bg-muted rounded text-xs font-mono truncate" title={header}>
                      {header}
                    </div>
                    <Select
                      value={mapping[header] ?? 'skip'}
                      onValueChange={v =>
                        setMapping(prev => ({ ...prev, [header]: v === 'skip' ? null : v }))
                      }
                    >
                      <SelectTrigger className="flex-1 max-w-xs">
                        <SelectValue placeholder="Select field…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="skip">Skip this column</SelectItem>
                        {BAR_FIELDS.map(f => (
                          <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {mapping[header] && mapping[header] !== 'skip' && (
                      <span className="text-xs text-emerald-600 font-medium shrink-0">✓</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Raw data preview */}
              {previewRows.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">
                    Data preview — first {previewRows.length} rows
                  </p>
                  <div className="overflow-x-auto border rounded-lg">
                    <Table className="text-xs">
                      <TableHeader>
                        <TableRow>
                          {headers.map(h => <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>)}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewRows.map((row, i) => (
                          <TableRow key={i}>
                            {headers.map(h => (
                              <TableCell key={h}>{row[h] || '—'}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t">
                <Button variant="outline" onClick={reset}>Back</Button>
                <Button className="ml-auto" onClick={proceedToPreview}>
                  Preview →
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 3: Preview ────────────────────────────────────────────── */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex gap-3 flex-wrap">
                <Alert className="flex-1">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{validRows.length}</strong> item{validRows.length !== 1 ? 's' : ''} ready to import
                    {totalServings > 0 && ` with ${totalServings} serving configuration${totalServings !== 1 ? 's' : ''}`}
                  </AlertDescription>
                </Alert>
                {invalidRows.length > 0 && (
                  <Alert variant="destructive" className="flex-1">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>{invalidRows.length}</strong> row{invalidRows.length !== 1 ? 's' : ''} will be skipped
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Valid rows table */}
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <Table className="text-xs">
                    <TableHeader className="sticky top-0 bg-muted z-10">
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Buying</TableHead>
                        <TableHead>Bottle Price</TableHead>
                        <TableHead>Servings</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validRows.slice(0, 100).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell>{r.type}</TableCell>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell>{r.size}</TableCell>
                          <TableCell>{r.quantity}</TableCell>
                          <TableCell>KES {r.buyingPrice.toLocaleString()}</TableCell>
                          <TableCell>KES {r.bottleSellingPrice.toLocaleString()}</TableCell>
                          <TableCell>
                            {r.servings.length > 0
                              ? r.servings.map(s => s.name).join(', ')
                              : <span className="text-muted-foreground">—</span>
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {validRows.length > 100 && (
                  <div className="bg-muted px-4 py-2 text-xs text-muted-foreground border-t">
                    Showing first 100 of {validRows.length} items
                  </div>
                )}
              </div>

              {/* Invalid rows */}
              {invalidRows.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-destructive mb-1">
                    Rows with errors (will be skipped)
                  </p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {invalidRows.map((r, i) => (
                      <p key={i} className="text-xs text-destructive bg-destructive/5 rounded px-2 py-1">
                        Row {r.rowNum}: {r.errors.join(' · ')}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Confirmation */}
              {showConfirm && (
                <Alert className="border-2 border-primary bg-primary/5">
                  <AlertCircle className="h-4 w-4 text-primary" />
                  <AlertDescription className="space-y-3">
                    <p className="font-semibold">
                      Import {validRows.length} item{validRows.length !== 1 ? 's' : ''}
                      {totalServings > 0 && ` and ${totalServings} serving${totalServings !== 1 ? 's' : ''}`}?
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Existing items with the same name and size will not be duplicated.
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={submitImport}>Yes, Import Now</Button>
                      <Button size="sm" variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2 pt-2 border-t">
                <Button variant="outline" onClick={() => { setStep('mapping'); setShowConfirm(false) }}>
                  Back
                </Button>
                {!showConfirm && (
                  <Button
                    className="ml-auto"
                    disabled={validRows.length === 0}
                    onClick={() => setShowConfirm(true)}
                  >
                    Confirm Import
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* ── Step 4: Progress ───────────────────────────────────────────── */}
          {step === 'importing' && (
            <div className="py-8 space-y-6">
              <div className="text-center space-y-3">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="h-8 w-8 text-primary animate-pulse" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">
                    {stats ? 'Import Complete!' : 'Importing Bar Inventory'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {stats ? 'Your inventory has been updated.' : 'Please wait…'}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              {stats && (
                <Card>
                  <CardContent className="pt-5">
                    <div className="flex items-center gap-2 text-emerald-600 mb-4">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-semibold">Done</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Items Imported</p>
                        <p className="text-2xl font-bold text-emerald-600">{stats.imported}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Servings Created</p>
                        <p className="text-2xl font-bold text-blue-600">{stats.servingsCreated}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Rows Processed</p>
                        <p className="text-2xl font-bold">{stats.total}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  )
}
