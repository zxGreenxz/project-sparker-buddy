import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Download } from "lucide-react";
import { formatVND } from "@/lib/currency-utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { EditProductDialog } from "./EditProductDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ProductImage } from "./ProductImage";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { searchTPOSProduct, importProductFromTPOS } from "@/lib/tpos-api";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Product {
  id: string;
  product_code: string;
  product_name: string;
  variant?: string;
  selling_price: number;
  purchase_price: number;
  unit: string;
  category?: string;
  barcode?: string;
  stock_quantity: number;
  supplier_name?: string;
  product_images?: string[];
  price_images?: string[];
  tpos_image_url?: string;
  tpos_product_id?: number;
  base_product_code?: string;
}

interface ProductListProps {
  products: Product[];
  isLoading: boolean;
  onRefetch: () => void;
  supplierFilter?: string | null;
  isAdmin: boolean;
  searchQuery?: string;
}

export function ProductList({ products, isLoading, onRefetch, supplierFilter, isAdmin, searchQuery }: ProductListProps) {
  const isMobile = useIsMobile();
  const { toast: toastHook } = useToast();
  const queryClient = useQueryClient();
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

  const importFromTPOSMutation = useMutation({
    mutationFn: async (productCode: string) => {
      // Step 1: Search in TPOS
      const tposProduct = await searchTPOSProduct(productCode);
      if (!tposProduct) {
        throw new Error(`Không tìm thấy sản phẩm "${productCode}" trong TPOS`);
      }

      // Step 2: Import to database
      return await importProductFromTPOS(tposProduct);
    },
    onSuccess: (data) => {
      toast.success(`✅ Đã import sản phẩm: ${data.product_name}`);
      // Refresh search results
      queryClient.invalidateQueries({ queryKey: ["products-search"] });
      onRefetch();
    },
    onError: (error: Error) => {
      toast.error(`❌ Lỗi: ${error.message}`);
      console.error(error);
    },
  });

  const handleImportFromTPOS = () => {
    if (!searchQuery || searchQuery.trim().length === 0) {
      toast.error("Vui lòng nhập mã sản phẩm");
      return;
    }
    importFromTPOSMutation.mutate(searchQuery.trim());
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map(p => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleDelete = async () => {
    if (!deletingProduct) return;

    if (isAdmin) {
      try {
        const { error } = await supabase.rpc('admin_force_delete_product', { p_product_id: deletingProduct.id });
        if (error) throw error;
        
        toastHook({
          title: "Thành công",
          description: "Đã xóa sản phẩm và các dữ liệu liên quan",
        });
        onRefetch();

      } catch (error: any) {
        toastHook({
          title: "Lỗi",
          description: `Không thể xóa sản phẩm: ${error.message}`,
          variant: "destructive",
        });
      }
    } else {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", deletingProduct.id);

      if (error) {
        let errorMessage = "Không thể xóa sản phẩm";
        
        if (error.code === "23503" || error.message.includes("violates foreign key constraint")) {
          errorMessage = `Không thể xóa sản phẩm "${deletingProduct.product_name}" vì đang được sử dụng trong đơn đặt hàng. Vui lòng xóa các đơn hàng liên quan trước.`;
        } else if (error.message) {
          errorMessage = `Không thể xóa sản phẩm: ${error.message}`;
        }
        
        toastHook({
          title: "Lỗi",
          description: errorMessage,
          variant: "destructive",
        });
      } else {
        toastHook({
          title: "Thành công",
          description: "Đã xóa sản phẩm",
        });
        onRefetch();
      }
    }
    setDeletingProduct(null);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    if (isAdmin) {
      try {
        const idsToDelete = Array.from(selectedIds);
        // Using Promise.all to run deletes in parallel
        const promises = idsToDelete.map(id => supabase.rpc('admin_force_delete_product', { p_product_id: id }));
        const results = await Promise.all(promises);
        
        const errors = results.filter(res => res.error);
        
        if (errors.length > 0) {
          throw new Error(`${errors.length} sản phẩm không thể xóa. Lỗi đầu tiên: ${errors[0].error.message}`);
        }
        
        toastHook({
          title: "Thành công",
          description: `Đã xóa ${selectedIds.size} sản phẩm và các dữ liệu liên quan`,
        });
        setSelectedIds(new Set());
        onRefetch();

      } catch (error: any) {
        toastHook({
          title: "Lỗi",
          description: error.message,
          variant: "destructive",
        });
      }
    } else {
      const { error } = await supabase
        .from("products")
        .delete()
        .in("id", Array.from(selectedIds));

      if (error) {
        let errorMessage = "Không thể xóa sản phẩm đã chọn";
        
        if (error.code === "23503" || error.message.includes("violates foreign key constraint")) {
          errorMessage = `Một hoặc nhiều sản phẩm đang được sử dụng trong đơn đặt hàng. Vui lòng xóa các đơn hàng liên quan trước hoặc bỏ chọn các sản phẩm đó.`;
        } else if (error.message) {
          errorMessage = `Không thể xóa sản phẩm: ${error.message}`;
        }
        
        toastHook({
          title: "Lỗi",
          description: errorMessage,
          variant: "destructive",
        });
      } else {
        toastHook({
          title: "Thành công",
          description: `Đã xóa ${selectedIds.size} sản phẩm`,
        });
        setSelectedIds(new Set());
        onRefetch();
      }
    }
    setShowBulkDeleteDialog(false);
  };

  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="text-center text-muted-foreground">Đang tải...</div>
      </Card>
    );
  }

  if (products.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center space-y-4">
          <div className="text-muted-foreground">
            Không có sản phẩm nào
          </div>
          {searchQuery && searchQuery.trim().length >= 2 && isAdmin && (
            <Button
              onClick={handleImportFromTPOS}
              disabled={importFromTPOSMutation.isPending}
              variant="outline"
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              {importFromTPOSMutation.isPending ? "Đang lấy từ TPOS..." : "Lấy sản phẩm từ TPOS"}
            </Button>
          )}
        </div>
      </Card>
    );
  }

  if (isMobile) {
    return (
      <>
        {isAdmin && selectedIds.size > 0 && (
          <Card className="p-4 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                Đã chọn {selectedIds.size} sản phẩm
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Bỏ chọn
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowBulkDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Xóa đã chọn
                </Button>
              </div>
            </div>
          </Card>
        )}

        <div className="space-y-4">
          {products.map((product) => {
            const isHighlighted = supplierFilter && product.supplier_name === supplierFilter;
            return (
            <Card key={product.id} className={`p-4 ${isHighlighted ? "ring-2 ring-primary" : ""}`}>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  {isAdmin && (
                    <Checkbox
                      checked={selectedIds.has(product.id)}
                      onCheckedChange={() => toggleSelect(product.id)}
                      className="mt-1"
                    />
                  )}
                  <div className="flex-1">
                    <div className="font-semibold text-foreground">
                      {product.product_name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {product.product_code}
                    </div>
                    {product.variant && (
                      <div className="text-xs text-muted-foreground">
                        {product.variant}
                      </div>
                    )}
                    {product.base_product_code && (
                      <div className="text-xs text-muted-foreground">
                        Base: {product.base_product_code}
                      </div>
                    )}
                  </div>
                <ProductImage 
                  productId={product.id}
                  productCode={product.product_code}
                  productImages={product.product_images}
                  tposImageUrl={product.tpos_image_url}
                  tposProductId={product.tpos_product_id}
                />
                </div>
                
                <ProductImage 
                  productId={product.id}
                  productCode={product.product_code}
                  productImages={product.product_images}
                  tposImageUrl={product.tpos_image_url}
                  tposProductId={product.tpos_product_id}
                />

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Giá bán: </span>
                    <span className="font-medium">{formatVND(product.selling_price)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tồn: </span>
                    <span className={`font-medium ${product.stock_quantity < 0 ? 'text-red-500' : ''}`}>
                      {product.stock_quantity}
                    </span>
                  </div>
                </div>

                {product.category && (
                  <div className="text-xs text-muted-foreground">
                    {product.category}
                  </div>
                )}

                {isAdmin && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingProduct(product)}
                      className="flex-1"
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Sửa
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeletingProduct(product)}
                      className="flex-1"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Xóa
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )})}
        </div>

        <EditProductDialog
          product={editingProduct}
          open={!!editingProduct}
          onOpenChange={(open) => !open && setEditingProduct(null)}
          onSuccess={onRefetch}
        />

        <AlertDialog open={!!deletingProduct} onOpenChange={(open) => !open && setDeletingProduct(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
              <AlertDialogDescription>
                Bạn có chắc muốn xóa sản phẩm "{deletingProduct?.product_name}"?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Xóa</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xác nhận xóa nhiều sản phẩm</AlertDialogTitle>
              <AlertDialogDescription>
                Bạn có chắc muốn xóa {selectedIds.size} sản phẩm đã chọn? Hành động này không thể hoàn tác.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Xóa {selectedIds.size} sản phẩm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return (
    <>
      {isAdmin && selectedIds.size > 0 && (
        <Card className="p-4 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Đã chọn {selectedIds.size} sản phẩm
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
              >
                Bỏ chọn
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowBulkDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Xóa đã chọn
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              {isAdmin && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedIds.size === products.length && products.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
              )}
              <TableHead>Hình ảnh</TableHead>
              <TableHead>Mã SP</TableHead>
              <TableHead>Tên sản phẩm</TableHead>
              <TableHead>Variant</TableHead>
              <TableHead>Base</TableHead>
              <TableHead>Giá bán</TableHead>
              <TableHead>Giá mua</TableHead>
              <TableHead>Tồn kho</TableHead>
              <TableHead>Nhóm</TableHead>
              <TableHead>NCC</TableHead>
              {isAdmin && <TableHead className="text-right">Thao tác</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => {
              const isHighlighted = supplierFilter && product.supplier_name === supplierFilter;
              return (
              <TableRow key={product.id} className={isHighlighted ? "bg-primary/5" : ""}>
                {isAdmin && (
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(product.id)}
                      onCheckedChange={() => toggleSelect(product.id)}
                    />
                  </TableCell>
                )}
                <TableCell>
                  <ProductImage 
                    productId={product.id}
                    productCode={product.product_code}
                    productImages={product.product_images}
                    tposImageUrl={product.tpos_image_url}
                    tposProductId={product.tpos_product_id}
                  />
                </TableCell>
                <TableCell className="font-medium">{product.product_code}</TableCell>
                <TableCell>{product.product_name}</TableCell>
                <TableCell className="text-muted-foreground">{product.variant || "-"}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{product.base_product_code || "-"}</TableCell>
                <TableCell>{formatVND(product.selling_price)}</TableCell>
                <TableCell>{formatVND(product.purchase_price)}</TableCell>
                <TableCell>
                  <span className={product.stock_quantity < 0 ? 'text-red-500 font-semibold' : ''}>
                    {product.stock_quantity}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{product.category || "-"}</TableCell>
                <TableCell className="text-muted-foreground">{product.supplier_name || "-"}</TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingProduct(product)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingProduct(product)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            )})}
          </TableBody>
        </Table>
      </Card>

      <EditProductDialog
        product={editingProduct}
        open={!!editingProduct}
        onOpenChange={(open) => !open && setEditingProduct(null)}
        onSuccess={onRefetch}
      />

      <AlertDialog open={!!deletingProduct} onOpenChange={(open) => !open && setDeletingProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa sản phẩm "{deletingProduct?.product_name}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Xóa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa nhiều sản phẩm</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa {selectedIds.size} sản phẩm đã chọn? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Xóa {selectedIds.size} sản phẩm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}