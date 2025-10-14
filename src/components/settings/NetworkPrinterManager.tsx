import { useState, useEffect } from "react";
import { Printer, Plus, Trash2, TestTube2, RefreshCw, AlertCircle, CheckCircle, Wifi, Download, FileCode, Package, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface NetworkPrinter {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  bridgeUrl: string;
  isActive: boolean;
  createdAt: string;
}

// Bridge server code embedded (truncated for brevity - use full code from artifact)
const BRIDGE_SERVER_CODE = `// See xc80-bridge-multimode.js artifact for full code`;

const PACKAGE_JSON = `{
  "name": "xc80-print-bridge",
  "version": "4.0.0",
  "description": "XC80 Print Bridge - Multi-Mode Vietnamese",
  "main": "xc80-bridge-multimode.js",
  "scripts": {
    "start": "node xc80-bridge-multimode.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "iconv-lite": "^0.6.3"
  }
}`;

export default function NetworkPrinterManager() {
  const [printers, setPrinters] = useState<NetworkPrinter[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [selectedPrinter, setSelectedPrinter] = useState<NetworkPrinter | null>(null);
  
  const [newPrinterName, setNewPrinterName] = useState("");
  const [newPrinterIp, setNewPrinterIp] = useState("");
  const [newPrinterPort, setNewPrinterPort] = useState("9100");
  const [bridgeUrl, setBridgeUrl] = useState("http://localhost:9100");
  
  // Encoding mode selection
  const [printMode, setPrintMode] = useState<'no-accents' | 'utf8' | 'cp1258'>('no-accents');
  
  const [testContent, setTestContent] = useState(
    "================================\n" +
    "     XC80 TEST TIENG VIET\n" +
    "================================\n" +
    "May in: [Printer Name]\n" +
    "IP: [IP Address]\n" +
    "Thoi gian: [Time]\n" +
    "--------------------------------\n" +
    "In thu tieng Viet:\n" +
    "- Xin chao Viet Nam!\n" +
    "- Day la ban in thu nghiem.\n" +
    "- Cac ky tu: aaaaaeeeee\n" +
    "- Gia: 150,000 VND\n" +
    "================================\n\n\n"
  );
  const [isPrinting, setIsPrinting] = useState(false);
  const [printResult, setPrintResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState<string | null>(null);

  useEffect(() => {
    loadPrinters();
  }, []);

  useEffect(() => {
    // Update test content based on mode
    if (printMode === 'no-accents') {
      setTestContent(
        "================================\n" +
        "     XC80 TEST TIENG VIET\n" +
        "================================\n" +
        "May in: [Printer Name]\n" +
        "IP: [IP Address]\n" +
        "Thoi gian: [Time]\n" +
        "--------------------------------\n" +
        "In thu tieng Viet (KHONG DAU):\n" +
        "- Xin chao Viet Nam!\n" +
        "- Day la ban in thu nghiem.\n" +
        "- Cac ky tu: aaaaaeeeee\n" +
        "- Gia: 150,000 VND\n" +
        "================================\n\n\n"
      );
    } else {
      setTestContent(
        "================================\n" +
        "     XC80 TEST TIẾNG VIỆT\n" +
        "================================\n" +
        "Máy in: [Printer Name]\n" +
        "IP: [IP Address]\n" +
        "Thời gian: [Time]\n" +
        "--------------------------------\n" +
        "In thử tiếng Việt (CÓ DẤU):\n" +
        "- Xin chào Việt Nam!\n" +
        "- Đây là bản in thử nghiệm.\n" +
        "- Các ký tự: áàảãạ éèẻẽẹ\n" +
        "- Giá: 150,000 VNĐ\n" +
        "================================\n\n\n"
      );
    }
  }, [printMode]);

  const loadPrinters = () => {
    const stored = localStorage.getItem("networkPrinters");
    if (stored) {
      setPrinters(JSON.parse(stored));
    }
  };

  const savePrinters = (updatedPrinters: NetworkPrinter[]) => {
    localStorage.setItem("networkPrinters", JSON.stringify(updatedPrinters));
    setPrinters(updatedPrinters);
  };

  const downloadFile = (content: string, filename: string, type: string = 'text/javascript') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadBridgeServer = () => {
    alert('⚠️ Vui lòng copy code từ artifact "xc80-bridge-multimode.js" vì code quá dài để embed trực tiếp.');
  };

  const handleDownloadPackageJson = () => {
    downloadFile(PACKAGE_JSON, 'package.json', 'application/json');
  };

  const testPrinterConnection = async (printer: NetworkPrinter) => {
    setIsTesting(printer.id);
    try {
      const response = await fetch(`${printer.bridgeUrl}/printers/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ipAddress: printer.ipAddress,
          port: printer.port,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        alert(`✅ Kết nối thành công đến ${printer.name}!`);
      } else {
        alert(`❌ Không thể kết nối: ${data.error}`);
      }
    } catch (error: any) {
      alert(`❌ Lỗi: ${error.message}\n\nĐảm bảo Print Bridge v4.0 đang chạy tại ${printer.bridgeUrl}`);
    } finally {
      setIsTesting(null);
    }
  };

  const handleAddPrinter = () => {
    if (!newPrinterName.trim() || !newPrinterIp.trim()) {
      alert("Vui lòng nhập đầy đủ thông tin máy in");
      return;
    }

    const newPrinter: NetworkPrinter = {
      id: crypto.randomUUID(),
      name: newPrinterName.trim(),
      ipAddress: newPrinterIp.trim(),
      port: parseInt(newPrinterPort) || 9100,
      bridgeUrl: bridgeUrl.trim(),
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const updatedPrinters = [...printers, newPrinter];
    savePrinters(updatedPrinters);

    setNewPrinterName("");
    setNewPrinterIp("");
    setNewPrinterPort("9100");
    setIsAddDialogOpen(false);
  };

  const handleTogglePrinter = (id: string) => {
    const updatedPrinters = printers.map((p) =>
      p.id === id ? { ...p, isActive: !p.isActive } : p
    );
    savePrinters(updatedPrinters);
  };

  const handleDeletePrinter = (id: string) => {
    if (confirm("Bạn có chắc muốn xóa máy in này?")) {
      const updatedPrinters = printers.filter((p) => p.id !== id);
      savePrinters(updatedPrinters);
    }
  };

  const handleTestPrint = async () => {
    if (!selectedPrinter) {
      alert("Vui lòng chọn máy in");
      return;
    }

    if (!testContent.trim()) {
      alert("Vui lòng nhập nội dung in thử");
      return;
    }

    setIsPrinting(true);
    setPrintResult(null);

    try {
      const content = testContent
        .replace("[Printer Name]", selectedPrinter.name)
        .replace("[IP Address]", `${selectedPrinter.ipAddress}:${selectedPrinter.port}`)
        .replace("[Time]", new Date().toLocaleString("vi-VN"));

      const response = await fetch(`${selectedPrinter.bridgeUrl}/print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ipAddress: selectedPrinter.ipAddress,
          port: selectedPrinter.port,
          content: content,
          options: {
            mode: printMode,
            align: 'left',
            feeds: 3
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      setPrintResult(result);

      if (result.success) {
        alert(`✅ In thử thành công!\nChế độ: ${printMode}`);
      } else {
        alert(`❌ Lỗi in: ${result.error}`);
      }
    } catch (error: any) {
      console.error("Print error:", error);
      alert(`❌ Lỗi: ${error.message}\n\nĐảm bảo Bridge v4.0 đang chạy tại ${selectedPrinter.bridgeUrl}`);
      setPrintResult({ success: false, error: error.message });
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Printer className="h-5 w-5" />
          Quản lý máy in mạng XC80
        </CardTitle>
        <CardDescription>
          In trực tiếp qua TCP/IP - Hỗ trợ 3 chế độ encoding
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-amber-50 border-amber-200">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">🎨 Bridge Server v4.0 - Multi-Mode</AlertTitle>
          <AlertDescription className="text-sm text-amber-800">
            <div className="space-y-2 mt-2">
              <div>
                <strong>✅ Chế độ 1: NO-ACCENTS</strong> (Khuyến nghị)
                <br />
                <span className="text-xs">Bỏ dấu tiếng Việt → In ra: "Xin chao Viet Nam"</span>
              </div>
              <div>
                <strong>🧪 Chế độ 2: UTF-8</strong> (Thử nghiệm)
                <br />
                <span className="text-xs">Unicode encoding → Cần máy in hỗ trợ UTF-8</span>
              </div>
              <div>
                <strong>🧪 Chế độ 3: CP1258</strong> (Thử nghiệm)
                <br />
                <span className="text-xs">Windows Vietnamese → Cần firmware đặc biệt</span>
              </div>
            </div>
          </AlertDescription>
        </Alert>

        <Alert>
          <Download className="h-4 w-4" />
          <AlertTitle>Tải Bridge Server v4.0</AlertTitle>
          <AlertDescription className="space-y-3">
            <p className="text-sm">Vui lòng copy code từ các artifacts bên trái:</p>
            <div className="space-y-1 text-xs">
              <div>1️⃣ Copy artifact <strong>"xc80-bridge-multimode.js"</strong></div>
              <div>2️⃣ Tải <strong>package.json</strong></div>
              <div>3️⃣ Chạy: <code className="bg-muted px-1">npm install && node xc80-bridge-multimode.js</code></div>
            </div>
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleDownloadPackageJson}
            >
              <Package className="h-4 w-4 mr-2" />
              Tải package.json
            </Button>
          </AlertDescription>
        </Alert>

        <div className="flex gap-2">
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Thêm máy in
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Thêm máy in XC80</DialogTitle>
                <DialogDescription>
                  Cấu hình máy in để in trực tiếp qua mạng
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bridge-url">Bridge Server URL</Label>
                  <Input
                    id="bridge-url"
                    value={bridgeUrl}
                    onChange={(e) => setBridgeUrl(e.target.value)}
                    placeholder="http://localhost:9100"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="printer-name">Tên máy in</Label>
                  <Input
                    id="printer-name"
                    value={newPrinterName}
                    onChange={(e) => setNewPrinterName(e.target.value)}
                    placeholder="XC80 Kho 1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="printer-ip">IP Address</Label>
                    <Input
                      id="printer-ip"
                      value={newPrinterIp}
                      onChange={(e) => setNewPrinterIp(e.target.value)}
                      placeholder="192.168.1.100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="printer-port">Port</Label>
                    <Input
                      id="printer-port"
                      type="number"
                      value={newPrinterPort}
                      onChange={(e) => setNewPrinterPort(e.target.value)}
                      placeholder="9100"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Hủy
                </Button>
                <Button onClick={handleAddPrinter}>
                  <Plus className="h-4 w-4 mr-2" />
                  Thêm
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={loadPrinters}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Làm mới
          </Button>
        </div>

        {printers.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Chưa có máy in</AlertTitle>
            <AlertDescription>
              Nhấn "Thêm máy in" để cấu hình máy in XC80 đầu tiên
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-3">
            {printers.map((printer) => (
              <Card key={printer.id} className="border-2">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <Printer className="h-5 w-5" />
                        <h3 className="font-semibold text-lg">{printer.name}</h3>
                        <Badge variant={printer.isActive ? "default" : "secondary"}>
                          {printer.isActive ? "Hoạt động" : "Tắt"}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground w-20">IP:Port:</span>
                          <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono">
                            {printer.ipAddress}:{printer.port}
                          </code>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground w-20">Bridge:</span>
                          <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono">
                            {printer.bridgeUrl}
                          </code>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Bật/Tắt:</span>
                        <Switch
                          checked={printer.isActive}
                          onCheckedChange={() => handleTogglePrinter(printer.id)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => testPrinterConnection(printer)}
                          disabled={!printer.isActive || isTesting === printer.id}
                        >
                          {isTesting === printer.id ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                              Test...
                            </>
                          ) : (
                            <>
                              <Wifi className="h-4 w-4 mr-1" />
                              Test
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => {
                            setSelectedPrinter(printer);
                            setIsTestDialogOpen(true);
                          }}
                          disabled={!printer.isActive}
                        >
                          <TestTube2 className="h-4 w-4 mr-1" />
                          In thử
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeletePrinter(printer.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>🎨 In thử nghiệm - Chọn chế độ</DialogTitle>
              <DialogDescription>
                Máy in: {selectedPrinter?.name} ({selectedPrinter?.ipAddress}:{selectedPrinter?.port})
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-3">
                <Label>Chế độ encoding</Label>
                <RadioGroup value={printMode} onValueChange={(v: any) => setPrintMode(v)}>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
                    <RadioGroupItem value="no-accents" id="mode-no-accents" />
                    <Label htmlFor="mode-no-accents" className="cursor-pointer flex-1">
                      <div className="font-semibold">✅ NO-ACCENTS (Khuyến nghị)</div>
                      <div className="text-xs text-muted-foreground">
                        Bỏ dấu tiếng Việt → Hoạt động 100% trên mọi máy in
                      </div>
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
                    <RadioGroupItem value="utf8" id="mode-utf8" />
                    <Label htmlFor="mode-utf8" className="cursor-pointer flex-1">
                      <div className="font-semibold">🧪 UTF-8 (Thử nghiệm)</div>
                      <div className="text-xs text-muted-foreground">
                        Unicode encoding → Cần máy in hỗ trợ UTF-8 font
                      </div>
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
                    <RadioGroupItem value="cp1258" id="mode-cp1258" />
                    <Label htmlFor="mode-cp1258" className="cursor-pointer flex-1">
                      <div className="font-semibold">🧪 CP1258 (Thử nghiệm)</div>
                      <div className="text-xs text-muted-foreground">
                        Windows Vietnamese → Cần firmware hỗ trợ CP1258
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="test-content">Nội dung in thử</Label>
                <Textarea
                  id="test-content"
                  value={testContent}
                  onChange={(e) => setTestContent(e.target.value)}
                  className="font-mono text-sm min-h-[200px]"
                  placeholder="Nhập nội dung..."
                />
                <p className="text-xs text-muted-foreground">
                  💡 Hỗ trợ: [Printer Name], [IP Address], [Time]
                </p>
              </div>

              {printResult && (
                <Alert variant={printResult.success ? "default" : "destructive"}>
                  {printResult.success ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <AlertTitle>
                    {printResult.success ? "✅ In thành công" : "❌ Lỗi in"}
                  </AlertTitle>
                  <AlertDescription>
                    {printResult.success ? (
                      <div className="text-sm space-y-1">
                        <div>Job ID: <code className="bg-muted px-1 py-0.5 rounded">{printResult.jobID}</code></div>
                        <div>Mode: <Badge variant="outline">{printResult.mode}</Badge></div>
                      </div>
                    ) : (
                      <div className="text-sm">{printResult.error}</div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsTestDialogOpen(false)}>
                Đóng
              </Button>
              <Button onClick={handleTestPrint} disabled={isPrinting}>
                {isPrinting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Đang in...
                  </>
                ) : (
                  <>
                    <Printer className="h-4 w-4 mr-2" />
                    In thử ({printMode})
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
