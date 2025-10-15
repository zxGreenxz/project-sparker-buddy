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
 * @returns Promise với kết quả in
 */
export const printToXC80 = async (
  printer: NetworkPrinter,
  content: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await fetch(`${printer.bridgeUrl}/print`, {
      method: "POST",
      headers: { "Content-Type": "application/json;charset=UTF-8" },
      body: JSON.stringify({
        ipAddress: printer.ipAddress,
        port: printer.port,
        content: content,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  } catch (error: any) {
    console.error("XC80 print error:", error);
    return { 
      success: false, 
      error: error.message || "Không thể kết nối với Print Bridge" 
    };
  }
};
