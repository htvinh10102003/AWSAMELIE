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
  Cpu,
  CheckCircle2,
  PackageCheck
} from 'lucide-react';

// ✨ LINH VẬT MÈO TRẮNG (CUTE & REALISTIC)
function Mascot({ focusedField, showPassword, error, emailLength }) {
  const isEmail = focusedField === 'email';
  const isPassword = focusedField === 'password';
  const isCovering = isPassword && !showPassword;
  const isPeeking = isPassword && showPassword;
  
  const hasError = !!error && !focusedField;

  const lookX = isEmail ? Math.min(emailLength, 24) * 0.5 - 6 : 0;
  const lookY = isEmail ? 2 : (hasError ? 4 : 0);

  const pupilStyle = {
    transform: `translate(calc(-50% + ${lookX}px), calc(-50% + ${lookY}px))`,
    transition: 'transform 0.1s ease-out'
  };

  return (
    <div className="relative w-32 h-32 transition-transform duration-300 drop-shadow-md">
      
      {/* Bong bóng chat báo lỗi vui nhộn */}
      <div className={`absolute -top-12 left-1/2 -translate-x-1/2 w-max max-w-[200px] text-center bg-red-500 text-white text-xs font-bold py-1.5 px-3 rounded-2xl shadow-lg shadow-red-500/30 transition-all duration-300 z-50 ${hasError ? 'opacity-100 scale-100 animate-bounce' : 'opacity-0 scale-50 pointer-events-none'}`}>
        Meo! Nhập sai rồi... 😿
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rotate-45" />
      </div>

      {/* Tai trái */}
      <div className={`absolute top-0 left-2 w-10 h-10 bg-white border-2 border-slate-200 rounded-xl overflow-hidden origin-bottom-right transition-transform duration-300 z-0
        ${hasError ? '-rotate-[60deg] translate-y-3' : '-rotate-12'}
      `}>
        <div className="absolute bottom-0 right-0 w-6 h-6 bg-pink-200 rounded-tl-full" />
      </div>

      {/* Tai phải */}
      <div className={`absolute top-0 right-2 w-10 h-10 bg-white border-2 border-slate-200 rounded-xl overflow-hidden origin-bottom-left transition-transform duration-300 z-0
        ${hasError ? 'rotate-[60deg] translate-y-3' : 'rotate-12'}
      `}>
        <div className="absolute bottom-0 left-0 w-6 h-6 bg-pink-200 rounded-tr-full" />
      </div>

      {/* Đầu mèo */}
      <div className="absolute inset-0 bg-white rounded-[40%] border-2 border-slate-200 shadow-sm z-10 flex flex-col items-center justify-center pt-2 overflow-hidden">
        
        {/* Mắt */}
        <div className="flex gap-4 mb-2">
          {/* Mắt trái */}
          <div className="w-7 h-7 bg-white rounded-full relative border-2 border-slate-300 overflow-hidden shadow-inner">
            <div 
              className="absolute w-3.5 h-3.5 bg-slate-800 rounded-full top-1/2 left-1/2"
              style={pupilStyle}
            >
              <div className="absolute top-0.5 right-0.5 w-1 h-1 bg-white rounded-full opacity-80" />
            </div>
            <div className={`absolute top-0 left-0 w-full bg-slate-100 transition-all duration-300 ${hasError ? 'h-3 opacity-100' : 'h-0 opacity-0'}`} />
          </div>
          
          {/* Mắt phải */}
          <div className="w-7 h-7 bg-white rounded-full relative border-2 border-slate-300 overflow-hidden shadow-inner">
            <div 
              className="absolute w-3.5 h-3.5 bg-slate-800 rounded-full top-1/2 left-1/2"
              style={pupilStyle}
            >
              <div className="absolute top-0.5 right-0.5 w-1 h-1 bg-white rounded-full opacity-80" />
            </div>
            <div className={`absolute top-0 left-0 w-full bg-slate-100 transition-all duration-300 ${hasError ? 'h-3 opacity-100' : 'h-0 opacity-0'}`} />
          </div>
        </div>

        {/* Má hồng */}
        <div className="absolute top-14 left-3 w-4 h-2 bg-pink-400/30 rounded-full blur-[2px]" />
        <div className="absolute top-14 right-3 w-4 h-2 bg-pink-400/30 rounded-full blur-[2px]" />

        {/* Mũi và Miệng */}
        <div className="flex flex-col items-center">
          <div className="w-2.5 h-1.5 bg-pink-400 rounded-full" />
          {hasError ? (
            <div className="w-3 h-2 border-t-2 border-slate-400 rounded-t-full mt-1.5 transition-all" />
          ) : (
            <div className="flex justify-center mt-1 transition-all">
              <div className="w-2.5 h-2.5 border-b-2 border-r-2 border-slate-400 rounded-br-full rotate-45" />
              <div className="w-2.5 h-2.5 border-b-2 border-l-2 border-slate-400 rounded-bl-full -rotate-45" />
            </div>
          )}
        </div>

        {/* Ria mép (Trái) */}
        <div className="absolute top-14 -left-1 flex flex-col gap-1.5 opacity-40">
          <div className="w-5 h-[1.5px] bg-slate-600 rotate-[15deg]" />
          <div className="w-6 h-[1.5px] bg-slate-600 ml-1" />
          <div className="w-5 h-[1.5px] bg-slate-600 -rotate-[15deg]" />
        </div>

        {/* Ria mép (Phải) */}
        <div className="absolute top-14 -right-1 flex flex-col gap-1.5 items-end opacity-40">
          <div className="w-5 h-[1.5px] bg-slate-600 -rotate-[15deg]" />
          <div className="w-6 h-[1.5px] bg-slate-600 mr-1" />
          <div className="w-5 h-[1.5px] bg-slate-600 rotate-[15deg]" />
        </div>
      </div>

      {/* Tay trái */}
      <div
        className={`absolute z-30 w-7 h-10 bg-white rounded-full border-2 border-slate-200 transition-all duration-300 shadow-sm origin-bottom
        ${isCovering || isPeeking ? 'top-6 left-5 rotate-[50deg]' : 'top-20 -left-1 -rotate-[20deg]'}`}
      >
        <div className="absolute top-1 left-1/2 -translate-x-1/2 flex gap-1 opacity-30">
          <div className="w-[1px] h-2.5 bg-slate-500" />
          <div className="w-[1px] h-2.5 bg-slate-500" />
        </div>
      </div>

      {/* Tay phải */}
      <div
        className={`absolute z-30 w-7 h-10 bg-white rounded-full border-2 border-slate-200 transition-all duration-300 shadow-sm origin-bottom
        ${isCovering ? 'top-6 right-5 -rotate-[50deg]' : ''}
        ${isPeeking ? 'top-10 right-2 -rotate-[20deg]' : ''}
        ${!isCovering && !isPeeking ? 'top-20 -right-1 rotate-[20deg]' : ''}`}
      >
        <div className="absolute top-1 left-1/2 -translate-x-1/2 flex gap-1 opacity-30">
          <div className="w-[1px] h-2.5 bg-slate-500" />
          <div className="w-[1px] h-2.5 bg-slate-500" />
        </div>
      </div>
    </div>
  );
}

// ✨ COMPONENT ITEM TÍNH NĂNG
function FeatureItem({ text }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 flex-shrink-0 bg-cyan-500/20 p-1 rounded-full">
        <CheckCircle2 size={16} className="text-cyan-400" />
      </div>
      <p className="text-slate-300 font-medium leading-relaxed">{text}</p>
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

  // === STATE ĐIỀU KHIỂN LINH VẬT ===
  const [focusedField, setFocusedField] = useState(null); 

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
    <div className="flex min-h-screen w-full bg-slate-50 font-sans antialiased overflow-hidden">
      
      {/* ================= PHẦN TRÁI: GIỚI THIỆU (BRANDING) ================= */}
      <div className="hidden lg:flex relative w-1/2 flex-col justify-between bg-[#0a0a1a] p-12 xl:p-16 overflow-hidden">
        {/* Nền công nghệ */}
        <div className="absolute inset-0 z-0">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                'linear-gradient(rgba(56,189,248,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.15) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />
          <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-blue-600/20 blur-[120px]" />
          <div className="absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full bg-cyan-400/10 blur-[120px]" />
        </div>

        <div className="relative z-10 flex flex-col pt-8">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-16">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-cyan-500/30">
              <PackageCheck size={24} className="text-white" />
            </div>
            <span className="text-2xl font-black text-white tracking-wider">AMELIE WMS</span>
          </div>

          <h1 className="text-4xl xl:text-5xl font-black text-white leading-tight tracking-tight mb-6">
            Khởi tạo sức mạnh <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
              Quản trị kho vận
            </span>
          </h1>
          
          <p className="text-lg text-slate-300 max-w-lg leading-relaxed mb-12">
            AMELIE WMS là hệ thống quản lý kho vận chuyên nghiệp, kết nối trực tiếp với Nhanh.vn nhằm hỗ trợ tối ưu hóa quy trình, kiểm soát tồn kho và xuất báo cáo tự động mỗi ngày.
          </p>
          
          <div className="space-y-6 max-w-md">
            <FeatureItem text="Đồng bộ dữ liệu thời gian thực trực tiếp qua API Nhanh.vn." />
            <FeatureItem text="Hỗ trợ các nghiệp vụ xuất nhập tồn, luân chuyển hàng hóa chính xác." />
            <FeatureItem text="Hệ thống báo cáo, thống kê đa chiều trực quan cho ban quản trị." />
          </div>
        </div>

        <div className="relative z-10 text-sm text-slate-500 font-medium pb-4">
          © {new Date().getFullYear()} Amelie Team. All rights reserved.
        </div>
      </div>

      {/* ================= PHẦN PHẢI: FORM ĐĂNG NHẬP ================= */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-6 sm:p-12 relative">
        {/* Background blobs cho mobile (bị ẩn trên Desktop) */}
        <div className="absolute inset-0 z-0 lg:hidden overflow-hidden bg-[#0a0a1a]">
          <div className="absolute -top-40 -left-40 h-[400px] w-[400px] rounded-full bg-blue-500/20 blur-[100px]" />
          <div className="absolute -bottom-40 -right-40 h-[400px] w-[400px] rounded-full bg-purple-500/20 blur-[100px]" />
        </div>

        {/* Card Đăng nhập */}
        <div className="relative z-10 w-full max-w-md mt-12">
          
          {/* Mascot Container */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 z-20">
            <Mascot 
              focusedField={focusedField} 
              showPassword={showPassword} 
              error={error} 
              emailLength={email.length} 
            />
          </div>

          <div className="bg-white rounded-[2rem] p-8 sm:p-10 pt-12 shadow-2xl shadow-slate-200/50 border border-slate-100 transition-all lg:shadow-xl lg:shadow-slate-300/30">
            
            {mode === 'login' ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-8 text-center">
                  <h2 className="text-2xl font-black tracking-tight text-slate-900">
                    Chào mừng trở lại! 👋
                  </h2>
                  <p className="mt-2 text-sm font-medium text-slate-500">
                    Đăng nhập vào bảng điều khiển hệ thống
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
                      Email quản trị
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
                        onFocus={() => setFocusedField('email')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="vinh12345@gmail.com"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
                      />
                      <Mail
                        size={18}
                        className="absolute left-4 top-3 text-slate-400"
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
                        className="text-xs font-bold text-cyan-600 transition hover:text-cyan-500 hover:underline"
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
                        onFocus={() => setFocusedField('password')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="••••••••"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 pl-11 pr-11 text-sm font-semibold text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
                      />
                      <Lock
                        size={18}
                        className="absolute left-4 top-3 text-slate-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-3 text-slate-400 transition hover:text-slate-600"
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
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex cursor-pointer select-none items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-cyan-500 focus:ring-cyan-500"
                      />
                      Duy trì đăng nhập
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/25 transition-all hover:shadow-cyan-500/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {loading ? (
                      'Đang xác thực...'
                    ) : (
                      <>
                        <Fingerprint size={18} />
                        Đăng nhập hệ thống
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
                    Khôi phục mật khẩu
                  </h2>
                  <p className="mt-2 text-sm font-medium text-slate-500 px-4">
                    Nhập email tài khoản, chúng tôi sẽ gửi liên kết đặt lại mật khẩu cho bạn.
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
                      Email tài khoản
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
                        onFocus={() => setFocusedField('email')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="vinh12345@gmail.com"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-500/10"
                      />
                      <Mail
                        size={18}
                        className="absolute left-4 top-3 text-slate-400"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-amber-500/25 transition-all hover:shadow-amber-500/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {loading ? 'Đang gửi yêu cầu...' : 'Gửi liên kết khôi phục'}
                  </button>
                </form>
              </div>
            )}

            {/* Link phiên bản cũ */}
            <div className="mt-8 border-t border-slate-100 pt-6 text-center">
              <a
                href="https://htvinh10102003.github.io/ameliebaocaokho/"
                className="text-xs font-bold text-slate-400 transition-colors hover:text-slate-600"
              >
                Trở về phiên bản cũ
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Animation CSS */}
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