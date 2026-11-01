import { useState } from 'react';

// Man hinh bao tri rieng cho giao dien mobile (/mobile): thay cho man hinh
// xam 404 cua ban may tinh. Anh ky su cam bien canh bao lay tu mang
// (Vectorgrove); neu anh khong tai duoc thi an anh di, tieu de van hien.
const ENGINEER_IMAGE_URL = 'https://thumbnails.vectorgrove.com/neutral/13/8e6/138e6ffe.jpg';

export default function MaintenanceMobile() {
    const [imageOk, setImageOk] = useState(true);

    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-white px-6 py-10 font-sans text-center">
            {imageOk && (
                <img
                    src={ENGINEER_IMAGE_URL}
                    alt="Kỹ sư đang bảo trì"
                    onError={() => setImageOk(false)}
                    className="w-full max-w-xs object-contain mb-6"
                />
            )}
            <h1 className="text-2xl font-bold text-slate-900 leading-tight">
                Máy chủ đang bảo trì
            </h1>
            <p className="text-sm font-medium text-slate-500 leading-relaxed mt-3 max-w-xs">
                Hệ thống đang được bảo trì, vui lòng quay lại sau.
            </p>
        </div>
    );
}
