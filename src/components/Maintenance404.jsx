import { useEffect } from 'react';

// Man hinh bao tri: dung man hinh xam, chi co 404 Not Found, khong nut, khong logo, khong menu.
export default function Maintenance404() {
  useEffect(() => {
    document.title = '404 Not Found';
  }, []);

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center"
      style={{ backgroundColor: '#808080' }}
    >
      <h1 className="text-white font-bold leading-none" style={{ fontSize: '120px' }}>
        404
      </h1>
      <p className="text-white font-medium" style={{ fontSize: '28px' }}>
        Not Found
      </p>
    </div>
  );
}
