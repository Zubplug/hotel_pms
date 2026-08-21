'use client';

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RoleForm } from './RoleForm';
import { toast } from 'sonner';

export function RolesManagement() {
  const [roles, setRoles] = useState<any[]>([]);
  const [permissionsDictionary, setPermissionsDictionary] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<any | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        fetch('/api/v1/roles'),
        fetch('/api/v1/permissions')
      ]);

      if (!rolesRes.ok) throw new Error('Failed to fetch roles');
      if (!permsRes.ok) throw new Error('Failed to fetch permissions');

      const rolesData = await rolesRes.json();
      const permsData = await permsRes.json();

      setRoles(rolesData.data);
      setPermissionsDictionary(permsData.data);
    } catch (error) {
      toast.error('Failed to load roles and permissions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEdit = (role: any) => {
    setSelectedRole(role);
    setIsFormOpen(true);
  };

  const handleAddNew = () => {
    setSelectedRole(null);
    setIsFormOpen(true);
  };

  const handleDelete = async (roleId: string) => {
    if (!confirm('Are you sure you want to delete this custom role? This will remove it from all users.')) return;

    try {
      const res = await fetch(`/api/v1/roles/${roleId}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete role');
      }
      toast.success('Role deleted');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const getRiskBadge = (role: any) => {
    const hasCritical = role.permissions?.some((p: any) => p.permission.riskLevel === 'CRITICAL');
    const hasHigh = role.permissions?.some((p: any) => p.permission.riskLevel === 'HIGH');
    const hasMedium = role.permissions?.some((p: any) => p.permission.riskLevel === 'MEDIUM');

    if (hasCritical) return <Badge variant="destructive" className="bg-red-600">CRITICAL RISK</Badge>;
    if (hasHigh) return <Badge variant="destructive" className="bg-orange-500">HIGH RISK</Badge>;
    if (hasMedium) return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700">MEDIUM RISK</Badge>;
    return <Badge variant="outline">LOW RISK</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleAddNew}>
          <Plus className="w-4 h-4 mr-2" />
          Add Custom Role
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Role Management</CardTitle>
          <CardDescription>Configure system baselines and custom roles for your team.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      Loading roles...
                    </TableCell>
                  </TableRow>
                ) : roles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No roles found.
                    </TableCell>
                  </TableRow>
                ) : (
                  roles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">
                        {role.name}
                        {role.description && (
                          <div className="text-xs text-muted-foreground font-normal mt-1">{role.description}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {role.isSystem ? (
                          <Badge variant="secondary">System Baseline</Badge>
                        ) : (
                          <Badge variant="outline">Custom</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {role.permissions?.length || 0} permissions
                        </span>
                      </TableCell>
                      <TableCell>
                        {getRiskBadge(role)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(role)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        {!role.isSystem && (
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(role.id)} className="text-red-500 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {isFormOpen && (
        <RoleForm
          role={selectedRole}
          permissionsDictionary={permissionsDictionary}
          onClose={() => setIsFormOpen(false)}
          onSaved={() => {
            setIsFormOpen(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
