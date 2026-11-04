import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const cleanStr = (str: any) => {
  if (!str) return '';
  return String(str).toLowerCase().replace(/[\s\-_]+/g, '').trim();
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Kéo Configs
    const { data: configData } = await supabase.from('system_configs').select('*')
    const configMap: Record<string, string> = {}
    configData?.forEach(c => configMap[c.key] = c.value)

    const allowedStatuses = (configMap['print_allowed_statuses'] || '54,55,56,42,40').split(',')
    const priorityRules = (configMap['print_priority_mode'] || '').split(',').filter(Boolean)

    // 2. Kéo Tồn kho (Chunk Pagination)
    let rawInventory: any[] = [];
    let invPage = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase.from('product_inventories').select('*').range(invPage * pageSize, (invPage + 1) * pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      rawInventory = rawInventory.concat(data);
      if (data.length < pageSize) break;
      invPage++;
    }

    // Kéo Đơn hàng
    let rawOrders: any[] = [];
    let orderPage = 0;
    while (true) {
      const { data, error } = await supabase.from('orders').select('*, order_products!order_id(*)').in('status', allowedStatuses).range(orderPage * pageSize, (orderPage + 1) * pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      rawOrders = rawOrders.concat(data);
      if (data.length < pageSize) break;
      orderPage++;
    }

    if (!rawOrders || rawOrders.length === 0) {
      return new Response(JSON.stringify({ printable: [], holding: [], outOfStock: [], invalidCount: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 3. Map Tồn kho
    const inventoryMap: Record<string, any> = {};
    rawInventory.forEach(inv => {
      const pId = String(inv.product_id).trim();
      const pCode = cleanStr(inv.product_code);
      const pName = cleanStr(inv.product_name);
      const stockItem = { on_hand: Number(inv.on_hand || 0), original: Number(inv.on_hand || 0) };
      if (pId && pId !== 'undefined') inventoryMap[`id_${pId}`] = stockItem;
      if (pCode) inventoryMap[`code_${pCode}`] = stockItem;
      if (pName) inventoryMap[`name_${pName}`] = stockItem;
    });

    // 4. Sắp xếp Đơn theo Luật Kéo Thả
    let sortedOrders = [...rawOrders].sort((a, b) => {
      for (let rule of priorityRules) {
        if (rule.startsWith('STATUS_')) {
          const code = Number(rule.replace('STATUS_', ''));
          const aStat = Number(a.status); const bStat = Number(b.status);
          if (aStat === code && bStat !== code) return -1;
          if (bStat === code && aStat !== code) return 1;
        }
        if (rule === 'DATE_ASC') {
          const timeDiff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          if (timeDiff !== 0) return timeDiff;
        }
        if (rule === 'DATE_DESC') {
          const timeDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          if (timeDiff !== 0) return timeDiff;
        }
      }
      return 0;
    });

    // 5. Tính toán Phân bổ Tham lam
    const printable: any[] = []; const holding: any[] = []; const outOfStock: any[] = [];
    let invalidCount = 0;
    sortedOrders.forEach(order => {
      // SỬA Ở ĐÂY: Đơn không có sản phẩm là đơn lỗi
      if (!order.order_products || order.order_products.length === 0) {
        invalidCount++;
        outOfStock.push(order);
        return;
      }
      // Chỉ mã 42 (Đã đóng gói) mới được tự động coi là đủ hàng
      // Mã 40 (Đang đóng gói) sẽ bị tính toán tồn kho như các đơn bình thường
      const isPacked = ['40'].includes(String(order.status));
      let totalItemsNeeded = 0; let itemsAllocated = 0;
      const shortItems: any[] = [];
      order.order_products.forEach((prod: any) => {
        const reqQty = Number(prod.quantity); totalItemsNeeded += reqQty;
        const pId = String(prod.product_id).trim();
        const pCode = cleanStr(prod.product_code); const pName = cleanStr(prod.product_name);

        let stockData = inventoryMap[`id_${pId}`] || inventoryMap[`code_${pCode}`] || inventoryMap[`name_${pName}`];
        if (!stockData) stockData = { on_hand: 0, original: 0 };

        let allocated = 0;
        if (isPacked) { allocated = reqQty; stockData.on_hand -= reqQty; }
        else {
          if (stockData.on_hand > 0) {
            allocated = Math.min(reqQty, stockData.on_hand);
            stockData.on_hand -= allocated;
          }
        }
        itemsAllocated += allocated;

        if (!isPacked && allocated < reqQty) {
          shortItems.push({
            name: prod.product_name || `Mã: ${pId}`,
            req: reqQty, allocated: allocated, missing: reqQty - allocated,
            original: stockData.original, remaining: stockData.on_hand
          });
        }
      });
      order.debug_shortItems = shortItems;
      if (isPacked || itemsAllocated === totalItemsNeeded) printable.push(order);
      else if (itemsAllocated > 0) holding.push(order);
      else outOfStock.push(order);
    });

    return new Response(JSON.stringify({ printable, holding, outOfStock, invalidCount, total_orders: rawOrders.length, total_products: rawInventory.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
