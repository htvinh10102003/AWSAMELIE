import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Papa from 'https://esm.sh/papaparse@5.4.1'

// sync-sheets — quét Google Sheet đơn đi / đơn in vào orders.
//
// Lịch sử: file này trước đây không có trong repo, chỉ chạy trên Supabase.
// Bản này giữ nguyên logic gốc (đã gửi 2026-11-01) và thêm:
//  1. Quét tách riêng theo loại: body { type: "daily" | "print" | "both" }.
//     Mặc định "both" để tương thích với lời gọi cũ không có body.
//     Chỉ sheet được chọn mới được tải CSV, nên 1 lần quét đơn lẻ tốn
//     khoảng một nửa công việc so với trước.
//  2. Cấu hình cột do người dùng tự gán, lưu trong system_configs:
//       sheet_daily_map, sheet_print_map — chuỗi JSON dạng:
//       {
//         "code_chain": [
//           { "db": "id", "header": "ID đơn" },
//           { "db": "carrier_code", "header": "Mã vận đơn" }
//         ],
//         "date_header": "Ngày"
//       }
//     "code_chain" là CHUỖI FALLBACK theo thứ tự: thử mục 1 trước, nếu
//     không tìm thấy đơn thì thử mục 2, rồi mục 3... "db" chỉ nhận
//     "id" (orders.id) hoặc "carrier_code" (mã vận đơn trong DB).
//     "header" là tiêu đề đúng ở hàng 1 của sheet (so khớp không phân
//     biệt hoa/thường, có trim). Dữ liệu luôn bắt đầu từ hàng 2.
//     "date_header" là tiêu đề cột ngày, gán vào carrier_date (đơn đi)
//     hoặc printed_at (đơn in).
//     Nếu chưa lưu map (hoặc map lỗi): giữ nguyên cách cũ để không làm
//     hỏng sheet đang chạy — mã lấy từ cột "mã vận đơn" / "mã đơn hàng"
//     / "mã đơn" (cột nào có trước), ngày từ cột "ngày", tìm theo
//     mã vận đơn trước rồi mới tới ID đơn.
//  3. Log đơn không tìm thấy trong DB: chỉ trả danh sách đầy đủ khi
//     người gọi chứng minh được quyền owner / super_admin bằng JWT
//     của chính họ (header Authorization: Bearer <access_token>).
//     Người gọi khác (admin thường, hoặc không có token) vẫn quét bình
//     thường nhưng chỉ nhận được số lượng, không nhận mã — để log này
//     không rò qua network response sang role không được phép xem.
//     Frontend cũng chỉ hiển thị bảng log + nút tải CSV khi
//     canEditSensitiveConfig (owner hoặc super_admin).
//
// Tối ưu — nói thẳng giới hạn: với cách xuất CSV công khai của Google
// (export?format=csv), Google luôn trả toàn bộ sheet, không có tham số
// lấy một phần hàng/cột. Muốn thật sự chỉ lấy một phần sheet phải đổi
// sang Sheets API (cần Google API key) hoặc gviz select — cả hai đều
// chưa được kiểm chứng trên sheet thật của hệ thống nên bản này KHÔNG
// đổi đường tải, tránh làm hỏng quét đang chạy. Tối ưu đã làm ở đây:
//  - chỉ tải sheet được chọn (type), không tải cả hai như trước;
//  - chỉ đọc các cột đã cấu hình, các cột khác trong sheet bị bỏ qua
//    ngay sau khi parse, không đưa vào xử lý;
//  - tải danh sách orders 120 ngày 1 lần duy nhất cho cả request và
//    tái dùng cho cả hai sheet khi type = "both";
//  - vẫn giữ dedup theo đơn + chỉ upsert khi ngày thay đổi (logic gốc),
//    nên DB chỉ ghi những đơn thực sự đổi ngày.
//  - sau mỗi lần quét thành công, ghi sheet_<type>_last_scan_at vào
//    system_configs để Admin hiển thị "lần quét trước".

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const SUPER_OWNER_EMAIL = 'contact.hotavinh@gmail.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

function extractSheetId(url: string): string | null {
    const matches = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return matches ? matches[1] : null;
}

function parseVietnameseDate(dateStr: string): string | null {
    if (!dateStr) return null;
    const parts = dateStr.trim().split(/[\/\-]/);
    if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        const d = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
        return isNaN(d.getTime()) ? null : d.toISOString();
    }
    const fallback = new Date(dateStr);
    return isNaN(fallback.getTime()) ? null : fallback.toISOString();
}

const getSafeDateStr = (dStr: string | null | undefined): string | null => {
    if (!dStr) return null;
    const d = new Date(dStr);
    return isNaN(d.getTime()) ? null : d.toISOString().substring(0, 10);
};

// Hàm "Siêu tẩy rửa" - Xóa sạch mọi ký tự không phải là chữ hoặc số
const cleanCode = (code: string | null | undefined): string => {
    if (!code) return '';
    return String(code).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
};

const normHeader = (h: string | null | undefined): string =>
    String(h ?? '').trim().toLowerCase();

// Parse map JSON từ system_configs. Trả null nếu chưa có / lỗi -> dùng cách cũ.
function parseMapConfig(raw: string | null | undefined): {
    codeChain: { db: 'id' | 'carrier_code', header: string }[],
    dateHeader: string
} | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.code_chain) || parsed.code_chain.length === 0) return null;
        if (!parsed.date_header || typeof parsed.date_header !== 'string') return null;
        const codeChain = parsed.code_chain
            .filter((c: any) => c && (c.db === 'id' || c.db === 'carrier_code') && c.header && String(c.header).trim())
            .map((c: any) => ({ db: c.db as 'id' | 'carrier_code', header: String(c.header).trim() }));
        if (codeChain.length === 0) return null;
        return { codeChain, dateHeader: String(parsed.date_header).trim() };
    } catch {
        return null;
    }
}

type OrderMaps = {
    idMap: Map<string, string>,
    carrierMap: Map<string, string>,
    existingDataMap: Map<string, { carrier_date: string | null, printed_at: string | null }>,
};

async function processSheet(opts: {
    supabase: any,
    label: string,
    sheetUrl: string | undefined,
    gid: string,
    dateField: 'carrier_date' | 'printed_at',
    mapConfig: ReturnType<typeof parseMapConfig>,
    maps: OrderMaps,
    privileged: boolean,
}) {
    const { supabase, label, sheetUrl, gid, dateField, mapConfig, maps, privileged } = opts;
    if (!sheetUrl) return { skipped: true, reason: 'Chưa cấu hình link sheet' };
    const sheetId = extractSheetId(sheetUrl);
    if (!sheetId) return { skipped: true, reason: 'Link sheet không trích được sheet id' };

    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid || '0'}`;
    const res = await fetch(csvUrl);
    const csvText = await res.text();

    if (csvText.includes('<!DOCTYPE html>') || csvText.includes('<html')) {
        throw new Error(`File Sheet '${label}' chưa mở công khai quyền xem!`);
    }

    // Parse dạng mảng (header: false) để giữ đúng số dòng của sheet:
    // hàng 1 = tiêu đề, hàng 2 trở đi = dữ liệu. Papa header:true sẽ
    // làm mất số dòng gốc khi có dòng trống bị skip.
    const parsed = Papa.parse(csvText, { header: false, skipEmptyLines: false });
    const rows = (parsed.data as any[][]) || [];
    if (rows.length === 0) {
        return { total_rows_parsed: 0, matched: 0, skipped_not_found: 0, final_unique_updated: 0 };
    }
    const headerRow = rows[0].map((c: any) => String(c ?? ''));
    const headerIndex = new Map<string, number>();
    headerRow.forEach((h: string, idx: number) => {
        const n = normHeader(h);
        if (n && !headerIndex.has(n)) headerIndex.set(n, idx);
    });

    // Xác định cột mã + cột ngày.
    // Có map: dùng đúng map. Không có map: cách cũ.
    let codeColumns: { db: 'id' | 'carrier_code', col: number, header: string }[] = [];
    let dateCol = -1;
    let missingHeaders: string[] = [];
    if (mapConfig) {
        for (const entry of mapConfig.codeChain) {
            const col = headerIndex.get(normHeader(entry.header));
            if (col === undefined) missingHeaders.push(entry.header);
            else codeColumns.push({ db: entry.db, col, header: entry.header });
        }
        const dc = headerIndex.get(normHeader(mapConfig.dateHeader));
        if (dc === undefined) missingHeaders.push(mapConfig.dateHeader);
        else dateCol = dc;
        if (missingHeaders.length > 0) {
            throw new Error(`Sheet '${label}' thiếu tiêu đề ở hàng 1: ${missingHeaders.join(', ')}. Kiểm tra lại cấu hình cột.`);
        }
    } else {
        const legacyCodeHeaders = ['mã vận đơn', 'mã đơn hàng', 'mã đơn'];
        const foundCode = legacyCodeHeaders.map(h => headerIndex.get(h)).find(c => c !== undefined);
        const dc = headerIndex.get('ngày');
        if (foundCode === undefined || dc === undefined) {
            throw new Error(`Sheet '${label}' thiếu cột mã đơn hoặc cột "ngày" ở hàng 1.`);
        }
        // Cách cũ: 1 cột mã, thử mã vận đơn trước rồi tới ID.
        codeColumns = [
            { db: 'carrier_code', col: foundCode, header: headerRow[foundCode] },
            { db: 'id', col: foundCode, header: headerRow[foundCode] },
        ];
        dateCol = dc;
    }

    const updatesRows: { targetOrderId: string, date: string }[] = [];
    const missing: any[] = [];
    const conflicts: any[] = [];
    let countIdMatch = 0;
    let countCarrierMatch = 0;
    let countSkipped = 0;
    let countNotFound = 0;
    let countInvalidDate = 0;
    let countEmpty = 0;
    let dataRows = 0;

    for (let r = 1; r < rows.length; r++) {
        const row = rows[r] || [];
        const sheetRowNumber = r + 1; // hàng 1 là tiêu đề nên dữ liệu bắt đầu ở hàng 2
        const cell = (col: number) => String(row[col] ?? '').trim();
        const codeValues = codeColumns.map(cc => ({
            db: cc.db, header: cc.header, raw: cell(cc.col), cleaned: cleanCode(cell(cc.col)),
        }));
        const hasAnyCode = codeValues.some(v => v.cleaned);
        const dateRaw = cell(dateCol);
        const validDate = parseVietnameseDate(dateRaw);
        const allEmpty = !hasAnyCode && !dateRaw;
        if (allEmpty) { countEmpty++; continue; }
        dataRows++;

        if (!hasAnyCode || !validDate) {
            // Không tính vào "không tìm thấy": dòng này thiếu mã hoặc thiếu
            // ngày hợp lệ nên không thể cập nhật, khác với mã có nhưng DB không có.
            if (!validDate) countInvalidDate++;
            countSkipped++;
            continue;
        }

        // Thử theo đúng thứ tự code_chain đã cấu hình.
        let targetOrderId: string | null = null;
        let matchedVia: string | null = null;
        const matchedOrders = new Map<string, string>(); // orderId -> db field đã khớp
        for (const v of codeValues) {
            if (!v.cleaned) continue;
            const hit = v.db === 'id' ? maps.idMap.get(v.cleaned) : maps.carrierMap.get(v.cleaned);
            if (hit) {
                matchedOrders.set(hit, v.db);
                if (!targetOrderId) { targetOrderId = hit; matchedVia = v.db; }
            }
        }
        if (matchedOrders.size > 1) {
            // Cột A khớp đơn này, cột B lại khớp đơn khác: ưu tiên cột
            // đứng trước nhưng ghi lại để owner/super_admin kiểm tra.
            conflicts.push({
                sheet_row: sheetRowNumber,
                codes: codeValues.map(v => ({ db: v.db, header: v.header, raw: v.raw })),
                date_raw: dateRaw,
                matched_orders: Array.from(matchedOrders.entries()).map(([orderId, db]) => ({ order_id: orderId, via: db })),
                chosen_order_id: targetOrderId,
            });
        }

        if (targetOrderId) {
            if (matchedVia === 'id') countIdMatch++; else countCarrierMatch++;
            updatesRows.push({ targetOrderId, date: validDate });
        } else {
            countSkipped++;
            countNotFound++;
            if (privileged) {
                missing.push({
                    sheet_row: sheetRowNumber,
                    codes: codeValues.map(v => ({ db: v.db, header: v.header, raw: v.raw, cleaned: v.cleaned })),
                    date_raw: dateRaw,
                });
            }
        }
    }

    updatesRows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const updatesMap = new Map<string, string>();
    updatesRows.forEach(item => updatesMap.set(item.targetOrderId, item.date));

    const upsertBody: any[] = [];
    for (const [id, newDateISO] of updatesMap.entries()) {
        const currentData = maps.existingDataMap.get(id);
        const newDateStr = getSafeDateStr(newDateISO);
        const currDateStr = getSafeDateStr(currentData ? (currentData as any)[dateField] : null);
        if (newDateStr !== currDateStr) {
            upsertBody.push({ id, [dateField]: newDateISO });
        }
    }

    if (upsertBody.length > 0) {
        await supabase.from('orders').upsert(upsertBody, { onConflict: 'id' });
    }

    return {
        total_rows_parsed: dataRows,
        matched: countIdMatch + countCarrierMatch,
        matched_by_id: countIdMatch,
        matched_by_carrier: countCarrierMatch,
        // Chỉ đếm dòng có mã + ngày hợp lệ nhưng DB không có đơn.
        // Dòng thiếu mã hoặc ngày không hợp lệ tính riêng, không tính vào đây.
        skipped_not_found: countNotFound,
        skipped_invalid_date: countInvalidDate,
        skipped_empty_rows: countEmpty,
        filtered_out_no_changes: updatesMap.size - upsertBody.length,
        final_unique_updated: upsertBody.length,
        missing_count: countNotFound,
        // Chỉ trả danh sách đầy đủ cho owner / super_admin (privileged).
        // Người gọi khác nhận mảng rỗng nhưng vẫn có missing_count.
        missing: privileged ? missing : [],
        conflicts: privileged ? conflicts : [],
    };
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Loại quét: body có thể rỗng (lời gọi cũ) -> "both".
        let reqType: string = 'both';
        try {
            const body = await req.clone().json();
            if (body && (body.type === 'daily' || body.type === 'print' || body.type === 'both')) reqType = body.type;
        } catch { /* body rỗng hoặc không phải JSON: giữ "both" */ }

        // Quyền xem log đầy đủ: chỉ owner / super_admin.
        // Lấy JWT của người gọi (nếu có) và kiểm tra qua auth.getUser.
        // Không có token hoặc kiểm tra lỗi -> vẫn cho quét, chỉ không trả log.
        let privileged = false;
        const authHeader = req.headers.get('authorization') || '';
        const token = authHeader.replace(/^Bearer\s+/i, '').trim();
        if (token && token !== supabaseServiceKey) {
            try {
                const { data: userData } = await supabase.auth.getUser(token);
                const user = userData?.user as any;
                if (user) {
                    // Owner được nhận diện giống Admin.jsx: user_metadata.is_owner
                    // (true hoặc 'true') hoặc email super owner. Super admin là
                    // user_metadata.role = 'super_admin' (cùng cách roles.js dùng).
                    const meta = user.user_metadata || {};
                    const appMeta = (user as any).app_metadata || {};
                    const role = meta.role || appMeta.role;
                    if (user.email === SUPER_OWNER_EMAIL || meta.is_owner === true || meta.is_owner === 'true' || role === 'super_admin') {
                        privileged = true;
                    }
                    // Admin thường quét vẫn chạy, chỉ không thấy log mã.
                }
            } catch { /* giữ privileged = false, quét vẫn chạy */ }
        }

        const pastDaysAgo = new Date();
        pastDaysAgo.setDate(pastDaysAgo.getDate() - 120);
        const dateLimitStr = pastDaysAgo.toISOString();

        const { data: configs } = await supabase.from('system_configs').select('*').in('key', [
            'sheet_daily_url', 'sheet_daily_gid',
            'sheet_print_url', 'sheet_print_gid',
            'sheet_daily_map', 'sheet_print_map'
        ]);

        const configMap: Record<string, string> = {};
        configs?.forEach(c => configMap[c.key] = c.value);

        let allRecentOrders: any[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data: chunk, error: chunkError } = await supabase
                .from('orders')
                .select('id, carrier_code, carrier_date, printed_at')
                .gte('created_at', dateLimitStr)
                .order('created_at', { ascending: false })
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (chunkError) throw chunkError;

            if (!chunk || chunk.length === 0) {
                hasMore = false;
            } else {
                allRecentOrders = [...allRecentOrders, ...chunk];
                if (chunk.length < pageSize) {
                    hasMore = false;
                } else {
                    page++;
                }
            }
        }

        const carrierCodeToIdMap = new Map<string, string>();
        const systemOrderIdMap = new Map<string, string>();
        const existingDataMap = new Map<string, { carrier_date: string | null, printed_at: string | null }>();

        allRecentOrders.forEach(o => {
            const originalId = o.id;
            const cleanId = cleanCode(originalId);
            systemOrderIdMap.set(cleanId, originalId);
            existingDataMap.set(originalId, {
                carrier_date: o.carrier_date,
                printed_at: o.printed_at
            });
            if (o.carrier_code) {
                const safeCarrier = cleanCode(o.carrier_code);
                if (safeCarrier) {
                    carrierCodeToIdMap.set(safeCarrier, originalId);
                }
            }
        });

        const maps: OrderMaps = { idMap: systemOrderIdMap, carrierMap: carrierCodeToIdMap, existingDataMap };

        const debugSummary: any = {
            supabase_total_orders_120d: systemOrderIdMap.size,
            requested_type: reqType,
            missing_log_privileged: privileged,
            daily_sheet: {},
            print_sheet: {}
        };

        const nowIso = new Date().toISOString();
        const markScanned = async (key: string) => {
            try { await supabase.from('system_configs').upsert({ key, value: nowIso }, { onConflict: 'key' }); } catch { /* không chặn kết quả quét */ }
        };

        // Quét từng sheet được chọn. Sheet lỗi thì ghi lỗi riêng cho sheet
        // đó, vẫn tiếp tục sheet còn lại khi type = "both" (khác cách cũ
        // là lỗi sheet đơn đi sẽ chặn luôn sheet đơn in).
        if (reqType === 'daily' || reqType === 'both') {
            try {
                debugSummary.daily_sheet = await processSheet({
                    supabase, label: 'Đơn Đi', sheetUrl: configMap['sheet_daily_url'],
                    gid: configMap['sheet_daily_gid'] || '0', dateField: 'carrier_date',
                    mapConfig: parseMapConfig(configMap['sheet_daily_map']), maps, privileged,
                });
                await markScanned('sheet_daily_last_scan_at');
            } catch (e: any) {
                debugSummary.daily_sheet = { error: e.message };
            }
        }
        if (reqType === 'print' || reqType === 'both') {
            try {
                debugSummary.print_sheet = await processSheet({
                    supabase, label: 'Đơn In', sheetUrl: configMap['sheet_print_url'],
                    gid: configMap['sheet_print_gid'] || '0', dateField: 'printed_at',
                    mapConfig: parseMapConfig(configMap['sheet_print_map']), maps, privileged,
                });
                await markScanned('sheet_print_last_scan_at');
            } catch (e: any) {
                debugSummary.print_sheet = { error: e.message };
            }
        }

        console.log("📊 [DEBUG SUMMARY RESULTS]:", JSON.stringify(debugSummary, null, 2));

        return new Response(JSON.stringify({
            success: true,
            message: "Đồng bộ hoàn tất rực rỡ!",
            debug: debugSummary
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200
        });

    } catch (error: any) {
        console.error("❌ Lỗi hệ thống:", error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500
        });
    }
})
