import { useState, useCallback, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ImageIcon, X, Loader2, Warehouse, Package, ChevronDown } from "lucide-react";
import { compressImage } from "@/lib/image-utils";
import { generateProductCode, getNextNACode } from "@/lib/product-code-generator";
import { useVariantDetector } from "@/hooks/use-variant-detector";
import { VariantDetectionBadge } from "@/components/products/VariantDetectionBadge";
import { useDebounce } from "@/hooks/use-debounce";
import { SelectProductDialog } from "@/components/products/SelectProductDialog";
import { detectSupplierFromProductName } from "@/lib/supplier-detector";
import { Badge } from "@/components/ui/badge";
import { detectVariantsFromText } from "@/lib/variant-detector";
import { generateProductName, generateVariantCode } from "@/lib/variant-code-generator";
import { Store } from "lucide-react";
import { useProductVariants } from "@/hooks/use-product-variants";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface AddProductToLiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phaseId: string;
  sessionId: string;
  onProductAdded?: () => void;
}

interface FormData {
  product_code: string;
  product_name: string;
  note: string;
  variants: { name: string; quantity: number }[];
}

export function AddProductToLiveDialog({ open, onOpenChange, phaseId, sessionId, onProductAdded }: AddProductToLiveDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const debouncedSearch = useDebounce(productSearchQuery, 300);
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [isSelectProductOpen, setIsSelectProductOpen] = useState(false);
  const [baseProductCode, setBaseProductCode] = useState<string>("");
  const [selectedVariantIds, setSelectedVariantIds] = useState<Set<string>>(new Set());
  const [isVariantsOpen, setIsVariantsOpen] = useState(false);
  const uploadAreaRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    defaultValues: {
      product_code: "",
      product_name: "",
      note: "",
      variants: [{ name: "", quantity: 0 }],
    },
  });

  // Auto-detect variants from product name
  const productName = form.watch("product_name");
  const { detectionResult, hasDetections } = useVariantDetector({
    productName,
    enabled: open,
  });

  // Auto-detect supplier from product name
  const detectedSupplier = productName ? detectSupplierFromProductName(productName) : null;

  // Fetch variants from inventory when base product code is entered
  const { data: detectedVariants = [], isLoading: isLoadingVariants } = useProductVariants(baseProductCode);

  // Auto-populate variants when detected
  useEffect(() => {
    if (detectedVariants.length > 0 && selectedVariantIds.size === 0) {
      // Auto-select all variants
      const allIds = new Set(detectedVariants.map(v => v.id));
      setSelectedVariantIds(allIds);
      
      // Auto-populate form with all variants (quantity = 1)
      const variantData = detectedVariants.map(v => ({
        name: v.variant,
        quantity: 1
      }));
      form.setValue("variants", variantData);
      
      // Auto-populate product_name from first variant
      if (detectedVariants[0]) {
        const baseName = detectedVariants[0].product_name.split('(')[0].trim();
        form.setValue('product_name', baseName);
      }
      
      // Set image from first variant if available
      if (!imageUrl && detectedVariants[0]) {
        const firstVariant = detectedVariants[0];
        if (firstVariant.product_images?.[0]) {
          setImageUrl(firstVariant.product_images[0]);
        } else if (firstVariant.tpos_image_url) {
          setImageUrl(firstVariant.tpos_image_url);
        }
      }
      
      toast.success(`Tìm thấy ${detectedVariants.length} biến thể`);
    }
  }, [detectedVariants, selectedVariantIds.size]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setBaseProductCode("");
      setSelectedVariantIds(new Set());
      setImageUrl("");
      setProductSearchQuery("");
      setShowProductSuggestions(false);
      form.reset();
    }
  }, [open]);

  // Fetch product suggestions from inventory
  const { data: suggestedProducts = [] } = useQuery({
    queryKey: ["product-suggestions", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) return [];
      
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .or(`product_code.ilike.%${debouncedSearch}%,product_name.ilike.%${debouncedSearch}%`)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
    enabled: debouncedSearch.length >= 2
  });

  const uploadImage = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error("Vui lòng chọn file hình ảnh");
      return;
    }

    setIsUploading(true);
    try {
      // Tự động nén ảnh nếu > 1MB
      let fileToUpload = file;
      if (file.size > 1 * 1024 * 1024) {
        toast.success(`Đang nén ảnh ${(file.size / 1024 / 1024).toFixed(1)}MB...`);
        fileToUpload = await compressImage(file, 1, 1920, 1920);
        toast.success(`Đã nén xuống ${(fileToUpload.size / 1024 / 1024).toFixed(1)}MB`);
      }

      const fileExt = fileToUpload.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `live-products/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('purchase-images')
        .upload(filePath, fileToUpload);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('purchase-images')
        .getPublicUrl(filePath);

      setImageUrl(publicUrl);
      toast.success("Đã tải ảnh lên thành công");
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : "Không thể tải ảnh lên");
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    if (!isFocused) return;
    
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        e.stopPropagation();
        const file = item.getAsFile();
        if (file) {
          await uploadImage(file);
        }
        break;
      }
    }
  }, [isFocused, uploadImage]);

  useEffect(() => {
    const handlePasteEvent = (e: ClipboardEvent) => handlePaste(e);
    document.addEventListener('paste', handlePasteEvent);
    return () => document.removeEventListener('paste', handlePasteEvent);
  }, [handlePaste]);

  // Handle product selection from suggestions or dialog
  const handleSelectProduct = async (product: any) => {
    // Check if it's a base product
    const isBaseProduct = !product.variant || product.base_product_code === product.product_code;
    
    if (isBaseProduct) {
      // Set base product code to trigger variant loading
      form.setValue("product_code", product.product_code);
      form.setValue("product_name", product.product_name);
      setBaseProductCode(product.product_code);
      setSelectedVariantIds(new Set()); // Reset selection to trigger auto-population
      setIsVariantsOpen(true); // Auto-open variants section
    } else {
      // Single variant selected - just add that one
      form.setValue("product_code", product.product_code);
      form.setValue("product_name", product.product_name);
      form.setValue("variants", [{ name: product.variant || "", quantity: 1 }]);
      setBaseProductCode(""); // Clear base product code
    }
    
    // Auto-fill image if available
    if (product.product_images?.[0]) {
      setImageUrl(product.product_images[0]);
    } else if (product.tpos_image_url) {
      setImageUrl(product.tpos_image_url);
    }
    
    setShowProductSuggestions(false);
    setProductSearchQuery("");
    toast.success(`Đã chọn: ${product.product_name}`);
  };

  // Handle blur on product code input to trigger variant loading
  const handleProductCodeBlur = () => {
    const productCode = form.getValues("product_code");
    const trimmedCode = productCode?.trim().toUpperCase() || "";
    if (trimmedCode && trimmedCode !== baseProductCode) {
      setBaseProductCode(trimmedCode);
      setSelectedVariantIds(new Set()); // Reset selection to trigger auto-population
      setIsVariantsOpen(true); // Auto-open variants section
    }
  };

  // Toggle variant selection
  const toggleVariantSelection = (variantId: string, variant: any) => {
    const newSelected = new Set(selectedVariantIds);
    
    if (newSelected.has(variantId)) {
      newSelected.delete(variantId);
    } else {
      newSelected.add(variantId);
    }
    
    setSelectedVariantIds(newSelected);
    
    // Update form variants based on selection
    const currentVariants = form.getValues("variants");
    const variantIndex = currentVariants.findIndex(v => v.name === variant.variant);
    
    if (newSelected.has(variantId)) {
      // Add variant if not already in form
      if (variantIndex === -1) {
        form.setValue("variants", [...currentVariants, { name: variant.variant, quantity: 1 }]);
      }
    } else {
      // Remove variant from form
      if (variantIndex !== -1) {
        form.setValue("variants", currentVariants.filter((_, i) => i !== variantIndex));
      }
    }
  };

  // Select/deselect all variants
  const toggleSelectAll = () => {
    if (selectedVariantIds.size === detectedVariants.length) {
      // Deselect all
      setSelectedVariantIds(new Set());
      form.setValue("variants", [{ name: "", quantity: 0 }]);
    } else {
      // Select all
      const allIds = new Set(detectedVariants.map(v => v.id));
      setSelectedVariantIds(allIds);
      const variantData = detectedVariants.map(v => ({
        name: v.variant,
        quantity: 1
      }));
      form.setValue("variants", variantData);
    }
  };

  // Update variant quantity
  const updateVariantQuantity = (variantName: string, quantity: number) => {
    const currentVariants = form.getValues("variants");
    const variantIndex = currentVariants.findIndex(v => v.name === variantName);
    
    if (variantIndex !== -1) {
      const updatedVariants = [...currentVariants];
      updatedVariants[variantIndex].quantity = quantity;
      form.setValue("variants", updatedVariants);
    }
  };

  const addProductMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const insertData = [];
      
      // SCENARIO A: Adding from inventory (has detectedVariants)
      if (detectedVariants.length > 0) {
        for (const variant of data.variants) {
          const matchedProduct = detectedVariants.find(v => v.variant === variant.name);
          
          if (matchedProduct) {
            // Check for duplicates
            const { data: existingProducts, error: checkError } = await supabase
              .from("live_products")
              .select("id")
              .eq("live_phase_id", phaseId)
              .eq("product_code", matchedProduct.product_code);

            if (checkError) throw checkError;

            if (existingProducts && existingProducts.length > 0) {
              throw new Error(`Sản phẩm "${matchedProduct.product_code}" đã tồn tại trong phiên live này`);
            }
            
            insertData.push({
              live_session_id: sessionId,
              live_phase_id: phaseId,
              product_code: matchedProduct.product_code,
              product_name: matchedProduct.product_name,
              variant: matchedProduct.variant,
              base_product_code: matchedProduct.base_product_code,
              prepared_quantity: variant.quantity,
              sold_quantity: 0,
              image_url: imageUrl || matchedProduct.tpos_image_url || null,
              note: data.note.trim() || null,
              product_type: 'hang_dat',
            });
          }
        }
      } 
      // SCENARIO B: Manual add (no inventory match)
      else {
        for (const variant of data.variants) {
          let productCode = data.product_code.trim();
          
          // Nếu không có mã, tự động generate mã N/A
          if (!productCode) {
            productCode = await getNextNACode();
            toast.info(`Tự động tạo mã: ${productCode}`);
          }
          
          const productName = data.product_name.trim() || null;
          const variantName = variant.name.trim() || null;
          
          // Check for duplicates
          const { data: existingProducts, error: checkError } = await supabase
            .from("live_products")
            .select("id")
            .eq("live_phase_id", phaseId)
            .eq("product_code", productCode);

          if (checkError) throw checkError;

          if (existingProducts && existingProducts.length > 0) {
            throw new Error(`Sản phẩm "${productCode}" đã tồn tại trong phiên live này`);
          }
          
          insertData.push({
            live_session_id: sessionId,
            live_phase_id: phaseId,
            product_code: productCode,
            product_name: productName,
            variant: variantName,
            base_product_code: null,
            prepared_quantity: variant.quantity,
            sold_quantity: 0,
            image_url: imageUrl || null,
            note: data.note.trim() || null,
            product_type: 'hang_dat',
          });
        }
      }

      const { error } = await supabase
        .from("live_products")
        .insert(insertData);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-products", phaseId] });
      toast.success("Đã thêm sản phẩm vào phiên live thành công");
      form.reset();
      setImageUrl("");
      onOpenChange(false);
      onProductAdded?.();
    },
    onError: (error) => {
      console.error("Error adding product to live:", error);
      toast.error(error.message || "Có lỗi xảy ra khi thêm sản phẩm");
    },
  });

  const onSubmit = async (data: FormData) => {
    if (!phaseId) {
      toast.error("Vui lòng chọn một phiên live");
      return;
    }

    // Check for duplicate variant names
    const variantNames = data.variants.map(v => v.name.trim().toLowerCase()).filter(n => n);
    const duplicates = variantNames.filter((name, index) => variantNames.indexOf(name) !== index);
    if (duplicates.length > 0) {
      toast.error("Có biến thể bị trùng lặp");
      return;
    }

    setIsSubmitting(true);
    try {
      await addProductMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addVariant = () => {
    const currentVariants = form.getValues("variants");
    form.setValue("variants", [...currentVariants, { name: "", quantity: 0 }]);
  };

  const removeVariant = (index: number) => {
    const currentVariants = form.getValues("variants");
    if (currentVariants.length > 1) {
      form.setValue("variants", currentVariants.filter((_, i) => i !== index));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Thêm Sản Phẩm Vào Live</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="product_code"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Mã sản phẩm (để trống sẽ tự tạo mã N/A)</FormLabel>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsSelectProductOpen(true)}
                      className="h-7 text-xs"
                    >
                      <Warehouse className="w-3 h-3 mr-1" />
                      Chọn từ Kho SP
                    </Button>
                  </div>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        placeholder="Nhập mã SP hoặc để trống tự tạo N/A..."
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          setProductSearchQuery(e.target.value);
                          setShowProductSuggestions(true);
                        }}
                        onFocus={() => {
                          if (field.value) {
                            setProductSearchQuery(field.value);
                            setShowProductSuggestions(true);
                          }
                        }}
                        onBlur={() => {
                          setTimeout(() => {
                            setShowProductSuggestions(false);
                            handleProductCodeBlur();
                          }, 200);
                        }}
                      />
                      
                      {showProductSuggestions && suggestedProducts.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
                          {suggestedProducts.map((product) => (
                            <div
                              key={product.id}
                              className="px-3 py-2 cursor-pointer hover:bg-muted transition-colors"
                              onClick={() => handleSelectProduct(product)}
                            >
                              <div className="font-medium text-sm">{product.product_code}</div>
                              <div className="text-xs text-muted-foreground line-clamp-1">
                                {product.product_name}
                                {product.variant && ` - ${product.variant}`}
                              </div>
                              {product.stock_quantity !== undefined && (
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  Tồn: {product.stock_quantity}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="product_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên sản phẩm</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Nhập tên sản phẩm (không bắt buộc)"
                      {...field}
                    />
                  </FormControl>
                  <div className="flex gap-2 flex-wrap mt-2">
                    {hasDetections && (
                      <VariantDetectionBadge detectionResult={detectionResult} />
                    )}
                    {detectedSupplier && (
                      <Badge variant="outline" className="gap-1">
                        <Store className="h-3 w-3" />
                        NCC: {detectedSupplier}
                      </Badge>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Auto-detected variants section */}
            {isLoadingVariants && baseProductCode && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang tìm biến thể...</span>
              </div>
            )}

            {detectedVariants.length > 0 && (
              <Collapsible open={isVariantsOpen} onOpenChange={setIsVariantsOpen}>
                <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-2">
                        <ChevronDown className={`w-4 h-4 text-primary transition-transform ${isVariantsOpen ? '' : '-rotate-90'}`} />
                        <Package className="w-4 h-4 text-primary" />
                        <span className="font-medium text-sm">
                          Biến thể từ kho
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {selectedVariantIds.size}/{detectedVariants.length}
                        </Badge>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectAll();
                        }}
                        className="h-7 text-xs"
                      >
                        {selectedVariantIds.size === detectedVariants.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                      </Button>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="grid gap-2 max-h-60 overflow-y-auto pt-2">
                      {detectedVariants.map((variant) => {
                        const isSelected = selectedVariantIds.has(variant.id);
                        const currentVariants = form.watch("variants");
                        const formVariant = currentVariants.find(v => v.name === variant.variant);
                        
                        return (
                          <div
                            key={variant.id}
                            className={`flex items-center gap-3 p-2 rounded-lg border transition-colors ${
                              isSelected ? "bg-primary/5 border-primary/20" : "bg-background"
                            }`}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleVariantSelection(variant.id, variant)}
                            />
                            
                            {(variant.product_images?.[0] || variant.tpos_image_url) && (
                              <img
                                src={variant.product_images?.[0] || variant.tpos_image_url || ""}
                                alt={variant.variant}
                                className="w-10 h-10 object-cover rounded border"
                              />
                            )}
                            
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">
                                {variant.variant}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Tồn: {variant.stock_quantity}
                              </div>
                            </div>
                            
                            {isSelected && (
                              <Input
                                type="number"
                                min="1"
                                value={formVariant?.quantity || 1}
                                onChange={(e) => updateVariantQuantity(variant.variant, parseInt(e.target.value) || 1)}
                                className="w-20 h-8 text-center"
                                onClick={(e) => e.stopPropagation()}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )}

            <div>
              <FormLabel>Hình ảnh sản phẩm</FormLabel>
              <div 
                ref={uploadAreaRef}
                className={`mt-2 flex flex-col gap-2 min-h-[120px] p-3 rounded border-2 transition-colors outline-none ${
                  isFocused ? 'border-primary bg-muted/20' : 'border-dashed border-muted-foreground/25'
                }`}
                tabIndex={0}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
              >
                {/* Image preview */}
                {imageUrl && (
                  <div className="relative inline-block">
                    <img 
                      src={imageUrl} 
                      alt="Preview" 
                      className="w-32 h-32 object-cover rounded border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                      onClick={() => setImageUrl("")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* Upload area */}
                <div className="flex items-center justify-center flex-1">
                  {isUploading ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Đang tải...</span>
                    </div>
                  ) : (
                    <div className="text-center">
                      <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground font-medium">
                        Ctrl+V để dán ảnh
                      </p>
            <p className="text-xs text-muted-foreground mt-1">
              {imageUrl ? "Dán để thay thế ảnh" : "Ảnh sẽ tự động nén nếu > 1MB"}
            </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ghi chú</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Nhập ghi chú cho sản phẩm (không bắt buộc)"
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <FormLabel>Biến thể</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addVariant}
                >
                  + Thêm biến thể
                </Button>
              </div>

              {form.watch("variants").map((_, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <FormField
                    control={form.control}
                    name={`variants.${index}.name`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        {index === 0 && <FormLabel className="sr-only">Tên biến thể</FormLabel>}
                        <FormControl>
                          <Input 
                            placeholder="Tên biến thể (không bắt buộc)"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`variants.${index}.quantity`}
                    render={({ field }) => (
                      <FormItem className="w-32">
                        {index === 0 && <FormLabel className="sr-only">Số lượng</FormLabel>}
                        <FormControl>
                          <Input 
                            type="number"
                            min="0"
                            placeholder="Số lượng"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.watch("variants").length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeVariant(index)}
                      className="mt-0"
                    >
                      ×
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Hủy
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting || isUploading || !phaseId}
                className="flex-1"
              >
                {isUploading ? "Đang tải ảnh..." : isSubmitting ? "Đang thêm..." : "Thêm sản phẩm"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>

      <SelectProductDialog
        open={isSelectProductOpen}
        onOpenChange={setIsSelectProductOpen}
        onSelect={handleSelectProduct}
      />
    </Dialog>
  );
}