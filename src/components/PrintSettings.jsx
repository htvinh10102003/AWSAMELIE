// Mục Cài đặt in trong Admin: thông tin người gửi + 3 mẫu bill tùy chỉnh.
// Chỉ owner/super_admin thấy được mục này (Admin bọc bằng
// canEditSensitiveConfig giống các link Nhanh, link Sheet).
import { useState, useEffect } from 'react';
import { Printer, Loader2, CheckCircle2 } from 'lucide-react';
import BillTemplateBuilder from './BillTemplateBuilder';
import {
    TEMPLATE_TYPES, DEFAULT_TEMPLATES, loadPrintSettings,
    savePrintSender, savePrintTemplate,
} from '../lib/billTemplates';

const clone = (o) => JSON.parse(JSON.stringify(o));

export default function PrintSettings() {
    const [loading, setLoading] = useState(true);
    const [sender, setSender] = useState(null);
    const [templates, setTemplates] = useState(null);
    const [activeType, setActiveType] = useState('a4');
    const [senderMsg, setSenderMsg] = useState('');
    const [templateMsg, setTemplateMsg] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let alive = true;
        loadPrintSettings().then(({ sender: s, templates: t }) => {
            if (!alive) return;
            setSender(s);
            setTemplates(t);
            setLoading(false);
        }).catch(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, []);

    if (loading) return <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> Đang tải cài đặt in...</p>;
    if (!sender || !templates) return <p className="text-sm text-red-600">Không tải được cài đặt in. Thử tải lại trang.</p>;

    const handleSaveSender = async () => {
        setSaving(true); setSenderMsg('');
        try { await savePrintSender(sender); setSenderMsg('Đã lưu thông tin người gửi.'); }
        catch (e) { setSenderMsg('Lỗi: ' + e.message); }
        setSaving(false);
    };
    const handleSaveTemplate = async () => {
        setSaving(true); setTemplateMsg('');
        try {
            const saved = await savePrintTemplate(activeType, templates[activeType]);
            setTemplates(prev => ({ ...prev, [activeType]: saved }));
            setTemplateMsg('Đã lưu mẫu bill.');
        } catch (e) { setTemplateMsg('Lỗi: ' + e.message); }
        setSaving(false);
    };
    const handleResetTemplate = () => {
        setTemplates(prev => ({ ...prev, [activeType]: clone(DEFAULT_TEMPLATES[activeType]) }));
        setTemplateMsg('Đã về mẫu mặc định. Bấm Lưu mẫu để ghi đè mẫu đang lưu.');
    };

    const inputCls = 'w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium transition';

    return (
        <div className="space-y-8">
            <div>
                <h3 className="text-sm font-bold text-slate-800 mb-4">Thông tin người gửi (in trên bill)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Tên doanh nghiệp / người gửi</label>
                        <input value={sender.name || ''} onChange={(e) => setSender({ ...sender, name: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Số điện thoại</label>
                        <input value={sender.phone || ''} onChange={(e) => setSender({ ...sender, phone: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Địa chỉ</label>
                        <input value={sender.address || ''} onChange={(e) => setSender({ ...sender, address: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Quận / huyện, tỉnh</label>
                        <input value={sender.district || ''} onChange={(e) => setSender({ ...sender, district: e.target.value })} className={inputCls} />
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Link logo (tùy chọn, để trống thì bill không hiện logo)</label>
                        <input value={sender.logoUrl || ''} onChange={(e) => setSender({ ...sender, logoUrl: e.target.value })} placeholder="https://..." className={inputCls} />
                    </div>
                </div>
                <div className="flex items-center gap-3 mt-4">
                    <button onClick={handleSaveSender} disabled={saving} className="px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800 disabled:opacity-50">Lưu thông tin người gửi</button>
                    {senderMsg && <span className="text-sm font-medium text-slate-700 flex items-center gap-1"><CheckCircle2 size={15} /> {senderMsg}</span>}
                </div>
            </div>

            <div className="border-t border-slate-200 pt-6">
                <h3 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2"><Printer size={16} /> Mẫu bill</h3>
                <p className="text-xs text-slate-500 mb-4">Mỗi loại bill có 1 mẫu riêng. Kéo-thả khối để xếp bill, hoặc dán code HTML kiểu Nhanh vào tab Dán code. Bấm Lưu mẫu mới ghi nhận thay đổi.</p>
                <div className="flex flex-wrap gap-2 mb-4">
                    {TEMPLATE_TYPES.map(t => (
                        <button key={t.id} onClick={() => { setActiveType(t.id); setTemplateMsg(''); }} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeType === t.id ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'}`}>{t.label}</button>
                    ))}
                </div>
                <BillTemplateBuilder
                    key={activeType}
                    initial={templates[activeType]}
                    onChange={(t) => setTemplates(prev => ({ ...prev, [activeType]: t }))}
                />
                <div className="flex flex-wrap items-center gap-3 mt-4">
                    <button onClick={handleSaveTemplate} disabled={saving} className="px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800 disabled:opacity-50">Lưu mẫu này</button>
                    <button onClick={handleResetTemplate} className="px-4 py-2 bg-white border border-slate-300 text-sm font-bold rounded-lg text-slate-700 hover:bg-slate-50">Về mẫu mặc định</button>
                    {templateMsg && <span className="text-sm font-medium text-slate-700 flex items-center gap-1"><CheckCircle2 size={15} /> {templateMsg}</span>}
                </div>
            </div>
        </div>
    );
}
