import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, FileText, Download, Printer } from "lucide-react";
import { jsPDF } from "jspdf";
import { getActivePrinter } from "@/lib/printer-utils";
import { textToESCPOSBitmap } from "@/lib/text-to-bitmap";

export const TextToPdfPrinter = () => {
  const [text, setText] = useState("");
  const [fontSize, setFontSize] = useState("12");
  const [lineHeight, setLineHeight] = useState("1.5");
  const [pageSize, setPageSize] = useState<"a4" | "a5" | "receipt">("receipt");
  const [pdfPreview, setPdfPreview] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const handleGeneratePdf = () => {
    if (!text.trim()) {
      toast.error("Vui lòng nhập nội dung cần tạo PDF");
      return;
    }

    setIsGenerating(true);
    try {
      // Create PDF document
      let pdf: jsPDF;
      let pageWidth: number;
      
      if (pageSize === "receipt") {
        // 80mm thermal receipt (80mm x unlimited height)
        pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: [80, 297] // 80mm width, A4 height as default
        });
        pageWidth = 80;
      } else if (pageSize === "a5") {
        pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a5"
        });
        pageWidth = 148;
      } else {
        pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4"
        });
        pageWidth = 210;
      }

      // Set font
      pdf.setFont("helvetica");
      const size = parseInt(fontSize);
      pdf.setFontSize(size);

      // Calculate margins and content width
      const margin = pageSize === "receipt" ? 5 : 15;
      const contentWidth = pageWidth - (margin * 2);
      
      // Split text into lines that fit the page width
      const lines = pdf.splitTextToSize(text, contentWidth);
      
      // Add text with line height
      const lineHeightMm = size * parseFloat(lineHeight) * 0.352778; // Convert pt to mm
      let y = margin;
      
      lines.forEach((line: string, index: number) => {
        if (y > (pageSize === "receipt" ? 280 : (pageSize === "a5" ? 195 : 280))) {
          pdf.addPage();
          y = margin;
        }
        pdf.text(line, margin, y);
        y += lineHeightMm;
      });

      // Generate preview
      const pdfDataUri = pdf.output("datauristring");
      setPdfPreview(pdfDataUri);
      
      toast.success("✅ Đã tạo PDF thành công!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("❌ Lỗi khi tạo PDF");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!pdfPreview) {
      toast.error("Vui lòng tạo PDF trước");
      return;
    }

    try {
      const link = document.createElement("a");
      link.href = pdfPreview;
      link.download = `document-${Date.now()}.pdf`;
      link.click();
      toast.success("✅ Đã tải PDF xuống!");
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast.error("❌ Lỗi khi tải xuống PDF");
    }
  };

  const handlePrint = async () => {
    const activePrinter = getActivePrinter();
    if (!activePrinter) {
      toast.error("❌ Không tìm thấy máy in đang active");
      return;
    }

    if (!text.trim()) {
      toast.error("Vui lòng nhập nội dung cần in");
      return;
    }

    setIsPrinting(true);
    try {
      // For thermal printer, we convert text directly to ESC/POS bitmap
      // (Thermal printers can't print PDF directly)
      const escposData = await textToESCPOSBitmap(text, {
        width: 576, // 80mm = 576 pixels for thermal printer
        fontSize: parseInt(fontSize),
        fontFamily: "monospace",
        lineHeight: parseFloat(lineHeight),
        align: "left",
        padding: 10,
      });

      // Convert Uint8Array to base64
      const base64 = btoa(String.fromCharCode(...escposData));

      const response = await fetch(`${activePrinter.bridgeUrl}/print-raw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ipAddress: activePrinter.ipAddress,
          port: activePrinter.port,
          dataBase64: base64,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        toast.success("✅ In thành công!");
      } else {
        throw new Error(result.error || "In thất bại");
      }
    } catch (error: any) {
      console.error("Print error:", error);
      toast.error(`❌ Lỗi khi in: ${error.message}`);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Text to PDF Printer
        </CardTitle>
        <CardDescription>
          Chuyển văn bản thành PDF, có thể xem trước, in trực tiếp hoặc tải xuống
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Text Input */}
        <div className="space-y-2">
          <Label htmlFor="pdf-text">Nội dung văn bản</Label>
          <Textarea
            id="pdf-text"
            placeholder="Nhập nội dung cần tạo PDF..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            className="font-mono"
          />
        </div>

        {/* Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="pdf-font-size">Cỡ chữ (pt)</Label>
            <Input
              id="pdf-font-size"
              type="number"
              min="8"
              max="72"
              value={fontSize}
              onChange={(e) => setFontSize(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pdf-line-height">Line Height</Label>
            <Input
              id="pdf-line-height"
              type="number"
              min="1"
              max="3"
              step="0.1"
              value={lineHeight}
              onChange={(e) => setLineHeight(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pdf-page-size">Khổ giấy</Label>
            <Select value={pageSize} onValueChange={(v: any) => setPageSize(v)}>
              <SelectTrigger id="pdf-page-size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="receipt">Receipt (80mm)</SelectItem>
                <SelectItem value="a5">A5</SelectItem>
                <SelectItem value="a4">A4</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={handleGeneratePdf} 
            disabled={isGenerating}
            variant="default"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Đang tạo...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Tạo PDF
              </>
            )}
          </Button>

          <Button 
            onClick={handlePrint} 
            disabled={isPrinting || !text.trim()}
            variant="secondary"
          >
            {isPrinting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Đang in...
              </>
            ) : (
              <>
                <Printer className="h-4 w-4 mr-2" />
                In trực tiếp
              </>
            )}
          </Button>

          <Button 
            onClick={handleDownload} 
            disabled={!pdfPreview}
            variant="outline"
          >
            <Download className="h-4 w-4 mr-2" />
            Tải PDF xuống
          </Button>
        </div>

        {/* PDF Preview */}
        {pdfPreview && (
          <div className="space-y-2">
            <Label>Xem trước PDF</Label>
            <div className="border rounded-lg overflow-hidden bg-muted/30">
              <iframe
                src={pdfPreview}
                className="w-full h-[600px]"
                title="PDF Preview"
              />
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="text-sm text-muted-foreground space-y-1 pt-2 border-t">
          <p>💡 <strong>Hướng dẫn:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Tạo PDF:</strong> Tạo file PDF để xem trước</li>
            <li><strong>In trực tiếp:</strong> In text lên máy in nhiệt (chuyển đổi thành bitmap)</li>
            <li><strong>Tải xuống:</strong> Lưu file PDF về máy</li>
            <li>Máy in nhiệt chỉ in được bitmap nên chức năng "In trực tiếp" sẽ chuyển text thành ảnh</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
