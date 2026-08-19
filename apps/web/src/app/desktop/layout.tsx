export default function DesktopLayout({ children }: { children: React.ReactNode }) {
  // Purely presentation layout. No NextAuth check here!
  // The Desktop Auth Guard will handle checking the POS Operator Session via IPC.
  return (
    <div className="h-screen w-full bg-slate-50 text-slate-900 overflow-hidden flex flex-col">
      {children}
    </div>
  );
}
