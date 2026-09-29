// Unified print styles utility for all document printing
// Supports receipts (thermal), quotations, POs, and other business documents

export type PaperSize = 'A4' | 'Letter' | '58mm' | '80mm'
export type FontFamily = 'Arial' | 'Courier' | 'Times'

export interface DocumentPrintSettings {
  paperSize?: PaperSize
  fontSize?: number
  fontFamily?: FontFamily
}

export interface PrintStylesResult {
  pageCSS: string
  bodyWidth: string
  baseFontSize: string
  fontFamily: string
  maxWidth: string
}

/**
 * Get print styles based on document settings
 */
export function getPrintStyles(settings?: DocumentPrintSettings): PrintStylesResult {
  const paperSize = settings?.paperSize || 'A4'
  const fontSize = settings?.fontSize || 12
  const fontFamily = settings?.fontFamily || 'Arial'

  let pageCSS: string
  let bodyWidth: string
  let maxWidth: string

  switch (paperSize) {
    case '58mm':
      pageCSS = '@page { size: 58mm auto; margin: 3mm; }'
      bodyWidth = '52mm'
      maxWidth = '52mm'
      break
    case '80mm':
      pageCSS = '@page { size: 80mm auto; margin: 4mm; }'
      bodyWidth = '72mm'
      maxWidth = '72mm'
      break
    case 'Letter':
      pageCSS = '@page { size: letter; margin: 1in; }'
      bodyWidth = '6.5in'
      maxWidth = '100%'
      break
    case 'A4':
    default:
      pageCSS = '@page { size: A4; margin: 20mm; }'
      bodyWidth = '170mm'
      maxWidth = '100%'
      break
  }

  return {
    pageCSS,
    bodyWidth,
    baseFontSize: `${fontSize}px`,
    fontFamily: getFontFamilyCSS(fontFamily),
    maxWidth,
  }
}

/**
 * Get CSS font-family value
 */
function getFontFamilyCSS(font: FontFamily): string {
  switch (font) {
    case 'Courier':
      return '"Courier New", Courier, monospace'
    case 'Times':
      return '"Times New Roman", Times, serif'
    case 'Arial':
    default:
      return 'Arial, Helvetica, sans-serif'
  }
}

/**
 * Generate complete print CSS string
 */
export function generatePrintCSS(settings?: DocumentPrintSettings, contentId?: string): string {
  const styles = getPrintStyles(settings)
  const selector = contentId ? `#${contentId}` : '.print-content'

  return `
    @media print {
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        background: white;
      }
      
      body > * {
        display: none;
      }
      
      ${selector} {
        display: block !important;
        visibility: visible !important;
        position: static;
        width: 100%;
        padding: 0;
        margin: 0;
        border: none;
        border-radius: 0;
        background: white;
        font-family: ${styles.fontFamily};
        font-size: ${styles.baseFontSize};
        line-height: 1.5;
      }
      
      ${selector} * {
        display: block !important;
        visibility: visible !important;
        margin: 0;
        padding: 0;
      }
      
      ${selector} table,
      ${selector} thead,
      ${selector} tbody,
      ${selector} tr,
      ${selector} th,
      ${selector} td {
        display: table-row-group;
      }
      
      ${selector} thead,
      ${selector} tbody {
        display: table-row-group;
      }
      
      ${selector} tr {
        display: table-row;
      }
      
      ${selector} th,
      ${selector} td {
        display: table-cell;
      }
      
      ${styles.pageCSS}
    }
  `
}

/**
 * Check if paper size is thermal (for special handling)
 */
export function isThermalSize(paperSize?: PaperSize): boolean {
  return paperSize === '58mm' || paperSize === '80mm'
}

/**
 * Get recommended settings based on document type
 */
export function getRecommendedSettings(docType: 'receipt' | 'quotation' | 'po' | 'report'): DocumentPrintSettings {
  switch (docType) {
    case 'receipt':
      return { paperSize: '58mm', fontSize: 10, fontFamily: 'Arial' }
    case 'quotation':
    case 'po':
      return { paperSize: 'A4', fontSize: 12, fontFamily: 'Arial' }
    case 'report':
      return { paperSize: 'A4', fontSize: 11, fontFamily: 'Arial' }
  }
}
