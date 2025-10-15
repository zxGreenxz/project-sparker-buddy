import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, FileText, Download, Printer } from "lucide-react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
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
  const contentRef = useRef<HTMLDivElement>(null);

  const handleGeneratePdf = async () => {
    if (!text.trim()) {
      toast.error("Vui lòng nhập nội dung cần tạo PDF");
      return;
    }

    setIsGenerating(true);
    try {
      if (!contentRef.current) {
        throw new Error("Content ref not available");
      }

      // Render HTML content to canvas with Tahoma font
      const canvas = await html2canvas(contentRef.current, {
        scale: 2, // Higher quality
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      // Determine page dimensions in mm
      let pageWidth: number;
      let pageHeight: number;
      
      if (pageSize === "receipt") {
        pageWidth = 80; // 80mm thermal receipt width
        pageHeight = 297; // A4 height as fallback
      } else if (pageSize === "a5") {
        pageWidth = 148;
        pageHeight = 210;
      } else {
        pageWidth = 210;
        pageHeight = 297;
      }

      // Create PDF with correct dimensions
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [pageWidth, pageHeight],
      });

      // Calculate image dimensions to fit PDF page
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Add image to PDF (split into pages if needed)
      let heightLeft = imgHeight;
      let position = 0;
      const imgData = canvas.toDataURL("image/png");

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add more pages if content is longer than one page
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Generate preview
      const pdfDataUri = pdf.output("datauristring");
      setPdfPreview(pdfDataUri);
      
      toast.success("✅ Đã tạo PDF thành công với font Tahoma!");
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
        {/* Hidden content div for rendering with Tahoma font */}
        <div 
          ref={contentRef}
          style={{
            position: "absolute",
            left: "-9999px",
            top: "0",
            width: pageSize === "receipt" ? "80mm" : pageSize === "a5" ? "148mm" : "210mm",
            padding: pageSize === "receipt" ? "5mm" : "15mm",
            fontFamily: "Tahoma, sans-serif",
            fontSize: `${fontSize}px`,
            lineHeight: lineHeight,
            backgroundColor: "#ffffff",
            color: "#000000",
            whiteSpace: "pre-wrap",
            wordWrap: "break-word",
          }}
        >
          {text}
        </div>

        {/* Text Input */}
        <div className="space-y-2">
          <Label htmlFor="pdf-text">Nội dung văn bản (Font Tahoma)</Label>
          <Textarea
            id="pdf-text"
            placeholder="Nhập nội dung cần tạo PDF..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            style={{ fontFamily: "Tahoma, sans-serif" }}
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
            <li><strong>Font Tahoma:</strong> Hỗ trợ tiếng Việt tốt, hiển thị chính xác</li>
            <li><strong>Tạo PDF:</strong> Chuyển text thành PDF với font Tahoma</li>
            <li><strong>In trực tiếp:</strong> In text lên máy in nhiệt (bitmap)</li>
            <li><strong>Tải xuống:</strong> Lưu file PDF về máy</li>
            <li>PDF được tạo bằng cách render HTML với font Tahoma rồi chuyển thành ảnh trong PDF</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
