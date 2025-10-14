import { useState, useEffect } from "react";
import { Printer, Plus, Trash2, TestTube2, RefreshCw, AlertCircle, CheckCircle, Wifi, Download, FileCode, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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

// XC80 Print Bridge Server Code
const BRIDGE_SERVER_CODE = `// XC80 Print Bridge Server - TCP Socket Version
// Chỉ cần: express + cors (KHÔNG cần package 'printer')
const express = require('express');
const cors = require('cors');
const net = require('net'); // Built-in Node.js module
const app = express();

app.use(cors());
app.use(express.json());

// Store printer configurations
const printers = new Map();

// Helper: Convert text to ESC/POS commands for XC80
function textToESCPOS(text) {
    const ESC = '\\x1B';
    const GS = '\\x1D';
    
    // ESC/POS commands
    const commands = [
        ESC + '@',           // Initialize printer
        ESC + 'a' + '\\x01',  // Center align
    ];
    
    // Add text content
    commands.push(text);
    
    // Add paper cut and feed
    commands.push('\\n\\n\\n');
    commands.push(GS + 'V' + '\\x41' + '\\x03'); // Partial cut
    
    return commands.join('');
}

// Print via TCP Socket
async function printToNetwork(ipAddress, port, data) {
    return new Promise((resolve, reject) => {
        const client = new net.Socket();
        const timeout = setTimeout(() => {
            client.destroy();
            reject(new Error('Connection timeout'));
        }, 5000);

        client.connect(port, ipAddress, () => {
            clearTimeout(timeout);
            console.log(\`✅ Connected to printer at \${ipAddress}:\${port}\`);
            
            // Convert text to ESC/POS if needed
            const printData = typeof data === 'string' ? textToESCPOS(data) : data;
            
            client.write(printData, (err) => {
                if (err) {
                    client.destroy();
                    reject(err);
                } else {
                    console.log('📄 Data sent to printer');
                    client.end();
                }
            });
        });

        client.on('close', () => {
            clearTimeout(timeout);
            resolve({ success: true, message: 'Print job completed' });
        });

        client.on('error', (err) => {
            clearTimeout(timeout);
            console.error('❌ Printer error:', err.message);
            reject(err);
        });
    });
}

// Register a printer
app.post('/printers/register', (req, res) => {
    const { name, ipAddress, port } = req.body;
    
    if (!name || !ipAddress || !port) {
        return res.status(400).json({ 
            success: false, 
            error: 'Name, IP address, and port are required' 
        });
    }
    
    const id = \`\${ipAddress}:\${port}\`;
    printers.set(id, { name, ipAddress, port: parseInt(port) });
    
    console.log(\`✅ Registered printer: \${name} (\${id})\`);
    
    res.json({ 
        success: true, 
        printer: { id, name, ipAddress, port: parseInt(port) } 
    });
});

// Get registered printers
app.get('/printers', (req, res) => {
    const printerList = Array.from(printers.entries()).map(([id, printer]) => ({
        id,
        name: printer.name,
        ipAddress: printer.ipAddress,
        port: printer.port,
        status: 'IDLE'
    }));
    
    res.json({ success: true, printers: printerList });
});

// Test printer connection
app.post('/printers/test', async (req, res) => {
    const { ipAddress, port } = req.body;
    
    if (!ipAddress || !port) {
        return res.status(400).json({ 
            success: false, 
            error: 'IP address and port are required' 
        });
    }
    
    console.log(\`🔍 Testing connection to \${ipAddress}:\${port}...\`);
    
    try {
        const client = new net.Socket();
        const timeout = setTimeout(() => {
            client.destroy();
            res.status(500).json({ 
                success: false, 
                error: 'Connection timeout - printer not responding' 
            });
        }, 3000);

        client.connect(parseInt(port), ipAddress, () => {
            clearTimeout(timeout);
            console.log(\`✅ Printer is reachable at \${ipAddress}:\${port}\`);
            client.end();
            res.json({ 
                success: true, 
                message: 'Printer is reachable',
                ipAddress,
                port: parseInt(port)
            });
        });

        client.on('error', (err) => {
            clearTimeout(timeout);
            console.error(\`❌ Cannot connect to \${ipAddress}:\${port} - \${err.message}\`);
            res.status(500).json({ 
                success: false, 
                error: \`Cannot connect to printer: \${err.message}\` 
            });
        });
    } catch (error) {
        console.error('❌ Test error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Print document
app.post('/print', async (req, res) => {
    const { printerName, ipAddress, port, content, options = {} } = req.body;
    
    if (!content) {
        return res.status(400).json({ 
            success: false, 
            error: 'Content is required' 
        });
    }
    
    // Must provide either printerName (registered) or ipAddress+port (direct)
    let printerConfig;
    
    if (ipAddress && port) {
        // Direct printing to IP:Port
        printerConfig = { ipAddress, port: parseInt(port) };
        console.log(\`🖨️  Printing to \${ipAddress}:\${port}\`);
    } else if (printerName) {
        // Find registered printer
        const id = Array.from(printers.entries())
            .find(([_, p]) => p.name === printerName)?.[0];
        
        if (!id) {
            return res.status(404).json({ 
                success: false, 
                error: 'Printer not found' 
            });
        }
        printerConfig = printers.get(id);
        console.log(\`🖨️  Printing to \${printerName} (\${printerConfig.ipAddress}:\${printerConfig.port})\`);
    } else {
        return res.status(400).json({ 
            success: false, 
            error: 'Either printerName or ipAddress+port must be provided' 
        });
    }
    
    try {
        const result = await printToNetwork(
            printerConfig.ipAddress, 
            printerConfig.port, 
            content
        );
        
        console.log('✅ Print job completed successfully');
        
        res.json({ 
            success: true, 
            jobID: Date.now().toString(),
            message: 'Print job sent successfully',
            printer: printerConfig
        });
    } catch (error) {
        console.error('❌ Print error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Print with ESC/POS formatting
app.post('/print/escpos', async (req, res) => {
    const { printerName, ipAddress, port, commands } = req.body;
    
    if (!commands) {
        return res.status(400).json({ 
            success: false, 
            error: 'ESC/POS commands are required' 
        });
    }
    
    let printerConfig;
    
    if (ipAddress && port) {
        printerConfig = { ipAddress, port: parseInt(port) };
    } else if (printerName) {
        const id = Array.from(printers.entries())
            .find(([_, p]) => p.name === printerName)?.[0];
        
        if (!id) {
            return res.status(404).json({ 
                success: false, 
                error: 'Printer not found' 
            });
        }
        printerConfig = printers.get(id);
    } else {
        return res.status(400).json({ 
            success: false, 
            error: 'Either printerName or ipAddress+port must be provided' 
        });
    }
    
    try {
        // Send raw ESC/POS commands
        const result = await printToNetwork(
            printerConfig.ipAddress, 
            printerConfig.port, 
            Buffer.from(commands, 'utf8')
        );
        
        res.json({ 
            success: true, 
            jobID: Date.now().toString(),
            message: 'ESC/POS commands sent successfully'
        });
    } catch (error) {
        console.error('Print error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        registeredPrinters: printers.size,
        version: '2.0.0'
    });
});

const PORT = process.env.PORT || 9100;
app.listen(PORT, () => {
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('  🖨️  XC80 Print Bridge Server v2.0');
    console.log('═══════════════════════════════════════');
    console.log(\`✅ Server running on port \${PORT}\`);
    console.log(\`📡 Access at: http://localhost:\${PORT}\`);
    console.log(\`🖨️  Registered printers: \${printers.size}\`);
    console.log('');
    console.log('📝 Quick Test:');
    console.log(\`   curl http://localhost:\${PORT}/health\`);
    console.log('');
    console.log('🔧 Test printer connection:');
    console.log(\`   curl -X POST http://localhost:\${PORT}/printers/test \\\\\`);
    console.log(\`     -H "Content-Type: application/json" \\\\\`);
    console.log(\`     -d '{"ipAddress":"192.168.1.100","port":9100}'\`);
    console.log('');
    console.log('🖨️  Send test print:');
    console.log(\`   curl -X POST http://localhost:\${PORT}/print \\\\\`);
    console.log(\`     -H "Content-Type: application/json" \\\\\`);
    console.log(\`     -d '{"ipAddress":"192.168.1.100","port":9100,"content":"TEST\\\\n\\\\n"}'\`);
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('');
});`;

const PACKAGE_JSON = `{
  "name": "xc80-print-bridge",
  "version": "2.0.0",
  "description": "Simple TCP-based print bridge for XC80 thermal printers",
  "main": "xc80-print-bridge.js",
  "scripts": {
    "start": "node xc80-print-bridge.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5"
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
  
  const [testContent, setTestContent] = useState(
    "================================\n" +
    "       XC80 TEST PRINT\n" +
    "================================\n" +
    "Máy in: [Printer Name]\n" +
    "IP: [IP Address]\n" +
    "Thời gian: [Time]\n" +
    "--------------------------------\n" +
    "Đây là bản in thử nghiệm.\n" +
    "Nếu bạn thấy văn bản này,\n" +
    "máy in đang hoạt động tốt!\n" +
    "================================\n\n\n"
  );
  const [isPrinting, setIsPrinting] = useState(false);
  const [printResult, setPrintResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState<string | null>(null);

  useEffect(() => {
    loadPrinters();
  }, []);

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
    downloadFile(BRIDGE_SERVER_CODE, 'xc80-print-bridge.js', 'text/javascript');
  };

  const handleDownloadPackageJson = () => {
    downloadFile(PACKAGE_JSON, 'package.json', 'application/json');
  };

  const handleDownloadAll = () => {
    handleDownloadBridgeServer();
    setTimeout(() => handleDownloadPackageJson(), 300);
    alert('✅ Đã tải 2 files:\n- xc80-print-bridge.js\n- package.json\n\nTiếp theo:\n1. Mở Terminal\n2. cd vào thư mục chứa files\n3. Chạy: npm install\n4. Chạy: node xc80-print-bridge.js');
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
      alert(`❌ Lỗi: ${error.message}\n\nĐảm bảo Print Bridge đang chạy tại ${printer.bridgeUrl}`);
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
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      setPrintResult(result);

      if (result.success) {
        alert("✅ In thử thành công!");
      } else {
        alert(`❌ Lỗi in: ${result.error}`);
      }
    } catch (error: any) {
      console.error("Print error:", error);
      alert(`❌ Lỗi: ${error.message}\n\nĐảm bảo Print Bridge đang chạy tại ${selectedPrinter.bridgeUrl}`);
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
          In trực tiếp qua TCP/IP (không cần driver) - Sử dụng XC80 Print Bridge
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Download className="h-4 w-4" />
          <AlertTitle>Tải XC80 Print Bridge Server</AlertTitle>
          <AlertDescription className="space-y-3">
            <p className="text-sm">Tải files và cài đặt server để in trực tiếp từ web:</p>
            <div className="flex flex-wrap gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={handleDownloadBridgeServer}
              >
                <FileCode className="h-4 w-4 mr-2" />
                Tải xc80-print-bridge.js
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={handleDownloadPackageJson}
              >
                <Package className="h-4 w-4 mr-2" />
                Tải package.json
              </Button>
              <Button 
                size="sm" 
                variant="default"
                onClick={handleDownloadAll}
              >
                <Download className="h-4 w-4 mr-2" />
                Tải tất cả
              </Button>
            </div>
            <div className="bg-muted p-3 rounded text-xs font-mono space-y-1 mt-2">
              <div className="font-semibold text-sm mb-2">Sau khi tải, mở Terminal:</div>
              <div>$ cd ~/Downloads</div>
              <div>$ npm install</div>
              <div>$ node xc80-print-bridge.js</div>
              <div className="text-green-600 mt-2">✅ Server: http://localhost:9100</div>
            </div>
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

                <Alert variant="default" className="bg-blue-50 border-blue-200">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-xs text-blue-800">
                    💡 Port 9100 là port mặc định cho máy in mạng. 
                    Kiểm tra IP máy in trong menu Settings của XC80.
                  </AlertDescription>
                </Alert>
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
              <DialogTitle>In thử nghiệm</DialogTitle>
              <DialogDescription>
                Máy in: {selectedPrinter?.name} ({selectedPrinter?.ipAddress}:{selectedPrinter?.port})
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="test-content">Nội dung in thử</Label>
                <Textarea
                  id="test-content"
                  value={testContent}
                  onChange={(e) => setTestContent(e.target.value)}
                  className="font-mono text-sm min-h-[300px]"
                  placeholder="Nhập nội dung cần in..."
                />
                <p className="text-xs text-muted-foreground">
                  💡 Hỗ trợ placeholder: [Printer Name], [IP Address], [Time]
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
                        <div className="text-xs text-muted-foreground">{printResult.message}</div>
                      </div>
                    ) : (
                      <div className="text-sm">
                        {printResult.error || "Có lỗi xảy ra khi in"}
                      </div>
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
                    In thử ngay
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