import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/i18n/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Euro, Search, Star, TrendingUp, Wrench, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Database } from '@/integrations/supabase/types';

type VanmoofModel = Database['public']['Enums']['vanmoof_model'];

const VANMOOF_MODELS: VanmoofModel[] = ['S1', 'S2', 'S3', 'S5', 'S6', 'X1', 'X2', 'X3', 'X5', 'A5'];

interface RepairType {
  id: string;
  name: string;
  description: string | null;
  price: number;
  points: number;
}

interface RepairTypeWithModels extends RepairType {
  models: string[];
}

export function PriceListManagement() {
  const { t } = useLanguage();
  const [repairTypes, setRepairTypes] = useState<RepairTypeWithModels[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [modelFilter, setModelFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRepair, setEditingRepair] = useState<RepairTypeWithModels | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [repairToDelete, setRepairToDelete] = useState<RepairTypeWithModels | null>(null);
  
  // Stats state
  const [totalCompletedRepairs, setTotalCompletedRepairs] = useState(0);
  const [topRepair, setTopRepair] = useState<{ name: string; count: number } | null>(null);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formPoints, setFormPoints] = useState('');
  const [formModels, setFormModels] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRepairTypes();
    fetchRepairStats();
  }, []);

  const fetchRepairTypes = async () => {
    setLoading(true);
    
    // Fetch repair types
    const { data: repairData, error: repairError } = await supabase
      .from('repair_types')
      .select('*')
      .order('name');

    if (repairError) {
      toast({ title: t('error'), description: t('couldNotLoadRepairTypes'), variant: 'destructive' });
      setLoading(false);
      return;
    }

    // Fetch model mappings
    const { data: mappingData } = await supabase
      .from('repair_type_models')
      .select('repair_type_id, model');

    // Build repair types with their models
    const repairTypesWithModels: RepairTypeWithModels[] = (repairData || []).map(repair => {
      const models = mappingData?.filter(m => m.repair_type_id === repair.id).map(m => m.model) || [];
      return { ...repair, models };
    });

    setRepairTypes(repairTypesWithModels);
    setLoading(false);
  };

  const fetchRepairStats = async () => {
    // Fetch completed work registrations with repair type info
    const { data: registrations } = await supabase
      .from('work_registrations')
      .select(`
        id,
        completed,
        repair_type:repair_types(id, name)
      `)
      .eq('completed', true);

    if (registrations) {
      setTotalCompletedRepairs(registrations.length);

      // Count repairs by type
      const repairCounts = new Map<string, { name: string; count: number }>();
      registrations.forEach(reg => {
        const repairName = (reg.repair_type as any)?.name || 'Onbekend';
        const existing = repairCounts.get(repairName);
        if (existing) {
          existing.count++;
        } else {
          repairCounts.set(repairName, { name: repairName, count: 1 });
        }
      });

      // Find top repair
      let topRepairItem: { name: string; count: number } | null = null;
      repairCounts.forEach(item => {
        if (!topRepairItem || item.count > topRepairItem.count) {
          topRepairItem = item;
        }
      });
      setTopRepair(topRepairItem);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormPrice('');
    setFormPoints('');
    setFormModels([]);
    setEditingRepair(null);
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (repair: RepairTypeWithModels) => {
    setEditingRepair(repair);
    setFormName(repair.name);
    setFormDescription(repair.description || '');
    setFormPrice(repair.price.toString());
    setFormPoints(repair.points.toString());
    setFormModels(repair.models);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast({ title: t('error'), description: t('nameRequired'), variant: 'destructive' });
      return;
    }

    const price = parseFloat(formPrice.replace(',', '.')) || 0;
    const points = parseFloat(formPoints.replace(',', '.')) || 0;

    setSaving(true);

    try {
      if (editingRepair) {
        // Update existing repair type
        const { error: updateError } = await supabase
          .from('repair_types')
          .update({
            name: formName.trim(),
            description: formDescription.trim() || null,
            price,
            points,
          })
          .eq('id', editingRepair.id);

        if (updateError) throw updateError;

        // Update model mappings - delete all and re-insert
        await supabase
          .from('repair_type_models')
          .delete()
          .eq('repair_type_id', editingRepair.id);

        if (formModels.length > 0) {
          const modelMappings = formModels.map(model => ({
            repair_type_id: editingRepair.id,
            model,
          }));
          
          const { error: mappingError } = await supabase
            .from('repair_type_models')
            .insert(modelMappings);

          if (mappingError) throw mappingError;
        }

        toast({ title: t('success'), description: t('repairTypeUpdated') });
      } else {
        // Create new repair type
        const { data: newRepair, error: insertError } = await supabase
          .from('repair_types')
          .insert({
            name: formName.trim(),
            description: formDescription.trim() || null,
            price,
            points,
          })
          .select('id')
          .single();

        if (insertError) throw insertError;

        // Add model mappings
        if (formModels.length > 0 && newRepair) {
          const modelMappings = formModels.map(model => ({
            repair_type_id: newRepair.id,
            model,
          }));
          
          const { error: mappingError } = await supabase
            .from('repair_type_models')
            .insert(modelMappings);

          if (mappingError) throw mappingError;
        }

        toast({ title: t('success'), description: t('repairTypeCreated') });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchRepairTypes();
    } catch (error) {
      console.error('Error saving repair type:', error);
      toast({ title: t('error'), description: t('couldNotSaveRepairType'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!repairToDelete) return;

    try {
      // Delete model mappings first
      await supabase
        .from('repair_type_models')
        .delete()
        .eq('repair_type_id', repairToDelete.id);

      // Delete repair type
      const { error } = await supabase
        .from('repair_types')
        .delete()
        .eq('id', repairToDelete.id);

      if (error) throw error;

      toast({ title: t('success'), description: t('repairTypeDeleted') });
      setDeleteConfirmOpen(false);
      setRepairToDelete(null);
      fetchRepairTypes();
    } catch (error) {
      console.error('Error deleting repair type:', error);
      toast({ title: t('error'), description: t('couldNotDeleteRepairType'), variant: 'destructive' });
    }
  };

  const toggleModel = (model: string) => {
    setFormModels(prev => 
      prev.includes(model) 
        ? prev.filter(m => m !== model)
        : [...prev, model]
    );
  };

  const selectAllModels = () => {
    setFormModels(VANMOOF_MODELS);
  };

  const deselectAllModels = () => {
    setFormModels([]);
  };

  const filteredRepairTypes = repairTypes.filter(repair => {
    const matchesSearch = repair.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repair.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesModel = modelFilter === 'all' || 
      repair.models.length === 0 || 
      repair.models.includes(modelFilter);
    
    return matchesSearch && matchesModel;
  });

  const totalValue = filteredRepairTypes.reduce((sum, r) => sum + r.price, 0);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Euro className="h-5 w-5" />
                {t('priceListManagement')}
              </CardTitle>
              <CardDescription>{t('priceListManagementDescription')}</CardDescription>
            </div>
            <Button onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-2" />
              {t('addRepairType')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <p className="text-xs text-muted-foreground">{t('topRepair')}</p>
                </div>
                <div className="text-lg font-bold truncate">{topRepair?.name || '-'}</div>
                {topRepair && (
                  <p className="text-xs text-muted-foreground">{topRepair.count}x {t('performed')}</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <Wrench className="h-4 w-4 text-primary" />
                  <p className="text-xs text-muted-foreground">{t('totalPerformedRepairs')}</p>
                </div>
                <div className="text-2xl font-bold">{totalCompletedRepairs}</div>
              </CardContent>
            </Card>
          </div>

          {/* Model Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={modelFilter} onValueChange={setModelFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('filterByModel')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allModels')}</SelectItem>
                {VANMOOF_MODELS.map(model => (
                  <SelectItem key={model} value={model}>{model}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('searchRepairTypes')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('name')}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t('description')}</TableHead>
                  <TableHead className="text-right">{t('price')}</TableHead>
                  <TableHead className="text-right">{t('points')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('models')}</TableHead>
                  <TableHead className="w-[100px]">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRepairTypes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {t('noRepairTypesFound')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRepairTypes.map(repair => (
                    <TableRow key={repair.id}>
                      <TableCell className="font-medium">{repair.name}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground max-w-[200px] truncate">
                        {repair.description || '-'}
                      </TableCell>
                      <TableCell className="text-right">€{repair.price.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Star className="h-3 w-3 text-primary" />
                          {repair.points % 1 === 0 ? repair.points : repair.points.toFixed(1)}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {repair.models.length === 0 ? (
                            <span className="text-muted-foreground text-xs">{t('allModels')}</span>
                          ) : repair.models.length > 3 ? (
                            <Badge variant="secondary" className="text-xs">
                              {repair.models.length} {t('models')}
                            </Badge>
                          ) : (
                            repair.models.map(model => (
                              <Badge key={model} variant="outline" className="text-xs">
                                {model}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(repair)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setRepairToDelete(repair);
                              setDeleteConfirmOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRepair ? t('editRepairType') : t('addRepairType')}
            </DialogTitle>
            <DialogDescription>
              {editingRepair ? t('editRepairTypeDescription') : t('addRepairTypeDescription')}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('name')} *</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={t('repairTypeName')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('description')}</Label>
              <Textarea
                id="description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder={t('repairTypeDescriptionPlaceholder')}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">{t('price')} (€)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="points">{t('points')}</Label>
                <Input
                  id="points"
                  type="text"
                  inputMode="decimal"
                  value={formPoints}
                  onChange={(e) => setFormPoints(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('applicableModels')}</Label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={selectAllModels}>
                    {t('selectAll')}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={deselectAllModels}>
                    {t('deselectAll')}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 p-3 border rounded-md">
                {VANMOOF_MODELS.map(model => (
                  <div key={model} className="flex items-center space-x-2">
                    <Checkbox
                      id={`model-${model}`}
                      checked={formModels.includes(model)}
                      onCheckedChange={() => toggleModel(model)}
                    />
                    <label
                      htmlFor={`model-${model}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {model}
                    </label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{t('noModelsSelectedMeansAll')}</p>
            </div>
          </form>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" onClick={handleSave} disabled={saving}>
              {saving ? t('saving') : t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteRepairType')}</DialogTitle>
            <DialogDescription>
              {t('deleteRepairTypeConfirm')} ({repairToDelete?.name || ''})
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
