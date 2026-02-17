import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import type { Database } from '@/integrations/supabase/types';

type VanmoofModel = Database['public']['Enums']['vanmoof_model'];
const VANMOOF_MODELS: VanmoofModel[] = ['S1', 'S2', 'S3', 'S5', 'S6', 'X1', 'X2', 'X3', 'X5', 'A5'];
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/i18n/LanguageContext';
import { Package, AlertTriangle, TrendingDown, Minus, Plus, PlusCircle, Search, ChevronDown, ChevronUp, FolderOpen, Trash2, Settings2, Infinity, MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface InventoryItem {
  id: string;
  repair_type_id: string;
  quantity: number;
  min_stock_level: number;
  purchase_price: number;
  group_id: string | null;
  unlimited_stock: boolean;
  repair_types: {
    id: string;
    name: string;
    price: number;
  };
}

interface InventoryGroup {
  id: string;
  name: string;
  quantity: number;
  min_stock_level: number;
  created_at: string;
}

export function InventoryManagement() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, NodeJS.Timeout>>({});
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLowStockAlert, setShowLowStockAlert] = useState(true);
  const [newGroupName, setNewGroupName] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [showStockWarningsInDiagnosis, setShowStockWarningsInDiagnosis] = useState(() => {
    const saved = localStorage.getItem('showStockWarningsInDiagnosis');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<InventoryItem | null>(null);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [editForm, setEditForm] = useState({ name: '', price: 0, points: 1, models: [] as string[] });
  useEffect(() => {
    localStorage.setItem('showStockWarningsInDiagnosis', JSON.stringify(showStockWarningsInDiagnosis));
  }, [showStockWarningsInDiagnosis]);

  const [newProduct, setNewProduct] = useState({
    name: '',
    price: 0,
    points: 1,
    quantity: 0,
    min_stock_level: 5,
    purchase_price: 0,
  });

  const { data: inventory, isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select(`
          id,
          repair_type_id,
          quantity,
          min_stock_level,
          purchase_price,
          group_id,
          unlimited_stock,
          repair_types (
            id,
            name,
            price
          )
        `)
        .order('quantity', { ascending: true });

      if (error) throw error;
      return data as InventoryItem[];
    },
  });

  const { data: groups } = useQuery({
    queryKey: ['inventory-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_groups')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as InventoryGroup[];
    },
  });

  const autoSaveMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: 'quantity' | 'min_stock_level' | 'purchase_price'; value: number }) => {
      const { error } = await supabase
        .from('inventory')
        .update({ [field]: field === 'quantity' ? Math.max(0, value) : value })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory'] }),
    onError: (error) => toast({ title: t('error'), description: error.message, variant: 'destructive' }),
  });

  const handleFieldChange = (id: string, field: 'quantity' | 'min_stock_level' | 'purchase_price', value: number) => {
    const key = `${id}-${field}`;
    if (pendingUpdates[key]) clearTimeout(pendingUpdates[key]);
    const timeout = setTimeout(() => {
      autoSaveMutation.mutate({ id, field, value });
      setPendingUpdates(prev => { const updated = { ...prev }; delete updated[key]; return updated; });
    }, 500);
    setPendingUpdates(prev => ({ ...prev, [key]: timeout }));
  };

  const quickUpdateMutation = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      const { error } = await supabase.from('inventory').update({ quantity: Math.max(0, quantity) }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory'] }),
    onError: (error) => toast({ title: t('error'), description: error.message, variant: 'destructive' }),
  });

  const groupQuickUpdateMutation = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      const { error } = await supabase.from('inventory_groups').update({ quantity: Math.max(0, quantity) }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory-groups'] }),
    onError: (error) => toast({ title: t('error'), description: error.message, variant: 'destructive' }),
  });

  const handleGroupFieldChange = (id: string, field: 'quantity' | 'min_stock_level', value: number) => {
    const key = `group-${id}-${field}`;
    if (pendingUpdates[key]) clearTimeout(pendingUpdates[key]);
    const timeout = setTimeout(() => {
      supabase.from('inventory_groups').update({ [field]: field === 'quantity' ? Math.max(0, value) : value }).eq('id', id)
        .then(({ error }) => {
          if (error) toast({ title: t('error'), description: error.message, variant: 'destructive' });
          else queryClient.invalidateQueries({ queryKey: ['inventory-groups'] });
        });
      setPendingUpdates(prev => { const updated = { ...prev }; delete updated[key]; return updated; });
    }, 500);
    setPendingUpdates(prev => ({ ...prev, [key]: timeout }));
  };

  const assignGroupMutation = useMutation({
    mutationFn: async ({ id, group_id }: { id: string; group_id: string | null }) => {
      const { error } = await supabase.from('inventory').update({ group_id }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory'] }),
    onError: (error) => toast({ title: t('error'), description: error.message, variant: 'destructive' }),
  });

  const addGroupMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from('inventory_groups').insert({ name });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-groups'] });
      setNewGroupName('');
      toast({ title: t('groupAdded'), description: t('groupAddedDesc') });
    },
    onError: (error) => toast({ title: t('error'), description: error.message, variant: 'destructive' }),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('inventory_groups').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-groups'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast({ title: t('groupDeleted'), description: t('groupDeletedDesc') });
    },
    onError: (error) => toast({ title: t('error'), description: error.message, variant: 'destructive' }),
  });

  const addProductMutation = useMutation({
    mutationFn: async (product: typeof newProduct) => {
      const { data: repairType, error: repairError } = await supabase
        .from('repair_types')
        .insert({ name: product.name, price: product.price, points: product.points })
        .select('id')
        .single();
      if (repairError) throw repairError;

      const { error: inventoryError } = await supabase
        .from('inventory')
        .update({ quantity: product.quantity, min_stock_level: product.min_stock_level, purchase_price: product.purchase_price })
        .eq('repair_type_id', repairType.id);
      if (inventoryError) throw inventoryError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['repair-types'] });
      setIsAddDialogOpen(false);
      setNewProduct({ name: '', price: 0, points: 1, quantity: 0, min_stock_level: 5, purchase_price: 0 });
      toast({ title: t('productAdded'), description: t('productAddedDesc') });
    },
    onError: (error) => toast({ title: t('error'), description: error.message, variant: 'destructive' }),
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (item: InventoryItem) => {
      // Delete inventory entry first (cascade won't handle this)
      const { error: invError } = await supabase.from('inventory').delete().eq('id', item.id);
      if (invError) throw invError;
      // Delete related work_registrations
      await supabase.from('work_registrations').delete().eq('repair_type_id', item.repair_type_id);
      // Delete repair_type_models
      await supabase.from('repair_type_models').delete().eq('repair_type_id', item.repair_type_id);
      // Delete the repair type itself
      const { error: rtError } = await supabase.from('repair_types').delete().eq('id', item.repair_type_id);
      if (rtError) throw rtError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['repair-types'] });
      setDeleteConfirmItem(null);
      toast({ title: t('productDeleted'), description: t('productDeletedDesc') });
    },
    onError: (error) => toast({ title: t('error'), description: error.message, variant: 'destructive' }),
  });

  const toggleUnlimitedMutation = useMutation({
    mutationFn: async ({ id, unlimited_stock }: { id: string; unlimited_stock: boolean }) => {
      const { error } = await supabase.from('inventory').update({ unlimited_stock }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory'] }),
    onError: (error) => toast({ title: t('error'), description: error.message, variant: 'destructive' }),
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ repairTypeId, name, price, points, models }: { repairTypeId: string; name: string; price: number; points: number; models: string[] }) => {
      const { error } = await supabase.from('repair_types').update({ name, price, points }).eq('id', repairTypeId);
      if (error) throw error;
      // Update model mappings
      await supabase.from('repair_type_models').delete().eq('repair_type_id', repairTypeId);
      if (models.length > 0) {
        const { error: mapErr } = await supabase.from('repair_type_models').insert(
          models.map(model => ({ repair_type_id: repairTypeId, model }))
        );
        if (mapErr) throw mapErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['repair-types'] });
      setEditItem(null);
      toast({ title: t('productUpdated'), description: t('productUpdatedDesc') });
    },
    onError: (error) => toast({ title: t('error'), description: error.message, variant: 'destructive' }),
  });

  const openEditDialog = async (item: InventoryItem) => {
    setEditForm({ name: item.repair_types.name, price: item.repair_types.price, points: 1, models: [] });
    setEditItem(item);
    const [pointsRes, modelsRes] = await Promise.all([
      supabase.from('repair_types').select('points').eq('id', item.repair_type_id).single(),
      supabase.from('repair_type_models').select('model').eq('repair_type_id', item.repair_type_id),
    ]);
    setEditForm(prev => ({
      ...prev,
      points: pointsRes.data?.points ?? prev.points,
      models: modelsRes.data?.map(m => m.model) ?? [],
    }));
  };

  const handleAddProduct = () => {
    if (!newProduct.name.trim()) {
      toast({ title: t('error'), description: t('nameRequired'), variant: 'destructive' });
      return;
    }
    addProductMutation.mutate(newProduct);
  };

  const getStockStatus = (quantity: number, minLevel: number) => {
    if (quantity === 0) return 'out';
    if (quantity <= minLevel) return 'low';
    return 'ok';
  };

  // Compute group totals from individual item quantities
  const getGroupTotal = (groupId: string) => {
    return inventory?.filter(i => i.group_id === groupId && !i.unlimited_stock).reduce((sum, i) => sum + i.quantity, 0) ?? 0;
  };

  // For items in groups, use group stock (sum of items); for ungrouped, use individual stock
  const getEffectiveStock = (item: InventoryItem) => {
    if (item.group_id) {
      const group = groups?.find(g => g.id === item.group_id);
      return { quantity: getGroupTotal(item.group_id), minLevel: group?.min_stock_level ?? 5 };
    }
    return { quantity: item.quantity, minLevel: item.min_stock_level };
  };

  const lowStockItems = [
    ...(inventory?.filter(item => item.repair_types && !item.group_id && !item.unlimited_stock && item.quantity <= item.min_stock_level) || []),
  ];
  const lowStockGroups = groups?.filter(g => {
    const total = getGroupTotal(g.id);
    return total <= g.min_stock_level;
  }) || [];
  const outOfStockItems = inventory?.filter(item => item.repair_types && !item.group_id && !item.unlimited_stock && item.quantity === 0) || [];
  const outOfStockGroups = groups?.filter(g => getGroupTotal(g.id) === 0) || [];

  const filteredInventory = inventory?.filter(item =>
    item.repair_types && item.repair_types.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // Split into regular and unlimited items
  const regularItems = filteredInventory.filter(item => !item.unlimited_stock);
  const unlimitedItems = filteredInventory.filter(item => item.unlimited_stock);

  // Group regular items only
  const groupedInventory = useMemo(() => {
    const grouped: Record<string, { group: InventoryGroup | null; items: typeof regularItems }> = {};

    // Add defined groups
    groups?.forEach(g => {
      grouped[g.id] = { group: g, items: [] };
    });

    // Assign items to groups
    regularItems.forEach(item => {
      if (item.group_id && grouped[item.group_id]) {
        grouped[item.group_id].items.push(item);
      } else {
        if (!grouped['ungrouped']) grouped['ungrouped'] = { group: null, items: [] };
        grouped['ungrouped'].items.push(item);
      }
    });

    // Sort: groups with items first, then empty groups, ungrouped last
    const entries = Object.entries(grouped);
    entries.sort((a, b) => {
      if (a[0] === 'ungrouped') return 1;
      if (b[0] === 'ungrouped') return -1;
      return (a[1].group?.name || '').localeCompare(b[1].group?.name || '');
    });

    return entries;
  }, [regularItems, groups]);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const renderInventoryRow = (item: InventoryItem, isGrouped: boolean) => {
    const isUnlimited = item.unlimited_stock;
    const status = isUnlimited ? null : (isGrouped ? null : getStockStatus(item.quantity, item.min_stock_level));
    const stockPercentage = !isUnlimited && !isGrouped && item.min_stock_level > 0
      ? Math.min((item.quantity / (item.min_stock_level * 2)) * 100, 100)
      : 100;

    return (
      <TableRow key={item.id} className={!isGrouped && !isUnlimited ? (status === 'out' ? 'bg-destructive/5' : status === 'low' ? 'bg-amber-500/5' : '') : ''}>
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            {item.repair_types.name}
            {isUnlimited && <Infinity className="h-4 w-4 text-muted-foreground" />}
          </div>
        </TableCell>
        <TableCell>
          <Select
            value={item.group_id || 'none'}
            onValueChange={(val) => assignGroupMutation.mutate({ id: item.id, group_id: val === 'none' ? null : val })}
          >
            <SelectTrigger className="h-8 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('noGroup')}</SelectItem>
              {groups?.map(g => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        {isUnlimited ? (
            <>
              <TableCell className="text-center text-muted-foreground text-xs">∞</TableCell>
              <TableCell className="text-center text-muted-foreground text-xs">—</TableCell>
            </>
          ) : (
            <>
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => quickUpdateMutation.mutate({ id: item.id, quantity: item.quantity - 1 })}
                    disabled={item.quantity === 0}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <Input type="number" min="0" defaultValue={item.quantity} key={`q-${item.id}-${item.quantity}`}
                    onChange={(e) => handleFieldChange(item.id, 'quantity', parseInt(e.target.value) || 0)}
                    className="w-16 text-center h-8" />
                  <Button variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => quickUpdateMutation.mutate({ id: item.id, quantity: item.quantity + 1 })}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </TableCell>
              <TableCell className="text-center">
                {!isGrouped ? (
                  <Input type="number" min="0" defaultValue={item.min_stock_level}
                    onChange={(e) => handleFieldChange(item.id, 'min_stock_level', parseInt(e.target.value) || 0)}
                    className="w-16 mx-auto text-center h-8" />
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </TableCell>
            </>
          )}
        <TableCell className="text-center">
          <div className="flex items-center justify-center">
            <span className="text-muted-foreground mr-1">€</span>
            <Input type="number" min="0" step="0.01" defaultValue={(item.purchase_price || 0).toFixed(2)}
              onChange={(e) => handleFieldChange(item.id, 'purchase_price', parseFloat(e.target.value) || 0)}
              className="w-20 text-center h-8" />
          </div>
        </TableCell>
        {isUnlimited ? (
            <>
              <TableCell className="text-center">
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20">∞</Badge>
              </TableCell>
              <TableCell className="w-32">
                <Progress value={100} className="h-2 [&>div]:bg-emerald-500" />
              </TableCell>
            </>
          ) : isGrouped ? (
            <>
              <TableCell className="text-center text-muted-foreground text-xs">—</TableCell>
              <TableCell className="text-center text-muted-foreground text-xs">—</TableCell>
            </>
          ) : (
            <>
              <TableCell className="text-center">
                {status === 'out' && <Badge variant="destructive">{t('outOfStock')}</Badge>}
                {status === 'low' && <Badge className="bg-amber-500 hover:bg-amber-600 text-white">{t('lowStock')}</Badge>}
                {status === 'ok' && <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20">{t('inStockStatus')}</Badge>}
              </TableCell>
              <TableCell className="w-32">
                <Progress value={stockPercentage}
                  className={`h-2 ${status === 'out' ? '[&>div]:bg-destructive' : status === 'low' ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'}`} />
              </TableCell>
            </>
          )}
        <TableCell className="text-center">
          <div className="flex items-center gap-1 justify-end">
            <Switch
              checked={item.unlimited_stock}
              onCheckedChange={(checked) => toggleUnlimitedMutation.mutate({ id: item.id, unlimited_stock: checked })}
              title={t('unlimitedStock')}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEditDialog(item)}>
                  <Settings2 className="h-4 w-4 mr-2" />
                  {t('editProperties')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => setDeleteConfirmItem(item)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('totalProducts')}</p>
              <p className="text-2xl font-bold">{inventory?.length || 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card className={(lowStockItems.length + lowStockGroups.length) > 0 ? 'border-amber-500' : ''}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className={`p-3 rounded-full ${(lowStockItems.length + lowStockGroups.length) > 0 ? 'bg-amber-500/10' : 'bg-muted'}`}>
              <TrendingDown className={`h-6 w-6 ${(lowStockItems.length + lowStockGroups.length) > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('lowStock')}</p>
              <p className="text-2xl font-bold">{lowStockItems.length + lowStockGroups.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className={(outOfStockItems.length + outOfStockGroups.length) > 0 ? 'border-destructive' : ''}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className={`p-3 rounded-full ${(outOfStockItems.length + outOfStockGroups.length) > 0 ? 'bg-destructive/10' : 'bg-muted'}`}>
              <AlertTriangle className={`h-6 w-6 ${(outOfStockItems.length + outOfStockGroups.length) > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('outOfStock')}</p>
              <p className="text-2xl font-bold">{outOfStockItems.length + outOfStockGroups.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stock Warnings in Diagnosis Toggle */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">{t('showStockWarningsInDiagnosis')}</p>
              <p className="text-sm text-muted-foreground">{t('showStockWarningsInDiagnosisDesc')}</p>
            </div>
          </div>
          <Switch checked={showStockWarningsInDiagnosis} onCheckedChange={setShowStockWarningsInDiagnosis} />
        </CardContent>
      </Card>

      {/* Low Stock Alert */}
      {(lowStockItems.length > 0 || lowStockGroups.length > 0) && (
        <Card className="border-amber-500 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center justify-between">
              <span className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-5 w-5" />
                {t('lowStockAlert')}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setShowLowStockAlert(!showLowStockAlert)}
                className="text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300">
                {showLowStockAlert ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {showLowStockAlert ? t('hide') : t('show')}
              </Button>
            </CardTitle>
          </CardHeader>
          {showLowStockAlert && (
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {lowStockGroups.map((group) => {
                  const total = getGroupTotal(group.id);
                  return (
                    <Badge key={group.id} variant={total === 0 ? 'destructive' : 'secondary'} className="text-sm">
                      <FolderOpen className="h-3 w-3 mr-1" />
                      {group.name}: {total} {t('inStock')}
                    </Badge>
                  );
                })}
                {lowStockItems.map((item) => (
                  <Badge key={item.id} variant={item.quantity === 0 ? 'destructive' : 'secondary'} className="text-sm">
                    {item.repair_types.name}: {item.quantity} {t('inStock')}
                  </Badge>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Inventory Table */}
      <Card>
        <CardHeader className="flex flex-col gap-4">
          <div className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {t('inventoryOverview')}
            </CardTitle>
            <div className="flex gap-2">
              {/* Manage Groups Dialog */}
              <Dialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <FolderOpen className="h-4 w-4 mr-2" />
                    {t('manageGroups')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('manageGroups')}</DialogTitle>
                    <DialogDescription>{t('inventoryGroups')}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="flex gap-2">
                      <Input
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder={t('groupName')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newGroupName.trim()) {
                            addGroupMutation.mutate(newGroupName.trim());
                          }
                        }}
                      />
                      <Button onClick={() => newGroupName.trim() && addGroupMutation.mutate(newGroupName.trim())}
                        disabled={!newGroupName.trim() || addGroupMutation.isPending}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {groups?.map(group => (
                        <div key={group.id} className="flex items-center justify-between p-2 rounded-md border">
                          <div className="flex items-center gap-2">
                            <FolderOpen className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{group.name}</span>
                            <Badge variant="secondary" className="text-xs">
                              {inventory?.filter(i => i.group_id === group.id).length || 0}
                            </Badge>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => deleteGroupMutation.mutate(group.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      {(!groups || groups.length === 0) && (
                        <p className="text-sm text-muted-foreground text-center py-4">{t('noGroup')}</p>
                      )}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Add Product Dialog */}
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    {t('addProduct')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('addProduct')}</DialogTitle>
                    <DialogDescription>{t('addProductDesc')}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">{t('name')}</Label>
                      <Input id="name" value={newProduct.name}
                        onChange={(e) => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
                        placeholder={t('repairTypeName')} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="price">{t('price')} (€)</Label>
                        <Input id="price" type="number" min="0" step="0.01" value={newProduct.price}
                          onChange={(e) => setNewProduct(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="points">{t('points')}</Label>
                        <Input id="points" type="number" min="0" value={newProduct.points}
                          onChange={(e) => setNewProduct(prev => ({ ...prev, points: parseInt(e.target.value) || 0 }))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="quantity">{t('initialStock')}</Label>
                        <Input id="quantity" type="number" min="0" value={newProduct.quantity}
                          onChange={(e) => setNewProduct(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="min_stock">{t('minLevel')}</Label>
                        <Input id="min_stock" type="number" min="0" value={newProduct.min_stock_level}
                          onChange={(e) => setNewProduct(prev => ({ ...prev, min_stock_level: parseInt(e.target.value) || 0 }))} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="purchase_price">{t('purchasePrice')} (€)</Label>
                      <Input id="purchase_price" type="number" min="0" step="0.01" value={newProduct.purchase_price}
                        onChange={(e) => setNewProduct(prev => ({ ...prev, purchase_price: parseFloat(e.target.value) || 0 }))} />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                      <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>{t('cancel')}</Button>
                      <Button onClick={handleAddProduct} disabled={addProductMutation.isPending}>
                        {addProductMutation.isPending ? t('saving') : t('save')}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t('searchInventory')} value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
        </CardHeader>
        <CardContent>
          {groupedInventory.map(([groupId, { group, items }]) => {
            if (items.length === 0 && groupId !== 'ungrouped') return null;
            const isCollapsed = collapsedGroups[groupId];
            const isGrouped = group !== null;
            const groupTotal = group ? getGroupTotal(group.id) : 0;
            const groupStatus = group ? getStockStatus(groupTotal, group.min_stock_level) : null;
            const groupStockPct = group && group.min_stock_level > 0
              ? Math.min((groupTotal / (group.min_stock_level * 2)) * 100, 100) : 100;

            return (
              <Collapsible key={groupId} open={!isCollapsed} onOpenChange={() => toggleGroup(groupId)}>
                <CollapsibleTrigger asChild>
                  <div className={`flex items-center gap-2 py-2 px-1 cursor-pointer hover:bg-muted/50 rounded-md mb-1 ${group && groupStatus === 'out' ? 'bg-destructive/5' : group && groupStatus === 'low' ? 'bg-amber-500/5' : ''}`}>
                    {isCollapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">{group ? group.name : t('ungrouped')}</span>
                    <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                    {group && (
                      <div className="flex items-center gap-2 ml-auto mr-2" onClick={(e) => e.stopPropagation()}>
                        <span className="text-sm font-medium">{t('total')}: {groupTotal}</span>
                        <span className="text-xs text-muted-foreground">min:</span>
                        <Input type="number" min="0" defaultValue={group.min_stock_level} key={`gm-${group.id}-${group.min_stock_level}`}
                          onChange={(e) => handleGroupFieldChange(group.id, 'min_stock_level', parseInt(e.target.value) || 0)}
                          className="w-14 text-center h-7 text-sm" />
                        {groupStatus === 'out' && <Badge variant="destructive" className="text-xs">{t('outOfStock')}</Badge>}
                        {groupStatus === 'low' && <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-xs">{t('lowStock')}</Badge>}
                        {groupStatus === 'ok' && <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-xs">{t('inStockStatus')}</Badge>}
                      </div>
                    )}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('product')}</TableHead>
                        <TableHead>{t('inventoryGroups')}</TableHead>
                        <TableHead className="text-center">{t('quantity')}</TableHead>
                        <TableHead className="text-center">{t('minLevel')}</TableHead>
                        <TableHead className="text-center">{t('purchasePrice')}</TableHead>
                        <TableHead className="text-center">{t('status')}</TableHead>
                        <TableHead className="text-center">{t('stockLevel')}</TableHead>
                        <TableHead className="text-right"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map(item => renderInventoryRow(item, isGrouped))}
                    </TableBody>
                  </Table>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </CardContent>
      </Card>

      {/* Unlimited Stock Section */}
      {unlimitedItems.length > 0 && (
        <Card>
          <CardHeader>
            <Collapsible open={!collapsedGroups['unlimited']} onOpenChange={() => toggleGroup('unlimited')}>
              <CollapsibleTrigger asChild>
                <div className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded-md py-1 px-1">
                  {collapsedGroups['unlimited'] ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
                  <Infinity className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">{t('unlimitedStock')}</CardTitle>
                  <Badge variant="secondary" className="text-xs">{unlimitedItems.length}</Badge>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Table className="mt-4">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('product')}</TableHead>
                      <TableHead className="text-center">{t('purchasePrice')}</TableHead>
                      <TableHead className="text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unlimitedItems.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {item.repair_types.name}
                            <Infinity className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center">
                            <span className="text-muted-foreground mr-1">€</span>
                            <Input type="number" min="0" step="0.01" defaultValue={(item.purchase_price || 0).toFixed(2)}
                              onChange={(e) => handleFieldChange(item.id, 'purchase_price', parseFloat(e.target.value) || 0)}
                              className="w-20 text-center h-8" />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <Switch
                              checked={item.unlimited_stock}
                              onCheckedChange={(checked) => toggleUnlimitedMutation.mutate({ id: item.id, unlimited_stock: checked })}
                              title={t('unlimitedStock')}
                            />
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditDialog(item)}>
                                  <Settings2 className="h-4 w-4 mr-2" />
                                  {t('editProperties')}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteConfirmItem(item)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CollapsibleContent>
            </Collapsible>
          </CardHeader>
        </Card>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmItem} onOpenChange={(open) => !open && setDeleteConfirmItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteProduct')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteProductConfirm')}
              {deleteConfirmItem && (
                <span className="block mt-2 font-semibold">{deleteConfirmItem.repair_types.name}</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirmItem && deleteProductMutation.mutate(deleteConfirmItem)}
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Properties Dialog */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editProperties')}</DialogTitle>
            <DialogDescription>{t('editPropertiesDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('name')}</Label>
              <Input value={editForm.name}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('price')} (€)</Label>
                <Input type="number" min="0" step="0.01" value={editForm.price}
                  onChange={(e) => setEditForm(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-2">
                <Label>{t('points')}</Label>
                <Input type="number" min="0" value={editForm.points}
                  onChange={(e) => setEditForm(prev => ({ ...prev, points: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('applicableModels')}</Label>
              <div className="flex gap-2 mb-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditForm(prev => ({ ...prev, models: [...VANMOOF_MODELS] }))}>
                  {t('selectAll')}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setEditForm(prev => ({ ...prev, models: [] }))}>
                  {t('deselectAll')}
                </Button>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {VANMOOF_MODELS.map(model => (
                  <label key={model} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox
                      checked={editForm.models.includes(model)}
                      onCheckedChange={(checked) => {
                        setEditForm(prev => ({
                          ...prev,
                          models: checked
                            ? [...prev.models, model]
                            : prev.models.filter(m => m !== model),
                        }));
                      }}
                    />
                    {model}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setEditItem(null)}>{t('cancel')}</Button>
              <Button onClick={() => editItem && updateProductMutation.mutate({
                repairTypeId: editItem.repair_type_id,
                name: editForm.name,
                price: editForm.price,
                points: editForm.points,
                models: editForm.models,
              })} disabled={updateProductMutation.isPending || !editForm.name.trim()}>
                {updateProductMutation.isPending ? t('saving') : t('save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
