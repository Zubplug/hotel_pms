import { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/Label';
import { Switch } from '@/components/ui/switch';
import { Save } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Settings | F&B Management',
};

export default function FnbSettingsPage() {
  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">F&B Settings</h1>
          <p className="text-muted-foreground mt-1">Configure outlet parameters and printing routing.</p>
        </div>
        <Button>
          <Save className="mr-2 h-4 w-4" /> Save Changes
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Kitchen Printing Routing</CardTitle>
            <CardDescription>Configure where different categories print.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Hot Food KOT Printer IP</Label>
              <Input placeholder="192.168.1.100" defaultValue="192.168.1.100" />
            </div>
            <div className="space-y-2">
              <Label>Bar Printer IP</Label>
              <Input placeholder="192.168.1.101" defaultValue="192.168.1.101" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inventory Controls</CardTitle>
            <CardDescription>Automated alerts and AvT tolerances.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="flex-1">Enable Low Stock Alerts</Label>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label className="flex-1">Auto-Draft Requisitions on Low Stock</Label>
              <Switch />
            </div>
            <div className="space-y-2 pt-2">
              <Label>Acceptable AvT Variance (%)</Label>
              <Input type="number" defaultValue="3.0" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
