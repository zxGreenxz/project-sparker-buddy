import { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";

const formSchema = z.object({
  quantity: z.coerce.number().min(0, "Số lượng không được âm"),
});

interface EditOrderItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderItem: {
    id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    orders?: Array<{
      id: string;
      live_product_id: string;
      product_name: string;
      product_code: string;
      quantity: number;
      order_code: string;
      created_at?: string;
      order_date?: string;
      live_session_id: string;
      live_phase_id?: string;
      sold_quantity?: number;
      facebook_comment_id?: string;
    }>;
  } | null;
  phaseId: string;
}

export function EditOrderItemDialog({ open, onOpenChange, orderItem, phaseId }: EditOrderItemDialogProps) {
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingQuantity, setPendingQuantity] = useState<number | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantity: 1,
    },
  });

  // Fetch comment info from facebook_pending_orders
  const { data: pendingOrderInfo } = useQuery({
    queryKey: ["facebook-pending-order-info", orderItem?.orders?.[0]?.facebook_comment_id],
    queryFn: async () => {
      const commentId = orderItem?.orders?.[0]?.facebook_comment_id;
      if (!commentId) return null;

      const { data } = await supabase
        .from("facebook_pending_orders")
        .select("session_index, name, comment, created_time")
        .eq("facebook_comment_id", commentId)
        .maybeSingle();

      return data || null;
    },
    enabled: !!orderItem?.orders?.[0]?.facebook_comment_id,
  });

  useEffect(() => {
    if (orderItem) {
      form.reset({
        quantity: orderItem.quantity,
      });
    }
  }, [orderItem, form]);

  const updateOrderItemMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!orderItem) return;

      // If we have multiple orders (aggregated), consolidate into single order
      if (orderItem.orders && orderItem.orders.length > 0) {
        const orders = orderItem.orders;
        const currentTotalQty = orders.reduce((sum, o) => sum + o.quantity, 0);
        const newTotalQty = values.quantity;
        const diff = newTotalQty - currentTotalQty;

        // Only return early if nothing changed
        if (diff === 0) return;

        // Keep the first order and delete the rest
        const firstOrder = orders[0];
        const ordersToDelete = orders.slice(1).map((o) => o.id);

        // Update the first order with new total quantity
        const { error: updateError } = await supabase
          .from("live_orders")
          .update({
            quantity: newTotalQty,
          })
          .eq("id", firstOrder.id);

        if (updateError) throw updateError;

        // Delete other orders with same order_code
        if (ordersToDelete.length > 0) {
          const { error: deleteError } = await supabase.from("live_orders").delete().in("id", ordersToDelete);

          if (deleteError) throw deleteError;
        }

        // Update product sold_quantity only if quantity changed
        if (diff !== 0) {
          const { data: product, error: productFetchError } = await supabase
            .from("live_products")
            .select("sold_quantity")
            .eq("id", orderItem.product_id)
            .single();

          if (productFetchError) throw productFetchError;

          const { error: productError } = await supabase
            .from("live_products")
            .update({
              sold_quantity: Math.max(0, product.sold_quantity + diff),
            })
            .eq("id", orderItem.product_id);

          if (productError) throw productError;
        }
      } else {
        // Single order item - update quantity directly
        const quantityDiff = values.quantity - orderItem.quantity;

        // Update order quantity
        const { error: orderError } = await supabase
          .from("live_orders")
          .update({
            quantity: values.quantity,
          })
          .eq("id", orderItem.id);

        if (orderError) throw orderError;

        // Update product sold_quantity
        const { data: product, error: productFetchError } = await supabase
          .from("live_products")
          .select("sold_quantity")
          .eq("id", orderItem.product_id)
          .single();

        if (productFetchError) throw productFetchError;

        const { error: productUpdateError } = await supabase
          .from("live_products")
          .update({
            sold_quantity: Math.max(0, product.sold_quantity + quantityDiff),
          })
          .eq("id", orderItem.product_id);

        if (productUpdateError) throw productUpdateError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-orders", phaseId] });
      queryClient.invalidateQueries({ queryKey: ["live-products", phaseId] });
      queryClient.invalidateQueries({ queryKey: ["orders-with-products", phaseId] });
      toast.success("Đã cập nhật số lượng sản phẩm");
      onOpenChange(false);
      form.reset();
    },
    onError: (error) => {
      console.error("Error updating order item:", error);
      toast.error("Có lỗi xảy ra khi cập nhật số lượng");
    },
  });

  const deleteOrderItemMutation = useMutation({
    mutationFn: async () => {
      if (!orderItem) return;

      const productId = orderItem.product_id;

      // Case 1: No orders array - delete by orderItem.id directly
      if (!orderItem.orders || orderItem.orders.length === 0) {
        // Delete the order
        const { error: deleteError } = await supabase
          .from("live_orders")
          .delete()
          .eq("id", orderItem.id);

        if (deleteError) throw deleteError;

        // Update sold_quantity
        const { data: product, error: productFetchError } = await supabase
          .from("live_products")
          .select("sold_quantity")
          .eq("id", productId)
          .single();

        if (productFetchError) throw productFetchError;

        const { error: productUpdateError } = await supabase
          .from("live_products")
          .update({
            sold_quantity: Math.max(0, product.sold_quantity - orderItem.quantity),
          })
          .eq("id", productId);

        if (productUpdateError) throw productUpdateError;
        return;
      }

      const isSingleOrder = orderItem.orders.length === 1;

      // Single order (clicked on specific badge)
      if (isSingleOrder) {
        const order = orderItem.orders[0];

        // Delete this specific order
        const { error: deleteError } = await supabase.from("live_orders").delete().eq("id", order.id);

        if (deleteError) throw deleteError;

        // Update sold_quantity for this product
        const { data: product, error: productFetchError } = await supabase
          .from("live_products")
          .select("sold_quantity")
          .eq("id", productId)
          .single();

        if (productFetchError) throw productFetchError;

        const { error: productUpdateError } = await supabase
          .from("live_products")
          .update({
            sold_quantity: Math.max(0, product.sold_quantity - order.quantity),
          })
          .eq("id", productId);

        if (productUpdateError) throw productUpdateError;
      }
      // Aggregated orders (clicked edit in table)
      else {
        const orderCode = orderItem.orders[0].order_code;

        // Get all orders for this specific product with this order_code
        const { data: ordersToDelete, error: fetchError } = await supabase
          .from("live_orders")
          .select("id, quantity")
          .eq("order_code", orderCode)
          .eq("live_product_id", productId);

        if (fetchError) throw fetchError;

        if (!ordersToDelete || ordersToDelete.length === 0) return;

        // Calculate total quantity to subtract for this product only
        const totalQuantity = ordersToDelete.reduce((sum, order) => sum + order.quantity, 0);

        // Update sold_quantity for this product only
        const { data: product, error: productFetchError } = await supabase
          .from("live_products")
          .select("sold_quantity")
          .eq("id", productId)
          .single();

        if (productFetchError) throw productFetchError;

        const { error: productUpdateError } = await supabase
          .from("live_products")
          .update({
            sold_quantity: Math.max(0, product.sold_quantity - totalQuantity),
          })
          .eq("id", productId);

        if (productUpdateError) throw productUpdateError;

        // Delete only orders for this specific product with this order_code
        const { error: deleteError } = await supabase
          .from("live_orders")
          .delete()
          .eq("order_code", orderCode)
          .eq("live_product_id", productId);

        if (deleteError) throw deleteError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-orders", phaseId] });
      queryClient.invalidateQueries({ queryKey: ["live-products", phaseId] });
      queryClient.invalidateQueries({ queryKey: ["orders-with-products", phaseId] });
      toast.success("Đã xóa sản phẩm khỏi đơn hàng thành công");
      onOpenChange(false);
      setShowDeleteConfirm(false);
      form.reset();
    },
    onError: (error) => {
      console.error("Error deleting order item:", error);
      toast.error("Có lỗi xảy ra khi xóa sản phẩm");
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (values.quantity === 0) {
      setPendingQuantity(values.quantity);
      setShowDeleteConfirm(true);
    } else {
      updateOrderItemMutation.mutate(values);
    }
  };

  const handleDeleteConfirm = () => {
    deleteOrderItemMutation.mutate();
  };

  const orderCode = useMemo(
    () => (orderItem?.orders && orderItem.orders.length > 0 ? orderItem.orders[0].order_code : ""),
    [orderItem],
  );

  const isSingleOrder = useMemo(() => orderItem?.orders && orderItem.orders.length === 1, [orderItem]);

  const singleOrderQuantity = useMemo(
    () => (isSingleOrder && orderItem?.orders ? orderItem.orders[0].quantity : 0),
    [isSingleOrder, orderItem],
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa số lượng sản phẩm</DialogTitle>
            <DialogDescription>
              Cập nhật số lượng cho sản phẩm: <strong>{orderItem?.product_name}</strong>
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Số lượng</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" placeholder="Nhập số lượng" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormItem>
                <FormLabel>Comment được chọn</FormLabel>
                <FormControl>
                  <div className="space-y-2 rounded-md border bg-muted p-3 text-sm">
                    {pendingOrderInfo ? (
                      <>
                        <div className="flex justify-between">
                          <span className="font-semibold">
                            #{pendingOrderInfo.session_index} - {pendingOrderInfo.name}
                          </span>
                          <span className="text-muted-foreground">
                            {pendingOrderInfo.created_time
                              ? format(new Date(pendingOrderInfo.created_time), "HH:mm:ss dd/MM")
                              : ""}
                          </span>
                        </div>
                        <p className="italic">"{pendingOrderInfo.comment || "Không có nội dung"}"</p>
                      </>
                    ) : (
                      <p className="text-muted-foreground">Không có thông tin comment.</p>
                    )}
                  </div>
                </FormControl>
              </FormItem>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Hủy
                </Button>
                <Button type="submit" disabled={updateOrderItemMutation.isPending}>
                  {updateOrderItemMutation.isPending ? "Đang lưu..." : "Lưu"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa sản phẩm</AlertDialogTitle>
            <AlertDialogDescription>
              {isSingleOrder ? (
                <>
                  Bạn có muốn xóa sản phẩm <strong>{orderItem?.product_name}</strong> với số lượng{" "}
                  <strong>{singleOrderQuantity}</strong> khỏi đơn hàng <strong>{orderCode}</strong> không?
                </>
              ) : (
                <>
                  Bạn có muốn xóa tất cả sản phẩm <strong>{orderItem?.product_name}</strong> khỏi đơn hàng{" "}
                  <strong>{orderCode}</strong> không?
                </>
              )}{" "}
              Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteConfirm(false)}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteOrderItemMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteOrderItemMutation.isPending ? "Đang xóa..." : "Xóa sản phẩm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
