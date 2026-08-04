import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  LockKeyhole,
  Terminal,
  Activity,
  Cpu,
  Fingerprint,
  ChevronRight,
  ShieldAlert,
  Database,
  Network
} from 'lucide-react';

export default function Login() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  
  // Fake terminal logs for the aesthetic background
  const [logs, setLogs] = useState([]);

  const navigate = useNavigate();

  // Sinh log giả để tạo cảm giác Data Center
  useEffect(() => {
    const messages = [
      "Establishing secure connection...",
      "Bypassing proxy server...",
      "Connecting to WMS_CORE_DB_01...",
      "Encrypting payload [RSA-4096]...",
      "Awaiting user authentication..."
    ];
    let i = 0;
    const interval = setInterval(() => {
      if (i < messages.length) {
        setLogs(prev => [...prev, messages[i]]);
        i++;
      } else {
        clearInterval(interval);
      }
    }, 800);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    
    setLogs(prev => [...prev, "> VERIFYING CREDENTIALS..."]);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLogs(prev => [...prev, "> AUTH_FAILED: ACCESS DENIED."]);
      setError(
        error.message === 'Invalid login credentials'
          ? 'Truy cập bị từ chối. Sai thông tin xác thực.'
          : error.message
      );
    } else {
      setLogs(prev => [...prev, "> AUTH_SUCCESS: REDIRECTING..."]);
      setTimeout(() => navigate('/admin'), 1000);
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    setLogs(prev => [...prev, "> INITIATING PASSWORD OVERRIDE PROTOCOL..."]);

    const { error } = await supabase.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/admin`,
    });

    if (error) {
      setLogs(prev => [...prev, `> ERROR: ${error.message}`]);
      setError(`Lỗi hệ thống: ${error.message}`);
    } else {
      setLogs(prev => [...prev, "> PROTOCOL SUCCESS: CHECK INBOX."]);
      setMessage('Lệnh khôi phục đã được mã hóa và gửi tới email.');
    }
    setLoading(false);
  };

  return (
    <div className="relative min-h-screen w-full bg-[#030712] text-cyan-500 font-sans antialiased flex items-center justify-center overflow-hidden selection:bg-cyan-500/30">
      
      {/* Background: Radar Grid & Scanning Line */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-20">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.2)_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/10 to-transparent w-full h-[200%] animate-scan" />
      </div>

      {/* HUD Elements (Heads-Up Display) - Ẩn trên mobile */}
      <div className="hidden lg:block absolute top-6 left-6 font-mono text-xs text-cyan-700 pointer-events-none z-0 space-y-1">
        <div className="flex items-center gap-2"><Activity size={14} className="animate-pulse text-cyan-400" /> SYS.STAT: ONLINE</div>
        <div>NODE: WMS-CORE-01</div>
        <div>LATENCY: 12ms</div>
      </div>
      
      <div className="hidden lg:block absolute bottom-6 right-6 font-mono text-xs text-cyan-700 pointer-events-none z-0 text-right space-y-1">
        <div className="flex items-center justify-end gap-2"><LockKeyhole size={14} /> SEC: RSA-4096 ENCRYPTED</div>
        <div>IP: {Math.floor(Math.random() * 255)}.{Math.floor(Math.random() * 255)}.x.x</div>
        <div>V: 2.4.1-STABLE</div>
      </div>

      {/* Fake Terminal Background */}
      <div className="absolute top-1/4 left-8 font-mono text-xs text-cyan-800/40 pointer-events-none hidden xl:block max-w-[250px]">
        {logs.map((log, idx) => (
          <div key={idx} className="mb-1">{log}</div>
        ))}
        <div className="animate-pulse">_</div>
      </div>

      {/* Main Authentication Card */}
      <div className="relative z-10 w-full max-w-[420px] p-6">
        
        <div className="bg-[#0b1120]/80 backdrop-blur-md border border-cyan-900/50 p-1 rounded-sm shadow-[0_0_40px_rgba(6,182,212,0.1)] relative">
          
          {/* Cắt góc kiểu Sci-fi (Corner Accents) */}
          <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-cyan-400" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-cyan-400" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-cyan-400" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-cyan-400" />

          <div className="p-8 border border-cyan-900/30">
            {/* Header */}
            <div className="flex flex-col items-center mb-8 border-b border-cyan-900/50 pb-6">
              <div className="relative h-14 w-14 rounded-full bg-cyan-950 flex items-center justify-center mb-4 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                <Database size={28} className="text-cyan-400" />
                {/* Vòng xoay ngoài */}
                <div className="absolute inset-0 rounded-full border border-t-cyan-400 border-r-transparent border-b-transparent border-l-transparent animate-spin" style={{ animationDuration: '3s' }} />
              </div>
              <h1 className="text-xl font-bold text-cyan-50 tracking-[0.2em] uppercase">
                AMELIE <span className="text-cyan-500">WMS</span>
              </h1>
              <p className="text-[10px] font-mono text-cyan-600 mt-2 tracking-widest uppercase">
                // Restricted Access Area //
              </p>
            </div>

            {mode === 'login' ? (
              <div className="animate-in fade-in duration-300">
                {error && (
                  <div className="mb-6 p-3 bg-red-950/30 border border-red-900 text-xs font-mono text-red-500 flex items-start gap-2">
                    <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                    <p>[ERR] {error}</p>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-cyan-600 uppercase tracking-wider flex items-center gap-2">
                      <ChevronRight size={12} /> ID Xác thực (Email)
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
                        className="w-full bg-[#030712] border border-cyan-900/50 px-4 py-2.5 text-sm text-cyan-100 placeholder:text-cyan-900 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_10px_rgba(6,182,212,0.2)] font-mono transition-all rounded-none"
                        placeholder="admin@amelie.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-mono text-cyan-600 uppercase tracking-wider flex items-center gap-2">
                        <ChevronRight size={12} /> Khóa bảo mật
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('forgot');
                          setError('');
                          setMessage('');
                        }}
                        className="text-[10px] font-mono text-cyan-700 hover:text-cyan-400 transition-colors uppercase tracking-widest"
                      >
                        [Override_Pass]
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (error) setError('');
                        }}
                        className="w-full bg-[#030712] border border-cyan-900/50 px-4 py-2.5 text-sm text-cyan-100 placeholder:text-cyan-900 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_10px_rgba(6,182,212,0.2)] font-mono transition-all rounded-none"
                        placeholder="••••••••••••"
                      />
                    </div>
                  </div>

                  <div className="flex items-center pt-2">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="appearance-none w-3.5 h-3.5 border border-cyan-800 bg-[#030712] checked:bg-cyan-500 checked:border-cyan-400 transition-all cursor-pointer rounded-sm"
                      />
                      <span className="text-[10px] font-mono text-cyan-700 group-hover:text-cyan-500 uppercase tracking-wider transition-colors select-none">
                        Duy trì kết nối
                      </span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-6 bg-cyan-950/50 hover:bg-cyan-900/50 text-cyan-400 border border-cyan-500/50 hover:border-cyan-400 py-3 text-xs font-mono font-bold tracking-widest uppercase transition-all shadow-[inset_0_0_15px_rgba(6,182,212,0.1)] hover:shadow-[0_0_15px_rgba(6,182,212,0.4)] disabled:opacity-50 flex items-center justify-center gap-2 rounded-sm group relative overflow-hidden"
                  >
                    <div className="absolute inset-0 w-0 bg-cyan-500/10 transition-all duration-300 ease-out group-hover:w-full" />
                    {loading ? (
                      <>
                        <Cpu size={16} className="animate-pulse" />
                        PROCESSING...
                      </>
                    ) : (
                      <>
                        <Fingerprint size={16} />
                        Xác thực truy cập
                      </>
                    )}
                  </button>
                </form>
              </div>
            ) : (
              /* Forgot Password Flow */
              <div className="animate-in fade-in duration-300">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                    setMessage('');
                  }}
                  className="mb-6 flex items-center gap-2 text-[10px] font-mono text-cyan-700 hover:text-cyan-400 transition-colors uppercase tracking-widest"
                >
                  &lt; [Return_to_Auth]
                </button>

                <div className="mb-6 border-l-2 border-cyan-500 pl-3">
                  <h2 className="text-sm font-mono font-bold text-cyan-100 uppercase tracking-wider">Khôi phục Protocol</h2>
                  <p className="text-[10px] font-mono text-cyan-600 mt-1 uppercase tracking-wider">Gửi chuỗi mã hóa đặt lại mật khẩu.</p>
                </div>

                {error && (
                  <div className="mb-6 p-3 bg-red-950/30 border border-red-900 text-xs font-mono text-red-500">
                    [ERR] {error}
                  </div>
                )}
                {message && (
                  <div className="mb-6 p-3 bg-cyan-950/50 border border-cyan-500/50 text-xs font-mono text-cyan-400 flex items-start gap-2">
                    <Network size={14} className="mt-0.5 shrink-0" />
                    <p>[SYS] {message}</p>
                  </div>
                )}

                <form onSubmit={handleForgotPassword} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-cyan-600 uppercase tracking-wider flex items-center gap-2">
                      <ChevronRight size={12} /> ID Xác thực (Email)
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError('');
                      }}
                      className="w-full bg-[#030712] border border-cyan-900/50 px-4 py-2.5 text-sm text-cyan-100 placeholder:text-cyan-900 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_10px_rgba(6,182,212,0.2)] font-mono transition-all rounded-none"
                      placeholder="admin@amelie.com"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-cyan-950/50 hover:bg-cyan-900/50 text-cyan-400 border border-cyan-500/50 hover:border-cyan-400 py-3 text-xs font-mono font-bold tracking-widest uppercase transition-all shadow-[inset_0_0_15px_rgba(6,182,212,0.1)] hover:shadow-[0_0_15px_rgba(6,182,212,0.4)] disabled:opacity-50 flex items-center justify-center gap-2 rounded-sm group relative overflow-hidden"
                  >
                    <div className="absolute inset-0 w-0 bg-cyan-500/10 transition-all duration-300 ease-out group-hover:w-full" />
                    {loading ? (
                      <>
                        <Terminal size={16} className="animate-bounce" />
                        TRANSMITTING...
                      </>
                    ) : (
                      'Thực thi lệnh'
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <a
            href="https://htvinh10102003.github.io/ameliebaocaokho/"
            className="text-[10px] font-mono text-cyan-800 hover:text-cyan-500 transition-colors tracking-widest uppercase"
          >
            // Init Legacy_System (v1.0)
          </a>
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(50%); }
        }
        .animate-scan {
          animation: scan 6s linear infinite;
        }
      `}</style>
    </div>
  );
}