'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

interface Drug {
  _id?: string
  genericName: string
  brandName?: string
  category: string
  drugClass?: string
  dosageForm?: string
  strength?: string
  unit?: string
  barcode?: string
  sellingPrice: number
  buyingPrice: number
  wholesalePrice?: number
  stock?: number
  reorderLevel?: number
  requiresPrescription?: boolean
  isControlled?: boolean
  status?: 'active' | 'inactive' | 'discontinued'
  description?: string
  sideEffects?: string
  manufacturer?: string
  sku?: string
}

interface DrugFormProps {
  drug?: Drug | null
  onSuccess: (savedDrug?: Drug) => void
}

const COMMON_CATEGORIES = [
  'Antibiotics', 'Analgesics', 'Antipyretics', 'Antihistamines', 'Antacids',
  'Cardiovascular', 'Respiratory', 'Gastrointestinal', 'Dermatological',
  'Vitamins', 'Supplements', 'Antidiabetic', 'Antihypertensive', 'Anticoagulants',
  'Corticosteroids', 'Immunosuppressants', 'Antiviral', 'Antifungal', 'General'
]

const DOSAGE_FORMS = [
  'Tablet', 'Capsule', 'Syrup', 'Suspension', 'Injection', 'Cream', 'Ointment',
  'Drops', 'Inhaler', 'Patch', 'Suppository', 'Powder', 'Solution', 'Gel'
]

const UNITS = [
  'Tablet', 'Capsule', 'ml', 'mg', 'g', 'piece', 'bottle', 'vial', 'tube', 'pack'
]

export function DrugForm({ drug, onSuccess }: DrugFormProps) {
  const [formData, setFormData] = useState<Drug>({
    genericName: '',
    brandName: '',
    category: 'General',
    drugClass: '',
    dosageForm: '',
    strength: '',
    unit: 'Tablet',
    barcode: '',
    sellingPrice: 0,
    buyingPrice: 0,
    wholesalePrice: 0,
    stock: 0,
    reorderLevel: 10,
    requiresPrescription: false,
    isControlled: false,
    status: 'active',
    description: '',
    sideEffects: '',
    manufacturer: '',
    sku: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (drug) {
      setFormData(drug)
    }
  }, [drug])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      const url = drug ? `/api/pharmacy/drugs/${drug._id}` : '/api/pharmacy/drugs'
      const method = drug ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save drug')
      }

      const data = await response.json()
      toast.success(drug ? 'Drug updated successfully' : 'Drug created successfully')
      onSuccess(data.drug)
    } catch (error: any) {
      toast.error(error.message || 'Failed to save drug')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="genericName">Generic Name *</Label>
          <Input
            id="genericName"
            value={formData.genericName}
            onChange={(e) => setFormData({ ...formData, genericName: e.target.value })}
            required
          />
        </div>

        <div>
          <Label htmlFor="brandName">Brand Name</Label>
          <Input
            id="brandName"
            value={formData.brandName || ''}
            onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="sku">SKU</Label>
          <Input
            id="sku"
            value={formData.sku || ''}
            onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="category">Category *</Label>
          <Select
            value={formData.category}
            onValueChange={(value) => setFormData({ ...formData, category: value })}
            required
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMON_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="drugClass">Drug Class</Label>
          <Input
            id="drugClass"
            value={formData.drugClass || ''}
            onChange={(e) => setFormData({ ...formData, drugClass: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="dosageForm">Dosage Form</Label>
          <Select
            value={formData.dosageForm || ''}
            onValueChange={(value) => setFormData({ ...formData, dosageForm: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select form" />
            </SelectTrigger>
            <SelectContent>
              {DOSAGE_FORMS.map((form) => (
                <SelectItem key={form} value={form}>
                  {form}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="strength">Strength</Label>
          <Input
            id="strength"
            placeholder="e.g. 500mg, 250mg/5ml"
            value={formData.strength || ''}
            onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="unit">Unit</Label>
          <Select
            value={formData.unit || 'Tablet'}
            onValueChange={(value) => setFormData({ ...formData, unit: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNITS.map((unit) => (
                <SelectItem key={unit} value={unit}>
                  {unit}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="barcode">Barcode</Label>
          <Input
            id="barcode"
            value={formData.barcode || ''}
            onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="manufacturer">Manufacturer</Label>
          <Input
            id="manufacturer"
            value={formData.manufacturer || ''}
            onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="buyingPrice">Buying Price (KES) *</Label>
          <Input
            id="buyingPrice"
            type="number"
            step="0.01"
            value={formData.buyingPrice}
            onChange={(e) => setFormData({ ...formData, buyingPrice: parseFloat(e.target.value) || 0 })}
            required
          />
        </div>

        <div>
          <Label htmlFor="sellingPrice">Selling Price (KES) *</Label>
          <Input
            id="sellingPrice"
            type="number"
            step="0.01"
            value={formData.sellingPrice}
            onChange={(e) => setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) || 0 })}
            required
          />
        </div>

        <div>
          <Label htmlFor="wholesalePrice">Wholesale Price (KES)</Label>
          <Input
            id="wholesalePrice"
            type="number"
            step="0.01"
            value={formData.wholesalePrice || 0}
            onChange={(e) => setFormData({ ...formData, wholesalePrice: parseFloat(e.target.value) || 0 })}
          />
        </div>

        <div>
          <Label htmlFor="reorderLevel">Reorder Level</Label>
          <Input
            id="reorderLevel"
            type="number"
            value={formData.reorderLevel || 10}
            onChange={(e) => setFormData({ ...formData, reorderLevel: parseInt(e.target.value) || 10 })}
          />
        </div>

        <div>
          <Label htmlFor="status">Status</Label>
          <Select
            value={formData.status || 'active'}
            onValueChange={(value: 'active' | 'inactive' | 'discontinued') => setFormData({ ...formData, status: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="discontinued">Discontinued</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={2}
          />
        </div>

        <div className="col-span-2">
          <Label htmlFor="sideEffects">Side Effects</Label>
          <Textarea
            id="sideEffects"
            value={formData.sideEffects || ''}
            onChange={(e) => setFormData({ ...formData, sideEffects: e.target.value })}
            rows={2}
          />
        </div>

        <div className="col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="requiresPrescription">Requires Prescription</Label>
            <Switch
              id="requiresPrescription"
              checked={formData.requiresPrescription || false}
              onCheckedChange={(checked) => setFormData({ ...formData, requiresPrescription: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="isControlled">Controlled Drug</Label>
            <Switch
              id="isControlled"
              checked={formData.isControlled || false}
              onCheckedChange={(checked) => setFormData({ ...formData, isControlled: checked })}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="submit" disabled={saving} className="flex-1">
          {saving ? 'Saving...' : drug ? 'Update Drug' : 'Create Drug'}
        </Button>
        <Button type="button" variant="outline" onClick={() => onSuccess()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
