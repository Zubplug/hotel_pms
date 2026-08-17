'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, MonitorCheck, Loader2 } from 'lucide-react';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';

export default function DeviceRegistrationPage() {
  const router = useRouter();
  const { data: session, status } = useLodgeCoreSession();
  const propertyId = (session?.user as any)?.propertyId || '';
  const [deviceName, setDeviceName] = useState('');
  const [outletId, setOutletId] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [outlets, setOutlets] = useState<any[]>([]);

  React.useEffect(() => {
    if (propertyId) {
      fetch(`/api/v1/pos/outlets?propertyId=${propertyId}`)
        .then(res => res.json())
        .then(data => {
          if (data.data) {
            setOutlets(data.data);
          }
        })
        .catch(console.error);
    }
  }, [propertyId]);

  const role = (session?.user as any)?.role;
  const needsAdminOverride = role !== 'SUPER_ADMIN' && role !== 'HOTEL_MANAGER';

  // Helper to generate a unique device identifier
  const generateDeviceIdentifier = () => {
    return 'dev_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName.trim()) {
      setError('Device name is required');
      return;
    }

    setLoading(true);
    setError('');

    const identifier = generateDeviceIdentifier();

    try {
      const res = await fetch('/api/v1/pos/devices/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          name: deviceName,
          identifier,
          outletId: outletId || null,
          adminEmail: needsAdminOverride ? adminEmail : undefined,
          adminPassword: needsAdminOverride ? adminPassword : undefined
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to register device');
      }

      // Store in localStorage for web clients
      // For desktop, this would ideally use IPC to store in SQLite
      localStorage.setItem('lodgecore_pos_device_id', identifier);
      
      setSuccess(true);
      setTimeout(() => {
        router.push('/pos/start-shift');
      }, 2000);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0a0a0a]">
        <div className="w-full max-w-md bg-white dark:bg-[#1a1a1a] rounded-xl shadow-xl border border-gray-100 dark:border-[#2a2a2a] p-8 text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
            <MonitorCheck className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Device Registered</h2>
          <p className="text-gray-500 dark:text-gray-400">
            This terminal has been successfully registered. Redirecting to shift start...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0a0a0a] p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#1a1a1a] rounded-xl shadow-xl border border-gray-100 dark:border-[#2a2a2a] overflow-hidden">
        <div className="bg-indigo-600 px-6 py-8 text-center">
          <MonitorCheck className="w-12 h-12 text-white/90 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white">Device Registration</h2>
          <p className="text-indigo-100 mt-2 text-sm">
            Register this physical terminal to your LodgeCore PMS
          </p>
        </div>

        <form onSubmit={handleRegister} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-lg flex gap-3 text-red-600 dark:text-red-400">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Device Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={deviceName}
                onChange={e => setDeviceName(e.target.value)}
                placeholder="e.g. Main Restaurant Till 1"
                className="w-full px-4 py-2 bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#2a2a2a] rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-900 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Default Outlet (Optional)
              </label>
              <select
                value={outletId}
                onChange={e => setOutletId(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#2a2a2a] rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-900 dark:text-white"
              >
                <option value="">Floating Terminal (No fixed outlet)</option>
                {outlets.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Leaving this blank makes this a floating terminal.
              </p>
            </div>
            
            {needsAdminOverride && (
              <div className="pt-4 mt-4 border-t border-gray-100 dark:border-[#2a2a2a] space-y-4">
                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-100 dark:border-amber-800/30">
                  <p className="text-sm text-amber-800 dark:text-amber-400 font-medium">
                    Admin Authorization Required
                  </p>
                  <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-1">
                    Your account does not have permission to register a new device. Please have a Manager or Super Admin enter their credentials to authorize this action.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Admin Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={e => setAdminEmail(e.target.value)}
                    placeholder="manager@hotel.com"
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#2a2a2a] rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all text-gray-900 dark:text-white"
                    required={needsAdminOverride}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Admin Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={e => setAdminPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#2a2a2a] rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all text-gray-900 dark:text-white"
                    required={needsAdminOverride}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Registering...
                </>
              ) : (
                'Register Device'
              )}
            </button>
          </div>
          
          <div className="text-center text-xs text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-100 dark:border-[#2a2a2a]">
            Requires HOTEL_MANAGER or SUPER_ADMIN privileges
          </div>
        </form>
      </div>
    </div>
  );
}
