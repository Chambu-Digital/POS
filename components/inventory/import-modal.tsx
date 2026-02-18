'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { detectColumnMapping, applyMapping, validateProducts } from '@/lib/column-mapper'
import { Upload, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

const PRODUCT_FIELDS = [
  'productName',
  'category',
  'variant',
  'brand',
  'model',
  'unit',
  'buyingPrice',
  'sellingPrice',
  'wholeSale',
  'stock',
  'description',
]

interface ImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ImportModal({ open, onOpenChange, onSuccess }: ImportModalProps) {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvData, setCsvData] = useState<any[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [processedData, setProcessedData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)

    const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase()

    if (fileExtension === 'csv') {
      // Parse CSV file
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string
          Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              const headers = Object.keys((results.data as any[])[0] || {})
              const data = (results.data as any[]).slice(0, 5) // Preview first 5 rows

              setCsvHeaders(headers)
              setCsvData(data)

              // Auto-detect mapping
              const detected = detectColumnMapping(headers)
              setMapping(detected.mapping)
              setStep('mapping')
            },
            error: () => {
              toast.error('Failed to parse CSV file')
            },
          })
        } catch (error) {
          toast.error('Error reading CSV file')
        }
      }
      reader.readAsText(selectedFile)
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      // Parse Excel file
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const data = event.target?.result
          const workbook = XLSX.read(data, { type: 'binary' })
          
          // Get first sheet
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          
          // Convert to JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
          
          if (jsonData.length === 0) {
            toast.error('Excel file is empty')
            return
          }

          // First row is headers
          const headers = (jsonData[0] as any[]).map(h => String(h || ''))
          
          // Convert remaining rows to objects
          const rows = jsonData.slice(1).map((row: any) => {
            const obj: any = {}
            headers.forEach((header, index) => {
              obj[header] = row[index] !== undefined ? String(row[index]) : ''
            })
            return obj
          })

          const previewData = rows.slice(0, 5) // Preview first 5 rows

          setCsvHeaders(headers)
          setCsvData(previewData)

          // Auto-detect mapping
          const detected = detectColumnMapping(headers)
          setMapping(detected.mapping)
          setStep('mapping')
        } catch (error) {
          console.error('Excel parse error:', error)
          toast.error('Failed to parse Excel file')
        }
      }
      reader.readAsBinaryString(selectedFile)
    } else {
      toast.error('Unsupported file format. Please use CSV or Excel files.')
    }
  }

  function handleMappingChange(header: string, field: string) {
    setMapping((prev) => ({
      ...prev,
      [header]: field === 'skip' ? null : field,
    }))
  }

  async function proceedToPreview() {
    if (!file) return

    const fileExtension = file.name.split('.').pop()?.toLowerCase()

    if (fileExtension === 'csv') {
      // Parse CSV file
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string
          Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              const rows = results.data as any[]
              const transformed = applyMapping(rows, mapping)
              const { valid, errors } = validateProducts(transformed)

              if (errors.length > 0 && valid.length === 0) {
                toast.error(`Validation failed: ${errors[0]}`)
                return
              }

              if (errors.length > 0) {
                toast.warning(`${errors.length} rows will be skipped due to validation errors`)
              }

              setProcessedData(valid)
              setStep('preview')
            },
          })
        } catch (error) {
          toast.error('Error processing CSV file')
        }
      }
      reader.readAsText(file)
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      // Parse Excel file
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const data = event.target?.result
          const workbook = XLSX.read(data, { type: 'binary' })
          
          // Get first sheet
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          
          // Convert to JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
          
          // First row is headers
          const headers = (jsonData[0] as any[]).map(h => String(h || ''))
          
          // Convert remaining rows to objects
          const rows = jsonData.slice(1).map((row: any) => {
            const obj: any = {}
            headers.forEach((header, index) => {
              obj[header] = row[index] !== undefined ? String(row[index]) : ''
            })
            return obj
          })

          const transformed = applyMapping(rows, mapping)
          const { valid, errors } = validateProducts(transformed)

          if (errors.length > 0 && valid.length === 0) {
            toast.error(`Validation failed: ${errors[0]}`)
            return
          }

          if (errors.length > 0) {
            toast.warning(`${errors.length} rows will be skipped due to validation errors`)
          }

          setProcessedData(valid)
          setStep('preview')
        } catch (error) {
          console.error('Excel processing error:', error)
          toast.error('Error processing Excel file')
        }
      }
      reader.readAsBinaryString(file)
    }
  }

  async function submitImport() {
    if (processedData.length === 0) {
      toast.error('No products to import')
      return
    }

    setLoading(true)

    try {
      const formData = new FormData()
      if (file) {
        formData.append('file', file)
      }
      formData.append('mapping', JSON.stringify(mapping))

      const response = await fetch('/api/products/import', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Import failed')
      }

      const result = await response.json()
      toast.success(`Successfully imported ${result.count} products`)

      // Reset
      setFile(null)
      setCsvHeaders([])
      setCsvData([])
      setMapping({})
      setProcessedData([])
      setStep('upload')

      onOpenChange(false)
      onSuccess()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Products</DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Select a CSV or Excel file to import'}
            {step === 'mapping' && 'Map CSV columns to product fields'}
            {step === 'preview' && 'Review products before importing'}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="font-medium">Click to select file or drag and drop</p>
              <p className="text-sm text-muted-foreground">CSV or Excel files are supported</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>
        )}

        {step === 'mapping' && (
          <div className="space-y-4">
            <div className="grid gap-4">
              {csvHeaders.map((header) => (
                <div key={header} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground mb-1 block">
                      CSV Column
                    </Label>
                    <div className="p-2 bg-muted rounded text-sm font-medium">{header}</div>
                  </div>
                  <Select
                    value={mapping[header] || 'skip'}
                    onValueChange={(value) => handleMappingChange(header, value)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip">Skip</SelectItem>
                      {PRODUCT_FIELDS.map((field) => (
                        <SelectItem key={field} value={field}>
                          {field}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {csvData.length > 0 && (
              <div className="mt-6">
                <h4 className="font-medium mb-2">Preview (first 5 rows)</h4>
                <div className="overflow-x-auto">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow>
                        {csvHeaders.map((h) => (
                          <TableHead key={h}>{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvData.map((row, i) => (
                        <TableRow key={i}>
                          {csvHeaders.map((h) => (
                            <TableCell key={`${i}-${h}`}>{row[h] || '-'}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setStep('upload')
                  setFile(null)
                  setCsvHeaders([])
                  setCsvData([])
                  setMapping({})
                }}
              >
                Back
              </Button>
              <Button onClick={proceedToPreview} className="ml-auto">
                Preview
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            {processedData.length > 0 ? (
              <>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {processedData.length} products ready to import
                  </AlertDescription>
                </Alert>

                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Buying Price</TableHead>
                        <TableHead>Selling Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {processedData.map((product, i) => (
                        <TableRow key={i}>
                          <TableCell>{product.productName}</TableCell>
                          <TableCell>{product.category}</TableCell>
                          <TableCell>{product.stock}</TableCell>
                          <TableCell>KSh {product.buyingPrice}</TableCell>
                          <TableCell>KSh {product.sellingPrice}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>No valid products found</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep('mapping')}
              >
                Back
              </Button>
              <Button
                onClick={submitImport}
                disabled={loading || processedData.length === 0}
                className="ml-auto"
              >
                {loading ? 'Importing...' : 'Import'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
