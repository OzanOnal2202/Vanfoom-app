import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/i18n/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Shield, User as UserIcon, Lock, Headphones, Clock, CheckCircle, XCircle, Trash2, Settings2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';

type AppRole = 'monteur' | 'admin' | 'foh';

const AVAILABLE_PERMISSIONS = [
  'inventory',
  'pricelist',
  'tv_announcements',
  'warranty',
  'call_status',
  'availability',
] as const;

type FeaturePermission = typeof AVAILABLE_PERMISSIONS[number];

interface UserAccount {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  is_approved: boolean;
  created_at: string;
  role: AppRole;
  permissions: FeaturePermission[];
}

export function AccountManagement() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const dateLocale = language === 'nl' ? nl : enUS;
  
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [approvingAccount, setApprovingAccount] = useState<string | null>(null);
  const [adminPasswordDialog, setAdminPasswordDialog] = useState<{ open: boolean; accountId: string | null }>({ open: false, accountId: null });
  const [adminPassword, setAdminPassword] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState<string | null>(null);
  const [permissionsDialog, setPermissionsDialog] = useState<{ open: boolean; account: UserAccount | null }>({ open: false, account: null });

  useEffect(() => {
    fetchAccounts();
  }, []);

  const getPermissionLabel = (perm: FeaturePermission) => {
    const map: Record<FeaturePermission, string> = {
      inventory: t('permInventory'),
      pricelist: t('permPricelist'),
      tv_announcements: t('permTvAnnouncements'),
      warranty: t('permWarranty'),
      call_status: t('permCallStatus'),
      availability: t('permAvailability'),
    };
    return map[perm];
  };

  const fetchAccounts = async () => {
    setLoading(true);
    
    // Fetch profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, full_name, is_active, is_approved, created_at')
      .order('created_at', { ascending: false });

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      setLoading(false);
      return;
    }

    // Fetch roles and permissions in parallel
    const [{ data: roles }, { data: permissions }] = await Promise.all([
      supabase.from('user_roles').select('user_id, role'),
      supabase.from('user_permissions').select('user_id, permission'),
    ]);

    const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);
    
    const permMap = new Map<string, FeaturePermission[]>();
    permissions?.forEach(p => {
      const existing = permMap.get(p.user_id) || [];
      existing.push(p.permission as FeaturePermission);
      permMap.set(p.user_id, existing);
    });

    const accountsData: UserAccount[] = (profiles || []).map(p => ({
      id: p.id,
      email: p.email,
      full_name: p.full_name,
      is_active: p.is_active ?? true,
      is_approved: p.is_approved ?? false,
      created_at: p.created_at,
      role: (roleMap.get(p.id) as AppRole) || 'monteur',
      permissions: permMap.get(p.id) || [],
    }));

    setAccounts(accountsData);
    setLoading(false);
  };

  const approveAccount = async (accountId: string) => {
    setApprovingAccount(accountId);
    
    const { error } = await supabase
      .from('profiles')
      .update({ is_approved: true, is_active: true })
      .eq('id', accountId);

    if (error) {
      toast.error(t('error'));
      console.error('Error approving account:', error);
    } else {
      setAccounts(prev => 
        prev.map(a => a.id === accountId ? { ...a, is_approved: true, is_active: true } : a)
      );
      toast.success(t('accountApproved'));
    }
    
    setApprovingAccount(null);
  };

  const rejectAccount = async (accountId: string) => {
    setApprovingAccount(accountId);
    
    try {
      // Delete the user completely so they can register again with the same email
      const response = await supabase.functions.invoke('delete-user', {
        body: { userId: accountId },
      });

      if (response.error) {
        console.error('Error rejecting account:', response.error);
        toast.error(t('error'));
      } else if (response.data?.error) {
        console.error('Error from delete-user:', response.data.error);
        toast.error(response.data.error);
      } else {
        setAccounts(prev => prev.filter(a => a.id !== accountId));
        toast.success(t('accountRejected'));
      }
    } catch (error) {
      console.error('Error rejecting account:', error);
      toast.error(t('error'));
    }
    
    setApprovingAccount(null);
  };

  const togglePermission = async (accountId: string, permission: FeaturePermission, hasPermission: boolean) => {
    if (hasPermission) {
      // Remove permission
      await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', accountId)
        .eq('permission', permission);
    } else {
      // Add permission
      await supabase
        .from('user_permissions')
        .insert({ user_id: accountId, permission, granted_by: user?.id });
    }

    // Update local state
    setAccounts(prev => prev.map(a => {
      if (a.id !== accountId) return a;
      const newPerms = hasPermission
        ? a.permissions.filter(p => p !== permission)
        : [...a.permissions, permission];
      return { ...a, permissions: newPerms };
    }));

    // Update dialog state too
    setPermissionsDialog(prev => {
      if (!prev.account || prev.account.id !== accountId) return prev;
      const newPerms = hasPermission
        ? prev.account.permissions.filter(p => p !== permission)
        : [...prev.account.permissions, permission];
      return { ...prev, account: { ...prev.account, permissions: newPerms } };
    });

    toast.success(t('permissionsUpdated'));
  };

  const changeRole = async (accountId: string, newRole: AppRole) => {
    // Prevent changing own role
    if (accountId === user?.id) {
      toast.error(t('cannotChangeOwnRole'));
      return;
    }

    // If changing to admin, require password
    if (newRole === 'admin') {
      setAdminPasswordDialog({ open: true, accountId });
      return;
    }

    // Changing to monteur or foh doesn't need password
    await executeRoleChange(accountId, newRole);
  };

  const executeRoleChange = async (accountId: string, newRole: AppRole) => {
    setUpdatingRole(accountId);
    
    const { error } = await supabase
      .from('user_roles')
      .update({ role: newRole })
      .eq('user_id', accountId);

    if (error) {
      toast.error(t('error'));
      console.error('Error updating role:', error);
    } else {
      setAccounts(prev => 
        prev.map(a => a.id === accountId ? { ...a, role: newRole } : a)
      );
      toast.success(t('roleUpdated'));
    }
    
    setUpdatingRole(null);
  };

  const handleAdminPasswordSubmit = async () => {
    if (!adminPasswordDialog.accountId || !adminPassword) return;

    setVerifyingPassword(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('verify-admin-password', {
        body: { 
          password: adminPassword,
          targetUserId: adminPasswordDialog.accountId
        },
      });

      if (response.error || !response.data?.valid) {
        toast.error(response.data?.error || t('invalidPassword'));
      } else {
        setAccounts(prev => 
          prev.map(a => a.id === adminPasswordDialog.accountId ? { ...a, role: 'admin' } : a)
        );
        toast.success(t('roleUpdated'));
        setAdminPasswordDialog({ open: false, accountId: null });
        setAdminPassword('');
      }
    } catch (error) {
      console.error('Error verifying password:', error);
      toast.error(t('error'));
    }

    setVerifyingPassword(false);
  };

  const deleteAccount = async (accountId: string) => {
    if (accountId === user?.id) {
      toast.error(t('cannotDeleteOwnAccount'));
      return;
    }

    setDeletingAccount(accountId);

    try {
      // Use edge function to delete both profile AND auth user
      const response = await supabase.functions.invoke('delete-user', {
        body: { userId: accountId },
      });

      if (response.error) {
        console.error('Error deleting account:', response.error);
        toast.error(t('error'));
      } else if (response.data?.error) {
        console.error('Error from delete-user:', response.data.error);
        toast.error(response.data.error);
      } else {
        setAccounts(prev => prev.filter(a => a.id !== accountId));
        toast.success(t('accountDeleted'));
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error(t('error'));
    }

    setDeletingAccount(null);
  };

  const filteredAccounts = accounts.filter(account =>
    account.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    account.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingApprovals = accounts.filter(a => !a.is_approved && a.is_active);
  const approvedAccounts = filteredAccounts.filter(a => a.is_approved);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending Approvals Section */}
      {pendingApprovals.length > 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              <CardTitle>{t('pendingApprovals')}</CardTitle>
              <Badge variant="secondary" className="ml-2">{pendingApprovals.length}</Badge>
            </div>
            <CardDescription>{t('pendingApprovalsDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingApprovals.map(account => (
                <div key={account.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                  <div className="flex-1">
                    <p className="font-medium">{account.full_name}</p>
                    <p className="text-sm text-muted-foreground">{account.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('createdAt')}: {format(new Date(account.created_at), 'dd MMM yyyy HH:mm', { locale: dateLocale })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => approveAccount(account.id)}
                      disabled={approvingAccount === account.id}
                      className="gap-1"
                    >
                      <CheckCircle className="h-4 w-4" />
                      {t('approveAccount')}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => rejectAccount(account.id)}
                      disabled={approvingAccount === account.id}
                      className="gap-1"
                    >
                      <XCircle className="h-4 w-4" />
                      {t('rejectAccount')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <UserIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{accounts.filter(a => a.is_approved).length}</p>
                <p className="text-sm text-muted-foreground">{t('totalAccounts')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-warning/10">
                <Clock className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingApprovals.length}</p>
                <p className="text-sm text-muted-foreground">{t('pendingApprovals')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Account List */}
      <Card>
        <CardHeader>
          <CardTitle>{t('accountManagement')}</CardTitle>
          <CardDescription>{t('accountManagementDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('searchAccounts')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">{t('fullName')}</TableHead>
                      <TableHead className="whitespace-nowrap">{t('email')}</TableHead>
                      <TableHead className="whitespace-nowrap">{t('role')}</TableHead>
                      <TableHead className="whitespace-nowrap">{t('createdAt')}</TableHead>
                      <TableHead className="text-right whitespace-nowrap">{t('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvedAccounts.map(account => (
                      <TableRow key={account.id} className={!account.is_active ? 'opacity-60' : ''}>
                        <TableCell className="font-medium whitespace-nowrap">{account.full_name}</TableCell>
                        <TableCell className="whitespace-nowrap">{account.email}</TableCell>
                        <TableCell>
                          <Select
                            value={account.role}
                            onValueChange={(value: AppRole) => changeRole(account.id, value)}
                            disabled={updatingRole === account.id || account.id === user?.id}
                          >
                            <SelectTrigger className="w-[130px]">
                              <SelectValue>
                                {account.role === 'admin' ? (
                                  <span className="flex items-center gap-1">
                                    <Shield className="h-3 w-3" /> Admin
                                  </span>
                                ) : account.role === 'foh' ? (
                                  <span className="flex items-center gap-1">
                                    <Headphones className="h-3 w-3" /> FOH
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1">
                                    <UserIcon className="h-3 w-3" /> Monteur
                                  </span>
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="monteur">
                                <span className="flex items-center gap-2">
                                  <UserIcon className="h-3 w-3" /> Monteur
                                </span>
                              </SelectItem>
                              <SelectItem value="foh">
                                <span className="flex items-center gap-2">
                                  <Headphones className="h-3 w-3" /> FOH
                                </span>
                              </SelectItem>
                              <SelectItem value="admin">
                                <span className="flex items-center gap-2">
                                  <Shield className="h-3 w-3" /> Admin
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(account.created_at), 'dd MMM yyyy', { locale: dateLocale })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {account.role !== 'admin' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setPermissionsDialog({ open: true, account })}
                                title={t('managePermissions')}
                              >
                                <Settings2 className="h-4 w-4" />
                              </Button>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  disabled={account.id === user?.id || deletingAccount === account.id}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t('deleteAccountTitle')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                    {t('deleteAccountDescription')}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteAccount(account.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    {deletingAccount === account.id ? t('deleting') : t('delete')}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {approvedAccounts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          {t('noAccountsFound')}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admin Password Dialog */}
      <Dialog open={adminPasswordDialog.open} onOpenChange={(open) => {
        if (!open) {
          setAdminPasswordDialog({ open: false, accountId: null });
          setAdminPassword('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              {t('enterAdminPassword')}
            </DialogTitle>
            <DialogDescription>
              {t('enterAdminPasswordDesc')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleAdminPasswordSubmit(); }}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="admin-password">{t('adminPassword')}</Label>
                <Input
                  id="admin-password"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setAdminPasswordDialog({ open: false, accountId: null });
                  setAdminPassword('');
                }}
              >
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={verifyingPassword || !adminPassword}>
                {verifyingPassword ? t('verifying') : t('confirm')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      <Dialog open={permissionsDialog.open} onOpenChange={(open) => {
        if (!open) setPermissionsDialog({ open: false, account: null });
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              {t('featurePermissions')}
            </DialogTitle>
            <DialogDescription>
              {permissionsDialog.account?.full_name} — {t('managePermissions')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {AVAILABLE_PERMISSIONS.map(perm => {
              const hasPerm = permissionsDialog.account?.permissions.includes(perm) ?? false;
              return (
                <div key={perm} className="flex items-center space-x-3">
                  <Checkbox
                    id={`perm-${perm}`}
                    checked={hasPerm}
                    onCheckedChange={() => {
                      if (permissionsDialog.account) {
                        togglePermission(permissionsDialog.account.id, perm, hasPerm);
                      }
                    }}
                  />
                  <Label htmlFor={`perm-${perm}`} className="cursor-pointer">
                    {getPermissionLabel(perm)}
                  </Label>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
