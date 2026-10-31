// Component giao dien chuan dung chung: Card, PageHeader, StatCard, Loading, EmptyState.
// Cac trang cu van chay binh thuong; trang nao refactor thi dung cac component nay thay cho class Tailwind roi rac.
export function Card({ children, className = '' }) {
  return <div className={`ui-card p-5 sm:p-6 ${className}`}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <Card className="flex items-center gap-4">
      <div className={`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center ${tones[tone] || tones.blue}`}>
        <span className="text-lg font-bold leading-none">{String(value).slice(0, 2)}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    </Card>
  );
}

export function LoadingState({ text = 'Đang tải dữ liệu...' }) {
  return (
    <div className="flex min-h-[240px] items-center justify-center text-sm font-medium text-slate-500 animate-pulse">
      {text}
    </div>
  );
}

export function EmptyState({ title, description }) {
  return (
    <div className="ui-card p-8 text-center">
      <p className="font-bold text-slate-800">{title}</p>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
    </div>
  );
}
