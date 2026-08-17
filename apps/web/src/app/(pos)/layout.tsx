import { ReactNode } from 'react';

export default function PosLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen w-screen bg-slate-50 overflow-hidden flex flex-col">
      {children}
    </div>
  );
}
