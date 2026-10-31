import { useEffect, useRef } from 'react';

// Widget xac minh chong bot bang Cloudflare Turnstile (mien phi, khong can tai khoan Google).
// Site key lay tu Cloudflare Dashboard > Turnstile, dat vao bien moi truong VITE_TURNSTILE_SITE_KEY.
// Neu khong co site key, component khong render gi - trang goi no tu quyet dinh co bat buoc hay khong.
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

export default function TurnstileWidget({ onToken, onExpire }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const callbacksRef = useRef({ onToken, onExpire });
  callbacksRef.current = { onToken, onExpire };

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !containerRef.current) return undefined;
    let cancelled = false;

    const renderWidget = () => {
      if (cancelled || !window.turnstile || !containerRef.current || widgetIdRef.current !== null) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token) => callbacksRef.current.onToken?.(token),
        'expired-callback': () => callbacksRef.current.onExpire?.(),
        'error-callback': () => callbacksRef.current.onExpire?.(),
      });
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      const existing = document.querySelector('script[data-turnstile]');
      if (!existing) {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
        script.async = true;
        script.defer = true;
        script.setAttribute('data-turnstile', 'true');
        script.onload = renderWidget;
        document.head.appendChild(script);
      } else {
        existing.addEventListener('load', renderWidget, { once: true });
        // Neu script da load xong truoc khi component mount thi render ngay
        if (window.turnstile) renderWidget();
      }
    }

    return () => {
      cancelled = true;
      if (window.turnstile && widgetIdRef.current !== null) {
        try { window.turnstile.remove(widgetIdRef.current); } catch (e) {}
        widgetIdRef.current = null;
      }
    };
  }, []);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={containerRef} className="flex justify-start" />;
}
