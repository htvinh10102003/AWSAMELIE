import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function ProtectedRoute({ children }) {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 1. Lấy session hiện tại
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });

        // 2. Lắng nghe trạng thái thay đổi
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center font-sans text-slate-500 font-semibold animate-pulse">
                Đang kiểm tra quyền truy cập...
            </div>
        );
    }

    // VÒNG GỬI XE 1: Chưa đăng nhập thì đá văng ra trang Login
    if (!session) {
        return <Navigate to="/login" replace />;
    }

    // ⚡️ VÒNG GỬI XE 2: Đã đăng nhập nhưng KHÔNG PHẢI ADMIN -> Đá văng về trang chủ báo cáo ngay lập tức
    const isAdmin = session.user?.user_metadata?.role === 'admin';
    if (!isAdmin) {
        console.warn(`🔒 Cảnh báo bảo mật: Tài khoản ${session.user?.email} cố gắng truy cập vùng admin trái phép!`);
        return <Navigate to="/" replace />;
    }

    // Đúng admin thì cho đi tiếp vào ruột
    return children;
}