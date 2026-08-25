import { useState, useEffect } from 'react';
import { ChefHat, X, RefreshCw, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WaiterTicketsModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataProvider: any;
  outletId: string;
  operatorToken: string;
  sessionId: string;
}

export function WaiterTicketsModal({
  isOpen,
  onClose,
  dataProvider,
  outletId,
  operatorToken,
  sessionId
}: WaiterTicketsModalProps) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = async () => {
    setIsLoading(true);
    setError(null);
    if (!outletId || !operatorToken || !sessionId) {
      setTickets([]);
      setError('Open a POS shift and sign in as an operator to view kitchen tickets.');
      setIsLoading(false);
      return;
    }
    try {
      const res = await dataProvider.getWaiterTickets(outletId, operatorToken, sessionId);
      if (res.error) throw new Error(res.error);
      setTickets(res.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load tickets');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTickets();
      const interval = setInterval(fetchTickets, 15000); // Poll every 15s
      return () => clearInterval(interval);
    }
  }, [isOpen, outletId, operatorToken, sessionId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <ChefHat className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800">My Kitchen Tickets</h2>
              <p className="text-xs text-slate-500">Live status of your sent orders</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchTickets} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="p-3 mb-4 text-sm text-red-600 bg-red-50 rounded-lg">
              {error}
            </div>
          )}

          {isLoading && tickets.length === 0 ? (
            <div className="flex items-center justify-center p-8 text-slate-400">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center p-8 text-slate-500">
              <ChefHat className="h-12 w-12 mx-auto text-slate-300 mb-3" />
              <p className="font-medium text-slate-700">No active tickets</p>
              <p className="text-sm">Orders you fire to the kitchen will appear here.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {tickets.map(ticket => (
                <div key={ticket.id} className="border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-slate-800">#{ticket.kotNumber}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          ticket.status === 'READY' ? 'bg-emerald-100 text-emerald-700' :
                          ticket.status === 'COOKING' ? 'bg-amber-100 text-amber-700' :
                          ticket.status === 'PENDING' ? 'bg-slate-100 text-slate-600' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {ticket.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                        {ticket.order?.tableNumber && (
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded">Table {ticket.order.tableNumber}</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 rounded-lg p-3">
                    <ul className="space-y-2">
                      {ticket.items?.map((item: any) => (
                        <li key={item.id} className="text-sm">
                          <div className="flex items-start gap-2">
                            <span className="font-medium text-slate-700 min-w-[20px]">{item.quantity}x</span>
                            <div className="flex-1">
                              <span className="text-slate-800">{item.productName}</span>
                              {item.modifiers?.length > 0 && (
                                <div className="text-xs text-slate-500 mt-0.5">
                                  {item.modifiers.map((m: any) => m.name).join(', ')}
                                </div>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
