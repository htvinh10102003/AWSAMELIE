import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function ProtectedRoute({ children }) {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 1. Kiểm tra xem có session đăng nhập sẵn chưa
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });

        // 2. Lắng nghe realtime trạng thái Auth (Đăng nhập/Đăng xuất phát biết ngay)
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

    // Nếu không có phiên đăng nhập, chuyển hướng ngay sang trang login
    if (!session) {
        return <Navigate to="/login" replace />;
    }

    return children;
}