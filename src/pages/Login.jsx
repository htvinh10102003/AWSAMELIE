import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowLeft,
  ShieldCheck,
  Fingerprint,
  PackageCheck,
  CheckCircle2,
  Box
} from 'lucide-react';

// ✨ COMPONENT ITEM TÍNH NĂNG
function FeatureItem({ text }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 flex-shrink-0 bg-orange-500/20 p-1 rounded-full">
        <CheckCircle2 size={16} className="text-orange-400" />
      </div>
      <p className="text-slate-200 font-medium leading-relaxed">{text}</p>
    </div>
  );
}

export default function Login() {
  // === STATES QUẢN LÝ ĐĂNG NHẬP ===
  const [mode, setMode] = useState('login'); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // === STATES PHẢN HỒI HỆ THỐNG ===
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const navigate = useNavigate();

  // ⚡️ XỬ LÝ ĐĂNG NHẬP
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'Sai tài khoản hoặc mật khẩu!'
          : error.message
      );
    } else {
      navigate('/admin');
    }
    setLoading(false);
  };

  // ⚡️ XỬ LÝ QUÊN MẬT KHẨU
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    const { error } = await supabase.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/admin`,
    });

    if (error) {
      setError(`Lỗi gửi mail: ${error.message}`);
    } else {
      setMessage('✅ Đã gửi link đặt lại mật khẩu!');
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen w-full bg-slate-50 font-sans antialiased overflow-hidden selection:bg-orange-500/30">
      
      {/* ================= PHẦN TRÁI: HÌNH ẢNH & GIỚI THIỆU (BRANDING) ================= */}
      <div className="hidden lg:flex relative w-1/2 flex-col justify-between overflow-hidden">
        
        {/* Ảnh nền tĩnh - Ảnh nhà kho chất lượng cao */}
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=2070&auto=format&fit=crop')" }}
        />
        
        {/* Overlay gradient tối kết hợp màu Cam đậm để dễ đọc chữ */}
        <div className="absolute inset-0 z-10 bg-gradient-to-br from-slate-900/95 via-slate-900/80 to-orange-950/90" />

        <div className="relative z-20 flex flex-col pt-12 px-12 xl:px-16">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-20">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg shadow-orange-500/30">
              <PackageCheck size={24} className="text-white" />
            </div>
            <span className="text-2xl font-black text-white tracking-wider">AMELIE WMS</span>
          </div>

          <h1 className="text-4xl xl:text-5xl font-black text-white leading-tight tracking-tight mb-6">
            Kiểm soát kho vận <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-300">
              Toàn diện & Chính xác
            </span>
          </h1>
          
          <p className="text-lg text-slate-300 max-w-lg leading-relaxed mb-10">
            Hệ thống quản trị kho nội bộ, đồng bộ dữ liệu thời gian thực và tự động hóa quy trình nghiệp vụ cho doanh nghiệp.
          </p>
          
          <div className="space-y-6 max-w-md">
            <FeatureItem text="Tích hợp API Nhanh.vn, tự động đồng bộ đơn hàng và tồn kho." />
            <FeatureItem text="Quản lý nhập - xuất - tồn, quản lý đơn in, đơn đi, đơn trả" />
            <FeatureItem text="Báo cáo thống kê, kiểm kê hàng hóa, tốc độ đóng gói." />
          </div>
        </div>

        <div className="relative z-20 text-sm text-slate-400 font-medium pb-8 px-12 xl:px-16 flex items-center justify-between">
          <span>© {new Date().getFullYear()} Amelie WMS Team.</span>
          <div className="flex gap-4">
            <a href="#" className="hover:text-white transition-colors">Bảo mật</a>
            <a href="mailto:contact.hotavinh@gmail.com" className="hover:text-white transition-colors">Hỗ trợ</a>
          </div>
        </div>
      </div>

      {/* ================= PHẦN PHẢI: FORM ĐĂNG NHẬP ================= */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-6 sm:p-12 relative bg-white lg:bg-slate-50">
        
        {/* Background Bubbles (Đốm sáng Cam mờ) */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-orange-500/10 blur-[100px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-amber-500/10 blur-[100px]" />
        </div>

        {/* Card Đăng nhập */}
        <div className="relative z-10 w-full max-w-[420px]">
          
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 sm:p-10 shadow-2xl shadow-slate-200/50 border border-white transition-all lg:shadow-xl lg:shadow-slate-300/40">
            
            {mode === 'login' ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-8">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-orange-600 mb-4 lg:hidden">
                    <Box size={24} />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-900">
                    Chào mừng trở lại!
                  </h2>
                  <p className="mt-2 text-sm font-medium text-slate-500">
                    Vui lòng đăng nhập để truy cập hệ thống WMS.
                  </p>
                </div>

                {error && (
                  <div className="mb-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm font-semibold text-red-600 animate-shake">
                    ⚠️ {error}
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-5">
                  {/* Email */}
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                      Tài khoản Email
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (error) setError('');
                        }}
                        placeholder="hotavinh@gmail.com"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10"
                      />
                      <Mail
                        size={18}
                        className="absolute left-4 top-3.5 text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Mật khẩu */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                        Mật khẩu
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('forgot');
                          setError('');
                          setMessage('');
                        }}
                        className="text-xs font-bold text-orange-600 transition hover:text-orange-700 hover:underline"
                      >
                        Quên mật khẩu?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (error) setError('');
                        }}
                        placeholder="••••••••"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-11 text-sm font-semibold text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10"
                      />
                      <Lock
                        size={18}
                        className="absolute left-4 top-3.5 text-slate-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-3.5 text-slate-400 transition hover:text-slate-600"
                      >
                        {showPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Ghi nhớ đăng nhập */}
                  <div className="flex items-center pt-1">
                    <label className="flex cursor-pointer select-none items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                      />
                      Duy trì đăng nhập
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition-all hover:shadow-orange-500/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {loading ? (
                      'Đang xác thực...'
                    ) : (
                      <>
                        <Fingerprint size={18} />
                        Đăng nhập
                      </>
                    )}
                  </button>
                </form>
              </div>
            ) : (
              /* Giao diện quên mật khẩu */
              <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="mb-8">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError('');
                      setMessage('');
                    }}
                    className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 transition hover:text-slate-900"
                  >
                    <ArrowLeft size={14} /> Quay lại đăng nhập
                  </button>
                </div>

                <div className="mb-8 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/30">
                    <ShieldCheck size={28} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-900">
                    Khôi phục truy cập
                  </h2>
                  <p className="mt-2 text-sm font-medium text-slate-500 px-4">
                    Nhập email của bạn, chúng tôi sẽ gửi liên kết để đặt lại mật khẩu.
                  </p>
                </div>

                {error && (
                  <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm font-semibold text-red-600">
                    ⚠️ {error}
                  </div>
                )}
                {message && (
                  <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-3.5 text-sm font-semibold text-green-600">
                    {message}
                  </div>
                )}

                <form onSubmit={handleForgotPassword} className="space-y-5">
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                      Email doanh nghiệp
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (error) setError('');
                        }}
                        placeholder="admin@amelie.com"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10"
                      />
                      <Mail
                        size={18}
                        className="absolute left-4 top-3.5 text-slate-400"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition-all hover:shadow-orange-500/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {loading ? 'Đang gửi yêu cầu...' : 'Nhận liên kết khôi phục'}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Link phiên bản cũ */}
          <div className="mt-8 text-center relative z-10">
            <a
              href="https://htvinh10102003.github.io/ameliebaocaokho/"
              className="text-xs font-bold text-slate-400 transition-colors hover:text-orange-600"
            >
              Chuyển sang phiên bản cũ (Legacy)
            </a>
          </div>
        </div>
      </div>

      {/* Animation CSS (Lắc nhẹ khi lỗi) */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
}