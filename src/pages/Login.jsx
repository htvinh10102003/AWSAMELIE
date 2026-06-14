import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Lock, Mail } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            setError(error.message === 'Invalid login credentials' ? 'Sai tài khoản hoặc mật khẩu ông ơi!' : error.message);
        } else {
            navigate('/admin'); // Đăng nhập chuẩn chỉ thì cho vào Admin luôn
        }
        setLoading(false);
    };

    return (
        <div className="h-screen w-screen flex items-center justify-center bg-slate-50 font-sans text-slate-800">
            <div className="w-full max-w-md p-8 bg-white rounded-2xl border border-slate-200 shadow-xl">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-black text-slate-900">Hệ thống WMS Amelie</h2>
                    <p className="text-sm text-slate-500 mt-1">Đăng nhập để vào khu vực Quản trị viên</p>
                </div>

                {error && (
                    <div className="p-3 mb-4 text-sm font-bold text-red-700 bg-red-50 rounded-lg border border-red-200">
                        ⚠️ {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Email</label>
                        <div className="relative">
                            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="vinh@example.com" className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-semibold"/>
                            <Mail size={16} className="absolute left-3 top-3.5 text-slate-400" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Mật khẩu</label>
                        <div className="relative">
                            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-semibold"/>
                            <Lock size={16} className="absolute left-3 top-3.5 text-slate-400" />
                        </div>
                    </div>

                    <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-lg shadow-blue-600/20 transition disabled:opacity-50 mt-2">
                        {loading ? 'Đang xác thực...' : 'Đăng nhập ngay'}
                    </button>
                </form>
            </div>
        </div>
    );
}