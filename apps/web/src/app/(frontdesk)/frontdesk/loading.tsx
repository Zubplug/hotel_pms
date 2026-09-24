export default function Loading() {
  return (
    <div className="min-h-screen bg-[#080c18] flex items-center justify-center relative overflow-hidden">
      {/* Ambient Glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-emerald-600/10 rounded-full blur-[80px] animate-pulse delay-75" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-700">
        <div className="relative">
          <div className="absolute -inset-4 bg-indigo-500/20 rounded-full animate-ping opacity-50" />
          <div className="relative w-20 h-20 bg-indigo-500/10 border border-indigo-500/20 rounded-full flex items-center justify-center shadow-[0_0_30px_-8px_rgba(99,102,241,0.5)]">
            <svg
              className="w-10 h-10 text-indigo-400 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-white mb-2 tracking-tight">Initializing Workspace</h2>
          <p className="text-sm font-medium text-slate-400">Loading front desk environment…</p>
        </div>
      </div>
    </div>
  );
}
