import { useState } from "react";
import { RefreshCw, CheckCircle, AlertCircle, Copy, ChevronDown, ChevronUp, ShoppingCart, Key, Save, TestTube2, Code, Download, Upload, Facebook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getTPOSHeaders, getActiveTPOSToken } from "@/lib/tpos-config";
import { getTPOSProduct, parseVariantToAttributes, createAttributeLines, generateVariants, createPayload, postTPOSVariantPayload, createTPOSVariants } from "@/lib/tpos-variant-creator";
import { TPOS_ATTRIBUTES } from "@/lib/tpos-attributes";
import { uploadToTPOS, TPOSProductItem } from "@/lib/tpos-api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VariantTestTool } from "@/components/settings/VariantTestTool";
import { SimpleProductUploadDialog } from "@/components/settings/SimpleProductUploadDialog";
import { BarcodeProductTest } from "@/components/settings/BarcodeProductTest";
import { BarcodeScannerSettings } from "@/components/settings/BarcodeScannerSettings";
import { FetchTPOSProductsDialog } from "@/components/settings/FetchTPOSProductsDialog";
import { GetTPOSProductTool } from "@/components/settings/GetTPOSProductTool";
import { FacebookPageManager } from "@/components/facebook/FacebookPageManager";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Import Tabs components

const Settings = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [checkResult, setCheckResult] = useState<any>(null);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [isJsonOpen, setIsJsonOpen] = useState(false);
  const isMobile = useIsMobile();
  
  const [topValue, setTopValue] = useState("20");
  const [isFetchingOrders, setIsFetchingOrders] = useState(false);
  const [ordersResult, setOrdersResult] = useState<any>(null);
  const [isOrdersJsonOpen, setIsOrdersJsonOpen] = useState(false);
  
  const [bearerToken, setBearerToken] = useState("");
  const [isUpdatingToken, setIsUpdatingToken] = useState(false);
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const [currentToken, setCurrentToken] = useState<any>(null);
  
  // Test Variant Creator states
  const [testProductId, setTestProductId] = useState("107831");
  const [isGettingProduct, setIsGettingProduct] = useState(false);
  const [testProduct, setTestProduct] = useState<any>(null);
  const [selectedSizeText, setSelectedSizeText] = useState<number[]>([]);
  const [selectedSizeNumber, setSelectedSizeNumber] = useState<number[]>([]);
  const [selectedColor, setSelectedColor] = useState<number[]>([]);
  const [isPostingVariant, setIsPostingVariant] = useState(false);
  const [variantPostResult, setVariantPostResult] = useState<any>(null);
  const [isTestJsonOpen, setIsTestJsonOpen] = useState(false);
  
  // TPOS Debug states (moved from LiveProducts)
  const [testOrderId, setTestOrderId] = useState("");
  const [testOrderResponse, setTestOrderResponse] = useState<any>(null);
  const [isTestingOrder, setIsTestingOrder] = useState(false);
  const [testOrderError, setTestOrderError] = useState<string | null>(null);
  const [isTestResponseOpen, setIsTestResponseOpen] = useState(false);
  
  const [testTPOSProductId, setTestTPOSProductId] = useState("");
  const [testTPOSProductResponse, setTestTPOSProductResponse] = useState<any>(null);
  const [isTestingTPOSProduct, setIsTestingTPOSProduct] = useState(false);
  const [testTPOSProductError, setTestTPOSProductError] = useState<string | null>(null);
  const [isTPOSProductResponseOpen, setIsTPOSProductResponseOpen] = useState(false);
  
  const [testVariantProductId, setTestVariantProductId] = useState("");
  const [testVariantString, setTestVariantString] = useState("");
  const [testVariantResponse, setTestVariantResponse] = useState<any>(null);
  const [isTestingVariant, setIsTestingVariant] = useState(false);
  const [testVariantError, setTestVariantError] = useState<string | null>(null);
  const [isVariantResponseOpen, setIsVariantResponseOpen] = useState(false);
  
  // Single Product Upload states
  const [singleProductName, setSingleProductName] = useState("");
  const [singleProductCode, setSingleProductCode] = useState("");
  const [singleVariant, setSingleVariant] = useState("");
  const [singlePurchasePrice, setSinglePurchasePrice] = useState("");
  const [singleSellingPrice, setSingleSellingPrice] = useState("");
  const [isUploadingSingle, setIsUploadingSingle] = useState(false);
  const [singleUploadResult, setSingleUploadResult] = useState<any>(null);
  const [isSingleResultOpen, setIsSingleResultOpen] = useState(false);
  const [isSimpleUploadOpen, setIsSimpleUploadOpen] = useState(false);
  const [isFetchTPOSDialogOpen, setIsFetchTPOSDialogOpen] = useState(false);
  
  const { toast } = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Đã sao chép",
      description: "JSON đã được sao chép vào clipboard",
    });
  };

  const handleCheckImages = async () => {
    setIsChecking(true);
    setCheckResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('check-tpos-images');
      
      if (error) throw error;
      
      if (data.success) {
        setCheckResult(data);
        toast({
          title: "Kiểm tra hoàn tất",
          description: `Tìm thấy ${data.summary.total_tpos_products} sản phẩm từ TPOS`,
        });
      } else {
        throw new Error(data.error || "Lỗi không xác định");
      }
    } catch (error: any) {
      console.error("Check images error:", error);
      toast({
        variant: "destructive",
        title: "Lỗi kiểm tra",
        description: error.message === "Unauthorized" 
          ? "Token TPOS đã hết hạn. Vui lòng cập nhật token mới trong Secrets."
          : error.message,
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleSyncImages = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('sync-tpos-images');
      
      if (error) throw error;
      
      if (data.success) {
        setSyncResult(data);
        toast({
          title: "Đồng bộ thành công",
          description: `Đã cập nhật ${data.summary.updated} sản phẩm`,
        });
      } else {
        throw new Error(data.error || "Lỗi không xác định");
      }
    } catch (error: any) {
      console.error("Sync images error:", error);
      toast({
        variant: "destructive",
        title: "Lỗi đồng bộ",
        description: error.message === "Unauthorized"
          ? "Token TPOS đã hết hạn. Vui lòng cập nhật token mới trong Secrets."
          : error.message,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const loadCurrentToken = async () => {
    setIsLoadingToken(true);
    try {
      const { data, error } = await supabase
        .from("tpos_config")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();
      
      if (error) throw error;
      
      if (data) {
        setCurrentToken(data);
        setBearerToken(data.bearer_token);
        toast({
          title: "Tải token thành công",
          description: "Token hiện tại đã được tải",
        });
      } else {
        toast({
          title: "Chưa có token",
          description: "Chưa có token nào được lưu trong hệ thống",
        });
      }
    } catch (error: any) {
      console.error("Load token error:", error);
      toast({
        variant: "destructive",
        title: "Lỗi tải token",
        description: error.message,
      });
    } finally {
      setIsLoadingToken(false);
    }
  };

  const handleUpdateToken = async () => {
    if (!bearerToken.trim()) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng nhập Bearer Token",
      });
      return;
    }
    
    setIsUpdatingToken(true);
    
    try {
      // Deactivate all existing tokens
      const { error: deactivateError } = await supabase
        .from("tpos_config")
        .update({ is_active: false })
        .eq("is_active", true);
      
      if (deactivateError) throw deactivateError;
      
      // Insert new token
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("tpos_config")
        .insert({
          bearer_token: bearerToken.trim(),
          is_active: true,
          created_by: userData.user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Log via edge function
      await supabase.functions.invoke('update-tpos-token', {
        body: { bearerToken: bearerToken.trim() }
      });
      
      setCurrentToken(data);
      
      toast({
        title: "✅ Cập nhật thành công",
        description: "Bearer Token đã được lưu vào database và sẵn sàng sử dụng",
      });
    } catch (error: any) {
      console.error("Update token error:", error);
      toast({
        variant: "destructive",
        title: "❌ Lỗi cập nhật",
        description: error.message,
      });
    } finally {
      setIsUpdatingToken(false);
    }
  };

  const handleFetchOrders = async () => {
    setIsFetchingOrders(true);
    setOrdersResult(null);
    
    try {
      const token = await getActiveTPOSToken();
      if (!token) {
        toast({
          variant: "destructive",
          title: "Lỗi",
          description: "Chưa có TPOS Bearer Token. Vui lòng cập nhật token trước.",
        });
        return;
      }
      
      // Get today's date range (00:00:00 to 23:59:59)
      const today = new Date();
      const startDate = new Date(today.setHours(0, 0, 0, 0));
      const endDate = new Date(today.setHours(23, 59, 59, 999));
      
      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();
      
      const url = `https://tomato.tpos.vn/odata/SaleOnline_Order/ODataService.GetView?$top=${topValue}&$orderby=DateCreated desc&$filter=(DateCreated ge ${startDateStr} and DateCreated le ${endDateStr})&$count=true`;
      
      const response = await fetch(url, {
        headers: getTPOSHeaders(token),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setOrdersResult(data);
      
      toast({
        title: "Lấy đơn hàng thành công",
        description: `Tìm thấy ${data["@odata.count"] || data.value?.length || 0} đơn hàng`,
      });
    } catch (error: any) {
      console.error("Fetch orders error:", error);
      toast({
        variant: "destructive",
        title: "Lỗi lấy đơn hàng",
        description: error.message,
      });
    } finally {
      setIsFetchingOrders(false);
    }
  };

  const handleGetTestProduct = async () => {
    if (!testProductId.trim()) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng nhập TPOS Product ID",
      });
      return;
    }

    setIsGettingProduct(true);
    setTestProduct(null);
    setSelectedSizeText([]);
    setSelectedSizeNumber([]);
    setSelectedColor([]);
    setVariantPostResult(null);

    try {
      const product = await getTPOSProduct(parseInt(testProductId));
      setTestProduct(product);
      toast({
        title: "Lấy sản phẩm thành công",
        description: `${product.Name}`,
      });
    } catch (error: any) {
      console.error("Get product error:", error);
      toast({
        variant: "destructive",
        title: "Lỗi lấy sản phẩm",
        description: error.message,
      });
    } finally {
      setIsGettingProduct(false);
    }
  };

  const handlePostVariant = async () => {
    if (!testProduct) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng GET sản phẩm trước",
      });
      return;
    }

    if (selectedSizeText.length === 0 && selectedSizeNumber.length === 0 && selectedColor.length === 0) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng chọn ít nhất một attribute",
      });
      return;
    }

    setIsPostingVariant(true);
    setVariantPostResult(null);

    try {
      // Build selected attributes
      const selectedAttributes: any = {};
      
      if (selectedSizeText.length > 0) {
        selectedAttributes.sizeText = TPOS_ATTRIBUTES.sizeText.filter(attr => 
          selectedSizeText.includes(attr.Id)
        );
      }
      
      if (selectedSizeNumber.length > 0) {
        selectedAttributes.sizeNumber = TPOS_ATTRIBUTES.sizeNumber.filter(attr => 
          selectedSizeNumber.includes(attr.Id)
        );
      }
      
      if (selectedColor.length > 0) {
        selectedAttributes.color = TPOS_ATTRIBUTES.color.filter(attr => 
          selectedColor.includes(attr.Id)
        );
      }

      // Create attribute lines
      const attributeLines = createAttributeLines(selectedAttributes);
      
      // Generate variants
      const variants = generateVariants(testProduct, attributeLines);
      
      // Create payload
      const payload = createPayload(testProduct, attributeLines, variants);
      
      // Post to TPOS
      const result = await postTPOSVariantPayload(payload);
      
      setVariantPostResult(result);
      toast({
        title: "✅ Tạo variant thành công",
        description: `Đã tạo ${variants.filter((v: any) => v.Id === 0).length} variants mới`,
      });
    } catch (error: any) {
      console.error("Post variant error:", error);
      toast({
        variant: "destructive",
        title: "Lỗi tạo variant",
        description: error.message,
      });
    } finally {
      setIsPostingVariant(false);
    }
  };

  // TPOS Debug handlers (moved from LiveProducts)
  const handleTestGetOrder = async () => {
    if (!testOrderId.trim()) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng nhập Order ID",
      });
      return;
    }

    setIsTestingOrder(true);
    setTestOrderError(null);
    setTestOrderResponse(null);
    
    try {
      const token = await getActiveTPOSToken();
      if (!token) {
        throw new Error("Không tìm thấy TPOS token");
      }

      const response = await fetch(
        `https://tomato.tpos.vn/odata/SaleOnline_Order(${testOrderId})?$expand=Details,Partner,User,CRMTeam`,
        { headers: getTPOSHeaders(token) }
      );

      if (!response.ok) {
        throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setTestOrderResponse(data);
      setIsTestResponseOpen(true);
      toast({
        title: "Thành công",
        description: "Lấy thông tin order thành công!",
      });
    } catch (error: any) {
      setTestOrderError(error.message);
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Lỗi khi lấy thông tin order",
      });
    } finally {
      setIsTestingOrder(false);
    }
  };

  const handleTestGetTPOSProduct = async () => {
    if (!testTPOSProductId.trim()) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng nhập Product ID",
      });
      return;
    }

    setIsTestingTPOSProduct(true);
    setTestTPOSProductError(null);
    setTestTPOSProductResponse(null);
    
    try {
      const data = await getTPOSProduct(parseInt(testTPOSProductId));
      setTestTPOSProductResponse(data);
      setIsTPOSProductResponseOpen(true);
      toast({
        title: "Thành công",
        description: "Lấy thông tin product thành công!",
      });
    } catch (error: any) {
      setTestTPOSProductError(error.message);
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Lỗi khi lấy thông tin product",
      });
    } finally {
      setIsTestingTPOSProduct(false);
    }
  };

  const handleTestCreateVariant = async () => {
    if (!testVariantProductId.trim()) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng nhập Product ID",
      });
      return;
    }
    if (!testVariantString.trim()) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng nhập chuỗi biến thể (ví dụ: Đen, L)",
      });
      return;
    }

    setIsTestingVariant(true);
    setTestVariantError(null);
    setTestVariantResponse(null);
    
    try {
      const data = await createTPOSVariants(
        parseInt(testVariantProductId),
        testVariantString,
        (message) => {
          console.log("Progress:", message);
        }
      );
      setTestVariantResponse(data);
      setIsVariantResponseOpen(true);
      toast({
        title: "Thành công",
        description: "Tạo variants thành công!",
      });
    } catch (error: any) {
      setTestVariantError(error.message);
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Lỗi khi tạo variants",
      });
    } finally {
      setIsTestingVariant(false);
    }
  };

  const handleUploadSingleProduct = async () => {
    // Validate inputs
    if (!singleProductName.trim()) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng nhập tên sản phẩm",
      });
      return;
    }
    
    if (!singleProductCode.trim()) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng nhập mã sản phẩm",
      });
      return;
    }
    
    const purchasePrice = parseFloat(singlePurchasePrice) || 0;
    const sellingPrice = parseFloat(singleSellingPrice) || 0;
    
    setIsUploadingSingle(true);
    setSingleUploadResult(null);
    
    try {
      const item: TPOSProductItem = {
        id: crypto.randomUUID(),
        product_code: singleProductCode.trim(),
        product_name: singleProductName.trim(),
        variant: singleVariant.trim() || null,
        quantity: 1,
        unit_price: purchasePrice,
        selling_price: sellingPrice,
        product_images: null,
        price_images: null,
        base_product_code: singleProductCode.trim(),
        purchase_order_id: "",
        supplier_name: "Manual Upload",
      };
      
      const result = await uploadToTPOS([item], (step, total, message) => {
        console.log(`[${step}/${total}] ${message}`);
      });
      
      setSingleUploadResult(result);
      setIsSingleResultOpen(true);
      
      if (result.successCount > 0) {
        toast({
          title: "✅ Upload thành công",
          description: `Sản phẩm đã được upload lên TPOS`,
        });
        
        // Clear form
        setSingleProductName("");
        setSingleProductCode("");
        setSingleVariant("");
        setSinglePurchasePrice("");
        setSingleSellingPrice("");
      } else {
        toast({
          variant: "destructive",
          title: "❌ Upload thất bại",
          description: result.errors[0]?.errorMessage || "Có lỗi xảy ra",
        });
      }
    } catch (error: any) {
      console.error("Upload single product error:", error);
      toast({
        variant: "destructive",
        title: "Lỗi upload",
        description: error.message,
      });
    } finally {
      setIsUploadingSingle(false);
    }
  };

  return (
    <div className={cn(
      "mx-auto space-y-6",
      isMobile ? "p-4" : "container p-6"
    )}>
      <div className={cn(
        "flex items-center",
        isMobile ? "flex-col items-start gap-3 w-full" : "justify-between"
      )}>
        <div>
          <h1 className={cn(
            "font-bold",
            isMobile ? "text-xl" : "text-3xl"
          )}>Cài đặt</h1>
          <p className={cn(
            "text-muted-foreground mt-2",
            isMobile ? "text-sm" : "text-base"
          )}>Quản lý các cài đặt hệ thống</p>
        </div>
        <Button 
          variant="default" 
          size={isMobile ? "sm" : "lg"}
          onClick={() => setIsSimpleUploadOpen(true)}
          className={isMobile ? "w-full" : ""}
        >
          <Upload className="mr-2 h-4 w-4" />
          Upload sản phẩm đơn giản
        </Button>
      </div>

      <SimpleProductUploadDialog 
        open={isSimpleUploadOpen}
        onOpenChange={setIsSimpleUploadOpen}
        items={[]}
        onSuccess={() => {
          toast({
            title: "Thành công",
            description: "Đã upload sản phẩm lên TPOS",
          });
        }}
      />

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          <TabsTrigger value="general" className="gap-2">
            <Key className="h-4 w-4" />
            Cấu hình chung
          </TabsTrigger>
          <TabsTrigger value="tpos-data" className="gap-2">
            <Download className="h-4 w-4" />
            Dữ liệu TPOS
          </TabsTrigger>
          <TabsTrigger value="tpos-tools" className="gap-2">
            <Code className="h-4 w-4" />
            Công cụ TPOS
          </TabsTrigger>
          <TabsTrigger value="barcode" className="gap-2">
            <TestTube2 className="h-4 w-4" />
            Barcode & Test
          </TabsTrigger>
        </TabsList>

        {/* Tab: Cấu hình chung */}
        <TabsContent value="general" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Cập nhật TPOS Bearer Token
                </CardTitle>
                <CardDescription>
                  Quản lý Bearer Token để kết nối với hệ thống TPOS
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Bearer Token</label>
                  <Textarea
                    value={bearerToken}
                    onChange={(e) => setBearerToken(e.target.value)}
                    placeholder="Nhập Bearer Token từ TPOS..."
                    className="min-h-[100px] font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    Token này sẽ được sử dụng để gọi API TPOS. Vui lòng lấy token mới từ TPOS khi token cũ hết hạn.
                  </p>
                </div>
                
                <div className="flex gap-3">
                  <Button
                    onClick={handleUpdateToken}
                    disabled={isUpdatingToken || !bearerToken.trim()}
                  >
                    {isUpdatingToken ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Đang cập nhật...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Cập nhật Token
                      </>
                    )}
                  </Button>
                  
                  <Button
                    onClick={loadCurrentToken}
                    variant="outline"
                    disabled={isLoadingToken}
                  >
                    {isLoadingToken ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Đang tải...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Tải token hiện tại
                      </>
                    )}
                  </Button>
                </div>
                
                {currentToken && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>Token hiện tại</AlertTitle>
                    <AlertDescription>
                      <div className="mt-2 space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Đã lưu lúc:</span>
                          <Badge variant="secondary">
                            {new Date(currentToken.updated_at).toLocaleString('vi-VN')}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Trạng thái:</span>
                          <Badge variant={currentToken.is_active ? "default" : "secondary"}>
                            {currentToken.is_active ? "Đang hoạt động" : "Không hoạt động"}
                          </Badge>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <FacebookPageManager />
          </div>

          <BarcodeScannerSettings />
        </TabsContent>

        {/* Tab: Dữ liệu TPOS */}
        <TabsContent value="tpos-data" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Quản lý ảnh TPOS
                </CardTitle>
                <CardDescription>
                  Kiểm tra và đồng bộ hóa ảnh sản phẩm từ hệ thống TPOS về database
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <Button
                    onClick={handleCheckImages}
                    disabled={isChecking || isSyncing}
                    variant="outline"
                  >
                    {isChecking ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Đang kiểm tra...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Kiểm tra ảnh TPOS
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={handleSyncImages}
                    disabled={isChecking || isSyncing}
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Đang đồng bộ...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Đồng bộ ảnh TPOS
                      </>
                    )}
                  </Button>
                </div>

                {checkResult && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Kết quả kiểm tra</AlertTitle>
                    <AlertDescription>
                      <div className="mt-2 space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Tổng sản phẩm TPOS:</span>
                          <Badge variant="secondary">{checkResult.summary.total_tpos_products}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Sản phẩm trong DB:</span>
                          <Badge variant="secondary">{checkResult.summary.total_db_products}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Thiếu ảnh:</span>
                          <Badge variant="destructive">{checkResult.summary.missing_images}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Không tìm thấy trong TPOS:</span>
                          <Badge variant="outline">{checkResult.summary.not_found_in_tpos}</Badge>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {syncResult && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>Kết quả đồng bộ</AlertTitle>
                    <AlertDescription>
                      <div className="mt-2 space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Tổng sản phẩm xử lý:</span>
                          <Badge variant="secondary">{syncResult.summary.total_products}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Đã cập nhật:</span>
                          <Badge>{syncResult.summary.updated}</Badge>
                        </div>
                        {syncResult.summary.skipped > 0 && (
                          <div className="flex justify-between">
                            <span>Đã đồng bộ trước đó:</span>
                            <Badge variant="outline">{syncResult.summary.skipped}</Badge>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Không tìm thấy trong TPOS:</span>
                          <Badge variant="outline">{syncResult.summary.not_found_in_tpos}</Badge>
                        </div>
                        {syncResult.summary.errors > 0 && (
                          <div className="flex justify-between">
                            <span>Lỗi:</span>
                            <Badge variant="destructive">{syncResult.summary.errors}</Badge>
                          </div>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {(checkResult || syncResult) && (
                  <Collapsible open={isJsonOpen} onOpenChange={setIsJsonOpen}>
                    <Card className="border-dashed">
                      <CollapsibleTrigger className="w-full">
                        <CardHeader className="hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">Chi tiết JSON Response</CardTitle>
                            {isJsonOpen ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent>
                          <div className="space-y-4">
                            {checkResult && (
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-sm font-medium">Check Result:</p>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => copyToClipboard(JSON.stringify(checkResult, null, 2))}
                                  >
                                    <Copy className="h-3 w-3 mr-1" />
                                    Copy
                                  </Button>
                                </div>
                                <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-96">
                                  {JSON.stringify(checkResult, null, 2)}
                                </pre>
                              </div>
                            )}
                            {syncResult && (
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-sm font-medium">Sync Result:</p>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => copyToClipboard(JSON.stringify(syncResult, null, 2))}
                                  >
                                    <Copy className="h-3 w-3 mr-1" />
                                    Copy
                                  </Button>
                                </div>
                                <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-96">
                                  {JSON.stringify(syncResult, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Đơn hàng TPOS
                </CardTitle>
                <CardDescription>
                  Lấy danh sách đơn hàng online từ TPOS theo ngày hôm nay
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3 items-end">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Số lượng đơn hàng</label>
                    <Select value={topValue} onValueChange={setTopValue}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Chọn số lượng" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="20">20 đơn</SelectItem>
                        <SelectItem value="50">50 đơn</SelectItem>
                        <SelectItem value="200">200 đơn</SelectItem>
                        <SelectItem value="1000">1000 đơn</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button
                    onClick={handleFetchOrders}
                    disabled={isFetchingOrders}
                  >
                    {isFetchingOrders ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Đang lấy...
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        Lấy đơn hàng
                      </>
                    )}
                  </Button>
                </div>

                {ordersResult && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>Kết quả</AlertTitle>
                    <AlertDescription>
                      <div className="mt-2 space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Tổng số đơn hàng:</span>
                          <Badge variant="secondary">
                            {ordersResult["@odata.count"] || ordersResult.value?.length || 0}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Đơn hàng hiển thị:</span>
                          <Badge>{ordersResult.value?.length || 0}</Badge>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {ordersResult && (
                  <Collapsible open={isOrdersJsonOpen} onOpenChange={setIsOrdersJsonOpen}>
                    <Card className="border-dashed">
                      <CollapsibleTrigger className="w-full">
                        <CardHeader className="hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">Chi tiết JSON Response</CardTitle>
                            {isOrdersJsonOpen ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium">Orders Response:</p>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyToClipboard(JSON.stringify(ordersResult, null, 2))}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copy
                            </Button>
                          </div>
                          <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-96">
                            {JSON.stringify(ordersResult, null, 2)}
                          </pre>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Lấy sản phẩm từ TPOS
                </CardTitle>
                <CardDescription>
                  Import sản phẩm từ TPOS về hệ thống nội bộ với số lượng tùy chọn
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => setIsFetchTPOSDialogOpen(true)}
                  variant="default"
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Mở công cụ lấy sản phẩm
                </Button>
              </CardContent>
            </Card>

            <GetTPOSProductTool />
          </div>
        </TabsContent>

        {/* Tab: Công cụ TPOS */}
        <TabsContent value="tpos-tools" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TestTube2 className="h-5 w-5" />
                  Test Variant Creator
                </CardTitle>
                <CardDescription>
                  Test việc tạo variant trên TPOS với product ID và attributes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">TPOS Product ID</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={testProductId}
                      onChange={(e) => setTestProductId(e.target.value)}
                      placeholder="Nhập TPOS Product ID..."
                      className="flex-1"
                    />
                    <Button
                      onClick={handleGetTestProduct}
                      disabled={isGettingProduct}
                      variant="outline"
                    >
                      {isGettingProduct ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Getting...
                        </>
                      ) : (
                        "GET Product"
                      )}
                    </Button>
                  </div>
                </div>

                {testProduct && (
                  <>
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertTitle>Product Retrieved</AlertTitle>
                      <AlertDescription>
                        <div className="mt-2 space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>Name:</span>
                            <Badge variant="secondary">{testProduct.Name}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Code:</span>
                            <Badge variant="outline">{testProduct.DefaultCode}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Price:</span>
                            <Badge>{testProduct.ListPrice?.toLocaleString()} VNĐ</Badge>
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-4 border rounded-lg p-4">
                      <h3 className="font-medium">Chọn Attributes</h3>
                      
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium mb-2 block">Size Chữ</label>
                          <div className="grid grid-cols-4 gap-2">
                            {TPOS_ATTRIBUTES.sizeText.map((attr) => (
                              <div key={attr.Id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`size-text-${attr.Id}`}
                                  checked={selectedSizeText.includes(attr.Id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedSizeText([...selectedSizeText, attr.Id]);
                                    } else {
                                      setSelectedSizeText(selectedSizeText.filter(id => id !== attr.Id));
                                    }
                                  }}
                                />
                                <label
                                  htmlFor={`size-text-${attr.Id}`}
                                  className="text-sm cursor-pointer"
                                >
                                  {attr.Name}
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-2 block">Size Số</label>
                          <div className="grid grid-cols-6 gap-2 max-h-32 overflow-y-auto">
                            {TPOS_ATTRIBUTES.sizeNumber.map((attr) => (
                              <div key={attr.Id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`size-number-${attr.Id}`}
                                  checked={selectedSizeNumber.includes(attr.Id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedSizeNumber([...selectedSizeNumber, attr.Id]);
                                    } else {
                                      setSelectedSizeNumber(selectedSizeNumber.filter(id => id !== attr.Id));
                                    }
                                  }}
                                />
                                <label
                                  htmlFor={`size-number-${attr.Id}`}
                                  className="text-sm cursor-pointer"
                                >
                                  {attr.Name}
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-2 block">Màu</label>
                          <div className="grid grid-cols-3 gap-2">
                            {TPOS_ATTRIBUTES.color.map((attr) => (
                              <div key={attr.Id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`color-${attr.Id}`}
                                  checked={selectedColor.includes(attr.Id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedColor([...selectedColor, attr.Id]);
                                    } else {
                                      setSelectedColor(selectedColor.filter(id => id !== attr.Id));
                                    }
                                  }}
                                />
                                <label
                                  htmlFor={`color-${attr.Id}`}
                                  className="text-sm cursor-pointer"
                                >
                                  {attr.Name}
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <Button
                        onClick={handlePostVariant}
                        disabled={isPostingVariant}
                        className="w-full"
                      >
                        {isPostingVariant ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Đang POST...
                          </>
                        ) : (
                          "POST Create Variants"
                        )}
                      </Button>
                    </div>

                    {variantPostResult && (
                      <Alert>
                        <CheckCircle className="h-4 w-4" />
                        <AlertTitle>Variant Created</AlertTitle>
                        <AlertDescription>
                          <div className="mt-2 text-sm">
                            Response đã nhận. Xem chi tiết bên dưới.
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}

                    <Collapsible open={isTestJsonOpen} onOpenChange={setIsTestJsonOpen}>
                      <Card className="border-dashed">
                        <CollapsibleTrigger className="w-full">
                          <CardHeader className="hover:bg-muted/50 transition-colors">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base">Chi tiết JSON Response</CardTitle>
                              {isTestJsonOpen ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                            )}
                            </div>
                          </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <CardContent>
                            <div className="space-y-4">
                              {testProduct && (
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-sm font-medium">GET Product Response:</p>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => copyToClipboard(JSON.stringify(testProduct, null, 2))}
                                    >
                                      <Copy className="h-3 w-3 mr-1" />
                                      Copy
                                    </Button>
                                  </div>
                                  <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-96">
                                    {JSON.stringify(testProduct, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {variantPostResult && (
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-sm font-medium">POST Variant Response:</p>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => copyToClipboard(JSON.stringify(variantPostResult, null, 2))}
                                    >
                                      <Copy className="h-3 w-3 mr-1" />
                                      Copy
                                    </Button>
                                  </div>
                                  <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-96">
                                    {JSON.stringify(variantPostResult, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Single Product Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload sản phẩm lên TPOS
                </CardTitle>
                <CardDescription>
                  Test upload từng sản phẩm lên TPOS với thông tin cơ bản
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tên sản phẩm *</label>
                    <Input
                      value={singleProductName}
                      onChange={(e) => setSingleProductName(e.target.value)}
                      placeholder="Nhập tên sản phẩm..."
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Mã sản phẩm *</label>
                    <Input
                      value={singleProductCode}
                      onChange={(e) => setSingleProductCode(e.target.value)}
                      placeholder="Nhập mã sản phẩm..."
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Biến thể</label>
                    <Input
                      value={singleVariant}
                      onChange={(e) => setSingleVariant(e.target.value)}
                      placeholder="Ví dụ: Đỏ, S, 28"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Giá mua</label>
                    <Input
                      type="number"
                      value={singlePurchasePrice}
                      onChange={(e) => setSinglePurchasePrice(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Giá bán</label>
                    <Input
                      type="number"
                      value={singleSellingPrice}
                      onChange={(e) => setSingleSellingPrice(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
                
                <Button
                  onClick={handleUploadSingleProduct}
                  disabled={isUploadingSingle || !singleProductName.trim() || !singleProductCode.trim()}
                  className="w-full"
                >
                  {isUploadingSingle ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Đang upload...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload lên TPOS
                    </>
                  )}
                </Button>
                
                {singleUploadResult && (
                  <Alert>
                    {singleUploadResult.successCount > 0 ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <AlertTitle>
                      {singleUploadResult.successCount > 0 ? "Upload thành công" : "Upload thất bại"}
                    </AlertTitle>
                    <AlertDescription>
                      <div className="mt-2 space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Thành công:</span>
                          <Badge variant={singleUploadResult.successCount > 0 ? "default" : "secondary"}>
                            {singleUploadResult.successCount}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Thất bại:</span>
                          <Badge variant={singleUploadResult.failedCount > 0 ? "destructive" : "secondary"}>
                            {singleUploadResult.failedCount}
                          </Badge>
                        </div>
                        {singleUploadResult.productIds.length > 0 && (
                          <div className="flex justify-between">
                            <span>TPOS Product ID:</span>
                            <Badge variant="outline">
                              {singleUploadResult.productIds[0].tposId}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
                
                {singleUploadResult && (
                  <Collapsible open={isSingleResultOpen} onOpenChange={setIsSingleResultOpen}>
                    <Card className="border-dashed">
                      <CollapsibleTrigger className="w-full">
                        <CardHeader className="hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">Chi tiết JSON Response</CardTitle>
                            {isSingleResultOpen ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium">Upload Result:</p>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyToClipboard(JSON.stringify(singleUploadResult, null, 2))}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copy
                            </Button>
                          </div>
                          <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-96">
                            {JSON.stringify(singleUploadResult, null, 2)}
                          </pre>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                )}
              </CardContent>
            </Card>

            {/* TPOS Debug Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  TPOS Debug
                </CardTitle>
                <CardDescription>
                  Test các API của TPOS: GET Order, GET Product, PUT Variant Creation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Test GET TPOS Order */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    Test GET TPOS Order
                  </h3>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder="Nhập Order ID (ví dụ: 12345)"
                        value={testOrderId}
                        onChange={(e) => setTestOrderId(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleTestGetOrder();
                          }
                        }}
                      />
                    </div>
                    <Button 
                      onClick={handleTestGetOrder}
                      disabled={isTestingOrder || !testOrderId.trim()}
                    >
                      {isTestingOrder ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Đang tải...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Test GET Order
                        </>
                      )}
                    </Button>
                  </div>

                  {testOrderError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Lỗi</AlertTitle>
                      <AlertDescription>{testOrderError}</AlertDescription>
                    </Alert>
                  )}

                  {testOrderResponse && (
                    <Collapsible open={isTestResponseOpen} onOpenChange={setIsTestResponseOpen}>
                      <div className="flex items-center justify-between border rounded-lg p-3 bg-muted/50">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="font-medium">Kết quả (Order ID: {testOrderResponse.Id})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(JSON.stringify(testOrderResponse, null, 2))}
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Copy JSON
                          </Button>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm">
                              {isTestResponseOpen ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                      </div>
                      <CollapsibleContent className="mt-2">
                        <ScrollArea className="h-[500px] w-full rounded-md border">
                          <pre className="p-4 text-xs bg-muted">
                            {JSON.stringify(testOrderResponse, null, 2)}
                          </pre>
                        </ScrollArea>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>

                {/* Test GET TPOS Product */}
                <div className="space-y-4 border-t pt-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Test GET TPOS Product
                  </h3>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder="Nhập Product ID (ví dụ: 107812)"
                        value={testTPOSProductId}
                        onChange={(e) => setTestTPOSProductId(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleTestGetTPOSProduct();
                          }
                        }}
                      />
                    </div>
                    <Button 
                      onClick={handleTestGetTPOSProduct}
                      disabled={isTestingTPOSProduct || !testTPOSProductId.trim()}
                    >
                      {isTestingTPOSProduct ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Đang tải...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Test GET Product
                        </>
                      )}
                    </Button>
                  </div>

                  {testTPOSProductError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Lỗi</AlertTitle>
                      <AlertDescription>{testTPOSProductError}</AlertDescription>
                    </Alert>
                  )}

                  {testTPOSProductResponse && (
                    <Collapsible open={isTPOSProductResponseOpen} onOpenChange={setIsTPOSProductResponseOpen}>
                      <div className="flex items-center justify-between border rounded-lg p-3 bg-muted/50">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="font-medium">Kết quả (Product ID: {testTPOSProductResponse.Id})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(JSON.stringify(testTPOSProductResponse, null, 2))}
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Copy JSON
                          </Button>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm">
                              {isTPOSProductResponseOpen ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                      </div>
                      <CollapsibleContent className="mt-2">
                        <ScrollArea className="h-[500px] w-full rounded-md border">
                          <pre className="p-4 text-xs bg-muted">
                            {JSON.stringify(testTPOSProductResponse, null, 2)}
                          </pre>
                        </ScrollArea>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>

                {/* Test PUT TPOS Variant Creation */}
                <div className="space-y-4 border-t pt-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Test PUT TPOS Variant Creation
                  </h3>
                  <div className="space-y-2">
                    <Input
                      placeholder="Nhập Product ID (ví dụ: 107812)"
                      value={testVariantProductId}
                      onChange={(e) => setTestVariantProductId(e.target.value)}
                    />
                    <Input
                      placeholder="Nhập chuỗi biến thể (ví dụ: Đen, L)"
                      value={testVariantString}
                      onChange={(e) => setTestVariantString(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleTestCreateVariant();
                        }
                      }}
                    />
                  </div>
                  <Button 
                    onClick={handleTestCreateVariant}
                    disabled={isTestingVariant || !testVariantProductId.trim() || !testVariantString.trim()}
                    className="w-full"
                  >
                    {isTestingVariant ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Đang xử lý...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Test Create Variants
                      </>
                    )}
                  </Button>

                  {testVariantError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Lỗi</AlertTitle>
                      <AlertDescription>{testVariantError}</AlertDescription>
                    </Alert>
                  )}

                  {testVariantResponse && (
                    <Collapsible open={isVariantResponseOpen} onOpenChange={setIsVariantResponseOpen}>
                      <div className="flex items-center justify-between border rounded-lg p-3 bg-muted/50">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          <span className="font-medium">Kết quả tạo variants</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(JSON.stringify(testVariantResponse, null, 2))}
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Copy JSON
                          </Button>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm">
                              {isVariantResponseOpen ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                      </div>
                      <CollapsibleContent className="mt-2">
                        <ScrollArea className="h-[500px] w-full rounded-md border">
                          <pre className="p-4 text-xs bg-muted">
                            {JSON.stringify(testVariantResponse, null, 2)}
                          </pre>
                        </ScrollArea>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Barcode & Test */}
        <TabsContent value="barcode" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <VariantTestTool />
            <BarcodeProductTest />
          </div>
        </TabsContent>
      </Tabs>

      <FetchTPOSProductsDialog
        open={isFetchTPOSDialogOpen}
        onOpenChange={setIsFetchTPOSDialogOpen}
        onSuccess={() => {
          toast({
            title: "✅ Thành công",
            description: "Đã đồng bộ sản phẩm từ TPOS",
          });
        }}
      />
    </div>
  );
};

export default Settings;