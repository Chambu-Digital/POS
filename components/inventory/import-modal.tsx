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
import { Upload, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'

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
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvData, setCsvData] = useState<any[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [processedData, setProcessedData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importStats, setImportStats] = useState<any>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
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

    setShowConfirmation(false)
    setLoading(true)
    setStep('importing')
    setImportProgress(0)

    try {
      const formData = new FormData()
      if (file) {
        formData.append('file', file)
      }
      formData.append('mapping', JSON.stringify(mapping))

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setImportProgress((prev) => Math.min(prev + 10, 90))
      }, 200)

      const response = await fetch('/api/products/import', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setImportProgress(100)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Import failed')
      }

      const result = await response.json()
      setImportStats(result.stats)

      // Show detailed success message
      const messages = [
        `✓ Imported ${result.count} products`,
        result.duplicatesSkipped > 0 ? `⚠ Skipped ${result.duplicatesSkipped} duplicates` : null,
        result.categoriesCreated > 0 ? `✓ Created ${result.categoriesCreated} new categories` : null,
      ].filter(Boolean)

      toast.success(messages.join('\n'))

      // Wait a bit to show the success state
      setTimeout(() => {
        // Reset
        setFile(null)
        setCsvHeaders([])
        setCsvData([])
        setMapping({})
        setProcessedData([])
        setImportProgress(0)
        setImportStats(null)
        setStep('upload')

        onOpenChange(false)
        onSuccess()
      }, 2000)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Import failed')
      setStep('preview')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Products</DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Select a CSV or Excel file to import'}
            {step === 'mapping' && 'Map CSV columns to product fields'}
            {step === 'preview' && 'Review products before importing'}
            {step === 'importing' && 'Importing products and creating categories...'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">{/* Scrollable content wrapper */}

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

                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto max-h-64 overflow-y-auto">
                    <Table className="text-xs">
                      <TableHeader className="sticky top-0 bg-gray-50 z-10">
                        <TableRow>
                          <TableHead>Product Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Stock</TableHead>
                          <TableHead>Buying Price</TableHead>
                          <TableHead>Selling Price</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {processedData.slice(0, 50).map((product, i) => (
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
                  {processedData.length > 50 && (
                    <div className="bg-gray-50 px-4 py-2 text-xs text-muted-foreground border-t">
                      Showing first 50 of {processedData.length} products
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>No valid products found</AlertDescription>
              </Alert>
            )}

            {/* Confirmation Dialog */}
            {showConfirmation && (
              <Alert className="border-2 border-blue-500 bg-blue-50">
                <AlertCircle className="h-5 w-5 text-blue-600" />
                <AlertDescription className="text-blue-900">
                  <div className="space-y-3">
                    <p className="font-semibold text-base">
                      ⚠️ Are you sure you want to import {processedData.length} product(s)?
                    </p>
                    <p className="text-sm">
                      This will add new products to your inventory and may create new categories.
                      Duplicates will be automatically skipped.
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button
                        onClick={() => {
                          setShowConfirmation(false)
                          submitImport()
                        }}
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {loading ? 'Importing...' : '✓ Yes, Import Now'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowConfirmation(false)}
                        disabled={loading}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2 pt-2 border-t">
              <Button
                variant="outline"
                onClick={() => setStep('mapping')}
                disabled={loading || showConfirmation}
              >
                Back
              </Button>
              {!showConfirmation && (
                <Button
                  onClick={() => setShowConfirmation(true)}
                  disabled={loading || processedData.length === 0}
                  className="ml-auto"
                >
                  Confirm Import
                </Button>
              )}
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="space-y-6 py-8">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="h-8 w-8 text-primary animate-pulse" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Importing Products</h3>
                <p className="text-sm text-muted-foreground">
                  Please wait while we process your file...
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span className="font-medium">{importProgress}%</span>
              </div>
              <Progress value={importProgress} className="h-2" />
            </div>

            {importStats && (
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-medium">Import Complete!</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total Processed</p>
                        <p className="text-2xl font-bold">{importStats.total}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Successfully Imported</p>
                        <p className="text-2xl font-bold text-green-600">{importStats.imported}</p>
                      </div>
                      {importStats.duplicates > 0 && (
                        <div>
                          <p className="text-muted-foreground">Duplicates Skipped</p>
                          <p className="text-2xl font-bold text-orange-600">{importStats.duplicates}</p>
                        </div>
                      )}
                      {importStats.categoriesCreated > 0 && (
                        <div>
                          <p className="text-muted-foreground">Categories Created</p>
                          <p className="text-2xl font-bold text-blue-600">{importStats.categoriesCreated}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
        </div>{/* End scrollable content wrapper */}
      </DialogContent>
    </Dialog>
  )
}
