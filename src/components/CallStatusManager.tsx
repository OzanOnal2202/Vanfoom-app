import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/i18n/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { Phone, Plus, Pencil, Trash2, GripVertical, Clock, TrendingUp } from 'lucide-react';

interface CallStatus {
  id: string;
  name: string;
  name_en: string;
  color: string;
  sort_order: number;
  is_active: boolean;
}

interface ApprovalStats {
  averageHours: number | null;
  totalBikes: number;
  fastestHours: number | null;
  slowestHours: number | null;
  over36HoursPercent: number | null;
}

const PRESET_COLORS = [
  { name: 'Gray', color: '#9ca3af' },
  { name: 'Yellow', color: '#fbbf24' },
  { name: 'Orange', color: '#f97316' },
  { name: 'Red', color: '#ef4444' },
  { name: 'Green', color: '#22c55e' },
  { name: 'Blue', color: '#3b82f6' },
  { name: 'Purple', color: '#a855f7' },
  { name: 'Pink', color: '#ec4899' },
];

export function CallStatusManager() {
  const { t, language } = useLanguage();
  const [callStatuses, setCallStatuses] = useState<CallStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<CallStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [approvalStats, setApprovalStats] = useState<ApprovalStats>({
    averageHours: null,
    totalBikes: 0,
    fastestHours: null,
    slowestHours: null,
    over36HoursPercent: null,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Form state
  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [color, setColor] = useState('#fbbf24');
  const [isActive, setIsActive] = useState(true);

  const fetchStatuses = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('table_call_statuses')
      .select('*')
      .order('sort_order');

    if (error) {
      console.error('Error fetching call statuses:', error);
    } else {
      setCallStatuses(data || []);
    }
    setLoading(false);
  };

  const fetchApprovalStats = async () => {
    setStatsLoading(true);
    try {
      // Get bikes that have moved from wacht_op_akkoord to klaar_voor_reparatie or beyond
      // We use diagnosed_at as the start point (when bike enters waiting state after diagnosis)
      // and look at bikes that are now in klaar_voor_reparatie, in_reparatie, or afgerond
      const { data: bikes, error } = await supabase
        .from('bikes')
        .select('diagnosed_at, updated_at, workflow_status')
        .not('diagnosed_at', 'is', null)
        .in('workflow_status', ['klaar_voor_reparatie', 'in_reparatie', 'afgerond']);

      if (error) {
        console.error('Error fetching approval stats:', error);
        return;
      }

      if (!bikes || bikes.length === 0) {
        setApprovalStats({
          averageHours: null,
          totalBikes: 0,
          fastestHours: null,
          slowestHours: null,
          over36HoursPercent: null,
        });
        return;
      }

      // Calculate time differences in hours
      const timeDiffs = bikes.map(bike => {
        const diagnosedAt = new Date(bike.diagnosed_at!);
        const updatedAt = new Date(bike.updated_at);
        return (updatedAt.getTime() - diagnosedAt.getTime()) / (1000 * 60 * 60);
      }).filter(hours => hours > 0 && hours < 720); // Filter out invalid data (> 30 days)

      if (timeDiffs.length === 0) {
        setApprovalStats({
          averageHours: null,
          totalBikes: 0,
          fastestHours: null,
          slowestHours: null,
          over36HoursPercent: null,
        });
        return;
      }

      const averageHours = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
      const fastestHours = Math.min(...timeDiffs);
      const slowestHours = Math.max(...timeDiffs);
      const over36Count = timeDiffs.filter(hours => hours > 36).length;
      const over36HoursPercent = (over36Count / timeDiffs.length) * 100;

      setApprovalStats({
        averageHours,
        totalBikes: timeDiffs.length,
        fastestHours,
        slowestHours,
        over36HoursPercent,
      });
    } catch (error) {
      console.error('Error calculating approval stats:', error);
    }
    setStatsLoading(false);
  };

  useEffect(() => {
    fetchStatuses();
    fetchApprovalStats();
  }, []);

  const formatDuration = (hours: number | null): string => {
    if (hours === null) return '-';
    if (hours < 1) {
      const minutes = Math.round(hours * 60);
      return `${minutes} ${t('minutes')}`;
    }
    if (hours < 24) {
      return `${hours.toFixed(1)} ${t('hours')}`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = Math.round(hours % 24);
    if (remainingHours === 0) {
      return `${days} ${t('days')}`;
    }
    return `${days} ${t('days')}, ${remainingHours} ${t('hours')}`;
  };

  const openAddDialog = () => {
    setEditingStatus(null);
    setName('');
    setNameEn('');
    setColor('#fbbf24');
    setIsActive(true);
    setDialogOpen(true);
  };

  const openEditDialog = (status: CallStatus) => {
    setEditingStatus(status);
    setName(status.name);
    setNameEn(status.name_en);
    setColor(status.color);
    setIsActive(status.is_active);
    setDialogOpen(true);
  };

  const saveStatus = async () => {
    if (!name.trim() || !nameEn.trim()) {
      toast({
        title: t('error'),
        description: t('nameRequired'),
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    try {
      if (editingStatus) {
        // Update existing
        const { error } = await supabase
          .from('table_call_statuses')
          .update({
            name: name.trim(),
            name_en: nameEn.trim(),
            color,
            is_active: isActive,
          })
          .eq('id', editingStatus.id);

        if (error) throw error;
        toast({ title: t('callStatusUpdated') });
      } else {
        // Create new
        const maxOrder = Math.max(...callStatuses.map(s => s.sort_order), 0);
        const { error } = await supabase
          .from('table_call_statuses')
          .insert({
            name: name.trim(),
            name_en: nameEn.trim(),
            color,
            is_active: isActive,
            sort_order: maxOrder + 1,
          });

        if (error) throw error;
        toast({ title: t('callStatusCreated') });
      }

      setDialogOpen(false);
      fetchStatuses();
    } catch (error) {
      console.error('Error saving call status:', error);
      toast({
        title: t('error'),
        variant: 'destructive',
      });
    }

    setSaving(false);
  };

  const deleteStatus = async (id: string) => {
    if (!confirm(t('confirmDeleteCallStatus'))) return;

    try {
      const { error } = await supabase
        .from('table_call_statuses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: t('callStatusDeleted') });
      fetchStatuses();
    } catch (error) {
      console.error('Error deleting call status:', error);
      toast({
        title: t('error'),
        variant: 'destructive',
      });
    }
  };

  const toggleActive = async (status: CallStatus) => {
    try {
      const { error } = await supabase
        .from('table_call_statuses')
        .update({ is_active: !status.is_active })
        .eq('id', status.id);

      if (error) throw error;
      fetchStatuses();
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Approval Time Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t('approvalTimeStats')}
          </CardTitle>
          <CardDescription>{t('approvalTimeStatsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="text-center py-4 text-muted-foreground">{t('loading')}</div>
          ) : approvalStats.totalBikes === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              {t('noApprovalData')}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <Clock className="h-4 w-4" />
                  {t('averageWaitTime')}
                </div>
                <div className="text-2xl font-bold text-primary">
                  {formatDuration(approvalStats.averageHours)}
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-muted-foreground text-sm mb-1">
                  {t('totalProcessed')}
                </div>
                <div className="text-2xl font-bold">
                  {approvalStats.totalBikes} {t('bikesLower')}
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-muted-foreground text-sm mb-1">
                  {t('fastestApproval')}
                </div>
                <div className="text-2xl font-bold text-primary">
                  {formatDuration(approvalStats.fastestHours)}
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-muted-foreground text-sm mb-1">
                  {t('slowestApproval')}
                </div>
                <div className="text-2xl font-bold text-destructive">
                  {formatDuration(approvalStats.slowestHours)}
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-muted-foreground text-sm mb-1">
                  {t('over36Hours')}
                </div>
                <div className="text-2xl font-bold text-destructive">
                  {approvalStats.over36HoursPercent !== null 
                    ? `${approvalStats.over36HoursPercent.toFixed(0)}%` 
                    : '-'}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                {t('callStatusManagement')}
              </CardTitle>
              <CardDescription>{t('callStatusManagementDescription')}</CardDescription>
            </div>
            <Button onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-2" />
              {t('addCallStatus')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">{t('loading')}</div>
          ) : callStatuses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('noCallStatuses')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>{t('color')}</TableHead>
                  <TableHead>{t('nameNL')}</TableHead>
                  <TableHead>{t('nameEN')}</TableHead>
                  <TableHead>{t('active')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {callStatuses.map((status) => (
                  <TableRow key={status.id}>
                    <TableCell>
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                    <TableCell>
                      <div 
                        className="w-8 h-8 rounded-lg border shadow-sm"
                        style={{ backgroundColor: status.color }}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{status.name}</TableCell>
                    <TableCell>{status.name_en}</TableCell>
                    <TableCell>
                      <Switch
                        checked={status.is_active}
                        onCheckedChange={() => toggleActive(status)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(status)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteStatus(status.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingStatus ? t('editCallStatus') : t('addCallStatus')}
            </DialogTitle>
            <DialogDescription>
              {editingStatus ? t('editCallStatusDescription') : t('addCallStatusDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name NL */}
            <div className="space-y-2">
              <Label>{t('nameNL')}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('callStatusNamePlaceholder')}
              />
            </div>

            {/* Name EN */}
            <div className="space-y-2">
              <Label>{t('nameEN')}</Label>
              <Input
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder={t('callStatusNameEnPlaceholder')}
              />
            </div>

            {/* Color */}
            <div className="space-y-2">
              <Label>{t('color')}</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((preset) => (
                  <button
                    key={preset.color}
                    type="button"
                    onClick={() => setColor(preset.color)}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${
                      color === preset.color ? 'border-primary scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: preset.color }}
                    title={preset.name}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Label className="text-sm">{t('customColor')}:</Label>
                <Input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-16 h-8 p-0 border-0"
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-24"
                  placeholder="#000000"
                />
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label>{t('preview')}</Label>
              <div 
                className="p-4 rounded-lg text-white text-center font-medium"
                style={{ backgroundColor: color }}
              >
                {name || t('callStatusNamePlaceholder')}
              </div>
            </div>

            {/* Active */}
            <div className="flex items-center justify-between">
              <Label>{t('active')}</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={saveStatus} disabled={saving}>
              {saving ? t('saving') : t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
