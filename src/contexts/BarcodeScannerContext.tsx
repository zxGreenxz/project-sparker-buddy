import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type ScannerPage = 'live-products' | 'settings-test' | 'facebook-comments' | 'disabled';

interface ScannedBarcode {
  code: string;
  timestamp: string;
  productInfo?: {
    id: string;
    name: string;
    image_url?: string;
    product_code: string;
  };
}

interface BarcodeScannerContextType {
  enabledPage: ScannerPage;
  setEnabledPage: (page: ScannerPage) => void;
  lastScannedCode: string;
  scannedBarcodes: ScannedBarcode[];
  addScannedBarcode: (barcode: ScannedBarcode) => void;
  clearScannedBarcodes: () => void;
  removeScannedBarcode: (code: string) => void;
}

const BarcodeScannerContext = createContext<BarcodeScannerContextType | undefined>(undefined);

export function BarcodeScannerProvider({ children }: { children: ReactNode }) {
  const [enabledPage, setEnabledPageState] = useState<ScannerPage>(() => {
    const saved = localStorage.getItem('barcode_scanner_enabled_page');
    return (saved as ScannerPage) || 'disabled';
  });
  const [lastScannedCode, setLastScannedCode] = useState("");
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [scannedBarcodes, setScannedBarcodes] = useState<ScannedBarcode[]>(() => {
    const saved = localStorage.getItem('scanned_barcodes');
    return saved ? JSON.parse(saved) : [];
  });
  const barcodeBufferRef = useRef<string>("");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const setEnabledPage = (page: ScannerPage) => {
    setEnabledPageState(page);
    localStorage.setItem('barcode_scanner_enabled_page', page);
  };

  const addScannedBarcode = (barcode: ScannedBarcode) => {
    setScannedBarcodes(prev => {
      const updated = [barcode, ...prev];
      localStorage.setItem('scanned_barcodes', JSON.stringify(updated));
      return updated;
    });
  };

  const clearScannedBarcodes = () => {
    setScannedBarcodes([]);
    localStorage.removeItem('scanned_barcodes');
  };

  const removeScannedBarcode = (code: string) => {
    setScannedBarcodes(prev => {
      const updated = prev.filter(b => b.code !== code);
      localStorage.setItem('scanned_barcodes', JSON.stringify(updated));
      return updated;
    });
  };

  // Global keyboard listener
  useEffect(() => {
    if (enabledPage === 'disabled') return;

    const handleGlobalKeyPress = (e: KeyboardEvent) => {
      // Bỏ qua nếu đang focus vào textarea, input, hoặc contentEditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'INPUT' ||
        target.isContentEditable
      ) {
        return;
      }

      // Bỏ qua các phím điều khiển (trừ Enter)
      if (e.key.length > 1 && e.key !== 'Enter') {
        return;
      }

      // Nếu là Enter, xử lý barcode đã scan
      if (e.key === 'Enter') {
        e.preventDefault();
        if (barcodeBufferRef.current.trim().length > 0) {
          const scannedCode = barcodeBufferRef.current.trim();
          handleBarcodeScanned(scannedCode);
          barcodeBufferRef.current = "";
        }
        return;
      }

      // Thêm ký tự vào buffer
      barcodeBufferRef.current += e.key;

      // Clear timeout cũ
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set timeout mới - nếu 200ms không có ký tự nào nữa, reset buffer
      timeoutRef.current = setTimeout(() => {
        barcodeBufferRef.current = "";
      }, 200);
    };

    const handleBarcodeScanned = (code: string) => {
      setLastScannedCode(code);
      
      // Kiểm tra xem có đang ở đúng trang không
      const currentPath = location.pathname;
      const shouldBeOnPath = enabledPage === 'live-products' ? '/live-products' 
        : enabledPage === 'facebook-comments' ? '/facebook-comments'
        : '/settings';
      
      if (currentPath !== shouldBeOnPath) {
        // Không đúng trang, hiện dialog hỏi có muốn chuyển không
        setPendingNavigation(shouldBeOnPath);
      } else {
        // Đúng trang rồi, dispatch event để trang xử lý
        window.dispatchEvent(new CustomEvent('barcode-scanned', { detail: { code } }));
      }
    };

    window.addEventListener('keydown', handleGlobalKeyPress);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyPress);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabledPage, location.pathname]);

  const handleNavigate = () => {
    if (pendingNavigation) {
      navigate(pendingNavigation);
      setPendingNavigation(null);
      // Sau khi navigate, dispatch event
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('barcode-scanned', { detail: { code: lastScannedCode } }));
      }, 100);
    }
  };

  const handleCancel = () => {
    setPendingNavigation(null);
  };

  return (
    <BarcodeScannerContext.Provider value={{ 
      enabledPage, 
      setEnabledPage, 
      lastScannedCode,
      scannedBarcodes,
      addScannedBarcode,
      clearScannedBarcodes,
      removeScannedBarcode
    }}>
      {children}
      
      <AlertDialog open={!!pendingNavigation} onOpenChange={(open) => !open && handleCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Chuyển trang để quét barcode?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn đang quét barcode nhưng tính năng này chỉ hoạt động ở trang{" "}
              <strong>
                {enabledPage === 'live-products' ? 'Sản phẩm Live' 
                  : enabledPage === 'facebook-comments' ? 'Facebook Comments' 
                  : 'Settings Test'}
              </strong>.
              <br /><br />
              Bạn có muốn chuyển sang trang đó ngay bây giờ không?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleNavigate}>Chuyển trang</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </BarcodeScannerContext.Provider>
  );
}

export function useBarcodeScanner() {
  const context = useContext(BarcodeScannerContext);
  if (context === undefined) {
    throw new Error('useBarcodeScanner must be used within a BarcodeScannerProvider');
  }
  return context;
}
