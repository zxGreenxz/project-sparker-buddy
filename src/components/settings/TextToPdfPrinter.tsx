import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, FileText, Download, Printer } from "lucide-react";
import { getActivePrinter } from "@/lib/printer-utils";
import { textToESCPOSBitmap } from "@/lib/text-to-bitmap";
import jsPDF from "jspdf";

export const TextToPdfPrinter = () => {
  const [text, setText] = useState("");
  const [fontSize, setFontSize] = useState("14");
  const [lineHeight, setLineHeight] = useState("1.5");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const handleGeneratePreview = async () => {
    if (!text.trim()) {
      toast.error("Vui lòng nhập nội dung cần xem trước");
      return;
    }

    setIsGenerating(true);
    try {
      // Create canvas with Tahoma font
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Cannot get canvas context");

      const width = 576; // 80mm = 576 pixels
      const padding = 10;
      const fontSizeNum = parseInt(fontSize);
      const lineHeightNum = parseFloat(lineHeight);
      
      ctx.font = `${fontSizeNum}px Tahoma, sans-serif`;
      
      // Split text into lines
      const lines: string[] = [];
      const textLines = text.split("\n");
      const maxWidth = width - (padding * 2);
      
      textLines.forEach((line) => {
        if (!line) {
          lines.push("");
          return;
        }
        
        const words = line.split(" ");
        let currentLine = "";
        
        words.forEach((word) => {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const metrics = ctx.measureText(testLine);
          
          if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        });
        
        if (currentLine) {
          lines.push(currentLine);
        }
      });
      
      // Calculate canvas height
      const lineHeightPx = fontSizeNum * lineHeightNum;
      const height = Math.ceil(lines.length * lineHeightPx + (padding * 2));
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw white background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      
      // Draw text with Tahoma
      ctx.font = `${fontSizeNum}px Tahoma, sans-serif`;
      ctx.fillStyle = "#000000";
      ctx.textBaseline = "top";
      
      lines.forEach((line, index) => {
        const y = padding + (index * lineHeightPx);
        ctx.fillText(line, padding, y);
      });
      
      // Convert to image
      const imageUrl = canvas.toDataURL("image/png");
      setPreviewImage(imageUrl);
      
      toast.success("✅ Đã tạo ảnh xem trước!");
    } catch (error) {
      console.error("Preview error:", error);
      toast.error("❌ Lỗi khi tạo ảnh xem trước");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadImage = () => {
    if (!previewImage) {
      toast.error("Vui lòng tạo ảnh xem trước trước");
      return;
    }

    try {
      const link = document.createElement("a");
      link.href = previewImage;
      link.download = `print-preview-${Date.now()}.png`;
      link.click();
      toast.success("✅ Đã tải ảnh xuống!");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("❌ Lỗi khi tải xuống");
    }
  };

  const handleDownloadPDF = () => {
    if (!text.trim()) {
      toast.error("Vui lòng nhập nội dung");
      return;
    }

    try {
      const doc = new jsPDF();
      
      // Set font to support Vietnamese
      doc.setFont("helvetica");
      doc.setFontSize(parseInt(fontSize));
      
      // Split text into lines and add to PDF
      const lines = doc.splitTextToSize(text, 180); // 180mm width for A4
      doc.text(lines, 15, 15);
      
      // Save PDF
      doc.save(`document-${Date.now()}.pdf`);
      toast.success("✅ Đã tải PDF xuống!");
    } catch (error) {
      console.error("PDF error:", error);
      toast.error("❌ Lỗi khi tạo PDF");
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
      // Convert text to ESC/POS bitmap with Tahoma font
      const escposData = await textToESCPOSBitmap(text, {
        width: 576, // 80mm = 576 pixels for thermal printer
        fontSize: parseInt(fontSize),
        fontFamily: "Tahoma, sans-serif",
        lineHeight: parseFloat(lineHeight),
        align: "left",
        padding: 10,
      });

      // Convert Uint8Array to base64
      const base64 = btoa(String.fromCharCode(...escposData));

      const response = await fetch(`${activePrinter.bridgeUrl}/print/bitmap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ipAddress: activePrinter.ipAddress,
          port: activePrinter.port,
          bitmapBase64: base64,
          feeds: 3,
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
      if (error.message?.includes("404") || error.message?.includes("Failed to fetch")) {
        toast.error("❌ Không kết nối được máy in. Vui lòng kiểm tra:\n1. Print Bridge đang chạy\n2. Địa chỉ máy in đúng\n3. Máy in đang bật");
      } else {
        toast.error(`❌ Lỗi khi in: ${error.message}`);
      }
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Text to PDF & Printer (Tahoma Font)
        </CardTitle>
        <CardDescription>
          Tạo PDF hoặc in văn bản trực tiếp lên máy in nhiệt với font Tahoma hỗ trợ tiếng Việt
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Text Input */}
        <div className="space-y-2">
          <Label htmlFor="printer-text">Nội dung văn bản (Font Tahoma)</Label>
          <Textarea
            id="printer-text"
            placeholder="Nhập nội dung cần in..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            style={{ fontFamily: "Tahoma, sans-serif" }}
          />
        </div>

        {/* Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="printer-font-size">Cỡ chữ (px)</Label>
            <Input
              id="printer-font-size"
              type="number"
              min="10"
              max="48"
              value={fontSize}
              onChange={(e) => setFontSize(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="printer-line-height">Line Height</Label>
            <Input
              id="printer-line-height"
              type="number"
              min="1"
              max="3"
              step="0.1"
              value={lineHeight}
              onChange={(e) => setLineHeight(e.target.value)}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={handleGeneratePreview} 
            disabled={isGenerating || !text.trim()}
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
                Tạo ảnh xem trước
              </>
            )}
          </Button>

          <Button 
            onClick={handleDownloadPDF} 
            disabled={!text.trim()}
            variant="secondary"
          >
            <Download className="h-4 w-4 mr-2" />
            Tải PDF xuống
          </Button>

          <Button 
            onClick={handleDownloadImage} 
            disabled={!previewImage}
            variant="secondary"
          >
            <Download className="h-4 w-4 mr-2" />
            Tải ảnh xuống
          </Button>

          <Button 
            onClick={handlePrint} 
            disabled={isPrinting || !text.trim()}
            variant="outline"
          >
            {isPrinting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Đang in...
              </>
            ) : (
              <>
                <Printer className="h-4 w-4 mr-2" />
                In ngay
              </>
            )}
          </Button>
        </div>

        {/* Preview Image */}
        {previewImage && (
          <div className="space-y-2">
            <Label>Xem trước ảnh sẽ in (Font Tahoma)</Label>
            <div className="border rounded-lg overflow-hidden bg-white p-4">
              <img 
                src={previewImage} 
                alt="Print Preview" 
                className="max-w-full h-auto"
              />
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="text-sm text-muted-foreground space-y-1 pt-2 border-t">
          <p>💡 <strong>Hướng dẫn:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Tải PDF:</strong> Nhấn "Tải PDF xuống" để tạo file PDF từ văn bản</li>
            <li><strong>Xem trước ảnh:</strong> Nhấn "Tạo ảnh xem trước" để xem kết quả in</li>
            <li><strong>Tải ảnh:</strong> Nhấn "Tải ảnh xuống" để lưu ảnh xem trước</li>
            <li><strong>In nhiệt:</strong> Nhấn "In ngay" để in lên máy in nhiệt (cần cấu hình Print Bridge)</li>
            <li><strong>Font Tahoma:</strong> Hỗ trợ tiếng Việt tốt, hiển thị chính xác dấu</li>
            <li><strong>Lưu ý:</strong> Nếu lỗi 404 khi in, kiểm tra Print Bridge và cấu hình máy in</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
