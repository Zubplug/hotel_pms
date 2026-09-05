import { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, DollarSign, Users, Utensils, TableProperties, Clock, AlertTriangle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'F&B Dashboard | LodgeCore',
  description: 'Overview of Food and Beverage operations.',
};

export default function FnbDashboardPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">F&B Dashboard</h1>
          <p className="text-muted-foreground mt-1">Real-time overview of outlet performance and operations.</p>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Sales (Today)</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦1,254,300</div>
            <p className="text-xs text-muted-foreground">+12.5% from yesterday</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-muted-foreground">8 preparing, 16 served</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Open Tables</CardTitle>
            <TableProperties className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">18 / 45</div>
            <p className="text-xs text-muted-foreground">40% capacity utilization</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Avg. Turnaround</CardTitle>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">42m</div>
            <p className="text-xs text-muted-foreground">-3m from average</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Revenue Breakdown */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Sales Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center border-2 border-dashed rounded-md">
              <span className="text-muted-foreground">Revenue Chart Placeholder (Room Charge vs Cash vs Card)</span>
            </div>
          </CardContent>
        </Card>

        {/* Operational Alerts */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Operational Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start space-x-4 border-l-4 border-yellow-500 pl-4 py-2 bg-yellow-50/50 dark:bg-yellow-900/10 rounded-r-md">
                <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold">Low Stock Alert</h4>
                  <p className="text-xs text-muted-foreground">Premium Gin is below minimum threshold (2 bottles remaining).</p>
                </div>
              </div>

              <div className="flex items-start space-x-4 border-l-4 border-red-500 pl-4 py-2 bg-red-50/50 dark:bg-red-900/10 rounded-r-md">
                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold">High Void Rate</h4>
                  <p className="text-xs text-muted-foreground">Waitstaff 'John D.' has voided 4 items in the last hour.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4 border-l-4 border-blue-500 pl-4 py-2 bg-blue-50/50 dark:bg-blue-900/10 rounded-r-md">
                <Clock className="w-5 h-5 text-blue-500 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold">Slow KOT Processing</h4>
                  <p className="text-xs text-muted-foreground">Main Kitchen is averaging 22 mins per ticket (Target: 15m).</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Popular Items */}
      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Selling Items (Today)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: 'Grilled Salmon', category: 'Mains', qty: 34, revenue: '₦289,000' },
                { name: 'Caesar Salad', category: 'Starters', qty: 28, revenue: '₦98,000' },
                { name: 'Mojito', category: 'Drinks', qty: 45, revenue: '₦157,500' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="bg-primary/10 p-2 rounded-full">
                      <Utensils className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium leading-none">{item.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{item.category}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{item.revenue}</p>
                    <p className="text-xs text-muted-foreground">{item.qty} ordered</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
