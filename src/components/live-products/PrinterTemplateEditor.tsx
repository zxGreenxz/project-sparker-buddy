import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  PrinterTemplate, 
  DEFAULT_TEMPLATE, 
  saveTemplate, 
  loadAllTemplates, 
  deleteTemplate,
  setActiveTemplate,
  getActiveTemplate,
  applyTemplate,
  validateTemplate,
  getSampleData
} from "@/lib/printer-template-utils";
import { printToXC80 } from "@/lib/printer-utils";
// import { textToESCPOSBitmap } from "@/lib/text-to-bitmap"; // Not needed for direct text printing
import { Save, Trash2, Plus, Download, RefreshCw, Printer, Info } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function PrinterTemplateEditor() {
  const [templates, setTemplates] = useState<PrinterTemplate[]>([]);
  const [activeTemplate, setActiveTemplateState] = useState<PrinterTemplate>(DEFAULT_TEMPLATE);
  const [editingTemplate, setEditingTemplate] = useState<PrinterTemplate>(DEFAULT_TEMPLATE);
  const [previewContent, setPreviewContent] = useState<string>("");
  const [errors, setErrors] = useState<string[]>([]);

  // Load templates on mount
  useEffect(() => {
    const loaded = loadAllTemplates();
    setTemplates(loaded);
    const active = getActiveTemplate();
    setActiveTemplateState(active);
    setEditingTemplate({ ...active });
    updatePreview(active);
  }, []);

  // Update preview when editing template changes
  useEffect(() => {
    updatePreview(editingTemplate);
  }, [editingTemplate]);

  const updatePreview = (template: PrinterTemplate) => {
    const sampleData = getSampleData();
    const content = applyTemplate(template, sampleData);
    setPreviewContent(content);
  };

  const handleSaveTemplate = () => {
    const validation = validateTemplate(editingTemplate);
    
    if (!validation.valid) {
      setErrors(validation.errors);
      toast.error("Có lỗi trong template");
      return;
    }

    try {
      saveTemplate(editingTemplate);
      setActiveTemplate(editingTemplate.name);
      setActiveTemplateState(editingTemplate);
      
      // Reload templates
      const loaded = loadAllTemplates();
      setTemplates(loaded);
      
      setErrors([]);
      toast.success("Đã lưu template");
    } catch (error) {
      toast.error("Không thể lưu template");
    }
  };

  const handleLoadTemplate = (templateName: string) => {
    const template = templates.find(t => t.name === templateName);
    if (template) {
      setEditingTemplate({ ...template });
      setActiveTemplate(template.name);
      setActiveTemplateState(template);
      toast.success(`Đã tải template: ${templateName}`);
    }
  };

  const handleDeleteTemplate = (templateName: string) => {
    if (templateName === DEFAULT_TEMPLATE.name) {
      toast.error("Không thể xóa template mặc định");
      return;
    }

    try {
      deleteTemplate(templateName);
      const loaded = loadAllTemplates();
      setTemplates(loaded);
      
      if (editingTemplate.name === templateName) {
        const newActive = getActiveTemplate();
        setEditingTemplate({ ...newActive });
        setActiveTemplateState(newActive);
      }
      
      toast.success("Đã xóa template");
    } catch (error) {
      toast.error("Không thể xóa template");
    }
  };

  const handleNewTemplate = () => {
    const newTemplate: PrinterTemplate = {
      ...DEFAULT_TEMPLATE,
      name: `Template ${templates.length + 1}`
    };
    setEditingTemplate(newTemplate);
  };

  const handleTestPrint = async () => {
    try {
      const activePrinter = JSON.parse(localStorage.getItem('network_printers') || '[]')
        .find((p: any) => p.active);

      if (!activePrinter) {
        // Fallback to browser print
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
          toast.error("Không thể mở cửa sổ in");
          return;
        }

        const lines = previewContent.split('\n');
        const linesHtml = lines.map((line, idx) => {
          const lineNum = idx + 1;
          const style = editingTemplate.lineStyles[`line${lineNum}`];
          const fontSize = style?.fontSize || editingTemplate.settings.fontSize;
          const fontWeight = style?.bold ? 'bold' : 'normal';
          const fontStyle = style?.italic ? 'italic' : 'normal';
          
          return `<div style="font-size: ${fontSize}pt; font-weight: ${fontWeight}; font-style: ${fontStyle}; line-height: ${editingTemplate.settings.lineHeight};">${line}</div>`;
        }).join('');

        printWindow.document.write(`
          <html>
            <head>
              <title>Test Print</title>
              <style>
                @page { margin: 2mm; size: ${editingTemplate.settings.width}px auto; }
                body { 
                  font-family: ${editingTemplate.settings.fontFamily};
                  text-align: ${editingTemplate.settings.align};
                  padding: ${editingTemplate.settings.padding}px;
                  margin: 0;
                }
              </style>
            </head>
            <body onload="window.print(); window.close();">
              ${linesHtml}
            </body>
          </html>
        `);
        printWindow.document.close();
        return;
      }

      // Print to thermal printer - send text content directly
      const result = await printToXC80(activePrinter, previewContent, {
        mode: 'utf8',
        align: editingTemplate.settings.align as 'left' | 'center' | 'right',
        feeds: 3
      });

      if (result.success) {
        toast.success("In thử thành công!");
      } else {
        toast.error(`Lỗi in: ${result.error}`);
      }
    } catch (error: any) {
      console.error('Test print error:', error);
      toast.error(`Không thể in thử: ${error.message}`);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Panel - Editor */}
      <Card>
        <CardHeader>
          <CardTitle>Chỉnh sửa Template In</CardTitle>
          <CardDescription>
            Tùy chỉnh mẫu in hóa đơn cho máy in nhiệt
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Template Selection */}
          <div className="space-y-2">
            <Label>Chọn Template</Label>
            <div className="flex gap-2">
              <Select 
                value={editingTemplate.name}
                onValueChange={handleLoadTemplate}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(template => (
                    <SelectItem key={template.name} value={template.name}>
                      {template.name}
                      {activeTemplate.name === template.name && (
                        <Badge variant="secondary" className="ml-2">Đang dùng</Badge>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                size="icon"
                onClick={handleNewTemplate}
              >
                <Plus className="h-4 w-4" />
              </Button>
              {editingTemplate.name !== DEFAULT_TEMPLATE.name && (
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => handleDeleteTemplate(editingTemplate.name)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Template Name */}
          <div className="space-y-2">
            <Label>Tên Template</Label>
            <Input
              value={editingTemplate.name}
              onChange={(e) => setEditingTemplate(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Tên template..."
            />
          </div>

          {/* Template Content */}
          <div className="space-y-2">
            <Label>Nội dung Template</Label>
            <Textarea
              value={editingTemplate.content}
              onChange={(e) => setEditingTemplate(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Sử dụng {{placeholder}} để chèn dữ liệu..."
              rows={6}
              className="font-mono text-sm"
            />
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs space-y-1">
                <div><strong>Placeholders:</strong></div>
                <div>{'{{sessionIndex}}'} - Số phiên | {'{{phone}}'} - SĐT</div>
                <div>{'{{customerName}}'} - Tên KH | {'{{productCode}}'} - Mã SP</div>
                <div>{'{{productName}}'} - Tên SP | {'{{comment}}'} - Ghi chú</div>
                <div>{'{{time}}'} - Thời gian</div>
              </AlertDescription>
            </Alert>
          </div>

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="general">Cài đặt chung</TabsTrigger>
              <TabsTrigger value="lines">Từng dòng</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              {/* Width */}
              <div className="space-y-2">
                <Label>Chiều rộng (px): {editingTemplate.settings.width}</Label>
                <Select
                  value={editingTemplate.settings.width.toString()}
                  onValueChange={(value) => setEditingTemplate(prev => ({
                    ...prev,
                    settings: { ...prev.settings, width: parseInt(value) }
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="384">384 (48mm)</SelectItem>
                    <SelectItem value="480">480 (60mm)</SelectItem>
                    <SelectItem value="576">576 (72mm)</SelectItem>
                    <SelectItem value="640">640 (80mm)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Font Size */}
              <div className="space-y-2">
                <Label>Cỡ chữ: {editingTemplate.settings.fontSize}pt</Label>
                <Slider
                  value={[editingTemplate.settings.fontSize]}
                  onValueChange={([value]) => setEditingTemplate(prev => ({
                    ...prev,
                    settings: { ...prev.settings, fontSize: value }
                  }))}
                  min={20}
                  max={40}
                  step={1}
                />
              </div>

              {/* Line Height */}
              <div className="space-y-2">
                <Label>Khoảng cách dòng: {editingTemplate.settings.lineHeight}</Label>
                <Slider
                  value={[editingTemplate.settings.lineHeight]}
                  onValueChange={([value]) => setEditingTemplate(prev => ({
                    ...prev,
                    settings: { ...prev.settings, lineHeight: value }
                  }))}
                  min={1.0}
                  max={2.0}
                  step={0.1}
                />
              </div>

              {/* Padding */}
              <div className="space-y-2">
                <Label>Lề (px): {editingTemplate.settings.padding}</Label>
                <Slider
                  value={[editingTemplate.settings.padding]}
                  onValueChange={([value]) => setEditingTemplate(prev => ({
                    ...prev,
                    settings: { ...prev.settings, padding: value }
                  }))}
                  min={0}
                  max={10}
                  step={1}
                />
              </div>

              {/* Text Align */}
              <div className="space-y-2">
                <Label>Canh lề</Label>
                <Select
                  value={editingTemplate.settings.align}
                  onValueChange={(value: 'left' | 'center' | 'right') => setEditingTemplate(prev => ({
                    ...prev,
                    settings: { ...prev.settings, align: value }
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Trái</SelectItem>
                    <SelectItem value="center">Giữa</SelectItem>
                    <SelectItem value="right">Phải</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="lines" className="space-y-4 mt-4">
              {[1, 2, 3, 4, 5].map(lineNum => {
                const lineKey = `line${lineNum}`;
                const lineStyle = editingTemplate.lineStyles[lineKey] || {};
                
                return (
                  <Card key={lineKey}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Dòng {lineNum}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-xs">Cỡ chữ: {lineStyle.fontSize || editingTemplate.settings.fontSize}pt</Label>
                        <Slider
                          value={[lineStyle.fontSize || editingTemplate.settings.fontSize]}
                          onValueChange={([value]) => setEditingTemplate(prev => ({
                            ...prev,
                            lineStyles: {
                              ...prev.lineStyles,
                              [lineKey]: { ...lineStyle, fontSize: value }
                            }
                          }))}
                          min={6}
                          max={36}
                          step={1}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant={lineStyle.bold ? "default" : "outline"}
                          size="sm"
                          onClick={() => setEditingTemplate(prev => ({
                            ...prev,
                            lineStyles: {
                              ...prev.lineStyles,
                              [lineKey]: { ...lineStyle, bold: !lineStyle.bold }
                            }
                          }))}
                        >
                          <strong>B</strong>
                        </Button>
                        <Button
                          variant={lineStyle.italic ? "default" : "outline"}
                          size="sm"
                          onClick={() => setEditingTemplate(prev => ({
                            ...prev,
                            lineStyles: {
                              ...prev.lineStyles,
                              [lineKey]: { ...lineStyle, italic: !lineStyle.italic }
                            }
                          }))}
                        >
                          <em>I</em>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>
          </Tabs>

          {/* Errors */}
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {errors.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={handleSaveTemplate} className="flex-1">
              <Save className="mr-2 h-4 w-4" />
              Lưu Template
            </Button>
            <Button variant="outline" onClick={handleTestPrint}>
              <Printer className="mr-2 h-4 w-4" />
              In thử
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Right Panel - Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Xem trước</CardTitle>
          <CardDescription>
            Xem trước mẫu in với dữ liệu mẫu
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div 
            className="border rounded-lg p-4 bg-white text-black"
            style={{
              width: `${editingTemplate.settings.width}px`,
              maxWidth: '100%',
              fontFamily: editingTemplate.settings.fontFamily,
              textAlign: editingTemplate.settings.align,
              padding: `${editingTemplate.settings.padding}px`
            }}
          >
            {previewContent.split('\n').map((line, idx) => {
              const lineNum = idx + 1;
              const lineStyle = editingTemplate.lineStyles[`line${lineNum}`];
              const fontSize = lineStyle?.fontSize || editingTemplate.settings.fontSize;
              const fontWeight = lineStyle?.bold ? 'bold' : 'normal';
              const fontStyle = lineStyle?.italic ? 'italic' : 'normal';
              
              return (
                <div
                  key={idx}
                  style={{
                    fontSize: `${fontSize}pt`,
                    fontWeight,
                    fontStyle,
                    lineHeight: editingTemplate.settings.lineHeight,
                    wordBreak: 'break-word'
                  }}
                >
                  {line || '\u00A0'}
                </div>
              );
            })}
          </div>
          
          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
            <div>Chiều rộng: {editingTemplate.settings.width}px</div>
            <div>Cỡ chữ: {editingTemplate.settings.fontSize}pt</div>
            <div>Khoảng cách dòng: {editingTemplate.settings.lineHeight}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
