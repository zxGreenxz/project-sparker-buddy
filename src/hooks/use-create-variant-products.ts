import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface BaseProductData {
  product_code: string;
  product_name: string;
  variant: string | null;
  purchase_price: number;
  selling_price: number;
  supplier_name?: string;
  stock_quantity: number;
  product_images: string[];
  price_images: string[];
}

interface ChildVariantData {
  product_code: string;
  base_product_code: string;
  product_name: string;
  variant: string;
  purchase_price: number;
  selling_price: number;
  supplier_name?: string;
  product_images: string[];
  price_images: string[];
}

interface CreateVariantInput {
  baseProduct: BaseProductData;
  childVariants: ChildVariantData[];
  onSuccessCallback?: () => void;
}

// Helper function to merge and deduplicate variants
function mergeVariants(oldVariant: string | null, newVariant: string | null): string | null {
  if (!newVariant) return oldVariant;
  if (!oldVariant) return newVariant;
  
  // Split, combine, deduplicate, and sort
  const oldParts = oldVariant.split(',').map(s => s.trim()).filter(Boolean);
  const newParts = newVariant.split(',').map(s => s.trim()).filter(Boolean);
  const combined = [...new Set([...oldParts, ...newParts])];
  
  return combined.sort().join(', ');
}

export function useCreateVariantProducts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateVariantInput) => {
      const { baseProduct, childVariants } = input;

      // 1. Handle Base Product
      const { data: existingBase } = await supabase
        .from("products")
        .select("*")
        .eq("product_code", baseProduct.product_code)
        .maybeSingle();

      let baseAction: 'created' | 'updated';
      if (existingBase) {
        // UPDATE only product_images and variant
        const mergedVariant = mergeVariants(existingBase.variant, baseProduct.variant);
        
        const { error } = await supabase
          .from("products")
          .update({
            product_images: baseProduct.product_images,
            variant: mergedVariant
          })
          .eq("product_code", baseProduct.product_code);

        if (error) throw error;
        baseAction = 'updated';
      } else {
        // INSERT with full data
        const { error } = await supabase
          .from("products")
          .insert({
            product_code: baseProduct.product_code,
            base_product_code: baseProduct.product_code,
            product_name: baseProduct.product_name,
            variant: baseProduct.variant,
            purchase_price: baseProduct.purchase_price,
            selling_price: baseProduct.selling_price,
            supplier_name: baseProduct.supplier_name || null,
            stock_quantity: baseProduct.stock_quantity,
            unit: "Cái",
            product_images: baseProduct.product_images,
            price_images: baseProduct.price_images
          });

        if (error) throw error;
        baseAction = 'created';
      }

      // 2. Handle Child Variants
      const childCodes = childVariants.map(c => c.product_code);
      const { data: existingChildren } = await supabase
        .from("products")
        .select("product_code")
        .in("product_code", childCodes);

      const existingChildCodes = new Set(existingChildren?.map(c => c.product_code) || []);
      
      // Filter out existing child variants (SKIP them)
      const newChildren = childVariants.filter(c => !existingChildCodes.has(c.product_code));

      let childrenCreated = 0;
      if (newChildren.length > 0) {
      const { error } = await supabase
        .from("products")
        .insert(
          newChildren.map(c => ({
            product_code: c.product_code,
            base_product_code: c.base_product_code,
            product_name: c.product_name,
            variant: c.variant,
            purchase_price: c.purchase_price,
            selling_price: c.selling_price,
            supplier_name: c.supplier_name || null,
            stock_quantity: 0,
            unit: "Cái",
            product_images: c.product_images,
            price_images: c.price_images
          }))
        );

        if (error) throw error;
        childrenCreated = newChildren.length;
      }

      return { 
        baseAction, 
        baseProduct: baseProduct.product_code,
        childrenCreated,
        childrenSkipped: childVariants.length - childrenCreated
      };
    },
    onSuccess: ({ baseAction, baseProduct, childrenCreated, childrenSkipped }, variables) => {
      const baseActionText = baseAction === 'created' ? 'tạo' : 'cập nhật';
      const messages = [`Đã ${baseActionText} sản phẩm gốc: ${baseProduct}`];
      
      if (childrenCreated > 0) {
        messages.push(`Đã tạo ${childrenCreated} biến thể con`);
      }
      if (childrenSkipped > 0) {
        messages.push(`Bỏ qua ${childrenSkipped} biến thể đã tồn tại`);
      }

      toast({
        title: "Tạo biến thể thành công",
        description: messages.join(' • ')
      });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["products-select"] });
      
      // Gọi callback nếu có
      if (variables.onSuccessCallback) {
        variables.onSuccessCallback();
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi xử lý sản phẩm",
        description: error.message,
        variant: "destructive"
      });
    }
  });
}
