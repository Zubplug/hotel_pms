import Link from 'next/link';
import { 
  Key, 
  Building2, 
  Users, 
  CreditCard,
  Bell,
  MonitorSmartphone,
  ShieldCheck,
  Store
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const settingsLinks = [
  {
    title: 'General',
    description: 'Manage your property details, timezone, and contact information.',
    href: '/settings/general',
    icon: Building2,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10'
  },
  {
    title: 'Hardware Devices',
    description: 'Configure physical door locks, key encoders, and Windows agents.',
    href: '/settings/hardware',
    icon: Key,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10'
  },
  {
    title: 'Team & Roles',
    description: 'Manage staff access, front-desk accounts, and permissions.',
    href: '/settings/team',
    icon: Users,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10'
  },
  {
    title: 'Billing & Payments',
    description: 'Configure payment gateways, invoices, and deposit policies.',
    href: '/settings/billing',
    icon: CreditCard,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10'
  },
  {
    title: 'Security',
    description: 'Manage 2FA, password requirements, and audit logs.',
    href: '/settings/security',
    icon: ShieldCheck,
    color: 'text-rose-500',
    bgColor: 'bg-rose-500/10'
  },
  {
    title: 'Notifications',
    description: 'Configure email alerts and automated guest communications.',
    href: '/settings/notifications',
    icon: Bell,
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/10'
  },
  {
    title: 'Integrations',
    description: 'Connect to external OTAs, POS systems, and other software.',
    href: '/settings/integrations',
    icon: MonitorSmartphone,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-500/10'
  },
  {
    title: 'POS Outlets',
    description: 'Manage POS settings, banking models, and physical outlets.',
    href: '/settings/pos',
    icon: Store,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10'
  }
];

export default function SettingsHubPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your property configuration and LodgeCore preferences.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {settingsLinks.map((setting) => {
          const Icon = setting.icon;
          return (
            <Link key={setting.href} href={setting.href}>
              <Card className="h-full hover:border-primary/50 hover:shadow-md transition-all duration-200 cursor-pointer group">
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${setting.bgColor} group-hover:scale-110 transition-transform duration-200`}>
                    <Icon className={`w-6 h-6 ${setting.color}`} />
                  </div>
                  <CardTitle className="text-xl">{setting.title}</CardTitle>
                  <CardDescription className="text-sm mt-2">
                    {setting.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
