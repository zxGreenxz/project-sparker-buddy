import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatVND } from "@/lib/currency-utils";
import { Check } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDebounce } from "@/hooks/use-debounce";
import { ProductImage } from "@/components/products/ProductImage";

interface Product {
  id: string;
  product_code: string;
  product_name: string;
  variant?: string;
  selling_price: number;
  purchase_price: number;
  unit: string;
  stock_quantity: number;
  supplier_name?: string;
  product_images?: string[];
  tpos_image_url?: string;
  tpos_product_id?: number;
}

interface SelectProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (product: Product) => void;
}

export function SelectProductDialog({ open, onOpenChange, onSelect }: SelectProductDialogProps) {
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products-select", debouncedSearch],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      
      // Nếu có search (>= 2 ký tự): Search trong database
      if (debouncedSearch.length >= 2) {
        query = query.or(
          `product_code.ilike.%${debouncedSearch}%,` +
          `product_name.ilike.%${debouncedSearch}%,` +
          `variant.ilike.%${debouncedSearch}%`
        );
      } else {
        // Load 50 SP mới nhất (không search)
        query = query.range(0, 49);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Product[];
    },
    enabled: open,
    staleTime: 30000,
    gcTime: 60000,
  });

  const handleSelect = (product: Product) => {
    onSelect(product);
    onOpenChange(false);
  };

  if (isMobile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Chọn sản phẩm từ kho</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <Input
              placeholder="Tìm kiếm theo mã SP, tên, variant (tối thiểu 2 ký tự)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            
            <div className="text-sm text-muted-foreground">
              {debouncedSearch.length >= 2 
                ? `Tìm thấy ${products.length} sản phẩm`
                : `Hiển thị ${products.length} sản phẩm mới nhất`
              }
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Card key={i} className="p-4">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-1/2 mb-2" />
                    <Skeleton className="h-3 w-full" />
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-2 overflow-y-auto flex-1">
                {products.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {debouncedSearch.length >= 2 ? "Không tìm thấy sản phẩm phù hợp" : "Chưa có sản phẩm nào"}
                  </div>
                ) : (
                  products.map((product) => (
                    <Card
                      key={product.id}
                      className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleSelect(product)}
                    >
                      <div className="space-y-2">
                        <div className="font-semibold">{product.product_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {product.product_code}
                          {product.variant && ` - ${product.variant}`}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Giá mua: </span>
                            <span className="font-medium">{formatVND(product.purchase_price)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Giá bán: </span>
                            <span className="font-medium">{formatVND(product.selling_price)}</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Chọn sản phẩm từ kho</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div className="space-y-2">
            <Input
              placeholder="Tìm kiếm theo mã SP, tên, variant (tối thiểu 2 ký tự)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            
            <div className="text-sm text-muted-foreground">
              {debouncedSearch.length >= 2 
                ? `Tìm thấy ${products.length} sản phẩm`
                : `Hiển thị ${products.length} sản phẩm mới nhất`
              }
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden flex-1 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hình ảnh</TableHead>
                  <TableHead>Mã SP</TableHead>
                  <TableHead>Tên sản phẩm</TableHead>
                  <TableHead>Variant</TableHead>
                  <TableHead>Giá mua</TableHead>
                  <TableHead>Giá bán</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-12 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                    </TableRow>
                  ))
                ) : products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {debouncedSearch.length >= 2 ? "Không tìm thấy sản phẩm phù hợp" : "Chưa có sản phẩm nào"}
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product) => (
                    <TableRow key={product.id} className="cursor-pointer hover:bg-muted/50">
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
                      <TableCell className="text-muted-foreground">
                        {product.variant || "-"}
                      </TableCell>
                      <TableCell>{formatVND(product.purchase_price)}</TableCell>
                      <TableCell>{formatVND(product.selling_price)}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => handleSelect(product)}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Chọn
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
