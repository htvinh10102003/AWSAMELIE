// Trình sửa mẫu bill: kéo-thả khối xếp dọc + dán code HTML + xem trước.
// Mẫu lưu dạng { mode, blocks, html }; lúc in luôn vẽ từ html.
// Sửa khối -> sinh lại html, mode 'builder'. Sửa code -> mode 'code'.
// Quay lại builder sẽ sinh lại html từ blocks (code đã sửa sẽ mất).
import { useState, useRef, useEffect } from 'react';
import { GripVertical, Trash2, ArrowUp, ArrowDown, Plus } from 'lucide-react';
import {
    BLOCK_TYPES, PLACEHOLDERS, PLACEHOLDER_GROUPS, newBlock, blocksToHtml,
    renderBillHtml, SAMPLE_BILL_DATA,
} from '../lib/billTemplates';

const PRODUCT_COL_OPTIONS = [
    { id: 'name', label: 'Tên SP' },
    { id: 'qty', label: 'SL' },
    { id: 'price', label: 'Giá' },
    { id: 'location', label: 'Vị trí' },
];

export default function BillTemplateBuilder({ initial, onChange }) {
    const [draft, setDraft] = useState(initial);
    const [tab, setTab] = useState('builder');
    const [previewHtml, setPreviewHtml] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const dragId = useRef(null);
    const [overId, setOverId] = useState(null);
    const textRefs = useRef({});

    const update = (next) => {
        setDraft(next);
        if (onChange) onChange(next);
    };
    const updateBlocks = (blocks) => update({ mode: 'builder', blocks, html: blocksToHtml(blocks) });
    const patchBlock = (id, patch) => updateBlocks(draft.blocks.map(b => (b.id === id ? { ...b, ...patch } : b)));
    const addBlock = (type) => updateBlocks([...draft.blocks, newBlock(type)]);
    const removeBlock = (id) => updateBlocks(draft.blocks.filter(b => b.id !== id));
    const moveBlock = (id, dir) => {
        const idx = draft.blocks.findIndex(b => b.id === id);
        const next = [...draft.blocks];
        const j = idx + dir;
        if (idx < 0 || j < 0 || j >= next.length) return;
        [next[idx], next[j]] = [next[j], next[idx]];
        updateBlocks(next);
    };
    const dropBlock = (targetId) => {
        const from = draft.blocks.findIndex(b => b.id === dragId.current);
        const to = draft.blocks.findIndex(b => b.id === targetId);
        if (from < 0 || to < 0 || from === to) return;
        const next = [...draft.blocks];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        updateBlocks(next);
        dragId.current = null;
        setOverId(null);
    };
    const insertPlaceholder = (blockId, key) => {
        const ta = textRefs.current[blockId];
        const block = draft.blocks.find(b => b.id === blockId);
        if (!block) return;
        const token = `__${key}__`;
        if (!ta) { patchBlock(blockId, { text: (block.text || '') + token }); return; }
        const start = ta.selectionStart ?? (block.text || '').length;
        const end = ta.selectionEnd ?? start;
        const text = (block.text || '').slice(0, start) + token + (block.text || '').slice(end);
        patchBlock(blockId, { text });
        setTimeout(() => { ta.focus(); ta.setSelectionRange(start + token.length, start + token.length); }, 0);
    };
    const insertCodePlaceholder = (key) => {
        const token = `__${key}__`;
        update({ mode: 'code', blocks: draft.blocks, html: (draft.html || '') + token });
    };

    useEffect(() => {
        if (tab !== 'preview') return;
        let alive = true;
        renderBillHtml(draft.html, SAMPLE_BILL_DATA).then(h => { if (alive) setPreviewHtml(h); });
        return () => { alive = false; };
    }, [tab, draft.html]);

    const blockLabel = (type) => (BLOCK_TYPES.find(t => t.type === type)?.label || type);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setTab('builder')} className={`px-3 py-1.5 rounded-lg text-sm font-bold ${tab === 'builder' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-700'}`}>Kéo thả</button>
                <button onClick={() => setTab('code')} className={`px-3 py-1.5 rounded-lg text-sm font-bold ${tab === 'code' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-700'}`}>Dán code</button>
                <button onClick={() => setTab('preview')} className={`px-3 py-1.5 rounded-lg text-sm font-bold ${tab === 'preview' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-700'}`}>Xem trước</button>
                <span className="text-xs font-medium text-slate-500">Đang dùng: {draft.mode === 'code' ? 'code tùy chỉnh' : 'khối kéo-thả'}</span>
            </div>

            {tab === 'builder' && (
                <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4 items-start">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                        <p className="text-xs font-bold text-slate-500 uppercase">Thêm khối</p>
                        {BLOCK_TYPES.map(t => (
                            <button key={t.type} onClick={() => addBlock(t.type)} className="w-full flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 text-left">
                                <Plus size={14} /> {t.label}
                            </button>
                        ))}
                        <p className="text-xs text-slate-500 pt-1">Kéo tay cầm để đổi thứ tự khối trong bill. Bill xếp khối từ trên xuống dưới.</p>
                    </div>
                    <div className="space-y-2">
                        {draft.blocks.length === 0 && <p className="text-sm text-slate-500">Chưa có khối nào. Thêm khối từ bảng bên trái.</p>}
                        {draft.blocks.map((b) => (
                            <div key={b.id}
                                draggable
                                onDragStart={() => { dragId.current = b.id; }}
                                onDragOver={(e) => { e.preventDefault(); setOverId(b.id); }}
                                onDragLeave={() => setOverId(null)}
                                onDrop={() => dropBlock(b.id)}
                                onClick={() => setSelectedId(b.id)}
                                className={`bg-white border rounded-xl p-3 ${overId === b.id ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200'} ${selectedId === b.id ? 'ring-1 ring-slate-400' : ''}`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <GripVertical size={16} className="text-slate-400 cursor-grab shrink-0" />
                                    <span className="text-sm font-bold text-slate-800 flex-1">{blockLabel(b.type)}</span>
                                    <button title="Lên" onClick={(e) => { e.stopPropagation(); moveBlock(b.id, -1); }} className="p-1 rounded text-slate-400 hover:text-slate-700"><ArrowUp size={14} /></button>
                                    <button title="Xuống" onClick={(e) => { e.stopPropagation(); moveBlock(b.id, 1); }} className="p-1 rounded text-slate-400 hover:text-slate-700"><ArrowDown size={14} /></button>
                                    <button title="Xóa khối" onClick={(e) => { e.stopPropagation(); removeBlock(b.id); }} className="p-1 rounded text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                                </div>
                                {(b.type === 'heading' || b.type === 'text') && (
                                    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                                        <textarea
                                            ref={(el) => { textRefs.current[b.id] = el; }}
                                            value={b.text || ''}
                                            onChange={(e) => patchBlock(b.id, { text: e.target.value })}
                                            rows={2}
                                            placeholder="Nội dung dòng, có thể chèn placeholder bên dưới"
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500"
                                        />
                                        <div className="flex flex-wrap gap-1">
                                            {PLACEHOLDERS.map(p => (
                                                <button key={p.key} title={p.hint} onClick={() => insertPlaceholder(b.id, p.key)} className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-mono text-slate-600 hover:bg-blue-50 hover:text-blue-700">__{p.key}__</button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {(b.type === 'products') && (
                                    <div className="flex flex-wrap items-center gap-3 text-sm" onClick={(e) => e.stopPropagation()}>
                                        {PRODUCT_COL_OPTIONS.map(c => (
                                            <label key={c.id} className="flex items-center gap-1 text-slate-700">
                                                <input type="checkbox" checked={(b.columns || []).includes(c.id)}
                                                    onChange={(e) => {
                                                        const cols = e.target.checked ? [...(b.columns || []), c.id] : (b.columns || []).filter(x => x !== c.id);
                                                        patchBlock(b.id, { columns: cols });
                                                    }} /> {c.label}
                                            </label>
                                        ))}
                                        <label className="flex items-center gap-1 text-slate-700">
                                            <input type="checkbox" checked={b.showHeader !== false} onChange={(e) => patchBlock(b.id, { showHeader: e.target.checked })} /> Hiện tiêu đề cột
                                        </label>
                                    </div>
                                )}
                                {(b.type === 'spacer') && (
                                    <label className="text-sm text-slate-700 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                        Cao (px)
                                        <input type="number" value={b.height || 16} onChange={(e) => patchBlock(b.id, { height: Number(e.target.value) || 16 })} className="w-20 px-2 py-1 border border-slate-300 rounded-lg text-sm outline-none" />
                                    </label>
                                )}
                                {['barcode', 'barcode-id', 'qr'].includes(b.type) && (
                                    <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-700" onClick={(e) => e.stopPropagation()}>
                                        <label className="flex items-center gap-1">Căn
                                            <select value={b.align || 'center'} onChange={(e) => patchBlock(b.id, { align: e.target.value })} className="px-2 py-1 border border-slate-300 rounded-lg text-sm outline-none">
                                                <option value="left">Trái</option>
                                                <option value="center">Giữa</option>
                                                <option value="right">Phải</option>
                                            </select>
                                        </label>
                                    </div>
                                )}
                                {['heading', 'text', 'business', 'sender', 'recipient', 'products', 'totals'].includes(b.type) && (
                                    <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-700" onClick={(e) => e.stopPropagation()}>
                                        <label className="flex items-center gap-1">Cỡ chữ
                                            <input type="number" value={b.fontSize || 14} onChange={(e) => patchBlock(b.id, { fontSize: Number(e.target.value) || 14 })} className="w-16 px-2 py-1 border border-slate-300 rounded-lg text-sm outline-none" />
                                        </label>
                                        <label className="flex items-center gap-1">Căn
                                            <select value={b.align || 'left'} onChange={(e) => patchBlock(b.id, { align: e.target.value })} className="px-2 py-1 border border-slate-300 rounded-lg text-sm outline-none">
                                                <option value="left">Trái</option>
                                                <option value="center">Giữa</option>
                                                <option value="right">Phải</option>
                                            </select>
                                        </label>
                                        <label className="flex items-center gap-1">
                                            <input type="checkbox" checked={!!b.bold} onChange={(e) => patchBlock(b.id, { bold: e.target.checked })} /> Đậm
                                        </label>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {tab === 'code' && (
                <div className="space-y-3">
                    <p className="text-xs text-slate-500">Dán code HTML kiểu Nhanh vào đây. Placeholder dạng __TEN_SP__... sẽ được thay bằng dữ liệu đơn lúc in. Dòng bảng nào chứa placeholder sản phẩm sẽ tự lặp theo từng sản phẩm. Lưu ý: lưu mẫu ở dạng này thì mẫu chuyển sang code tùy chỉnh; muốn quay lại kéo-thả thì bấm nút bên dưới (code đã sửa sẽ mất).</p>
                    <textarea
                        value={draft.html || ''}
                        onChange={(e) => update({ mode: 'code', blocks: draft.blocks, html: e.target.value })}
                        rows={20}
                        spellCheck={false}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono outline-none focus:border-blue-500"
                    />
                    <div className="space-y-2">
                        {PLACEHOLDER_GROUPS.map(g => (
                            <div key={g.id} className="flex flex-wrap items-center gap-1">
                                <span className="text-xs font-bold text-slate-500 w-24 shrink-0">{g.label}:</span>
                                {PLACEHOLDERS.filter(p => p.group === g.id).map(p => (
                                    <button key={p.key} title={p.hint} onClick={() => insertCodePlaceholder(p.key)} className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-mono text-slate-600 hover:bg-blue-50 hover:text-blue-700">__{p.key}__</button>
                                ))}
                            </div>
                        ))}
                    </div>
                    <button onClick={() => update({ mode: 'builder', blocks: draft.blocks, html: blocksToHtml(draft.blocks) })} className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50">Dùng lại khối kéo-thả (bỏ code đã sửa)</button>
                </div>
            )}

            {tab === 'preview' && (
                <div className="space-y-2">
                    <p className="text-xs text-slate-500">Xem trước bằng đơn mẫu (không phải đơn thật). Bấm Lưu mẫu rồi ra ngoài in thử 1 đơn thật để kiểm tra lần cuối.</p>
                    <div className="bg-white border border-slate-300 rounded-xl p-4 overflow-x-auto" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                </div>
            )}
        </div>
    );
}
