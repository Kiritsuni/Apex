import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg)] px-6 text-center">
      <div className="space-y-4 animate-fade-in">
        <p className="text-8xl font-black tracking-tighter text-[var(--surface-2)]">404</p>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Page not found</h1>
        <p className="text-[var(--text-secondary)] text-sm max-w-xs">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-[6px] bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
