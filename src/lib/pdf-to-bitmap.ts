import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

// Setup PDF.js worker (required)
GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

export interface BitmapResult {
  width: number;
  height: number;
  data: Uint8Array;
}

/**
 * Convert PDF to monochrome bitmap
 * @param pdfDataUri PDF data URI (data:application/pdf;base64,...)
 * @param options Width for rendering
 */
export async function pdfToBitmap(
  pdfDataUri: string,
  options: { width?: number } = {}
): Promise<BitmapResult> {
  const width = options.width || 384; // 80mm printer default
  
  console.log('📄 Loading PDF document...');
  
  // Load PDF
  const loadingTask = getDocument(pdfDataUri);
  const pdf = await loadingTask.promise;
  
  console.log(`📄 PDF loaded, ${pdf.numPages} pages`);
  
  // Get first page
  const page = await pdf.getPage(1);
  
  // Calculate scale to match target width
  const viewport = page.getViewport({ scale: 1 });
  const scale = width / viewport.width;
  const scaledViewport = page.getViewport({ scale });
  
  console.log(`📐 Rendering at ${scaledViewport.width}x${scaledViewport.height}px (scale: ${scale.toFixed(2)})`);
  
  // Create canvas
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  if (!context) {
    throw new Error('Could not get canvas context');
  }
  
  canvas.width = scaledViewport.width;
  canvas.height = scaledViewport.height;
  
  // Render PDF page to canvas
  await page.render({
    canvasContext: context,
    viewport: scaledViewport
  }).promise;
  
  console.log('✅ PDF rendered to canvas');
  
  // Get image data
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  
  // Convert to monochrome
  console.log('🎨 Converting to monochrome bitmap...');
  const monoData = convertToMonochrome(imageData, canvas.width, canvas.height);
  
  console.log(`✅ Bitmap created: ${canvas.width}x${canvas.height}px`);
  
  return {
    width: canvas.width,
    height: canvas.height,
    data: monoData
  };
}

/**
 * Convert ImageData to 1-bit monochrome bitmap
 */
function convertToMonochrome(
  imageData: ImageData,
  width: number,
  height: number
): Uint8Array {
  const { data } = imageData;
  const bytesPerLine = Math.ceil(width / 8);
  const totalBytes = bytesPerLine * height;
  const monoData = new Uint8Array(totalBytes);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIndex = (y * width + x) * 4;
      const r = data[pixelIndex];
      const g = data[pixelIndex + 1];
      const b = data[pixelIndex + 2];
      
      // Calculate grayscale value
      const gray = (r + g + b) / 3;
      
      // Threshold: < 128 = black (1), >= 128 = white (0)
      const isBlack = gray < 128 ? 1 : 0;
      
      // Pack into byte array
      const byteIndex = y * bytesPerLine + Math.floor(x / 8);
      const bitIndex = 7 - (x % 8);
      
      if (isBlack) {
        monoData[byteIndex] |= (1 << bitIndex);
      }
    }
  }
  
  return monoData;
}

/**
 * Encode bitmap to ESC/POS format (GS v 0 command)
 */
export function encodeBitmapToESCPOS(bitmap: BitmapResult): Uint8Array {
  const { width, height, data } = bitmap;
  const bytesPerLine = Math.ceil(width / 8);
  
  // ESC/POS GS v 0 command header
  const header = new Uint8Array([
    0x1D, 0x76, 0x30,           // GS v 0
    0x00,                        // Normal mode
    bytesPerLine & 0xFF,         // xL (width low byte)
    (bytesPerLine >> 8) & 0xFF,  // xH (width high byte)
    height & 0xFF,               // yL (height low byte)
    (height >> 8) & 0xFF         // yH (height high byte)
  ]);
  
  // Combine header + bitmap data
  const result = new Uint8Array(header.length + data.length);
  result.set(header, 0);
  result.set(data, header.length);
  
  return result;
}
