import { AppSwitcher } from "@/components/layout/AppSwitcher";
import { PageHeader } from "@/components/layout/PageHeader";

export default function CashManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-slate-50">
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="bg-white border-b border-slate-200 h-16 flex items-center px-4 justify-between shrink-0">
          <div className="flex items-center gap-4">
            <AppSwitcher />
            <div className="h-6 w-px bg-slate-200" />
            <h1 className="font-semibold text-slate-900">Cash Management</h1>
          </div>
          <PageHeader />
        </header>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
