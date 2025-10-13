import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreateLiveSessionDialog } from "@/components/live-products/CreateLiveSessionDialog";
import { EditLiveSessionDialog } from "@/components/live-products/EditLiveSessionDialog";
import { AddProductToLiveDialog } from "@/components/live-products/AddProductToLiveDialog";
import { UploadTPOSDialog } from "@/components/live-products/UploadTPOSDialog";
import { EditProductDialog } from "@/components/live-products/EditProductDialog";
import { EditOrderItemDialog } from "@/components/live-products/EditOrderItemDialog";
import { QuickAddOrder } from "@/components/live-products/QuickAddOrder";
import { LiveSessionStats } from "@/components/live-products/LiveSessionStats";
import { FullScreenProductView } from "@/components/live-products/FullScreenProductView";
import { LiveSupplierStats } from "@/components/live-products/LiveSupplierStats";
import { TPOSActionsCollapsible } from "@/components/live-products/TPOSActionsCollapsible";
import { useBarcodeScanner } from "@/contexts/BarcodeScannerContext";
import { useCommentsSidebar } from "@/contexts/CommentsSidebarContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import { 
  Plus, 
  Calendar,
  Package,
  ShoppingCart,
  Trash2,
  ChevronDown,
  ChevronRight,
  Edit,
  ListOrdered,
  Pencil,
  Copy,
  AlertTriangle,
  RefreshCw,
  Maximize2,
  Download,
  CheckCircle,
  Upload,
  Store,
  Search,
  MessageSquare,
  ShoppingBag
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { CommentsSettingsCollapsible } from "@/components/live-products/CommentsSettingsCollapsible";
import { LiveCommentsPanel } from "@/components/live-products/LiveCommentsPanel";
import { CommentsSidebar } from "@/components/live-products/CommentsSidebar";
import { useFacebookComments } from "@/hooks/use-facebook-comments";
import type { FacebookVideo } from "@/types/facebook";
import { toast } from "sonner";
import { generateOrderImage } from "@/lib/order-image-generator";
import { getProductImageUrl } from "@/lib/tpos-image-loader";
import { formatVariant } from "@/lib/variant-utils";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { getTPOSHeaders, getActiveTPOSToken } from "@/lib/tpos-config";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useProcessPendingOrders } from "@/hooks/use-process-pending-orders";

/**
 * Client-side multi-keyword product filter
 * - Single keyword: search in product_code, product_name, variant
 * - Multiple keywords: ALL must be in product_name
 */
const filterProductsBySearch = <T extends { product_code: string; product_name: string; variant?: string | null }>(
  products: T[], 
  searchTerm: string
): T[] => {
  if (!searchTerm.trim()) return products;
  
  const keywords = searchTerm.trim().split(/\s+/).filter(k => k.length > 0);
  
  if (keywords.length === 1) {
    // Single keyword: OR search across fields
    const searchLower = keywords[0].toLowerCase();
    return products.filter(product => 
      product.product_code.toLowerCase().includes(searchLower) ||
      product.product_name.toLowerCase().includes(searchLower) ||
      (product.variant?.toLowerCase() || "").includes(searchLower)
    );
  } else {
    // Multiple keywords: ALL must be in product_name
    return products.filter(product => {
      const nameLower = product.product_name.toLowerCase();
      return keywords.every(keyword => nameLower.includes(keyword.toLowerCase()));
    });
  }
};


interface LiveSession {
  id: string;
  session_date: string;
  supplier_name: string;
  session_name?: string;
  start_date?: string;
  end_date?: string;
  status: string;
  notes?: string;
  created_at: string;
}

interface LivePhase {
  id: string;
  live_session_id: string;
  phase_date: string;
  phase_type: string;
  status: string;
  created_at: string;
}

interface LiveProduct {
  id: string;
  live_session_id: string;
  live_phase_id?: string;
  product_code: string;
  product_name: string;
  variant?: string | null;
  base_product_code?: string | null;
  prepared_quantity: number;
  sold_quantity: number;
  image_url?: string;
  created_at?: string;
  note?: string | null;
  product_type?: 'hang_dat' | 'hang_le' | 'hang_so_luong';
}

interface LiveOrder {
  id: string;
  live_session_id: string;
  live_product_id: string;
  live_phase_id?: string;
  order_code: string;
  tpos_order_id?: string | null;
  code_tpos_order_id?: string | null;
  quantity: number;
  order_date: string;
  is_oversell?: boolean;
  uploaded_at?: string | null;
  upload_status?: string | null;
  customer_status?: string;
}

interface OrderWithProduct extends LiveOrder {
  product_code: string;
  product_name: string;
  product_images?: string[];
  customer_status?: string;
}

// Helper function to calculate oversell status dynamically
const calculateIsOversell = (
  productId: string,
  currentOrderId: string,
  liveProducts: LiveProduct[],
  ordersWithProducts: OrderWithProduct[]
): boolean => {
  const product = liveProducts.find(p => p.id === productId);
  if (!product) return false;

  const productOrders = ordersWithProducts.filter(
    order => order.live_product_id === productId
  );
  
  // Sort orders by order date to get chronological order
  const sortedOrders = [...productOrders].sort((a, b) => 
    new Date(a.order_date).getTime() - new Date(b.order_date).getTime()
  );
  
  // Calculate cumulative quantity up to and including the current order
  let cumulativeQuantity = 0;
  let foundCurrentOrder = false;
  
  for (const order of sortedOrders) {
    cumulativeQuantity += order.quantity;
    
    if (order.id === currentOrderId) {
      foundCurrentOrder = true;
      // Current order is oversell if cumulative quantity exceeds prepared quantity
      return cumulativeQuantity > product.prepared_quantity;
    }
  }
  
  // If current order not found, check if total exceeds prepared quantity
  return cumulativeQuantity > product.prepared_quantity;
};

// Helper function to get highest priority customer_status from orders array
const getHighestPriorityCustomerStatus = (orders: OrderWithProduct[]): string => {
  if (!orders || orders.length === 0) return 'normal';
  
  // Check for bom_hang first (highest priority)
  if (orders.some(order => order.customer_status === 'bom_hang')) {
    return 'bom_hang';
  }
  
  // Check for thieu_thong_tin (medium priority)
  if (orders.some(order => order.customer_status === 'thieu_thong_tin')) {
    return 'thieu_thong_tin';
  }
  
  // Default to normal
  return 'normal';
};

export default function LiveProducts() {
  const isMobile = useIsMobile();
  
  // Auto-process pending orders from Facebook Comments
  useProcessPendingOrders();
  
  // Initialize states from localStorage
  const [selectedSession, setSelectedSession] = useState<string>(() => {
    return localStorage.getItem('liveProducts_selectedSession') || "";
  });
  const [selectedPhase, setSelectedPhase] = useState<string>(() => {
    return localStorage.getItem('liveProducts_selectedPhase') || "";
  });
  const [activeTab, setActiveTab] = useState<string>(() => {
    return localStorage.getItem('liveProducts_activeTab') || "products";
  });
  
  // Facebook Comments State - persist in localStorage
  const [commentsPageId, setCommentsPageId] = useState(() => {
    return localStorage.getItem('liveProducts_commentsPageId') || "";
  });
  const [commentsVideoId, setCommentsVideoId] = useState(() => {
    return localStorage.getItem('liveProducts_commentsVideoId') || "";
  });
  const [selectedFacebookVideo, setSelectedFacebookVideo] = useState<FacebookVideo | null>(() => {
    const saved = localStorage.getItem('liveProducts_selectedFacebookVideo');
    return saved ? JSON.parse(saved) : null;
  });
  const [isCommentsAutoRefresh, setIsCommentsAutoRefresh] = useState(true);
  const [showOnlyWithOrders, setShowOnlyWithOrders] = useState(false);
  const [hideNhiJudyHouse, setHideNhiJudyHouse] = useState(true);
  const hideNames = hideNhiJudyHouse ? ["Nhi Judy House"] : [];
  const productListRef = useRef<HTMLDivElement>(null);
  const { isCommentsOpen: isCommentsPanelOpen, setIsCommentsOpen: setIsCommentsPanelOpen } = useCommentsSidebar();
  
  const {
    comments,
    ordersData,
    newCommentIds,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetchComments,
    commentsLoading,
  } = useFacebookComments({
    pageId: commentsPageId,
    videoId: commentsVideoId,
    isAutoRefresh: isCommentsAutoRefresh,
  });
  
  const [isCreateSessionOpen, setIsCreateSessionOpen] = useState(false);
  const [isEditSessionOpen, setIsEditSessionOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isEditProductOpen, setIsEditProductOpen] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [editingProduct, setEditingProduct] = useState<{
    id: string;
    product_code: string;
    product_name: string;
    variant?: string;
    prepared_quantity: number;
    live_phase_id?: string;
    live_session_id?: string;
    image_url?: string;
  } | null>(null);
  const [editingSession, setEditingSession] = useState<LiveSession | null>(null);
  const [isEditOrderItemOpen, setIsEditOrderItemOpen] = useState(false);
  const [orderQuantities, setOrderQuantities] = useState<Record<string, number>>({});
  const [copyTotals, setCopyTotals] = useState<Record<string, number>>({});
  const [editingOrderItem, setEditingOrderItem] = useState<{
    id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    orders?: OrderWithProduct[];
  } | null>(null);
  const [isFullScreenProductViewOpen, setIsFullScreenProductViewOpen] = useState(false);
  const [isSyncingTpos, setIsSyncingTpos] = useState(false);
  const [isUploadTPOSOpen, setIsUploadTPOSOpen] = useState(false);
  const [tposSyncResult, setTposSyncResult] = useState<{
    matched: number;
    notFound: number;
    errors: number;
  } | null>(null);
  
  // States for Product ID sync
  const [isSyncingProductIds, setIsSyncingProductIds] = useState(false);
  const [productIdSyncResult, setProductIdSyncResult] = useState<{
    matched: number;
    notFound: number;
    errors: number;
  } | null>(null);
  const [maxRecordsToFetch, setMaxRecordsToFetch] = useState("4000");
  
  // Search state for products tab
  const [productSearch, setProductSearch] = useState("");
  const debouncedProductSearch = useDebounce(productSearch, 300);
  
  const queryClient = useQueryClient();
  const { enabledPages, addScannedBarcode } = useBarcodeScanner();

  const [tposSyncDateRange, setTposSyncDateRange] = useState<DateRange | undefined>(() => {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 1);
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 3); // 4-day range ending tomorrow
    return { from: startDate, to: endDate };
  });

  // New mutation for updating prepared_quantity
  const updatePreparedQuantityMutation = useMutation({
    mutationFn: async ({ productId, newQuantity }: { productId: string; newQuantity: number }) => {
      const { error } = await supabase
        .from("live_products")
        .update({ prepared_quantity: newQuantity })
        .eq("id", productId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-products", selectedPhase, selectedSession] });
      toast.success("Đã cập nhật số lượng chuẩn bị");
    },
    onError: (error) => {
      console.error("Error updating prepared quantity:", error);
      toast.error("Lỗi cập nhật số lượng chuẩn bị: " + error.message);
    },
  });

  // Fetch live sessions
  const { data: liveSessions = [], isLoading } = useQuery({
    queryKey: ["live-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_sessions")
        .select("*")
        .order("session_date", { ascending: false });
      
      if (error) throw error;
      return data as LiveSession[];
    },
  });

  // Fetch live phases for selected session
  const { data: livePhases = [] } = useQuery({
    queryKey: ["live-phases", selectedSession],
    queryFn: async () => {
      if (!selectedSession) return [];
      
      const { data, error } = await supabase
        .from("live_phases")
        .select("*")
        .eq("live_session_id", selectedSession)
        .order("phase_date", { ascending: true })
        .order("phase_type", { ascending: true });
      
      if (error) throw error;
      return data as LivePhase[];
    },
    enabled: !!selectedSession,
  });

  // Fetch live products for selected phase (or all phases if "all" selected)
  const { data: allLiveProducts = [] } = useQuery({
    queryKey: ["live-products", selectedPhase, selectedSession],
    queryFn: async () => {
      if (!selectedPhase) return [];
      
      if (selectedPhase === "all") {
        // Fetch all products for the session
        const { data, error } = await supabase
          .from("live_products")
          .select("*")
          .eq("live_session_id", selectedSession)
          .order("created_at", { ascending: true });
        
        if (error) throw error;
        
        // Aggregate products by product_code
        const aggregated = (data as LiveProduct[]).reduce((acc, product) => {
          if (!acc[product.product_code]) {
            acc[product.product_code] = {
              id: product.id, // Keep first id for reference
              live_session_id: product.live_session_id,
              live_phase_id: product.live_phase_id,
              product_code: product.product_code,
              product_name: product.product_name,
              prepared_quantity: 0,
              sold_quantity: 0,
              earliest_created_at: product.created_at,
            };
          }
          
          // Update product_name if found earlier record
          const currentCreatedAt = new Date(product.created_at || 0).getTime();
          const earliestCreatedAt = new Date(acc[product.product_code].earliest_created_at || 0).getTime();
          
          if (currentCreatedAt < earliestCreatedAt) {
            acc[product.product_code].product_name = product.product_name;
            acc[product.product_code].earliest_created_at = product.created_at;
          }
          
          // Sum quantities
          acc[product.product_code].prepared_quantity += product.prepared_quantity;
          acc[product.product_code].sold_quantity += product.sold_quantity;
          
          return acc;
        }, {} as Record<string, LiveProduct & { earliest_created_at?: string }>);
        
        return Object.values(aggregated).map(({ earliest_created_at, ...product }) => product);
      } else {
        // Fetch products for single phase
        const { data, error } = await supabase
          .from("live_products")
          .select("*")
          .eq("live_phase_id", selectedPhase)
          .order("created_at", { ascending: false })
          .order("product_code", { ascending: true })
          .order("variant", { ascending: true });
        
        if (error) throw error;
        return data as LiveProduct[];
      }
    },
    enabled: !!selectedPhase && !!selectedSession,
  });

  // State to manage prepared quantities in the input fields
  const [preparedQuantities, setPreparedQuantities] = useState<Record<string, number>>({});

  const handlePreparedQuantityChange = (productId: string, value: string) => {
    const newQuantity = parseInt(value);
    if (!isNaN(newQuantity) && newQuantity >= 0) {
      setPreparedQuantities(prev => ({
        ...prev,
        [productId]: newQuantity
      }));
    } else if (value === "") { // Allow empty string for user to clear input
      setPreparedQuantities(prev => ({
        ...prev,
        [productId]: 0 // Or keep it as empty string if preferred for UX
      }));
    }
  };

  // Effect to initialize preparedQuantities when liveProducts changes
  useEffect(() => {
    const initialQuantities: Record<string, number> = {};
    allLiveProducts.forEach(product => {
      initialQuantities[product.id] = product.prepared_quantity;
    });
    setPreparedQuantities(initialQuantities);
  }, [allLiveProducts]);

  // Filter products by type using useMemo to avoid reference errors
  const liveProducts = useMemo(() => 
    allLiveProducts.filter(p => !p.product_type || p.product_type === 'hang_dat'), 
    [allLiveProducts]
  );
  
  const productsHangDat = useMemo(() => liveProducts, [liveProducts]);
  
  const productsHangLe = useMemo(() => 
    allLiveProducts.filter(p => p.product_type === 'hang_le'), 
    [allLiveProducts]
  );

  // Memoized filtered products for better performance
  const filteredProductsHangDat = useMemo(() => {
    return filterProductsBySearch(productsHangDat, debouncedProductSearch);
  }, [productsHangDat, debouncedProductSearch]);

  const filteredProductsHangLe = useMemo(() => {
    return filterProductsBySearch(productsHangLe, debouncedProductSearch);
  }, [productsHangLe, debouncedProductSearch]);

  const filteredLiveProducts = useMemo(() => {
    return filterProductsBySearch(liveProducts, debouncedProductSearch);
  }, [liveProducts, debouncedProductSearch]);

  // Barcode scanner listener - chỉ hoạt động khi enabledPages bao gồm 'live-products'
  useEffect(() => {
    if (!enabledPages.includes('live-products')) return;

    const handleBarcodeScanned = async (event: CustomEvent) => {
      const code = event.detail.code;
      
      // Kiểm tra xem có session và phase được chọn không
      if (!selectedSession || !selectedPhase || selectedPhase === 'all') {
        toast.error("Vui lòng chọn session và phase cụ thể để thêm sản phẩm");
        return;
      }

      try {
        // 1. Tìm sản phẩm được quét (lấy cả product_name để kiểm tra)
        const { data: scannedProduct, error: productError } = await supabase
          .from("products")
          .select("*")
          .eq("product_code", code.trim())
          .maybeSingle();

        if (productError) throw productError;

        if (!scannedProduct) {
          toast.error(`Không tìm thấy sản phẩm: ${code}`);
          return;
        }

        // Add to BarcodeScannerContext for display in FacebookComments
        addScannedBarcode({
          code: scannedProduct.product_code,
          timestamp: new Date().toISOString(),
          productInfo: {
            id: scannedProduct.id,
            name: scannedProduct.product_name,
            image_url: getProductImageUrl(scannedProduct.product_images, scannedProduct.tpos_image_url),
            product_code: scannedProduct.product_code,
          }
        });

        let productsToAdd = [];

        // 2. Kiểm tra xem tên sản phẩm có dấu "-" không
        if (scannedProduct.product_name.includes('-')) {
          // CASE 1: Tên có dấu "-" → Split và tìm theo tên
          // Ưu tiên split theo ' - ' (với space) nếu có, fallback về '-' nếu không
          const baseNamePrefix = scannedProduct.product_name.includes(' - ')
            ? scannedProduct.product_name.split(' - ')[0].trim()
            : scannedProduct.product_name.split('-')[0].trim();
          
          const { data: matchingProducts, error: matchError } = await supabase
            .from("products")
            .select("*")
            .ilike("product_name", `${baseNamePrefix}%`);
          
          if (matchError) throw matchError;
          productsToAdd = matchingProducts || [];
          
        } else {
          // CASE 2: Không có "-" → Dùng base_product_code như cũ
          const baseCode = scannedProduct.base_product_code || scannedProduct.product_code;

          // Lấy TẤT CẢ biến thể (loại trừ sản phẩm gốc mặc định)
          const { data: variants, error: variantsError } = await supabase
            .from("products")
            .select("*")
            .eq("base_product_code", baseCode)
            .not("variant", "is", null)
            .neq("variant", "")
            .neq("product_code", baseCode);

          if (variantsError) throw variantsError;

          // Nếu không tìm thấy biến thể, sử dụng chính sản phẩm được quét
          productsToAdd = variants && variants.length > 0 ? variants : [scannedProduct];
        }

        if (productsToAdd.length === 0) {
          toast.error("Không tìm thấy sản phẩm hoặc biến thể nào");
          return;
        }

        // 4. Kiểm tra tất cả biến thể đã có trong live_products chưa
        const variantCodes = productsToAdd.map(v => v.product_code);
        const { data: existingProducts, error: existingError } = await supabase
          .from("live_products")
          .select("id, product_code, prepared_quantity")
          .eq("live_phase_id", selectedPhase)
          .in("product_code", variantCodes);

        if (existingError) throw existingError;

        const existingMap = new Map(
          (existingProducts || []).map(p => [p.product_code, p])
        );

        // 5. Chuẩn bị batch insert và update
        const toInsert = [];
        const toUpdate = [];

        for (const variant of productsToAdd) {
          const existing = existingMap.get(variant.product_code);
          
          if (existing) {
            // Tăng số lượng
            toUpdate.push({
              id: existing.id,
              prepared_quantity: existing.prepared_quantity + 1
            });
          } else {
            // Thêm mới
            toInsert.push({
              live_session_id: selectedSession,
              live_phase_id: selectedPhase,
              product_code: variant.product_code,
              product_name: variant.product_name,
              variant: formatVariant(variant.variant, variant.product_code),
              base_product_code: variant.base_product_code,
              prepared_quantity: 1,
              sold_quantity: 0,
              image_url: getProductImageUrl(variant.product_images, variant.tpos_image_url),
              product_type: 'hang_dat',
            });
          }
        }

        // 6. Thực hiện batch operations
        if (toInsert.length > 0) {
          const { error: insertError } = await supabase
            .from("live_products")
            .insert(toInsert);
          if (insertError) throw insertError;
        }

        if (toUpdate.length > 0) {
          for (const update of toUpdate) {
            const { error: updateError } = await supabase
              .from("live_products")
              .update({ prepared_quantity: update.prepared_quantity })
              .eq("id", update.id);
            if (updateError) throw updateError;
          }
        }

        // 7. Toast thông báo
        const insertedCount = toInsert.length;
        const updatedCount = toUpdate.length;
        const variantNames = productsToAdd.map(v => v.product_code).join(", ");

        if (insertedCount > 0 && updatedCount > 0) {
          toast.success(
            `✅ Đã thêm ${insertedCount} biến thể mới, tăng số lượng ${updatedCount} biến thể có sẵn (${variantNames})`
          );
        } else if (insertedCount > 0) {
          toast.success(`✅ Đã thêm ${insertedCount} biến thể: ${variantNames}`);
        } else {
          toast.success(`✅ Đã tăng số lượng ${updatedCount} biến thể: ${variantNames}`);
        }

        // 8. Refresh data
        queryClient.invalidateQueries({ 
          queryKey: ["live-products", selectedPhase, selectedSession] 
        });
      } catch (error: any) {
        console.error("Barcode add product error:", error);
        toast.error("Lỗi thêm sản phẩm: " + error.message);
      }
    };

    window.addEventListener('barcode-scanned' as any, handleBarcodeScanned as any);

    return () => {
      window.removeEventListener('barcode-scanned' as any, handleBarcodeScanned as any);
    };
  }, [enabledPages, selectedSession, selectedPhase, queryClient]);

  // Persist state changes to localStorage
  useEffect(() => {
    localStorage.setItem('liveProducts_selectedSession', selectedSession);
  }, [selectedSession]);

  useEffect(() => {
    localStorage.setItem('liveProducts_selectedPhase', selectedPhase);
  }, [selectedPhase]);

  useEffect(() => {
    localStorage.setItem('liveProducts_activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('liveProducts_commentsPageId', commentsPageId);
  }, [commentsPageId]);

  useEffect(() => {
    localStorage.setItem('liveProducts_commentsVideoId', commentsVideoId);
  }, [commentsVideoId]);

  useEffect(() => {
    localStorage.setItem('liveProducts_selectedFacebookVideo', JSON.stringify(selectedFacebookVideo));
  }, [selectedFacebookVideo]);

  // Helper function to get color based on copy status
  const getCopyStatusColor = (copyCount: number, soldQuantity: number) => {
    if (copyCount < soldQuantity) return "text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-950";
    if (copyCount === soldQuantity) return "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950";
    return "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950";
  };

  // Fetch live orders for selected phase (or all phases if "all" selected)
  const { data: liveOrders = [] } = useQuery({
    queryKey: ["live-orders", selectedPhase, selectedSession],
    queryFn: async () => {
      if (!selectedPhase) return [];
      
      if (selectedPhase === "all") {
        // Fetch all orders for the session
        const { data, error } = await supabase
          .from("live_orders")
          .select("*")
          .eq("live_session_id", selectedSession)
          .order("created_at", { ascending: false });
        
        if (error) throw error;
        return data as LiveOrder[];
      } else {
        const { data, error } = await supabase
          .from("live_orders")
          .select("*")
          .eq("live_phase_id", selectedPhase)
          .order("created_at", { ascending: false });
        
        if (error) throw error;
        return data as LiveOrder[];
      }
    },
    enabled: !!selectedPhase && !!selectedSession,
  });

  // Fetch orders with product details for selected phase (or all phases if "all" selected)
  const { data: ordersWithProducts = [] } = useQuery({
    queryKey: ["orders-with-products", selectedPhase, selectedSession],
    queryFn: async () => {
      if (!selectedPhase) return [];
      
      if (selectedPhase === "all") {
        // Fetch all orders for the session
        const { data, error } = await supabase
          .from("live_orders")
          .select(`
            *,
            live_products (
              product_code,
              product_name
            )
          `)
          .eq("live_session_id", selectedSession)
          .order("created_at", { ascending: false });
        
        if (error) throw error;
        
        return data.map(order => ({
          ...order,
          product_code: order.live_products?.product_code || "",
          product_name: order.live_products?.product_name || "",
        })) as OrderWithProduct[];
      } else {
        const { data, error } = await supabase
          .from("live_orders")
          .select(`
            *,
            live_products (
              product_code,
              product_name
            )
          `)
          .eq("live_phase_id", selectedPhase)
          .order("created_at", { ascending: false });
        
        if (error) throw error;
        
        return data.map(order => ({
          ...order,
          product_code: order.live_products?.product_code || "",
          product_name: order.live_products?.product_name || "",
        })) as OrderWithProduct[];
      }
    },
    enabled: !!selectedPhase && !!selectedSession,
  });

  // Real-time subscriptions for live data updates
  useEffect(() => {
    if (!selectedSession || !selectedPhase) return;

    const channel = supabase
      .channel('live-products-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_sessions'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["live-sessions"] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_phases',
          filter: `live_session_id=eq.${selectedSession}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["live-phases", selectedSession] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_products',
          filter: `live_session_id=eq.${selectedSession}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["live-products", selectedPhase, selectedSession] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_orders',
          filter: `live_session_id=eq.${selectedSession}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["live-orders", selectedPhase, selectedSession] });
          queryClient.invalidateQueries({ queryKey: ["orders-with-products", selectedPhase, selectedSession] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedSession, selectedPhase]);

  // Delete order item mutation (delete single product from order)
  const deleteOrderItemMutation = useMutation({
    mutationFn: async ({ orderId, productId, quantity }: { orderId: string; productId: string; quantity: number }) => {
      // Update product sold quantity first
      const { data: product, error: productFetchError } = await supabase
        .from("live_products")
        .select("sold_quantity")
        .eq("id", productId)
        .single();

      if (productFetchError) throw productFetchError;

      const { error: updateError } = await supabase
        .from("live_products")
        .update({ 
          sold_quantity: Math.max(0, product.sold_quantity - quantity) 
        })
        .eq("id", productId);
      
      if (updateError) throw updateError;

      // Delete the order item
      const { error } = await supabase
        .from("live_orders")
        .delete()
        .eq("id", orderId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-orders", selectedPhase] });
      queryClient.invalidateQueries({ queryKey: ["live-products", selectedPhase] });
      queryClient.invalidateQueries({ queryKey: ["orders-with-products", selectedPhase] });
      toast.success("Đã xóa sản phẩm khỏi đơn hàng");
    },
    onError: (error) => {
      console.error("Error deleting order item:", error);
      toast.error("Có lỗi xảy ra khi xóa sản phẩm");
    },
  });

  // Delete product mutation (cascading delete orders)
  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      // First delete all orders for this product
      const { error: deleteOrdersError } = await supabase
        .from("live_orders")
        .delete()
        .eq("live_product_id", productId);
      
      if (deleteOrdersError) throw deleteOrdersError;

      // Then delete the product
      const { error } = await supabase
        .from("live_products")
        .delete()
        .eq("id", productId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-products", selectedPhase] });
      queryClient.invalidateQueries({ queryKey: ["live-orders", selectedPhase] });
      queryClient.invalidateQueries({ queryKey: ["orders-with-products", selectedPhase] });
      toast.success("Đã xóa sản phẩm và các đơn hàng liên quan thành công");
    },
    onError: (error) => {
      console.error("Error deleting product:", error);
      toast.error("Có lỗi xảy ra khi xóa sản phẩm");
    },
  });

  // Delete all variants of a product (by product_code)
  const deleteAllVariantsMutation = useMutation({
    mutationFn: async ({ product_code, live_phase_id, live_session_id }: { 
      product_code: string; 
      live_phase_id: string | null; 
      live_session_id: string;
    }) => {
      // Get all products with this product_code in the session
      let query = supabase
        .from("live_products")
        .select("id")
        .eq("product_code", product_code)
        .eq("live_session_id", live_session_id);

      if (live_phase_id) {
        query = query.eq("live_phase_id", live_phase_id);
      }

      const { data: productsToDelete, error: fetchError } = await query;
      
      if (fetchError) throw fetchError;
      if (!productsToDelete || productsToDelete.length === 0) return;

      const productIds = productsToDelete.map(p => p.id);

      // First delete all orders for these products
      const { error: deleteOrdersError } = await supabase
        .from("live_orders")
        .delete()
        .in("live_product_id", productIds);
      
      if (deleteOrdersError) throw deleteOrdersError;

      // Then delete all the products
      const { error: deleteProductsError } = await supabase
        .from("live_products")
        .delete()
        .in("id", productIds);
      
      if (deleteProductsError) throw deleteProductsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-products", selectedPhase] });
      queryClient.invalidateQueries({ queryKey: ["live-orders", selectedPhase] });
      queryClient.invalidateQueries({ queryKey: ["orders-with-products", selectedPhase] });
      toast.success("Đã xóa toàn bộ sản phẩm và các đơn hàng liên quan");
    },
    onError: (error) => {
      console.error("Error deleting all variants:", error);
      toast.error("Có lỗi xảy ra khi xóa sản phẩm");
    },
  });

  // Delete all phases and data for a live session
  const deleteAllPhasesForSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      // First get all phases for this session
      const { data: phases, error: phasesError } = await supabase
        .from("live_phases")
        .select("id")
        .eq("live_session_id", sessionId);
      
      if (phasesError) throw phasesError;

      const phaseIds = phases.map(p => p.id);

      // Delete all orders for all phases in this session
      if (phaseIds.length > 0) {
        const { error: deleteOrdersError } = await supabase
          .from("live_orders")
          .delete()
          .in("live_phase_id", phaseIds);
        
        if (deleteOrdersError) throw deleteOrdersError;

        // Delete all products for all phases in this session
        const { error: deleteProductsError } = await supabase
          .from("live_products")
          .delete()
          .in("live_phase_id", phaseIds);
        
        if (deleteProductsError) throw deleteProductsError;
      }

      // Delete all phases for this session
      const { error: deletePhasesError } = await supabase
        .from("live_phases")
        .delete()
        .eq("live_session_id", sessionId);
      
      if (deletePhasesError) throw deletePhasesError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-phases"] });
      queryClient.invalidateQueries({ queryKey: ["live-products"] });
      queryClient.invalidateQueries({ queryKey: ["live-orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders-with-products"] });
      setSelectedPhase("");
      toast.success("Đã xóa toàn bộ phiên live và dữ liệu thành công");
    },
    onError: (error) => {
      console.error("Error deleting all phases for session:", error);
      toast.error("Có lỗi xảy ra khi xóa phiên live");
    },
  });

  // Delete live session mutation (cascading delete products and orders)
  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      // First get all phases for this session
      const { data: phases, error: phasesError } = await supabase
        .from("live_phases")
        .select("id")
        .eq("live_session_id", sessionId);
      
      if (phasesError) throw phasesError;

      const phaseIds = phases.map(p => p.id);

      // Delete all orders for all phases in this session
      if (phaseIds.length > 0) {
        const { error: deleteOrdersError } = await supabase
          .from("live_orders")
          .delete()
          .in("live_phase_id", phaseIds);
        
        if (deleteOrdersError) throw deleteOrdersError;

        // Delete all products for all phases in this session
        const { error: deleteProductsError } = await supabase
          .from("live_products")
          .delete()
          .in("live_phase_id", phaseIds);
        
        if (deleteProductsError) throw deleteProductsError;
      }

      // Delete all phases for this session
      const { error: deletePhasesError } = await supabase
        .from("live_phases")
        .delete()
        .eq("live_session_id", sessionId);
      
      if (deletePhasesError) throw deletePhasesError;

      // Finally delete the session
      const { error } = await supabase
        .from("live_sessions")
        .delete()
        .eq("id", sessionId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["live-phases"] });
      queryClient.invalidateQueries({ queryKey: ["live-products"] });
      queryClient.invalidateQueries({ queryKey: ["live-orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders-with-products"] });
      setSelectedSession("");
      setSelectedPhase("");
      toast.success("Đã xóa đợt live và tất cả dữ liệu liên quan thành công");
    },
    onError: (error) => {
      console.error("Error deleting live session:", error);
      toast.error("Có lỗi xảy ra khi xóa đợt live");
    },
  });

  const handleDeleteOrderItem = async (orderId: string, productId: string, quantity: number) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa sản phẩm này khỏi đơn hàng?")) {
      await deleteOrderItemMutation.mutateAsync({ orderId, productId, quantity });
    }
  };

  const handleEditOrderItem = (aggregatedProduct: {
    product_code: string;
    product_name: string;
    live_product_id: string;
    total_quantity: number;
    orders: OrderWithProduct[];
  }) => {
    setEditingOrderItem({
      id: aggregatedProduct.orders[0].id,
      product_id: aggregatedProduct.live_product_id,
      product_name: aggregatedProduct.product_name,
      quantity: aggregatedProduct.total_quantity,
      orders: aggregatedProduct.orders.map((o: OrderWithProduct) => ({
        ...o,
        customer_status: o.customer_status || 'normal',
      })),
    });
    setIsEditOrderItemOpen(true);
  };

  const handleDeleteAggregatedProduct = async (aggregatedProduct: {
    product_code: string;
    product_name: string;
    live_product_id: string;
    total_quantity: number;
    orders: OrderWithProduct[];
  }) => {
    if (window.confirm(`Bạn có chắc muốn xóa tất cả ${aggregatedProduct.total_quantity} sản phẩm ${aggregatedProduct.product_name}?`)) {
      const orderIds = aggregatedProduct.orders.map(o => o.id);
      
      try {
        // Delete all orders
        const { error: deleteError } = await supabase
          .from("live_orders")
          .delete()
          .in("id", orderIds);
        
        if (deleteError) throw deleteError;
        
        // Fetch current sold_quantity
        const { data: product, error: productFetchError } = await supabase
          .from("live_products")
          .select("sold_quantity")
          .eq("id", aggregatedProduct.live_product_id)
          .single();
        
        if (productFetchError) throw productFetchError;
        
        // Update sold_quantity
        const { error: productError } = await supabase
          .from("live_products")
          .update({ 
            sold_quantity: Math.max(0, product.sold_quantity - aggregatedProduct.total_quantity)
          })
          .eq("id", aggregatedProduct.live_product_id);
        
        if (productError) throw productError;
        
        queryClient.invalidateQueries({ queryKey: ["live-orders", selectedPhase] });
        queryClient.invalidateQueries({ queryKey: ["live-products", selectedPhase] });
        queryClient.invalidateQueries({ queryKey: ["orders-with-products", selectedPhase] });
        toast.success("Đã xóa sản phẩm khỏi đơn hàng");
      } catch (error) {
        console.error("Error deleting aggregated product:", error);
        toast.error("Có lỗi xảy ra khi xóa sản phẩm");
      }
    }
  };

  const handleDeleteAllPhasesForSession = async (sessionId: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ phiên live và dữ liệu của đợt này? Hành động này không thể hoàn tác.")) {
      await deleteAllPhasesForSessionMutation.mutateAsync(sessionId);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa sản phẩm này? Tất cả đơn hàng liên quan cũng sẽ bị xóa.")) {
      await deleteProductMutation.mutateAsync(productId);
    }
  };

  const handleDeleteAllVariants = async (product_code: string, product_name: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa toàn bộ sản phẩm "${product_name}" (${product_code}) và tất cả biến thể? Tất cả đơn hàng liên quan cũng sẽ bị xóa.`)) {
      await deleteAllVariantsMutation.mutateAsync({
        product_code,
        live_phase_id: selectedPhase === "all" ? null : selectedPhase,
        live_session_id: selectedSession,
      });
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa đợt live này? Tất cả phiên live, sản phẩm và đơn hàng liên quan sẽ bị xóa.")) {
      await deleteSessionMutation.mutateAsync(sessionId);
    }
  };

  // Mutation chuyển sang Hàng Lẻ
  const changeToHangLeMutation = useMutation({
    mutationFn: async (productIds: string[]) => {
      // 1. Kiểm tra từng sản phẩm xem có đơn hàng không
      const { data: ordersData } = await supabase
        .from('live_orders')
        .select('live_product_id')
        .in('live_product_id', productIds);
      
      const productIdsWithOrders = new Set(
        (ordersData || []).map(order => order.live_product_id)
      );
      
      // 2. Chia thành 2 nhóm: có đơn và không có đơn
      const productsToConvert = productIds.filter(id => productIdsWithOrders.has(id));
      const productsToDelete = productIds.filter(id => !productIdsWithOrders.has(id));
      
      // 3. Chuyển sang Hàng Lẻ cho các sản phẩm có đơn
      if (productsToConvert.length > 0) {
        const { error: updateError } = await supabase
          .from('live_products')
          .update({ product_type: 'hang_le' })
          .in('id', productsToConvert);
        
        if (updateError) throw updateError;
      }
      
      // 4. Xóa các sản phẩm không có đơn
      if (productsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('live_products')
          .delete()
          .in('id', productsToDelete);
        
        if (deleteError) throw deleteError;
      }
      
      return { converted: productsToConvert.length, deleted: productsToDelete.length };
    },
    onSuccess: ({ converted, deleted }) => {
      queryClient.invalidateQueries({ queryKey: ['live-products'] });
      
      if (converted > 0 && deleted > 0) {
        toast.success(`Đã chuyển ${converted} biến thể có đơn sang Hàng Lẻ, xóa ${deleted} biến thể không có đơn`);
      } else if (converted > 0) {
        toast.success(`Đã chuyển ${converted} biến thể sang Hàng Lẻ`);
      } else if (deleted > 0) {
        toast.success(`Đã xóa ${deleted} biến thể không có đơn`);
      } else {
        toast.info('Không có thay đổi nào');
      }
    },
    onError: (error) => {
      toast.error(`Lỗi: ${error.message}`);
    }
  });

  // Mutation chuyển về Hàng Đặt
  const changeToHangDatMutation = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase
        .from('live_products')
        .update({ product_type: 'hang_dat' })
        .eq('id', productId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-products'] });
      toast.success('Đã chuyển về Hàng Đặt');
    },
    onError: (error) => {
      toast.error(`Lỗi: ${error.message}`);
    }
  });

  const handleSyncTposOrders = async (): Promise<boolean> => {
    setIsSyncingTpos(true);
    setTposSyncResult(null);
    
    try {
      // 1. Use date range from state
      if (!tposSyncDateRange?.from || !tposSyncDateRange?.to) {
        toast.error("Vui lòng chọn khoảng thời gian để đồng bộ.");
        setIsSyncingTpos(false);
        return false;
      }

      const startDate = new Date(tposSyncDateRange.from);
      const endDate = new Date(tposSyncDateRange.to);
      
      // Set time to start and end of day
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();
      
      // 2. Construct URL with date range
      const topValue = 200; // Default as per previous logic
      const url = `https://tomato.tpos.vn/odata/SaleOnline_Order/ODataService.GetView?$top=${topValue}&$orderby=DateCreated desc&$filter=(DateCreated ge ${startDateStr} and DateCreated le ${endDateStr})&$count=true`;
      
      console.log('[TPOS Sync] Fetching from URL:', url);
      
      // 3. Get TPOS token
      const token = await getActiveTPOSToken();
      if (!token) {
        toast.error("Chưa có TPOS Bearer Token. Vui lòng cập nhật trong Cài đặt.");
        setIsSyncingTpos(false);
        return false;
      }
      
      // 4. Fetch from TPOS
      const response = await fetch(url, {
        headers: getTPOSHeaders(token)
      });
      
      if (!response.ok) throw new Error("Failed to fetch TPOS orders");
      
      const data = await response.json();
      console.log('[TPOS Sync] Response data:', data);
      
      // 5. Create mapping: SessionIndex -> {Id, Code}
      const tposMap = new Map<string, { id: string; code: string }>();
      data.value?.forEach((order: any) => {
        if (order.SessionIndex && order.Id && order.Code) {
          const sessionIndexStr = String(order.SessionIndex).trim();
          tposMap.set(sessionIndexStr, {
            id: order.Id,
            code: order.Code
          });
        }
      });
      
      console.log('[TPOS Sync] Total TPOS mappings:', tposMap.size);
      
      // 6. Get local orders that need syncing
      const ordersToSync = ordersWithProducts.filter(o => !o.tpos_order_id && o.order_code);
      if (ordersToSync.length === 0) {
        toast.info("Không có đơn hàng nào cần đồng bộ.");
        setIsSyncingTpos(false);
        return true; // Still success, just nothing to do
      }
      
      console.log(`[TPOS Sync] Found ${ordersToSync.length} local orders to sync.`);
      
      // 7. Match and prepare updates
      let matched = 0;
      let notFound = 0;
      const updates: { id: string; tpos_order_id: string; code_tpos_order_id: string }[] = [];

      for (const order of ordersToSync) {
        const normalizedOrderCode = String(order.order_code).trim();
        const tposData = tposMap.get(normalizedOrderCode);
        
        if (tposData) {
          updates.push({
            id: order.id,
            tpos_order_id: tposData.code,
            code_tpos_order_id: tposData.id,
          });
          matched++;
        } else {
          notFound++;
        }
      }
      
      console.log(`[TPOS Sync] Matched: ${matched}, Not Found: ${notFound}`);
      
      // 8. Perform batch update to Supabase
      if (updates.length > 0) {
        // Update each order individually
        for (const update of updates) {
          const { error } = await supabase
            .from('live_orders')
            .update({
              tpos_order_id: update.tpos_order_id,
              code_tpos_order_id: update.code_tpos_order_id,
            })
            .eq('id', update.id);
          
          if (error) {
            console.error('Error updating order:', update.id, error);
            throw error;
          }
        }
      }
      
      // 9. Update result state and show toast
      setTposSyncResult({ matched, notFound, errors: 0 });
      toast.success(`Đồng bộ hoàn tất: ${matched} đơn được cập nhật, ${notFound} không tìm thấy.`);
      
      // 10. Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['live-orders', selectedPhase, selectedSession] });
      queryClient.invalidateQueries({ queryKey: ['orders-with-products', selectedPhase, selectedSession] });
      
      setIsSyncingTpos(false);
      return true;
      
    } catch (error) {
      console.error("Error syncing TPOS orders:", error);
      toast.error("Không thể lấy dữ liệu từ TPOS. " + (error instanceof Error ? error.message : ""));
      setTposSyncResult({ matched: 0, notFound: 0, errors: 1 });
      setIsSyncingTpos(false);
      return false;
    }
  };

  const handleSyncAndUpload = async () => {
    const syncSuccess = await handleSyncTposOrders();
    if (syncSuccess) {
      setIsUploadTPOSOpen(true);
    }
  };

  const handleEditProduct = (product: LiveProduct) => {
    setEditingProduct({
      id: product.id,
      product_code: product.product_code,
      product_name: product.product_name,
      variant: product.variant || undefined,
      prepared_quantity: product.prepared_quantity,
      live_phase_id: product.live_phase_id || selectedPhase,
      live_session_id: product.live_session_id || selectedSession,
    });
    setIsEditProductOpen(true);
  };

  const handleEditSession = (session: LiveSession) => {
    setEditingSession(session);
    setIsEditSessionOpen(true);
  };

  const handleRefreshProducts = () => {
    queryClient.invalidateQueries({ queryKey: ["live-products", selectedPhase, selectedSession] });
    queryClient.invalidateQueries({ queryKey: ["live-orders", selectedPhase, selectedSession] });
    queryClient.invalidateQueries({ queryKey: ["orders-with-products", selectedPhase, selectedSession] });
    toast.success("Đã làm mới danh sách sản phẩm");
  };
  
  const handleSyncProductIds = async () => {
    if (!window.confirm("Đồng bộ mã biến thể cho các sản phẩm chưa có productid_bienthe?\n\nQuá trình này có thể mất vài phút tùy theo số lượng records.")) {
      return;
    }
    
    setIsSyncingProductIds(true);
    setProductIdSyncResult(null);
    
    try {
      const { syncTPOSProductIds } = await import("@/lib/tpos-api");
      const maxRecords = parseInt(maxRecordsToFetch);
      
      const result = await syncTPOSProductIds(maxRecords);
      
      setProductIdSyncResult({
        matched: result.matched,
        notFound: result.notFound,
        errors: result.errors
      });
      
      toast.success(`Đã cập nhật ${result.matched} sản phẩm${result.notFound > 0 ? `, ${result.notFound} không tìm thấy` : ''}`);
      
    } catch (error) {
      console.error("Error syncing product IDs:", error);
      toast.error("Không thể đồng bộ mã biến thể từ TPOS");
    } finally {
      setIsSyncingProductIds(false);
    }
  };

  const getPhaseDisplayName = (phase: LivePhase) => {
    const date = new Date(phase.phase_date);
    const dayNumber = Math.floor((date.getTime() - new Date(livePhases[0]?.phase_date || phase.phase_date).getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const phaseType = phase.phase_type === 'morning' ? 'Sáng' : 'Chiều';
    return `Ngày ${dayNumber} - ${phaseType} (${format(date, "dd/MM/yyyy")})`;
  };

  const getSessionDisplayName = (session: LiveSession) => {
    const sessionName = session.session_name || session.supplier_name;
    if (session.start_date && session.end_date) {
      return `${sessionName} - ${format(new Date(session.start_date), "dd/MM/yyyy")} đến ${format(new Date(session.end_date), "dd/MM/yyyy")}`;
    }
    return `${sessionName} - ${format(new Date(session.session_date), "dd/MM/yyyy")}`;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="w-full py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Order Live</h1>
          <p className="text-muted-foreground">
            Quản lý các phiên live, sản phẩm và đơn hàng
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            onClick={() => setIsCreateSessionOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Tạo đợt Live mới
          </Button>
        </div>
      </div>

      {/* Main content wrapper - pushes left when sidebar opens */}
      <div className={cn(
        "transition-all duration-300 ease-in-out",
        isCommentsPanelOpen && !isMobile ? 'mr-[450px]' : 'mr-0'
      )}>
        {/* Session Selection */}
        {liveSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Chọn đợt Live
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Đợt Live</label>
                <Select 
                  value={selectedSession} 
                  onValueChange={(value) => {
                    setSelectedSession(value);
                    setSelectedPhase(""); // Reset phase selection
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn một đợt live" />
                  </SelectTrigger>
                  <SelectContent>
                    {liveSessions.map((session) => (
                      <SelectItem key={session.id} value={session.id}>
                        {getSessionDisplayName(session)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedSession && livePhases.length > 0 && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Phiên Live</label>
                  <Select value={selectedPhase} onValueChange={setSelectedPhase}>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn phiên live" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="all">📊 Tất cả phiên live</SelectItem>
                      {livePhases.map((phase) => (
                        <SelectItem key={phase.id} value={phase.id}>
                          {getPhaseDisplayName(phase)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {selectedSession && (
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const session = liveSessions.find(s => s.id === selectedSession);
                    if (session) handleEditSession(session);
                  }}
                  className="flex items-center gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Chỉnh sửa đợt live
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteAllPhasesForSession(selectedSession)}
                  className="flex items-center gap-2 text-orange-600 hover:text-orange-700"
                >
                  <Trash2 className="h-4 w-4" />
                  Xóa toàn bộ phiên live
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteSession(selectedSession)}
                  className="flex items-center gap-2 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                  Xóa đợt live
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stats and Content */}
      {selectedPhase && (
        <>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div ref={tabsRef} className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="products" className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Sản phẩm ({productsHangDat.length})
                </TabsTrigger>
                <TabsTrigger value="hang-le" className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  Hàng Lẻ ({productsHangLe.length})
                </TabsTrigger>
                <TabsTrigger value="orders" className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Đơn hàng (theo mã đơn)
                </TabsTrigger>
                 <TabsTrigger value="supplier-stats" className="flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  Thống kê NCC
                </TabsTrigger>
              </TabsList>

              <div className="flex gap-2">
                {activeTab === "products" && (
                  <>
                    {commentsVideoId && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2"
                          onClick={() => setIsCommentsPanelOpen(!isCommentsPanelOpen)}
                        >
                          <MessageSquare className="h-4 w-4" />
                          Comments
                          {isCommentsPanelOpen && (
                            <Badge variant="secondary" className="ml-1">Đang mở</Badge>
                          )}
                        </Button>
                      </>
                    )}
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setIsFullScreenProductViewOpen(true)}
                      disabled={liveProducts.length === 0}
                      className="flex items-center gap-2"
                    >
                      <Maximize2 className="h-4 w-4" />
                      Xem toàn màn hình
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefreshProducts}
                      disabled={liveProducts.length === 0}
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Làm mới
                    </Button>
                  </>
                )}
              </div>
            </div>

            <TabsContent value="products" className="space-y-4">
              {liveProducts.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Package className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Chưa có sản phẩm nào</h3>
                    <p className="text-muted-foreground text-center mb-4">
                      Thêm sản phẩm đầu tiên cho phiên live này
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Search box */}
                  <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 rounded-lg border">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Tìm kiếm theo mã SP, tên sản phẩm, biến thể..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground"
                    />
                    {productSearch && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setProductSearch("")}
                        className="h-6 px-2"
                      >
                        Xóa
                      </Button>
                    )}
                  </div>

                  <div ref={productListRef}>
                    <Card>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Mã SP</TableHead>
                            <TableHead>Tên sản phẩm</TableHead>
                            <TableHead>Hình ảnh</TableHead>
                            <TableHead>Biến thể</TableHead>
                            <TableHead className="text-center w-24">Tạo order</TableHead>
                            <TableHead className="text-center">SL chuẩn bị</TableHead>
                            <TableHead className="text-center">SL đã bán</TableHead>
                            <TableHead>Mã đơn hàng</TableHead>
                            <TableHead className="text-center">Thao tác</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(() => {
                            // Use memoized filtered products
                            const filteredProducts = filteredProductsHangDat;

                            // Group products by base_product_code (or unique key for manual products)
                            const productGroups = filteredProducts.reduce((groups, product) => {
                              // Use base_product_code for inventory items, unique key for manual items
                              const key = product.base_product_code 
                                ? product.base_product_code 
                                : `single_${product.id}`;
                              
                              if (!groups[key]) {
                                groups[key] = {
                                  product_code: product.base_product_code || product.product_code,
                                  product_name: product.base_product_code 
                                    ? product.product_name.split('(')[0].trim()
                                    : product.product_name,
                                  products: [],
                                  earliest_created_at: product.created_at,
                                  base_product_code: product.base_product_code
                                };
                              }
                              groups[key].products.push(product);
                              // Track earliest created_at for group sorting
                              if (product.created_at && product.created_at < groups[key].earliest_created_at!) {
                                groups[key].earliest_created_at = product.created_at;
                              }
                              return groups;
                            }, {} as Record<string, {
                              product_code: string;
                              product_name: string;
                              products: LiveProduct[];
                              earliest_created_at?: string;
                              base_product_code?: string | null;
                            }>);

                            // Sort groups by earliest created_at (newest first)
                            const sortedGroups = Object.values(productGroups).sort((a, b) => {
                              const timeA = new Date(a.earliest_created_at || 0).getTime();
                              const timeB = new Date(b.earliest_created_at || 0).getTime();
                              return timeB - timeA; // Descending: newest first
                            });

                            return sortedGroups.flatMap((group) => {
                              // Sort products within group by variant name first, then by created_at
                              const sortedProducts = [...group.products].sort((a, b) => {
                                // Primary sort: variant name (alphabetically)
                                const variantA = (a.variant || '').toLowerCase();
                                const variantB = (b.variant || '').toLowerCase();
                                const variantCompare = variantA.localeCompare(variantB);
                                
                                if (variantCompare !== 0) return variantCompare;
                                
                                // Secondary sort: created_at (if variants are the same)
                                const timeA = new Date(a.created_at || 0).getTime();
                                const timeB = new Date(b.created_at || 0).getTime();
                                return timeA - timeB;
                              });

                              return sortedProducts.map((product, productIndex) => (
                                <TableRow key={product.id}>
                                  {productIndex === 0 && (
                                    <>
                                      <TableCell 
                                        rowSpan={group.products.length} 
                                        className="font-medium align-top border-r"
                                      >
                                        {group.product_code}
                                      </TableCell>
                                      <TableCell 
                                        rowSpan={group.products.length}
                                        className="align-top border-r"
                                      >
                                        {group.product_name}
                                      </TableCell>
                                      <TableCell 
                                        rowSpan={group.products.length}
                                        className="align-top border-r"
                                      >
                                        {product.image_url ? (
                                          <img 
                                            src={product.image_url} 
                                            alt={group.product_name}
                                            className="w-12 h-12 object-cover rounded img-zoom-right-lg"
                                          />
                                        ) : (
                                          <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                                            <Package className="h-6 w-6 text-muted-foreground" />
                                          </div>
                                        )}
                                      </TableCell>
                                    </>
                                  )}
                                  <TableCell className="text-muted-foreground">
                                    {product.variant || "-"}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <div className="flex flex-col items-center gap-1">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={async () => {
                                          const qty = orderQuantities[product.id] || 1;
                                          if (!product.image_url) {
                                            toast.error("Sản phẩm chưa có hình ảnh");
                                            return;
                                          }
                                          await generateOrderImage(
                                            product.image_url,
                                            product.variant || "",
                                            qty,
                                            product.product_name
                                          );
                                          // Update copy total
                                          setCopyTotals(prev => ({
                                            ...prev,
                                            [product.id]: (prev[product.id] || 0) + qty
                                          }));
                                        }}
                                        disabled={!product.image_url}
                                        title={product.image_url ? "Copy hình order" : "Chưa có hình ảnh"}
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                      <input
                                        type="number"
                                        min="1"
                                        value={orderQuantities[product.id] || 1}
                                        onChange={(e) => {
                                          const value = parseInt(e.target.value) || 1;
                                          setOrderQuantities(prev => ({
                                            ...prev,
                                            [product.id]: value
                                          }));
                                        }}
                                        className="w-12 h-6 text-center text-xs border rounded px-1"
                                        placeholder="SL"
                                      />
                                      {copyTotals[product.id] > 0 && (
                                        <div className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getCopyStatusColor(copyTotals[product.id], product.sold_quantity)}`}>
                                          Đã copy: {copyTotals[product.id]}
                                        </div>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Input
                                      type="number"
                                      min="0"
                                      value={preparedQuantities[product.id] ?? product.prepared_quantity} // Use local state, fallback to prop
                                      onChange={(e) => handlePreparedQuantityChange(product.id, e.target.value)}
                                      onBlur={() => {
                                        const newQuantity = preparedQuantities[product.id];
                                        if (newQuantity !== undefined && newQuantity !== product.prepared_quantity) {
                                          updatePreparedQuantityMutation.mutate({ productId: product.id, newQuantity });
                                        }
                                      }}
                                      className="w-20 text-center h-8"
                                      disabled={updatePreparedQuantityMutation.isPending}
                                    />
                                  </TableCell>
                                  <TableCell className="text-center">{product.sold_quantity}</TableCell>
                                  <TableCell>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      {(() => {
                                        const productOrders = selectedPhase === "all"
                                          ? ordersWithProducts.filter(order => order.product_code === product.product_code)
                                          : ordersWithProducts.filter(order => order.live_product_id === product.id);
                                        
                                        // Reverse to show newest on the right
                                        const ordersReversed = [...productOrders].reverse();
                                        
                                        return (
                                          <>
                                            {ordersReversed.map(order => {
                                              const isOversell = calculateIsOversell(
                                                order.live_product_id,
                                                order.id,
                                                liveProducts,
                                                ordersWithProducts
                                              );
                                              
                                              const badgeVariant = isOversell 
                                                ? "destructive" 
                                                : order.uploaded_at 
                                                  ? "secondary" 
                                                  : "default";
                                              
                                              const getCustomerStatusColor = (status?: string) => {
                                                switch (status) {
                                                  case 'bom_hang':
                                                    return 'bg-red-500 text-white border-red-600';
                                                  case 'thieu_thong_tin':
                                                    return 'bg-yellow-500 text-white border-yellow-600';
                                                  default:
                                                    return '';
                                                }
                                              };

                                              const customerStatusColor = getCustomerStatusColor(order.customer_status);

                                              return (
                                                <TooltipProvider key={order.id}>
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                      <Badge 
                                                        variant={badgeVariant}
                                                        className={`cursor-pointer text-xs ${customerStatusColor}`}
                                                        onClick={() => {
                                                          const ordersWithSameCode = productOrders.filter(
                                                            o => o.order_code === order.order_code
                                                          );
                                                          const aggregatedProduct = {
                                                            product_code: product.product_code,
                                                            product_name: product.product_name,
                                                            live_product_id: product.id,
                                                            total_quantity: ordersWithSameCode.reduce((sum, o) => sum + o.quantity, 0),
                                                            orders: ordersWithSameCode
                                                          };
                                                          handleEditOrderItem(aggregatedProduct);
                                                        }}
                                                      >
                                                        {order.order_code}
                                                        {isOversell && " ⚠️"}
                                                        {order.uploaded_at && " ✓"}
                                                      </Badge>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                      <div className="text-xs">
                                                        <div>Mã: {order.order_code}</div>
                                                        <div>SL: {order.quantity}</div>
                                                        {isOversell && <div className="text-red-500 font-semibold">⚠️ Vượt số lượng chuẩn bị</div>}
                                                        {order.uploaded_at && (
                                                          <div className="text-green-600 font-semibold">
                                                            ✓ Đã đẩy lên TPOS {format(new Date(order.uploaded_at), 'dd/MM HH:mm', { locale: vi })}
                                                          </div>
                                                        )}
                                                        {order.customer_status === 'bom_hang' && (
                                                          <div className="text-red-600 font-semibold">🚫 BOM HÀNG</div>
                                                        )}
                                                        {order.customer_status === 'thieu_thong_tin' && (
                                                          <div className="text-yellow-600 font-semibold">⚠️ THIẾU THÔNG TIN</div>
                                                        )}
                                                      </div>
                                                    </TooltipContent>
                                                  </Tooltip>
                                                </TooltipProvider>
                                              );
                                            })}
                                            {productOrders.length === 0 && (
                                              <span className="text-xs text-muted-foreground">
                                                Chưa có đơn
                                              </span>
                                            )}
                                            {selectedPhase !== "all" && (
                                              <QuickAddOrder 
                                                productId={product.id}
                                                phaseId={selectedPhase}
                                                sessionId={selectedSession}
                                                availableQuantity={product.prepared_quantity - product.sold_quantity}
                                              />
                                            )}
                                          </>
                                        );
                                      })()}
                                    </div>
                                  </TableCell>
                                  {productIndex === 0 && (
                                    <TableCell 
                                      rowSpan={group.products.length}
                                      className="align-top border-l"
                                    >
                                      <div className="flex items-center gap-2 justify-center">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleEditProduct(product)}
                                        >
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDeleteAllVariants(group.product_code, group.product_name)}
                                          className="text-red-600 hover:text-red-700"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  )}
                                </TableRow>
                              ));
                            });
                          })()}
                        </TableBody>
                      </Table>
                    </Card>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="individual" className="space-y-4">
              {!selectedPhase ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <Package className="mx-auto h-12 w-12 mb-2" />
                    <p>Vui lòng chọn phiên live để xem sản phẩm</p>
                  </CardContent>
                </Card>
              ) : (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Tìm kiếm theo mã SP, tên sản phẩm, biến thể..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleRefreshProducts}
                    title="Làm mới"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setIsFullScreenProductViewOpen(true)}
                    title="Toàn màn hình"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </div>

                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mã SP</TableHead>
                        <TableHead>Tên sản phẩm</TableHead>
                        <TableHead>Hình ảnh</TableHead>
                        <TableHead>Biến thể</TableHead>
                        <TableHead className="text-center">Tạo order</TableHead>
                        <TableHead className="text-center">SL chuẩn bị</TableHead>
                        <TableHead className="text-center">SL đã bán</TableHead>
                        <TableHead>Mã đơn hàng</TableHead>
                        <TableHead className="text-center">Thao tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        // Use memoized filtered products
                        const filteredProducts = filteredLiveProducts;

                        // Sort by created_at (newest first)
                        const sortedProducts = [...filteredProducts].sort((a, b) => {
                          const timeA = new Date(a.created_at || 0).getTime();
                          const timeB = new Date(b.created_at || 0).getTime();
                          return timeB - timeA;
                        });

                        return sortedProducts.map((product) => (
                          <TableRow key={product.id}>
                            <TableCell className="font-medium">{product.product_code}</TableCell>
                            <TableCell>{product.product_name}</TableCell>
                            <TableCell>
                              {product.image_url ? (
                                <img 
                                  src={product.image_url} 
                                  alt={product.product_name}
                                  className="w-12 h-12 object-cover rounded img-zoom-right-lg"
                                />
                              ) : (
                                <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                                  <Package className="h-6 w-6 text-muted-foreground" />
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {product.variant || "-"}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={async () => {
                                    const qty = orderQuantities[product.id] || 1;
                                    if (!product.image_url) {
                                      toast.error("Sản phẩm chưa có hình ảnh");
                                      return;
                                    }
                                    await generateOrderImage(
                                      product.image_url,
                                      product.variant || "",
                                      qty,
                                      product.product_name
                                    );
                                    setCopyTotals(prev => ({
                                      ...prev,
                                      [product.id]: (prev[product.id] || 0) + qty
                                    }));
                                  }}
                                  disabled={!product.image_url}
                                  title={product.image_url ? "Copy hình order" : "Chưa có hình ảnh"}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                                <input
                                  type="number"
                                  min="1"
                                  value={orderQuantities[product.id] || 1}
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value) || 1;
                                    setOrderQuantities(prev => ({
                                      ...prev,
                                      [product.id]: value
                                    }));
                                  }}
                                  className="w-12 h-6 text-center text-xs border rounded px-1"
                                  placeholder="SL"
                                />
                                {copyTotals[product.id] > 0 && (
                                  <div className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getCopyStatusColor(copyTotals[product.id], product.sold_quantity)}`}>
                                    Đã copy: {copyTotals[product.id]}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Input
                                type="number"
                                min="0"
                                value={preparedQuantities[product.id] ?? product.prepared_quantity} // Use local state, fallback to prop
                                onChange={(e) => handlePreparedQuantityChange(product.id, e.target.value)}
                                onBlur={() => {
                                  const newQuantity = preparedQuantities[product.id];
                                  if (newQuantity !== undefined && newQuantity !== product.prepared_quantity) {
                                    updatePreparedQuantityMutation.mutate({ productId: product.id, newQuantity });
                                  }
                                }}
                                className="w-20 text-center h-8"
                                disabled={updatePreparedQuantityMutation.isPending}
                              />
                            </TableCell>
                            <TableCell className="text-center">{product.sold_quantity}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {(() => {
                                  const productOrders = ordersWithProducts.filter(order => order.live_product_id === product.id);
                                  const ordersReversed = [...productOrders].reverse();
                                  
                                  return (
                                    <>
                                      {ordersReversed.map(order => {
                                        const isOversell = calculateIsOversell(
                                          order.live_product_id,
                                          order.id,
                                          liveProducts || [],
                                          ordersWithProducts
                                        );
                                        
                                        let badgeColor = "bg-blue-100 text-blue-700 hover:bg-blue-200";
                                        
                                        if (isOversell) {
                                          badgeColor = "bg-yellow-500 text-white hover:bg-yellow-600 font-bold shadow-md";
                                        } else if (order.customer_status === 'bom_hang') {
                                          badgeColor = "bg-red-600 text-white hover:bg-red-700 font-bold";
                                        } else if (order.customer_status === 'thieu_thong_tin') {
                                          badgeColor = "bg-gray-500 text-white hover:bg-gray-600";
                                        }
                                        
                                        return (
                                          <TooltipProvider key={order.id}>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Badge
                                                  variant="secondary"
                                                  className={`text-xs cursor-pointer hover:scale-105 transition-transform ${badgeColor}`}
                                                  onClick={() => {
                                                    const aggregatedProduct = {
                                                      product_code: order.product_code,
                                                      product_name: order.product_name,
                                                      live_product_id: order.live_product_id,
                                                      total_quantity: order.quantity,
                                                      orders: [order]
                                                    };
                                                    handleEditOrderItem(aggregatedProduct);
                                                  }}
                                                >
                                                  {isOversell && <AlertTriangle className="h-3 w-3 mr-1" />}
                                                  {order.quantity === 1 ? order.order_code : `${order.order_code} x${order.quantity}`}
                                                </Badge>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p>{isOversell ? "⚠️ Đơn quá số" : `Đơn: ${order.order_code} - SL: ${order.quantity}`}</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        );
                                      })}
                                      {selectedPhase !== "all" && (
                                        <div className="flex items-center gap-2 ml-2">
                                          <QuickAddOrder 
                                            productId={product.id}
                                            phaseId={selectedPhase}
                                            sessionId={selectedSession}
                                            availableQuantity={product.prepared_quantity - product.sold_quantity}
                                          />
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditProduct(product)}
                                  disabled={selectedPhase === "all"}
                                  title={selectedPhase === "all" ? "Chọn phiên live cụ thể để chỉnh sửa" : ""}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteProduct(product.id)}
                                  disabled={selectedPhase === "all"}
                                  className="text-red-600 hover:text-red-700"
                                  title={selectedPhase === "all" ? "Chọn phiên live cụ thể để xóa" : ""}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ));
                      })()}
                    </TableBody>
                  </Table>
                </Card>
              </>
              )}
            </TabsContent>

            {/* Hàng Lẻ Tab */}
            <TabsContent value="hang-le" className="space-y-4">
              {!selectedPhase ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <ShoppingBag className="mx-auto h-12 w-12 mb-4" />
                    <p>Vui lòng chọn phiên live để xem hàng lẻ</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Tìm kiếm hàng lẻ..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleRefreshProducts}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>

                  <Card>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Mã SP</TableHead>
                          <TableHead>Tên sản phẩm</TableHead>
                          <TableHead>Hình ảnh</TableHead>
                          <TableHead>Biến thể</TableHead>
                          <TableHead className="text-center">SL chuẩn bị</TableHead>
                          <TableHead className="text-center">SL đã bán</TableHead>
                          <TableHead>Mã đơn hàng</TableHead>
                          <TableHead className="text-center">Thao tác</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const filteredHangLe = filteredProductsHangLe;

                          if (filteredHangLe.length === 0) {
                            return (
                              <TableRow>
                                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                  {productSearch.trim() ? "Không tìm thấy sản phẩm" : "Chưa có hàng lẻ"}
                                </TableCell>
                              </TableRow>
                            );
                          }

                          return filteredHangLe.map(product => {
                            const productOrders = ordersWithProducts.filter(
                              order => order.live_product_id === product.id
                            );

                            return (
                              <TableRow key={product.id}>
                                <TableCell className="font-medium">{product.product_code}</TableCell>
                                <TableCell>{product.product_name}</TableCell>
                                <TableCell>
                                  {product.image_url ? (
                                    <img 
                                      src={product.image_url} 
                                      alt={product.product_name} 
                                      className="w-12 h-12 object-cover rounded img-zoom-right-lg"
                                    />
                                  ) : (
                                    <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                                      <Package className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell>{product.variant || "-"}</TableCell>
                                <TableCell className="text-center">{product.prepared_quantity}</TableCell>
                                <TableCell className="text-center">{product.sold_quantity}</TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {productOrders.map(order => {
                                      const isOversell = calculateIsOversell(product.id, order.id, allLiveProducts, ordersWithProducts);
                                      const badgeColor = order.customer_status === "vip" ? "bg-yellow-100 text-yellow-800" : "";
                                      
                                      return (
                                        <TooltipProvider key={order.id}>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Badge
                                                variant="secondary"
                                                className={`text-xs cursor-pointer hover:scale-105 transition-transform ${badgeColor}`}
                                                onClick={() => {
                                                  const aggregatedProduct = {
                                                    product_code: product.product_code,
                                                    product_name: product.product_name,
                                                    live_product_id: order.live_product_id,
                                                    total_quantity: order.quantity,
                                                    orders: [order]
                                                  };
                                                  handleEditOrderItem(aggregatedProduct);
                                                }}
                                              >
                                                {isOversell && <AlertTriangle className="h-3 w-3 mr-1" />}
                                                {order.quantity === 1 ? order.order_code : `${order.order_code} x${order.quantity}`}
                                              </Badge>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>{isOversell ? "⚠️ Đơn quá số" : `Đơn: ${order.order_code} - SL: ${order.quantity}`}</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      );
                                    })}
                                    {selectedPhase !== "all" && (
                                      <QuickAddOrder 
                                        productId={product.id}
                                        phaseId={selectedPhase}
                                        sessionId={selectedSession}
                                        availableQuantity={product.prepared_quantity - product.sold_quantity}
                                      />
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => changeToHangDatMutation.mutate(product.id)}
                                      disabled={selectedPhase === "all"}
                                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                      title={selectedPhase === "all" ? "Chọn phiên live cụ thể" : "Chuyển về Hàng Đặt"}
                                    >
                                      <Package className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEditProduct(product)}
                                      disabled={selectedPhase === "all"}
                                      title={selectedPhase === "all" ? "Chọn phiên live cụ thể" : "Chỉnh sửa"}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteProduct(product.id)}
                                      disabled={selectedPhase === "all"}
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                      title={selectedPhase === "all" ? "Chọn phiên live cụ thể" : "Xóa"}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          });
                        })()}
                      </TableBody>
                    </Table>
                  </Card>
                </>
              )}
            </TabsContent>

            <TabsContent value="orders" className="space-y-4">
              <TPOSActionsCollapsible
                hasOrders={ordersWithProducts.length > 0}
                handleSyncAndUpload={handleSyncAndUpload}
                isSyncingTpos={isSyncingTpos}
                tposSyncDateRange={tposSyncDateRange}
                setTposSyncDateRange={setTposSyncDateRange}
                maxRecordsToFetch={maxRecordsToFetch}
                setMaxRecordsToFetch={setMaxRecordsToFetch}
                handleSyncProductIds={handleSyncProductIds}
                isSyncingProductIds={isSyncingProductIds}
                productIdSyncResult={productIdSyncResult}
              />
              
              {ordersWithProducts.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Chưa có đơn hàng nào</h3>
                    <p className="text-muted-foreground text-center">
                      Đơn hàng sẽ xuất hiện ở đây khi có người mua sản phẩm
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32 font-bold text-base">Mã đơn hàng</TableHead>
                  <TableHead className="w-32 font-bold text-base">Mã TPOS</TableHead>
                  <TableHead className="w-48 font-bold text-base">Tên sản phẩm</TableHead>
                  <TableHead className="w-32 font-bold text-base">Mã sản phẩm</TableHead>
                  <TableHead className="w-20 text-center font-bold text-base">Số lượng</TableHead>
                  <TableHead className="w-24 text-center font-bold text-base">Thao tác SP</TableHead>
                  <TableHead className="w-24 text-center font-bold text-base">Trạng thái</TableHead>
                  <TableHead className="w-28 text-center font-bold text-base">Upload</TableHead>
                </TableRow>
              </TableHeader>
                    <TableBody>
                      {(() => {
                        // Group orders by order_code
                        const orderGroups = ordersWithProducts.reduce((groups, order) => {
                          if (!groups[order.order_code]) {
                            groups[order.order_code] = [];
                          }
                          groups[order.order_code].push(order);
                          return groups;
                        }, {} as Record<string, typeof ordersWithProducts>);

                        return Object.entries(orderGroups).flatMap(([orderCode, orders], groupIndex) => {
                          // Group by product_code within order_code
                          const productGroups = orders.reduce((groups, order) => {
                            const key = order.product_code;
                            if (!groups[key]) {
                              groups[key] = {
                                product_code: order.product_code,
                                product_name: order.product_name,
                                live_product_id: order.live_product_id,
                                total_quantity: 0,
                                orders: [] as OrderWithProduct[]
                              };
                            }
                            groups[key].total_quantity += order.quantity;
                            groups[key].orders.push(order);
                            return groups;
                          }, {} as Record<string, {
                            product_code: string;
                            product_name: string;
                            live_product_id: string;
                            total_quantity: number;
                            orders: OrderWithProduct[];
                          }>);

                          const aggregatedProducts = Object.values(productGroups);

                          // Check if any order in this group is oversell
                          const hasOversell = aggregatedProducts.some(p => 
                            p.orders.some(order => order.is_oversell)
                          );
                          
                            return aggregatedProducts.map((product, index) => {
                             // Only show oversell color in Orders tab
                             let bgColorClass = groupIndex % 2 === 1 ? 'bg-muted/30' : '';
                             
                             // Check if any order in this product group has oversell
                             if (hasOversell) {
                               bgColorClass = 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900';
                             }
                            
                            return (
                            <TableRow 
                              key={`${orderCode}-${product.product_code}`}
                              id={orders[0]?.tpos_order_id || undefined}
                              className={`h-12 ${
                                index === aggregatedProducts.length - 1 
                                  ? 'border-b-2 border-border/60' 
                                  : 'border-b border-border/20'
                              } ${bgColorClass}`}
                            >
                    {index === 0 && (
                      <>
                        <TableCell 
                          rowSpan={aggregatedProducts.length} 
                          className="font-medium align-middle border-r border-l text-center"
                        >
                          <div className="flex flex-col items-center justify-center gap-2">
                            <div className="flex items-center gap-2">
                              {hasOversell && (
                                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                              )}
                              <Badge className={`text-base font-bold font-mono px-3 py-1.5 ${
                                hasOversell 
                                  ? 'bg-yellow-500 text-white hover:bg-yellow-600 dark:bg-yellow-600 dark:hover:bg-yellow-700'
                                  : 'bg-primary text-primary-foreground'
                              }`}>
                                {orderCode}
                              </Badge>
                            </div>
                          </div>
                        </TableCell>
                        
                        <TableCell 
                          rowSpan={aggregatedProducts.length} 
                          className="align-middle border-r text-center"
                        >
                          <span className="text-sm text-muted-foreground font-mono">
                            {orders[0]?.tpos_order_id || '-'}
                          </span>
                        </TableCell>
                      </>
                    )}
                              <TableCell className="py-2 border-r">
                                <div className="font-medium text-sm">{product.product_name}</div>
                              </TableCell>
                              <TableCell className="py-2 border-r">
                                <span className="text-sm">{product.product_code}</span>
                              </TableCell>
                              <TableCell className="text-center py-2 border-r">
                                <span className="text-sm font-medium">{product.total_quantity}</span>
                              </TableCell>
                              <TableCell className="text-center py-2 border-r">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditOrderItem(product)}
                                    className="h-7 w-7 p-0"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteAggregatedProduct(product)}
                                    className="text-red-600 hover:text-red-700 h-7 w-7 p-0"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                              {index === 0 && (
                                  <TableCell 
                                    rowSpan={aggregatedProducts.length}
                                    className="text-center py-2 align-middle border-r"
                                  >
                                    <div className="flex items-center justify-center">
                                      <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          className="sr-only"
                                          defaultChecked={false}
                                          onChange={(e) => {
                                            const statusElement = e.target.nextElementSibling;
                                            const dot = statusElement?.querySelector('.status-dot');
                                            const text = statusElement?.querySelector('.status-text');
                                            if (e.target.checked) {
                                              dot?.classList.remove('bg-red-500');
                                              dot?.classList.add('bg-green-500');
                                              text?.classList.remove('text-red-600');
                                              text?.classList.add('text-green-600');
                                              if (text) text.textContent = 'Hoàn tất';
                                            } else {
                                              dot?.classList.remove('bg-green-500');
                                              dot?.classList.add('bg-red-500');
                                              text?.classList.remove('text-green-600');
                                              text?.classList.add('text-red-600');
                                              if (text) text.textContent = 'Đang chờ';
                                            }
                                          }}
                                        />
                                        <div className="flex items-center gap-1">
                                          <div className="status-dot w-2.5 h-2.5 rounded-full bg-red-500"></div>
                                          <span className="status-text text-xs text-red-600 font-medium">Đang chờ</span>
                                        </div>
                                      </label>
                                    </div>
                                  </TableCell>
                              )}
                              {index === 0 && (
                                <TableCell 
                                  rowSpan={aggregatedProducts.length}
                                  className="text-center py-2 align-middle border-r"
                                >
                                  {(() => {
                                    const uploadStatus = orders[0]?.upload_status;
                                    if (uploadStatus === 'success') {
                                      return <Badge variant="default" className="bg-green-600">Đã upload</Badge>;
                                    }
                                    if (uploadStatus === 'failed') {
                                      return <Badge variant="destructive">Lỗi</Badge>;
                                    }
                                    if (orders[0]?.code_tpos_order_id) {
                                      return <Badge variant="outline">Chưa upload</Badge>;
                                    }
                                    return <span className="text-xs text-muted-foreground">-</span>;
                                  })()}
                                </TableCell>
                              )}
                            </TableRow>
                            );
                          });
                        });
                      })()}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </TabsContent>

            {/* Supplier Stats Tab */}
            <TabsContent value="supplier-stats" className="space-y-4">
              <LiveSupplierStats 
                liveProducts={liveProducts}
                sessionId={selectedSession}
                phaseId={selectedPhase}
              />
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Empty States */}
      {liveSessions.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Chưa có đợt live nào</h3>
            <p className="text-muted-foreground text-center mb-4">
              Tạo đợt live đầu tiên để bắt đầu quản lý sản phẩm và đơn hàng
            </p>
            <Button onClick={() => setIsCreateSessionOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Tạo đợt Live mới
            </Button>
          </CardContent>
        </Card>
      )}

      {selectedSession && !selectedPhase && livePhases.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ListOrdered className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Đợt live chưa có phiên nào</h3>
            <p className="text-muted-foreground text-center">
              Có vẻ như đợt live này được tạo bằng hệ thống cũ. Vui lòng tạo đợt live mới để sử dụng tính năng mới.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <CreateLiveSessionDialog 
        open={isCreateSessionOpen} 
        onOpenChange={setIsCreateSessionOpen} 
      />
      
      <EditLiveSessionDialog 
        open={isEditSessionOpen}
        onOpenChange={setIsEditSessionOpen}
        session={editingSession}
      />

      <AddProductToLiveDialog 
        open={isAddProductOpen}
        onOpenChange={setIsAddProductOpen}
        phaseId={selectedPhase}
        sessionId={selectedSession}
        onProductAdded={() => {
          productListRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      <EditProductDialog 
        open={isEditProductOpen}
        onOpenChange={setIsEditProductOpen}
        product={editingProduct}
      />

      <EditOrderItemDialog 
        open={isEditOrderItemOpen}
        onOpenChange={setIsEditOrderItemOpen}
        orderItem={editingOrderItem}
        phaseId={selectedPhase}
      />

      <FullScreenProductView
        open={isFullScreenProductViewOpen}
        onOpenChange={setIsFullScreenProductViewOpen}
        products={liveProducts}
        orders={ordersWithProducts}
        selectedPhase={selectedPhase}
        selectedSession={selectedSession}
      />

      <UploadTPOSDialog
        open={isUploadTPOSOpen}
        onOpenChange={setIsUploadTPOSOpen}
        sessionId={selectedSession}
        onUploadComplete={() => {
          queryClient.invalidateQueries({ queryKey: ['live-orders'] });
          setIsUploadTPOSOpen(false);
        }}
      />

      {/* Floating Action Button - Thêm sản phẩm */}
      {selectedPhase && selectedPhase !== "all" && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="lg"
                onClick={(e) => {
                  e.preventDefault();
                  tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  setIsAddProductOpen(true);
                }}
                className="fixed top-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow z-50"
              >
                <Plus className="h-6 w-6" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Thêm sản phẩm</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      </div>

      {/* Comments Sidebar - outside content wrapper */}
      {commentsVideoId && (
        <CommentsSidebar
          isOpen={isCommentsPanelOpen}
          onClose={() => setIsCommentsPanelOpen(false)}
        >
          <LiveCommentsPanel
            pageId={commentsPageId}
            videoId={commentsVideoId}
            comments={comments}
            ordersData={ordersData}
            newCommentIds={newCommentIds}
            showOnlyWithOrders={showOnlyWithOrders}
            hideNames={hideNames}
            isLoading={commentsLoading || isFetchingNextPage}
            onLoadMore={() => fetchNextPage()}
            hasMore={hasNextPage}
            onRefresh={refetchComments}
          />
        </CommentsSidebar>
      )}
    </div>
  );
}
