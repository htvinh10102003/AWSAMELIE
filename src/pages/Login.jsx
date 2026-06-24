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
} from 'lucide-react';

// ✨ LINH VẬT MÈO TRẮNG (CUTE & REALISTIC)
function Mascot({ focusedField, showPassword, error, emailLength }) {
  const isEmail = focusedField === 'email';
  const isPassword = focusedField === 'password';
  const isCovering = isPassword && !showPassword;
  const isPeeking = isPassword && showPassword;
  
  // Chỉ hiện biểu cảm lỗi khi có lỗi và người dùng không đang gõ
  const hasError = !!error && !focusedField;

  // Logic liếc mắt: Từ trái (-6px) sang phải (+6px) dựa vào độ dài email đang gõ
  const lookX = isEmail ? Math.min(emailLength, 24) * 0.5 - 6 : 0;
  // Khi nhìn email thì liếc xuống xíu, khi lỗi thì nhìn gục hẳn xuống
  const lookY = isEmail ? 2 : (hasError ? 4 : 0);

  const pupilStyle = {
    transform: `translate(calc(-50% + ${lookX}px), calc(-50% + ${lookY}px))`,
    transition: 'transform 0.1s ease-out'
  };

  return (
    <div className="relative w-32 h-32 transition-transform duration-300">
      
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
              {/* Đốm sáng trong mắt */}
              <div className="absolute top-0.5 right-0.5 w-1 h-1 bg-white rounded-full opacity-80" />
            </div>
            {/* Mí mắt khi lỗi (buồn) */}
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
            {/* Mí mắt khi lỗi */}
            <div className={`absolute top-0 left-0 w-full bg-slate-100 transition-all duration-300 ${hasError ? 'h-3 opacity-100' : 'h-0 opacity-0'}`} />
          </div>
        </div>

        {/* Má hồng */}
        <div className="absolute top-14 left-3 w-4 h-2 bg-pink-400/30 rounded-full blur-[2px]" />
        <div className="absolute top-14 right-3 w-4 h-2 bg-pink-400/30 rounded-full blur-[2px]" />

        {/* Mũi và Miệng */}
        <div className="flex flex-col items-center">
          {/* Mũi */}
          <div className="w-2.5 h-1.5 bg-pink-400 rounded-full" />
          
          {/* Miệng */}
          {hasError ? (
            // Miệng buồn
            <div className="w-3 h-2 border-t-2 border-slate-400 rounded-t-full mt-1.5 transition-all" />
          ) : (
            // Miệng cười
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

export default function Login() {
  // === STATES QUẢN LÝ ĐĂNG NHẬP ===
  const [mode, setMode] = useState('login'); // 'login' hoặc 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // === STATES PHẢN HỒI HỆ THỐNG ===
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // === STATE ĐIỀU KHIỂN LINH VẬT ===
  const [focusedField, setFocusedField] = useState(null); // 'email' | 'password' | null

  const navigate = useNavigate();

  // ⚡️ XỬ LÝ ĐĂNG NHẬP TÀI KHOẢN
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

  // ⚡️ XỬ LÝ GỬI EMAIL KHÔI PHỤC MẬT KHẨU
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
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#0a0a1a] font-sans text-slate-200 antialiased">
      {/* Nền công nghệ: lưới, chấm, vòng tròn phát sáng */}
      <div className="absolute inset-0 -z-10">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'linear-gradient(rgba(56,189,248,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-blue-500/20 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-purple-500/20 blur-[120px]" />
        <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/10 blur-[100px]" />
      </div>

      {/* Card chính */}
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/50 backdrop-blur-2xl transition-all mt-16">
        {/* Viền sáng chạy */}
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-cyan-400/0 via-cyan-400/30 to-cyan-400/0 opacity-0 transition-opacity duration-500 hover:opacity-100" />

        {/* LINH VẬT */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 z-20">
          <Mascot 
            focusedField={focusedField} 
            showPassword={showPassword} 
            error={error} 
            emailLength={email.length} // Truyền độ dài để mắt liếc chuẩn
          />
        </div>

        <div className="relative z-10 pt-4">
          {mode === 'login' ? (
            <>
              {/* Logo / Thương hiệu */}
              <div className="mb-8 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-cyan-500/30">
                  <Cpu size={28} className="text-white" />
                </div>
                <h2 className="text-2xl font-black tracking-tight text-white">
                  Hệ thống WMS
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-400">
                  Đăng nhập vào khu vực Quản trị viên
                </p>
              </div>

              {/* Thông báo lỗi */}
              {error && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-bold text-red-400 animate-shake">
                  ⚠️ {error}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-5">
                {/* Email */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Email
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError(''); // Xóa lỗi khi người dùng gõ lại
                      }}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="vinh12345@gmail.com"
                      className="w-full rounded-xl border border-slate-700/50 bg-slate-800/50 py-2.5 pl-10 pr-4 text-sm font-semibold text-white placeholder-slate-500 outline-none backdrop-blur-sm transition-all focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/20"
                    />
                    <Mail
                      size={16}
                      className="absolute left-3.5 top-3.5 text-slate-400"
                    />
                  </div>
                </div>

                {/* Mật khẩu */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                      Mật khẩu
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setError('');
                        setMessage('');
                      }}
                      className="text-xs font-bold text-cyan-400 transition hover:text-cyan-300 hover:underline"
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
                      className="w-full rounded-xl border border-slate-700/50 bg-slate-800/50 py-2.5 pl-10 pr-10 text-sm font-semibold text-white placeholder-slate-500 outline-none backdrop-blur-sm transition-all focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/20"
                    />
                    <Lock
                      size={16}
                      className="absolute left-3.5 top-3.5 text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-400 transition hover:text-slate-300"
                    >
                      {showPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Ghi nhớ + nút đăng nhập */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex cursor-pointer select-none items-center gap-2 text-xs font-bold text-slate-400">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded-lg border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500"
                    />
                    Duy trì đăng nhập
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3 font-bold text-white shadow-xl shadow-cyan-500/20 transition-all hover:shadow-cyan-500/40 disabled:opacity-50"
                >
                  {loading ? (
                    'Đang xác thực...'
                  ) : (
                    <>
                      <Fingerprint size={18} />
                      Đăng nhập vận hành
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            /* Giao diện quên mật khẩu */
            <>
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                    setMessage('');
                  }}
                  className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 transition hover:text-white"
                >
                  <ArrowLeft size={14} /> Quay lại đăng nhập
                </button>
              </div>

              <div className="mb-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500 shadow-lg shadow-amber-500/30">
                  <ShieldCheck size={24} className="text-white" />
                </div>
                <h2 className="text-xl font-black tracking-tight text-white">
                  Khôi phục mật khẩu
                </h2>
                <p className="mt-1 text-xs font-medium text-slate-400">
                  Hệ thống sẽ gửi một liên kết đổi mật khẩu bảo mật tới email.
                </p>
              </div>

              {error && (
                <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-bold text-red-400">
                  ⚠️ {error}
                </div>
              )}
              {message && (
                <div className="mb-4 rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-xs font-bold text-green-400">
                  {message}
                </div>
              )}

              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Nhập Email tài khoản
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
                      className="w-full rounded-xl border border-slate-700/50 bg-slate-800/50 py-2.5 pl-10 pr-4 text-sm font-semibold text-white placeholder-slate-500 outline-none backdrop-blur-sm transition-all focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20"
                    />
                    <Mail
                      size={16}
                      className="absolute left-3.5 top-3.5 text-slate-400"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 py-3 font-bold text-white shadow-xl shadow-amber-500/20 transition-all hover:shadow-amber-500/40 disabled:opacity-50"
                >
                  {loading ? 'Đang gửi yêu cầu...' : 'Gửi liên kết khôi phục'}
                </button>
              </form>
            </>
          )}

          {/* Link phiên bản cũ */}
          <div className="mt-6 border-t border-white/5 pt-4 text-center">
            <a
              href="https://htvinh10102003.github.io/ameliebaocaokho/"
              className="text-xs font-medium text-slate-500 transition-colors hover:text-slate-300"
            >
              Dùng phiên bản cũ
            </a>
          </div>
        </div>
      </div>

      {/* Animation shake cho lỗi */}
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