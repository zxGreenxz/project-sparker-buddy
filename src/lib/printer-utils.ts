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
