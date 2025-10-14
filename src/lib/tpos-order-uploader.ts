import { supabase } from "@/integrations/supabase/client";
import { getActiveTPOSToken, getTPOSHeaders } from "./tpos-config";

interface UploadOrderToTPOSParams {
  orderCode: string;
  products: Array<{
    product_code: string;
    product_name: string;
    quantity: number;
  }>;
  sessionInfo: {
    start_date: string;
    end_date: string;
    session_index: number;
  };
  onProgress?: (step: number, message: string) => void;
}

interface UploadResult {
  success: boolean;
  tposOrderId?: string;
  codeTPOSOrderId?: string;
  error?: string;
}

/**
 * Format date for TPOS API with Vietnam timezone (GMT+7)
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param isEndDate - Whether this is end date (23:59:59) or start date (00:00:00)
 * @returns ISO string in UTC format suitable for TPOS API
 */
function formatDateForTPOSAPI(dateStr: string, isEndDate: boolean = false): string {
  const date = new Date(dateStr);
  
  if (isEndDate) {
    // Set to 23:59:59 GMT+7 = 16:59:59 UTC
    date.setHours(16, 59, 59, 0);
  } else {
    // Set to 00:00:00 GMT+7 = 17:00:00 UTC previous day
    date.setHours(17, 0, 0, 0);
    date.setDate(date.getDate() - 1);
  }
  
  // Format as ISO string without milliseconds
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// Search for a product in TPOS
async function searchTPOSProduct(productCode: string, bearerToken: string) {
  const url = `https://tomato.tpos.vn/odata/Product/ODataService.GetView?$filter=DefaultCode eq '${productCode}'&$top=1`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: getTPOSHeaders(bearerToken),
  });

  if (!response.ok) {
    throw new Error(`Failed to search product ${productCode}: ${response.status}`);
  }

  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    throw new Error(`Invalid response from TPOS (not JSON)`);
  }

  const data = await response.json();
  return data.value?.[0] || null;
}

// Fetch orders from TPOS by date range and session index
async function fetchTPOSOrders(
  startDate: string,
  endDate: string,
  sessionIndex: number,
  bearerToken: string
) {
  // Format dates for TPOS API with GMT+7 timezone
  const startDateTime = formatDateForTPOSAPI(startDate, false);
  const endDateTime = formatDateForTPOSAPI(endDate, true);
  
  console.log('📅 Start Date (input):', startDate);
  console.log('📅 Start Date (formatted for TPOS):', startDateTime);
  console.log('📅 End Date (input):', endDate);
  console.log('📅 End Date (formatted for TPOS):', endDateTime);
  
  const filterQuery = `DateCreated ge ${startDateTime} and DateCreated le ${endDateTime} and SessionIndex eq ${sessionIndex}`;
  const url = `https://tomato.tpos.vn/odata/SaleOnline_Order/ODataService.GetView?$filter=${encodeURIComponent(filterQuery)}&$orderby=DateCreated desc&$top=50`;

  const response = await fetch(url, {
    method: 'GET',
    headers: getTPOSHeaders(bearerToken),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch TPOS orders: ${response.status}`);
  }

  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    throw new Error(`Invalid response from TPOS (not JSON)`);
  }

  const data = await response.json();
  return data.value || [];
}

// Get order detail from TPOS
async function getTPOSOrderDetail(orderId: number, bearerToken: string) {
  const url = `https://tomato.tpos.vn/odata/SaleOnline_Order(${orderId})?$expand=Details,Partner,User,CRMTeam`;

  const response = await fetch(url, {
    method: 'GET',
    headers: getTPOSHeaders(bearerToken),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch order detail: ${response.status}`);
  }

  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    throw new Error(`Invalid response from TPOS (not JSON)`);
  }

  return await response.json();
}

// Update TPOS order with new products
async function updateTPOSOrder(
  orderId: number,
  orderDetail: any,
  products: any[],
  bearerToken: string
) {
  const url = `https://tomato.tpos.vn/odata/SaleOnline_Order(${orderId})`;

  const payload = {
    ...orderDetail,
    Details: products,
  };

  console.log(`Updating TPOS order ${orderId} with ${products.length} products`);

  const response = await fetch(url, {
    method: 'PUT',
    headers: getTPOSHeaders(bearerToken),
    body: JSON.stringify(payload),
  });

  console.log('Update response status:', response.status);
  console.log('Update response content-type:', response.headers.get('content-type'));
  console.log('Update response content-length:', response.headers.get('content-length'));

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update order: ${response.status} - ${errorText}`);
  }

  // Handle 204 No Content or empty responses
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    console.log('Order updated successfully (204 No Content)');
    return { success: true };
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return await response.json();
  }

  console.log('Order updated successfully (non-JSON response)');
  return { success: true };
}

export async function uploadOrderToTPOS(
  params: UploadOrderToTPOSParams
): Promise<UploadResult> {
  try {
    const bearerToken = await getActiveTPOSToken();
    if (!bearerToken) {
      throw new Error("TPOS token không khả dụng");
    }

    // Step 1: Fetch TPOS Orders
    params.onProgress?.(1, `Đang tìm đơn hàng TPOS từ ${params.sessionInfo.start_date} đến ${params.sessionInfo.end_date}...`);
    
    const tposOrders = await fetchTPOSOrders(
      params.sessionInfo.start_date,
      params.sessionInfo.end_date,
      params.sessionInfo.session_index,
      bearerToken
    );

    if (tposOrders.length === 0) {
      throw new Error("Không tìm thấy đơn hàng TPOS trong khoảng thời gian này");
    }

    // Step 2: Select first order automatically
    const selectedOrder = tposOrders[0];
    params.onProgress?.(2, `Đã chọn đơn TPOS: ${selectedOrder.Code}`);

    // Step 3: Fetch order detail and search products
    params.onProgress?.(3, `Đang tìm ${params.products.length} sản phẩm trong TPOS...`);
    
    const [orderDetail, ...productSearchResults] = await Promise.all([
      getTPOSOrderDetail(selectedOrder.Id, bearerToken),
      ...params.products.map(p => searchTPOSProduct(p.product_code, bearerToken))
    ]);

    const tposProducts = [];
    for (let i = 0; i < params.products.length; i++) {
      const product = params.products[i];
      const searchResult = productSearchResults[i];
      
      if (!searchResult) {
        throw new Error(`Không tìm thấy sản phẩm ${product.product_code} trong TPOS`);
      }

      tposProducts.push({
        ProductId: searchResult.Id,
        ProductName: searchResult.Name,
        ProductNameGet: searchResult.NameGet,
        Quantity: product.quantity,
        Price: searchResult.ListPrice || searchResult.PriceVariant || 0,
        UOMId: 1,
        UOMName: "Cái",
        Factor: 1,
        ProductWeight: 0,
      });
    }

    // Step 4: Update order in TPOS
    params.onProgress?.(4, `Đang cập nhật đơn ${selectedOrder.Code} với ${tposProducts.length} sản phẩm...`);
    
    await updateTPOSOrder(selectedOrder.Id, orderDetail, tposProducts, bearerToken);

    // Update database
    const { error: updateError } = await supabase
      .from('live_orders')
      .update({
        tpos_order_id: selectedOrder.Id.toString(),
        code_tpos_order_id: selectedOrder.Code,
        upload_status: 'success',
      })
      .eq('order_code', params.orderCode);

    if (updateError) {
      console.error('Failed to update database:', updateError);
    }

    return {
      success: true,
      tposOrderId: selectedOrder.Id.toString(),
      codeTPOSOrderId: selectedOrder.Code,
    };
  } catch (error) {
    console.error('Upload error:', error);
    
    // Update database with failed status
    await supabase
      .from('live_orders')
      .update({
        upload_status: 'failed',
      })
      .eq('order_code', params.orderCode);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
