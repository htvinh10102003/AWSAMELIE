// Tiện ích dùng chung cho tìm kiếm theo danh sách ID đơn / mã vận đơn:
// - parseIdList: tách mã dán vào (mỗi dòng 1 mã; chấp nhận cả dấu phẩy /
//   chấm phẩy / tab khi dán từ Excel), bỏ dòng trống + mã trùng (không
//   phân biệt hoa/thường), giới hạn tối đa `max` mã, giữ nguyên thứ tự
//   dán. Trả { list: [{raw, upper}], total } với total là số mã riêng
//   biệt trước khi giới hạn.
// - sortRowsByPastedOrder: xếp các đơn khớp theo đúng thứ tự mã đã dán
//   (khớp theo mã vận đơn trước, rồi tới ID đơn); đơn không khớp mã nào
//   xếp cuối.
export const parseIdList = (text, max = 200) => {
    const seen = new Set();
    const all = [];
    String(text || '').split(/[\n\r\t,;]+/).forEach((part) => {
        const raw = part.trim();
        if (!raw) return;
        const upper = raw.toUpperCase();
        if (seen.has(upper)) return;
        seen.add(upper);
        all.push({ raw, upper });
    });
    return { list: all.slice(0, max), total: all.length };
};

export const sortRowsByPastedOrder = (rows, codes) => {
    const codeIndex = new Map();
    codes.forEach((c, idx) => { if (!codeIndex.has(c.upper)) codeIndex.set(c.upper, idx); });
    const rowIndex = (o) => {
        const byCarrier = o.carrier_code ? codeIndex.get(String(o.carrier_code).toUpperCase()) : undefined;
        if (byCarrier !== undefined) return byCarrier;
        const byId = codeIndex.get(String(o.id).toUpperCase());
        return byId !== undefined ? byId : codes.length;
    };
    return [...rows].sort((a, b) => rowIndex(a) - rowIndex(b));
};
