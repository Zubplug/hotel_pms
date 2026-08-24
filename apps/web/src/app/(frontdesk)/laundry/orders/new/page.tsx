'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Shirt, Loader2, Search, User, Phone, Mail } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

export default function NewLaundryOrderPage() {
  const { propertyId } = useProperty();
  const { provider } = useLodgeCoreProvider();
  const router = useRouter();
  
  const [items, setItems] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  
  const [customerType, setCustomerType] = useState<'IN_HOUSE' | 'WALK_IN'>('IN_HOUSE');

  const [reservations, setReservations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  
  const [walkInDetails, setWalkInDetails] = useState({ firstName: '', lastName: '', phone: '', email: '' });
  const [matchingGuest, setMatchingGuest] = useState<any>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const [serviceType, setServiceType] = useState('STANDARD');
  const [loading, setLoading] = useState(false);
  const [fetchingGuests, setFetchingGuests] = useState(false);
  const [searchingWalkIn, setSearchingWalkIn] = useState(false);
  
  useEffect(() => {
    if (!propertyId) return;
    provider.laundry.getItems(propertyId)
      .then(res => setItems(res.data || []));
      
    setFetchingGuests(true);
    provider.reservations.list(propertyId, { status: 'IN_HOUSE', pageSize: 200 })
      .then(res => {
         setReservations(res.data?.items || res.data || []);
      })
      .catch(console.error)
      .finally(() => setFetchingGuests(false));
  }, [propertyId]);

  const filteredReservations = useMemo(() => {
    if (!searchQuery) return reservations;
    return reservations.filter(r => {
      const name = `${r.primaryGuest?.firstName} ${r.primaryGuest?.lastName}`.toLowerCase();
      const room = r.reservationRooms?.[0]?.room?.number?.toLowerCase() || '';
      const query = searchQuery.toLowerCase();
      return name.includes(query) || room.includes(query);
    });
  }, [reservations, searchQuery]);

  const handleSelectReservation = (res: any) => {
    setSelectedReservation(res);
    setSearchQuery(`${res.reservationRooms?.[0]?.room?.number || 'N/A'} - ${res.primaryGuest?.firstName} ${res.primaryGuest?.lastName}`);
    setShowDropdown(false);
  };

  const handleWalkInPhoneChange = (phone: string) => {
      setWalkInDetails(prev => ({ ...prev, phone }));
      setMatchingGuest(null);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);

      if (phone.length >= 6) {
          setSearchingWalkIn(true);
          searchTimeout.current = setTimeout(async () => {
              try {
                  // Use the provider which searches local SQLite first, then falls back to cloud
                  const res = await provider.guests.search(phone);
                  if (res?.data && res.data.length > 0) {
                      const guest = res.data[0];
                      setMatchingGuest(guest);
                      setWalkInDetails({
                          firstName: guest.firstName,
                          lastName: guest.lastName || '',
                          phone: guest.phone,
                          email: guest.email || ''
                      });
                  }
              } catch (e) {
                  console.error(e);
              } finally {
                  setSearchingWalkIn(false);
              }
          }, 600);
      }
  };

  const getMultiplier = (type: string) => {
    if (type === 'EXPRESS') return 1.5;
    if (type === 'DRY_CLEAN') return 2.0;
    return 1.0;
  };

  const currentTotal = items.reduce((acc, item) => {
    const qty = selectedItems[item.id] || 0;
    let base = Number(item.basePrice);
    
    // Apply service rules if they exist on the item
    if (item.servicePricingRules && item.servicePricingRules[serviceType]) {
        const rule = item.servicePricingRules[serviceType];
        if (rule.type === 'FIXED') base = rule.amount;
        else if (rule.type === 'MULTIPLIER') base = base * rule.value;
    } else {
        base = base * getMultiplier(serviceType);
    }
    
    return acc + (qty * base);
  }, 0);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    
    if (customerType === 'IN_HOUSE' && !selectedReservation) return alert('Please select a guest');
    if (customerType === 'WALK_IN') {
        if (!walkInDetails.firstName || !walkInDetails.phone) {
            return alert('First Name and Phone are required for walk-ins');
        }
    }

    const orderItems = Object.entries(selectedItems)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, quantity]) => ({ itemId, quantity }));

    if (orderItems.length === 0) return alert('Select at least one item');
    setLoading(true);

    const payload: any = {
      propertyId,
      customerType,
      serviceType,
      items: orderItems
    };

    if (customerType === 'IN_HOUSE') {
        payload.reservationId = selectedReservation.id;
        payload.guestId = selectedReservation.primaryGuestId;
        const roomId = selectedReservation.reservationRooms?.[0]?.roomId;
        if (roomId) payload.roomId = roomId;
    } else {
        payload.walkInDetails = walkInDetails;
    }

    const res = await provider.laundry.createOrder(payload);

    if (!res.error) {
      router.push('/laundry');
    } else {
      alert(res.error || 'Failed to create order');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-slate-50/50 pb-20">
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-200/40">
          <div>
            <Button onClick={() => router.push('/laundry')} variant="ghost" size="sm" className="rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 h-8 flex items-center gap-2 mb-2">
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </Button>
            <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
              <Shirt className="w-8 h-8 text-cyan-600" /> New Laundry Order
            </h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-200/40 space-y-8">
          
          <div className="flex gap-4 p-1 bg-slate-100 rounded-xl overflow-hidden w-full max-w-sm">
             <button type="button" onClick={() => setCustomerType('IN_HOUSE')} className={`flex-1 py-2 font-bold rounded-lg transition-all ${customerType === 'IN_HOUSE' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                In-House Guest
             </button>
             <button type="button" onClick={() => setCustomerType('WALK_IN')} className={`flex-1 py-2 font-bold rounded-lg transition-all ${customerType === 'WALK_IN' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                Walk-In
             </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {customerType === 'IN_HOUSE' ? (
                <div className="space-y-2 relative">
                <label className="block text-sm font-bold text-slate-700">Guest / Room Search</label>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input 
                    type="text"
                    placeholder="Search room or guest name..."
                    className="w-full h-12 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-cyan-500"
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setSelectedReservation(null);
                        setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                    />
                    {fetchingGuests && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 animate-spin" />
                    )}
                </div>
                
                {showDropdown && filteredReservations.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    {filteredReservations.map(res => (
                        <div 
                        key={res.id} 
                        className="px-4 py-3 hover:bg-cyan-50 cursor-pointer flex justify-between items-center border-b border-slate-50 last:border-0"
                        onClick={() => handleSelectReservation(res)}
                        >
                        <span className="font-bold text-slate-700">{res.primaryGuest?.firstName} {res.primaryGuest?.lastName}</span>
                        <span className="font-mono text-sm bg-slate-100 px-2 py-1 rounded text-slate-600">{res.reservationRooms?.[0]?.room?.number || 'N/A'}</span>
                        </div>
                    ))}
                    </div>
                )}
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="space-y-2 relative">
                        <label className="block text-sm font-bold text-slate-700 flex justify-between">
                            Phone Number
                            {matchingGuest && <span className="text-cyan-600 text-xs bg-cyan-50 px-2 py-0.5 rounded-full">Existing Guest Found</span>}
                        </label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                            <input 
                                type="tel"
                                required
                                placeholder="Enter phone number..."
                                className="w-full h-12 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-cyan-500"
                                value={walkInDetails.phone}
                                onChange={(e) => handleWalkInPhoneChange(e.target.value)}
                            />
                            {searchingWalkIn && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 animate-spin" />}
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-slate-700">First Name</label>
                            <input 
                                type="text"
                                required
                                disabled={!!matchingGuest}
                                className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-60"
                                value={walkInDetails.firstName}
                                onChange={(e) => setWalkInDetails(prev => ({ ...prev, firstName: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-slate-700">Last Name (Optional)</label>
                            <input 
                                type="text"
                                disabled={!!matchingGuest}
                                className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-60"
                                value={walkInDetails.lastName}
                                onChange={(e) => setWalkInDetails(prev => ({ ...prev, lastName: e.target.value }))}
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700">Service Type</label>
              <select 
                className="w-full h-12 border border-slate-200 rounded-xl bg-slate-50 px-3 text-slate-700 font-medium outline-none focus:ring-2 focus:ring-cyan-500" 
                value={serviceType} 
                onChange={e => setServiceType(e.target.value)}
              >
                <option value="STANDARD">Standard (Regular Price)</option>
                <option value="EXPRESS">Express (50% Surcharge)</option>
                <option value="DRY_CLEAN">Dry Clean (100% Surcharge)</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <label className="block text-lg font-bold text-slate-900">Laundry Items</label>
              <span className="font-bold text-slate-500 text-xl">Total: <span className="text-cyan-700">{formatCurrency(currentTotal, 'NGN')}</span></span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map(item => {
                const qty = selectedItems[item.id] || 0;
                const isSelected = qty > 0;
                
                let displayPrice = Number(item.basePrice);
                if (item.servicePricingRules && item.servicePricingRules[serviceType]) {
                    const rule = item.servicePricingRules[serviceType];
                    if (rule.type === 'FIXED') displayPrice = rule.amount;
                    else if (rule.type === 'MULTIPLIER') displayPrice = displayPrice * rule.value;
                } else {
                    displayPrice = displayPrice * getMultiplier(serviceType);
                }
                
                return (
                  <div key={item.id} className={`border p-4 rounded-2xl flex justify-between items-center transition-colors ${isSelected ? 'border-cyan-300 bg-cyan-50/30 shadow-sm' : 'border-slate-100 bg-slate-50/50'}`}>
                    <div>
                      <p className={`font-bold ${isSelected ? 'text-cyan-900' : 'text-slate-700'}`}>{item.name}</p>
                      <p className="text-sm font-medium text-slate-500">
                        {formatCurrency(displayPrice, item.currency)}
                        {serviceType !== 'STANDARD' && <span className="text-xs text-amber-600 ml-2">({serviceType.replace('_', ' ')})</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button type="button" variant="outline" size="sm" className="h-8 w-8 p-0 rounded-full" onClick={() => setSelectedItems({ ...selectedItems, [item.id]: Math.max(0, qty - 1) })}>-</Button>
                      <span className="font-bold w-6 text-center">{qty}</span>
                      <Button type="button" variant="outline" size="sm" className="h-8 w-8 p-0 rounded-full border-cyan-200 text-cyan-700 hover:bg-cyan-100" onClick={() => setSelectedItems({ ...selectedItems, [item.id]: qty + 1 })}>+</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <Button type="submit" disabled={loading} className="h-14 px-8 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold shadow-lg shadow-cyan-600/20 text-lg">
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
              Place Order ({formatCurrency(currentTotal, 'NGN')})
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
