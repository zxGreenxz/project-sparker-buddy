/**
 * Template to Bitmap Converter
 * Render printer template (with line styles and placeholder sizes) to bitmap for thermal printing
 */

import { PrinterTemplate, applyTemplate } from './printer-template-utils';
import { encodeBitmapToESCPOS, BitmapResult } from './text-to-bitmap';

export interface TemplateBitmapOptions {
  template: PrinterTemplate;
  data: Record<string, string>;
}

/**
 * Parse HTML string and extract text content with inline styles
 */
function parseHTMLContent(html: string): Array<{ text: string; fontSize?: number }> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const div = doc.querySelector('div');
  
  if (!div) return [{ text: html }];
  
  const segments: Array<{ text: string; fontSize?: number }> = [];
  
  function traverse(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text.trim()) {
        segments.push({ text });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      if (element.tagName === 'SPAN') {
        const style = element.getAttribute('style') || '';
        const fontSizeMatch = style.match(/font-size:\s*(\d+)pt/);
        const fontSize = fontSizeMatch ? parseInt(fontSizeMatch[1]) : undefined;
        
        segments.push({
          text: element.textContent || '',
          fontSize
        });
      } else {
        // Traverse children
        node.childNodes.forEach(traverse);
      }
    }
  }
  
  div.childNodes.forEach(traverse);
  
  return segments;
}

/**
 * Convert template with data to bitmap
 */
export async function templateToBitmap(
  options: TemplateBitmapOptions
): Promise<BitmapResult> {
  const { template, data } = options;
  const { settings, lineStyles, placeholderSizes } = template;
  
  // Apply template to get formatted content
  const formattedContent = applyTemplate(template, data);
  
  // Split into lines
  const lines = formattedContent.split('\n');
  
  // Create canvas
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }
  
  // Set canvas width based on template settings
  canvas.width = settings.width;
  
  // Calculate total height needed
  let totalHeight = settings.padding * 2;
  const lineHeights: number[] = [];
  
  lines.forEach((line, index) => {
    const lineKey = `line${index + 1}`;
    const lineStyle = lineStyles[lineKey];
    const fontSize = lineStyle?.fontSize || settings.fontSize;
    const lineHeight = fontSize * settings.lineHeight;
    lineHeights.push(lineHeight);
    totalHeight += lineHeight;
  });
  
  canvas.height = Math.ceil(totalHeight);
  
  // Fill white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Set default text properties
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';
  
  // Draw each line
  let currentY = settings.padding;
  
  lines.forEach((line, index) => {
    const lineKey = `line${index + 1}`;
    const lineStyle = lineStyles[lineKey];
    const fontSize = lineStyle?.fontSize || settings.fontSize;
    const isBold = lineStyle?.bold || false;
    const isItalic = lineStyle?.italic || false;
    
    // Set font for this line
    const fontWeight = isBold ? 'bold' : 'normal';
    const fontStyle = isItalic ? 'italic' : 'normal';
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}pt ${settings.fontFamily}`;
    
    // Set alignment
    let xPos = settings.padding;
    ctx.textAlign = 'left';
    
    if (settings.align === 'center') {
      xPos = canvas.width / 2;
      ctx.textAlign = 'center';
    } else if (settings.align === 'right') {
      xPos = canvas.width - settings.padding;
      ctx.textAlign = 'right';
    }
    
    // Check if line contains HTML spans (for placeholder sizes)
    if (line.includes('<span')) {
      // Parse HTML segments
      const segments = parseHTMLContent(line);
      
      // For center/right alignment with spans, we need to measure total width first
      if (settings.align === 'center' || settings.align === 'right') {
        let totalWidth = 0;
        segments.forEach(seg => {
          const segFontSize = seg.fontSize || fontSize;
          ctx.font = `${fontStyle} ${fontWeight} ${segFontSize}pt ${settings.fontFamily}`;
          totalWidth += ctx.measureText(seg.text).width;
        });
        
        if (settings.align === 'center') {
          xPos = (canvas.width - totalWidth) / 2;
        } else {
          xPos = canvas.width - settings.padding - totalWidth;
        }
      }
      
      // Draw each segment
      let currentX = xPos;
      segments.forEach(seg => {
        const segFontSize = seg.fontSize || fontSize;
        ctx.font = `${fontStyle} ${fontWeight} ${segFontSize}pt ${settings.fontFamily}`;
        ctx.fillText(seg.text, currentX, currentY);
        currentX += ctx.measureText(seg.text).width;
      });
    } else {
      // Plain text line
      ctx.fillText(line, xPos, currentY);
    }
    
    currentY += lineHeights[index];
  });
  
  // Get image data and convert to monochrome
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const monoData = convertToMonochrome(imageData);
  
  return {
    width: canvas.width,
    height: canvas.height,
    data: monoData
  };
}

/**
 * Convert ImageData to monochrome (1-bit) bitmap
 */
function convertToMonochrome(imageData: ImageData): Uint8Array {
  const { width, height, data } = imageData;
  
  const bytesPerLine = Math.ceil(width / 8);
  const totalBytes = bytesPerLine * height;
  const monoData = new Uint8Array(totalBytes);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIndex = (y * width + x) * 4;
      
      const r = data[pixelIndex];
      const g = data[pixelIndex + 1];
      const b = data[pixelIndex + 2];
      
      const gray = (r + g + b) / 3;
      const isBlack = gray < 128 ? 1 : 0;
      
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
 * Main function: Template → Bitmap → ESC/POS bytes
 */
export async function templateToESCPOSBitmap(
  options: TemplateBitmapOptions
): Promise<Uint8Array> {
  console.log('🖼️ Converting template to bitmap...');
  
  // Render template to bitmap
  const bitmap = await templateToBitmap(options);
  console.log(`✅ Bitmap created: ${bitmap.width}x${bitmap.height} pixels`);
  
  // Encode to ESC/POS format
  const escposData = encodeBitmapToESCPOS(bitmap);
  console.log(`✅ ESC/POS encoded: ${escposData.length} bytes`);
  
  // Add paper feed commands
  const feedCommands = new Uint8Array([
    0x1B, 0x64, 0x03  // ESC d 3 - Feed 3 lines
  ]);
  
  const result = new Uint8Array(escposData.length + feedCommands.length);
  result.set(escposData, 0);
  result.set(feedCommands, escposData.length);
  
  return result;
}
