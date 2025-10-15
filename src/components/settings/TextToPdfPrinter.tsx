import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Loader2, FileText, Download, Printer, ChevronDown, Settings2 } from "lucide-react";
import { getActivePrinter } from "@/lib/printer-utils";
import { textToESCPOSBitmap } from "@/lib/text-to-bitmap";
import jsPDF from "jspdf";

type PaperSize = {
  name: string;
  width: number;
  height: number;
};

const PAPER_SIZES: PaperSize[] = [
  { name: "A4 (210 x 297 mm)", width: 210, height: 297 },
  { name: "80mm Thermal (80 x 210 mm)", width: 80, height: 210 },
  { name: "58mm Thermal (58 x 210 mm)", width: 58, height: 210 },
  { name: "Custom", width: 80, height: 210 },
];

const VIETNAMESE_FONTS = [
  "Arial",
  "Tahoma",
  "Times New Roman",
  "Verdana",
  "Roboto",
  "Open Sans",
  "Noto Sans",
];

export const TextToPdfPrinter = () => {
  const [text, setText] = useState(`Hóa đơn bán hàng
Công ty TNHH ABC
Địa chỉ: 123 Nguyễn Huệ, Quận 1, TP.HCM
---------------------------------------
Sản phẩm: Điện thoại iPhone 15
Giá: 25.000.000 đ
Số lượng: 1
---------------------------------------
Tổng tiền: 25.000.000 đ
Cảm ơn quý khách!`);
  
  // Font settings
  const [fontSize, setFontSize] = useState("14");
  const [fontFamily, setFontFamily] = useState("Tahoma");
  const [lineHeight, setLineHeight] = useState("1.5");
  
  // Paper settings
  const [selectedPaperIndex, setSelectedPaperIndex] = useState(1); // 80mm thermal default
  const [customWidth, setCustomWidth] = useState("80");
  const [customHeight, setCustomHeight] = useState("210");
  
  // Margin settings
  const [marginTop, setMarginTop] = useState("10");
  const [marginBottom, setMarginBottom] = useState("10");
  const [marginLeft, setMarginLeft] = useState("10");
  const [marginRight, setMarginRight] = useState("10");
  
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const getPaperSize = () => {
    const paper = PAPER_SIZES[selectedPaperIndex];
    if (paper.name === "Custom") {
      return {
        width: parseFloat(customWidth),
        height: parseFloat(customHeight),
      };
    }
    return { width: paper.width, height: paper.height };
  };

  const handleGeneratePreview = async () => {
    if (!text.trim()) {
      toast.error("Vui lòng nhập nội dung cần xem trước");
      return;
    }

    setIsGenerating(true);
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Cannot get canvas context");

      const paperSize = getPaperSize();
      // Convert mm to pixels (assuming 96 DPI: 1mm ≈ 3.78 pixels)
      const mmToPx = 3.78;
      const width = Math.round(paperSize.width * mmToPx);
      
      const margins = {
        top: parseInt(marginTop),
        bottom: parseInt(marginBottom),
        left: parseInt(marginLeft),
        right: parseInt(marginRight),
      };
      
      const fontSizeNum = parseInt(fontSize);
      const lineHeightNum = parseFloat(lineHeight);
      
      ctx.font = `${fontSizeNum}px ${fontFamily}, sans-serif`;
      
      // Split text into lines
      const lines: string[] = [];
      const textLines = text.split("\n");
      const maxWidth = width - (margins.left + margins.right);
      
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
      const height = Math.ceil(lines.length * lineHeightPx + margins.top + margins.bottom);
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw white background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      
      // Draw text
      ctx.font = `${fontSizeNum}px ${fontFamily}, sans-serif`;
      ctx.fillStyle = "#000000";
      ctx.textBaseline = "top";
      
      lines.forEach((line, index) => {
        const y = margins.top + (index * lineHeightPx);
        ctx.fillText(line, margins.left, y);
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
      const paperSize = getPaperSize();
      const orientation = paperSize.width > paperSize.height ? "landscape" : "portrait";
      
      const doc = new jsPDF({
        orientation,
        unit: "mm",
        format: [paperSize.width, paperSize.height],
      });
      
      doc.setFont("helvetica");
      doc.setFontSize(parseInt(fontSize));
      
      const margins = {
        top: parseInt(marginTop),
        left: parseInt(marginLeft),
      };
      
      const maxWidth = paperSize.width - parseInt(marginLeft) - parseInt(marginRight);
      const lines = doc.splitTextToSize(text, maxWidth);
      doc.text(lines, margins.left, margins.top);
      
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
      const paperSize = getPaperSize();
      const mmToPx = 3.78;
      const printerWidth = Math.round(paperSize.width * mmToPx);
      
      // Convert text to ESC/POS bitmap
      const escposData = await textToESCPOSBitmap(text, {
        width: printerWidth,
        fontSize: parseInt(fontSize),
        fontFamily: `${fontFamily}, sans-serif`,
        lineHeight: parseFloat(lineHeight),
        align: "left",
        padding: parseInt(marginLeft),
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
          <Label htmlFor="printer-text">Nội dung văn bản</Label>
          <Textarea
            id="printer-text"
            placeholder="Nhập nội dung cần in..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            style={{ fontFamily: `${fontFamily}, sans-serif` }}
          />
        </div>

        {/* Basic Settings */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="font-family">Font chữ</Label>
            <Select value={fontFamily} onValueChange={setFontFamily}>
              <SelectTrigger id="font-family">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VIETNAMESE_FONTS.map((font) => (
                  <SelectItem key={font} value={font}>
                    {font}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="printer-font-size">Cỡ chữ (px)</Label>
            <Input
              id="printer-font-size"
              type="number"
              min="8"
              max="72"
              value={fontSize}
              onChange={(e) => setFontSize(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="printer-line-height">Khoảng cách dòng</Label>
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

        {/* Advanced Settings */}
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Cài đặt nâng cao (Khổ giấy & Canh lề)
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  advancedOpen ? "transform rotate-180" : ""
                }`}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            {/* Paper Size */}
            <div className="space-y-2">
              <Label htmlFor="paper-size">Khổ giấy</Label>
              <Select
                value={selectedPaperIndex.toString()}
                onValueChange={(val) => setSelectedPaperIndex(parseInt(val))}
              >
                <SelectTrigger id="paper-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAPER_SIZES.map((paper, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      {paper.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom Paper Size */}
            {PAPER_SIZES[selectedPaperIndex].name === "Custom" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="custom-width">Chiều rộng (mm)</Label>
                  <Input
                    id="custom-width"
                    type="number"
                    min="50"
                    max="300"
                    value={customWidth}
                    onChange={(e) => setCustomWidth(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custom-height">Chiều cao (mm)</Label>
                  <Input
                    id="custom-height"
                    type="number"
                    min="50"
                    max="500"
                    value={customHeight}
                    onChange={(e) => setCustomHeight(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Margins */}
            <div>
              <Label className="mb-2 block">Lề (mm)</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="margin-top" className="text-xs">
                    Trên
                  </Label>
                  <Input
                    id="margin-top"
                    type="number"
                    min="0"
                    max="50"
                    value={marginTop}
                    onChange={(e) => setMarginTop(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="margin-bottom" className="text-xs">
                    Dưới
                  </Label>
                  <Input
                    id="margin-bottom"
                    type="number"
                    min="0"
                    max="50"
                    value={marginBottom}
                    onChange={(e) => setMarginBottom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="margin-left" className="text-xs">
                    Trái
                  </Label>
                  <Input
                    id="margin-left"
                    type="number"
                    min="0"
                    max="50"
                    value={marginLeft}
                    onChange={(e) => setMarginLeft(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="margin-right" className="text-xs">
                    Phải
                  </Label>
                  <Input
                    id="margin-right"
                    type="number"
                    min="0"
                    max="50"
                    value={marginRight}
                    onChange={(e) => setMarginRight(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

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
          <p>💡 <strong>Hướng dẫn sử dụng:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Chọn font:</strong> Tất cả font đều hỗ trợ tiếng Việt đầy đủ</li>
            <li><strong>Khổ giấy:</strong> Mở "Cài đặt nâng cao" để chọn khổ giấy phù hợp</li>
            <li><strong>Canh lề:</strong> Điều chỉnh lề trên/dưới/trái/phải theo nhu cầu</li>
            <li><strong>Xem trước:</strong> Kiểm tra bố cục trước khi in hoặc tải xuống</li>
            <li><strong>In nhiệt:</strong> Cần cấu hình máy in và Print Bridge</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
