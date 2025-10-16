import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { BillTemplate, BillField, DEFAULT_BILL_TEMPLATE } from '@/types/bill-template';
import { generateBillPDF } from '@/lib/bill-pdf-generator';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  GripVertical, 
  Eye, 
  EyeOff, 
  AlignLeft, 
  AlignCenter, 
  AlignRight,
  Save,
  RefreshCw,
  Download,
  Upload,
  Printer
} from 'lucide-react';
import { getActivePrinter } from '@/lib/printer-utils';

const FIELD_LABELS: Record<string, string> = {
  sessionIndex: 'Số thứ tự (#)',
  phone: 'Số điện thoại',
  customerName: 'Tên khách hàng',
  productCode: 'Mã sản phẩm',
  productName: 'Tên sản phẩm',
  comment: 'Ghi chú',
  createdTime: 'Thời gian tạo',
  price: 'Giá',
  quantity: 'Số lượng'
};

interface SortableFieldItemProps {
  field: BillField;
  onUpdate: (updatedField: BillField) => void;
}

function SortableFieldItem({ field, onUpdate }: SortableFieldItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border rounded-lg p-4 bg-card mb-2"
    >
      <div className="flex items-start gap-3">
        <button
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </button>

        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">{FIELD_LABELS[field.key]}</Label>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onUpdate({ ...field, visible: !field.visible })}
              >
                {field.visible ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          {field.visible && (
            <>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Font size: {field.fontSize}pt</Label>
                <Slider
                  value={[field.fontSize]}
                  onValueChange={([value]) => onUpdate({ ...field, fontSize: value })}
                  min={8}
                  max={48}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={field.align === 'left' ? 'default' : 'outline'}
                    onClick={() => onUpdate({ ...field, align: 'left' })}
                  >
                    <AlignLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant={field.align === 'center' ? 'default' : 'outline'}
                    onClick={() => onUpdate({ ...field, align: 'center' })}
                  >
                    <AlignCenter className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant={field.align === 'right' ? 'default' : 'outline'}
                    onClick={() => onUpdate({ ...field, align: 'right' })}
                  >
                    <AlignRight className="h-4 w-4" />
                  </Button>
                </div>

                <Button
                  size="sm"
                  variant={field.fontWeight === 'bold' ? 'default' : 'outline'}
                  onClick={() => onUpdate({ 
                    ...field, 
                    fontWeight: field.fontWeight === 'bold' ? 'normal' : 'bold' 
                  })}
                >
                  <strong>B</strong>
                </Button>
              </div>

              {field.label !== undefined && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Prefix (optional)</Label>
                  <Input
                    value={field.label || ''}
                    onChange={(e) => onUpdate({ ...field, label: e.target.value })}
                    placeholder="VD: Khách: "
                    className="h-8 text-sm"
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function PdfBillEditor() {
  const [template, setTemplate] = useState<BillTemplate>(DEFAULT_BILL_TEMPLATE);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load saved template from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('billTemplate');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setTemplate(parsed);
      } catch (error) {
        console.error('Failed to load template:', error);
      }
    }
  }, []);

  // Generate preview whenever template changes
  useEffect(() => {
    generatePreview();
  }, [template]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setTemplate((prev) => {
        const oldIndex = prev.fields.findIndex((f) => f.id === active.id);
        const newIndex = prev.fields.findIndex((f) => f.id === over.id);
        const newFields = arrayMove(prev.fields, oldIndex, newIndex);
        
        // Update order property
        return {
          ...prev,
          fields: newFields.map((f, idx) => ({ ...f, order: idx + 1 }))
        };
      });
    }
  };

  const handleFieldUpdate = (fieldId: string, updatedField: BillField) => {
    setTemplate((prev) => ({
      ...prev,
      fields: prev.fields.map((f) => f.id === fieldId ? updatedField : f)
    }));
  };

  const generatePreview = () => {
    try {
      const sampleData = {
        sessionIndex: '123',
        phone: '0901234567',
        customerName: 'Nguyễn Văn A',
        productCode: 'SP001',
        productName: 'Áo thun nam basic',
        comment: 'Size: L, Màu: Đen',
        createdTime: new Date().toISOString(),
        price: 250000,
        quantity: 1
      };

      const pdf = generateBillPDF(template, sampleData);
      const pdfDataUri = pdf.output('datauristring');
      setPreviewUrl(pdfDataUri);
    } catch (error) {
      console.error('Preview generation error:', error);
      toast({
        variant: 'destructive',
        title: 'Lỗi tạo preview',
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const handleSave = () => {
    localStorage.setItem('billTemplate', JSON.stringify(template));
    toast({
      title: 'Đã lưu template',
      description: 'Template bill đã được lưu thành công'
    });
  };

  const handleReset = () => {
    setTemplate(DEFAULT_BILL_TEMPLATE);
    localStorage.removeItem('billTemplate');
    toast({
      title: 'Đã reset template',
      description: 'Template bill đã được khôi phục về mặc định'
    });
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(template, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = 'bill-template.json';

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();

    toast({
      title: 'Đã export template',
      description: 'File JSON đã được tải xuống'
    });
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        setTemplate(imported);
        toast({
          title: 'Đã import template',
          description: 'Template đã được import thành công'
        });
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Lỗi import',
          description: 'File JSON không hợp lệ'
        });
      }
    };
    reader.readAsText(file);
  };

  const handleTestPrint = async () => {
    const activePrinter = getActivePrinter();
    if (!activePrinter) {
      toast({
        variant: 'destructive',
        title: 'Chưa có máy in',
        description: 'Vui lòng thiết lập máy in trong tab Máy in'
      });
      return;
    }

    try {
      const sampleData = {
        sessionIndex: '999',
        phone: '0901234567',
        customerName: 'TEST PRINT',
        productCode: 'TEST001',
        productName: 'Test Product Name',
        comment: 'Test comment',
        createdTime: new Date().toISOString()
      };

      const pdf = generateBillPDF(template, sampleData);
      const pdfBase64 = pdf.output('datauristring').split(',')[1];

      // Note: Print bridge doesn't support PDF yet, this will fail
      toast({
        variant: 'destructive',
        title: 'Chưa hỗ trợ in PDF',
        description: 'Chức năng in PDF đang được phát triển. Hiện tại vui lòng dùng Download PDF.'
      });

    } catch (error) {
      console.error('Test print error:', error);
      toast({
        variant: 'destructive',
        title: 'Lỗi in thử',
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Panel - Editor */}
      <Card>
        <CardHeader>
          <CardTitle>Chỉnh sửa Bill Template</CardTitle>
          <CardDescription>
            Kéo thả để sắp xếp thứ tự, tùy chỉnh font và alignment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] pr-4">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={template.fields.map(f => f.id)}
                strategy={verticalListSortingStrategy}
              >
                {template.fields.map((field) => (
                  <SortableFieldItem
                    key={field.id}
                    field={field}
                    onUpdate={(updated) => handleFieldUpdate(field.id, updated)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </ScrollArea>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={handleSave} size="sm">
              <Save className="h-4 w-4 mr-2" />
              Lưu
            </Button>
            <Button onClick={handleReset} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button onClick={handleExport} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <label>
              <Button variant="outline" size="sm" asChild>
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </span>
              </Button>
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </label>
            <Button onClick={handleTestPrint} variant="secondary" size="sm">
              <Printer className="h-4 w-4 mr-2" />
              In thử
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Right Panel - Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            Xem trước bill với dữ liệu mẫu
          </CardDescription>
        </CardHeader>
        <CardContent>
          {previewUrl ? (
            <iframe
              src={previewUrl}
              className="w-full h-[600px] border rounded-lg"
              title="PDF Preview"
            />
          ) : (
            <div className="h-[600px] flex items-center justify-center border rounded-lg bg-muted">
              <p className="text-muted-foreground">Đang tạo preview...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
