import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Lock, Mail, Eye, EyeOff, ArrowLeft, ShieldCheck } from 'lucide-react';

export default function Login() {
    // === STATES QUẢN LÝ ĐĂNG NHẬP ===
    const [mode, setMode] = useState('login'); // 'login' hoặc 'forgot'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false); // Ẩn/hiện pass
    const [rememberMe, setRememberMe] = useState(false);
    
    // === STATES PHẢN HỒI HỆ THỐNG ===
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    
    const navigate = useNavigate();

    // ⚡️ XỬ LÝ ĐĂNG NHẬP TÀI KHOẢN
    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            setError(error.message === 'Invalid login credentials' ? 'Sai tài khoản hoặc mật khẩu!' : error.message);
        } else {
            navigate('/admin');
        }
        setLoading(false);
    };

    // ⚡️ XỬ LÝ GỬI EMAIL KHÔI PHỤC MẬT KHẨU
    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/admin`, // Điểm hướng sau khi họ bấm link trong mail
        });

        if (error) {
            setError(`Lỗi gửi mail: ${error.message}`);
        } else {
            setMessage('✅ Đã gửi link đặt lại mật khẩu!');
        }
        setLoading(false);
    };

    return (
        <div className="h-screen w-screen flex items-center justify-center bg-slate-50 font-sans antialiased text-slate-800 relative overflow-hidden">
            {/* Hiệu ứng mờ background cho sang xịn mịn */}
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />

            <div className="w-full max-w-md p-8 bg-white rounded-2xl border border-slate-200 shadow-2xl relative z-10 transition-all">
                
                {/* 1. GIAO DIỆN ĐĂNG NHẬP CHUẨN FORM */}
                {mode === 'login' ? (
                    <>
                        <div className="text-center mb-8">
                            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-600/30 mx-auto mb-3">
                                AM
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Hệ thống WMS</h2>
                            <p className="text-sm text-slate-400 font-medium mt-1">Đăng nhập để vào khu vực Quản trị viên</p>
                        </div>

                        {error && <div className="p-3 mb-4 text-xs font-bold text-red-700 bg-red-50 rounded-xl border border-red-200 animate-shake">⚠️ {error}</div>}

                        <form onSubmit={handleLogin} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Email</label>
                                <div className="relative">
                                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="vinh12345@gmail.com" className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 font-semibold transition" />
                                    <Mail size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Mật khẩu</label>
                                    {/* NÚT QUÊN MẬT KHẨU */}
                                    <button type="button" onClick={() => { setMode('forgot'); setError(''); setMessage(''); }} className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline transition">
                                        Quên mật khẩu?
                                    </button>
                                </div>
                                <div className="relative">
                                    <input type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full pl-10 pr-10 py-2.5 text-sm border border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 font-semibold transition" />
                                    <Lock size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                                    
                                    {/* ⚡️ NÚT ẨN HIỆN MẬT KHẨU KHƯ KHƯ */}
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition">
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-1">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer select-none">
                                    <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} className="w-4 h-4 text-blue-600 border-slate-300 rounded-lg focus:ring-blue-500 cursor-pointer" />
                                    Duy trì đăng nhập
                                </label>
                            </div>

                            <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xl shadow-blue-600/20 hover:shadow-blue-600/30 transition-all disabled:opacity-50 mt-2 flex items-center justify-center gap-2">
                                {loading ? 'Đang xác thực dữ liệu...' : 'Đăng nhập vận hành'}
                            </button>
                        </form>
                    </>
                ) : (
                    // 2. GIAO DIỆN QUÊN MẬT KHẨU (NẰM TRONG 1 FILE)
                    <>
                        <div className="mb-6">
                            <button type="button" onClick={() => { setMode('login'); setError(''); setMessage(''); }} className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition">
                                <ArrowLeft size={14} /> Quay lại đăng nhập
                            </button>
                        </div>

                        <div className="text-center mb-6">
                            <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/30 mx-auto mb-3">
                                <ShieldCheck size={24} />
                            </div>
                            <h2 className="text-xl font-black text-slate-900 tracking-tight">Khôi phục mật khẩu</h2>
                            <p className="text-xs text-slate-400 font-medium mt-1">Hệ thống sẽ gửi một liên kết đổi mật khẩu bảo mật tới email.</p>
                        </div>

                        {error && <div className="p-3 mb-4 text-xs font-bold text-red-700 bg-red-50 rounded-xl border border-red-200">⚠️ {error}</div>}
                        {message && <div className="p-3 mb-4 text-xs font-bold text-green-700 bg-green-50 rounded-xl border border-green-200">{message}</div>}

                        <form onSubmit={handleForgotPassword} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Nhập Email tài khoản</label>
                                <div className="relative">
                                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="vinh12345@gmail.com" className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 font-semibold transition" />
                                    <Mail size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                                </div>
                            </div>

                            <button type="submit" disabled={loading} className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold shadow-xl shadow-amber-500/20 hover:shadow-amber-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                                {loading ? 'Đang gửi yêu cầu...' : 'Gửi liên kết khôi phục'}
                            </button>
                        </form>
                    </>
                )}

                {/* 🆕 DÙNG PHIÊN BẢN CŨ – ĐẶT Ở CUỐI CARD */}
                <div className="mt-6 pt-4 border-t border-gray-100/70 text-center">
                    <a href="https://htvinh10102003.github.io/ameliebaocaokho/" className="text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors">Dùng phiên bản cũ</a>
                </div>
            </div>
        </div>
    );
}