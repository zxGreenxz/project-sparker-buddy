import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, FileText, Download, Printer } from "lucide-react";
import { getActivePrinter } from "@/lib/printer-utils";
import { textToESCPOSBitmap } from "@/lib/text-to-bitmap";

export const TextToPdfPrinter = () => {
  const [text, setText] = useState("");
  const [fontSize, setFontSize] = useState("14");
  const [lineHeight, setLineHeight] = useState("1.5");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

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
          <Printer className="h-5 w-5" />
          Text Printer (Tahoma Font)
        </CardTitle>
        <CardDescription>
          In văn bản trực tiếp lên máy in nhiệt với font Tahoma hỗ trợ tiếng Việt
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

        {/* Action Button */}
        <Button 
          onClick={handlePrint} 
          disabled={isPrinting || !text.trim()}
          variant="default"
          className="w-full"
        >
          {isPrinting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Đang in...
            </>
          ) : (
            <>
              <Printer className="h-4 w-4 mr-2" />
              In ngay với Font Tahoma
            </>
          )}
        </Button>

        {/* Instructions */}
        <div className="text-sm text-muted-foreground space-y-1 pt-2 border-t">
          <p>💡 <strong>Hướng dẫn:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Font Tahoma:</strong> Hỗ trợ tiếng Việt tốt, hiển thị chính xác dấu</li>
            <li><strong>In trực tiếp:</strong> Chuyển text thành bitmap với font Tahoma rồi in</li>
            <li>Máy in nhiệt chỉ in được bitmap, không in được PDF trực tiếp</li>
            <li>Cỡ chữ và line height có thể điều chỉnh phù hợp</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
