export interface NetworkPrinter {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  bridgeUrl: string;
  isActive: boolean;
  createdAt: string;
}

/**
 * Lấy máy in đang active từ localStorage
 * @returns Máy in đầu tiên có isActive = true, hoặc null nếu không có
 */
export const getActivePrinter = (): NetworkPrinter | null => {
  try {
    const printersJson = localStorage.getItem("networkPrinters");
    if (!printersJson) return null;
    
    const printers: NetworkPrinter[] = JSON.parse(printersJson);
    const activePrinter = printers.find(p => p.isActive === true);
    
    return activePrinter || null;
  } catch (error) {
    console.error("Error loading active printer:", error);
    return null;
  }
};

/**
 * In PDF lên máy in XC80 qua bitmap conversion
 * @param printer Thông tin máy in
 * @param pdfDataUri PDF data URI (data:application/pdf;base64,...)
 * @returns Promise với kết quả in
 */
export const printPDFToXC80 = async (
  printer: NetworkPrinter,
  pdfDataUri: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('📄 Converting PDF to bitmap...');
    
    // Dynamic import to avoid loading PDF.js until needed
    const { pdfToBitmap, encodeBitmapToESCPOS } = await import('./pdf-to-bitmap');
    
    // Step 1: PDF → Bitmap
    const bitmap = await pdfToBitmap(pdfDataUri, { width: 384 });
    console.log(`✅ Bitmap created: ${bitmap.width}x${bitmap.height}px`);
    
    // Step 2: Bitmap → ESC/POS
    const escposData = encodeBitmapToESCPOS(bitmap);
    
    // Step 3: Add paper feed + cut commands
    const cutCommands = new Uint8Array([
      0x1B, 0x64, 0x03,  // ESC d 3 - Feed 3 lines
      0x1D, 0x56, 0x00   // GS V 0 - Full cut
    ]);
    
    const finalData = new Uint8Array(escposData.length + cutCommands.length);
    finalData.set(escposData, 0);
    finalData.set(cutCommands, escposData.length);
    
    console.log(`✅ ESC/POS data ready: ${finalData.length} bytes`);
    
    // Step 4: Encode to base64
    const base64Bitmap = btoa(String.fromCharCode(...finalData));
    
    console.log(`📦 Sending to print bridge: ${printer.bridgeUrl}/print-bitmap`);
    
    // Step 5: Send to bridge
    const response = await fetch(`${printer.bridgeUrl}/print-bitmap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ip: printer.ipAddress,
        port: printer.port,
        bitmap: base64Bitmap
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    console.log('✅ Print result:', result);
    
    return { success: true };
    
  } catch (error: any) {
    console.error('❌ PDF print error:', error);
    return {
      success: false,
      error: error.message || 'Không thể in PDF'
    };
  }
};

/**
 * In nội dung text lên máy in XC80 qua Print Bridge
 * @param printer Thông tin máy in
 * @param content Nội dung text cần in
 * @param options Tùy chọn in (mode, align, feeds)
 * @returns Promise với kết quả in
 */
export const printToXC80 = async (
  printer: NetworkPrinter,
  content: string,
  options?: {
    mode?: 'cp1258' | 'no-accents' | 'utf8';
    align?: 'left' | 'center' | 'right';
    feeds?: number;
  }
): Promise<{ success: boolean; error?: string }> => {
  try {
    const printOptions = {
      mode: options?.mode || 'cp1258',
      align: options?.align || 'center',
      feeds: options?.feeds || 3,
    };

    // 🆕 ENCODE CONTENT THÀNH BASE64
    const contentBase64 = btoa(
      encodeURIComponent(content).replace(/%([0-9A-F]{2})/g, (match, p1) => {
        return String.fromCharCode(parseInt(p1, 16));
      })
    );

    console.log('📦 Original content:', content);
    console.log('📦 Base64 encoded:', contentBase64);

    const response = await fetch(`${printer.bridgeUrl}/print`, {
      method: "POST",
      headers: { "Content-Type": "application/json;charset=UTF-8" },
      body: JSON.stringify({
        ipAddress: printer.ipAddress,
        port: printer.port,
        contentBase64: contentBase64,  // 🆕 Gửi Base64 thay vì content
        options: printOptions,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('🖨️ Print result:', result);
    return result;
  } catch (error: any) {
    console.error("XC80 print error:", error);
    return { 
      success: false, 
      error: error.message || "Không thể kết nối với Print Bridge" 
    };
  }
};
