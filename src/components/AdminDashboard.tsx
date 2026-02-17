import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/i18n/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Users, Wrench, Bike, TrendingUp, Clock, CheckCircle, ChevronRight, X, Table2, UserPlus, Archive, MessageSquare, Calendar, Search, UserMinus, Undo2, Trash2, XCircle, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { format, startOfDay, endOfDay, subDays, subMonths, subYears, differenceInMinutes } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';
import { CompletionChecklistDialog } from './CompletionChecklistDialog';
import { WarrantyOverview } from './WarrantyOverview';
import { AdminPasswordSettings } from './AdminPasswordSettings';

interface MechanicStats {
  id: string;
  name: string;
  totalRepairs: number;
  totalPoints: number;
}

interface RepairDetail {
  id: string;
  mechanicName: string;
  mechanicId: string;
  bikeFrameNumber: string;
  bikeModel: string;
  repairType: string;
  points: number;
  durationMinutes: number | null;
  completedAt: string;
}

interface DailyMechanicPoints {
  date: string;
  [mechanicName: string]: string | number;
}

interface BikeStatus {
  id: string;
  frame_number: string;
  model: string;
  status: string;
  pendingRepairs: number;
  completedRepairs: number;
}

interface DailyStats {
  date: string;
  repairs: number;
  points: number;
}

interface TableBike {
  id: string;
  frame_number: string;
  model: string;
  workflow_status: string;
  current_mechanic_id: string | null;
  current_mechanic_name?: string;
  diagnosed_by_name?: string;
  pending_repairs: number;
}

interface TableOverview {
  tableNumber: string;
  bikes: TableBike[];
}

const WORKFLOW_STATUS_OPTIONS = [
  { value: 'diagnose_nodig', label: 'Diagnose nodig' },
  { value: 'wacht_op_akkoord', label: 'Wacht op akkoord' },
  { value: 'klaar_voor_reparatie', label: 'Klaar voor reparatie' },
  { value: 'in_reparatie', label: 'In reparatie' },
  { value: 'afgerond', label: 'Afgerond' },
] as const;

interface MechanicOption {
  id: string;
  full_name: string;
}

interface CompletedBike {
  id: string;
  frame_number: string;
  model: string;
  completed_at: string;
  diagnosed_by_name?: string;
  diagnosed_at?: string;
  last_modified_by_name?: string;
  last_modified_at?: string;
  completed_by_name?: string;
  mechanics: { id: string; name: string }[];
  repairs: { type: string; points: number; completedAt: string; mechanicName: string }[];
  comments: { content: string; authorName: string; createdAt: string }[];
  totalPoints: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export function AdminDashboard() {
  const { t, language } = useLanguage();
  const dateLocale = language === 'nl' ? nl : enUS;
  
  const [mechanicStats, setMechanicStats] = useState<MechanicStats[]>([]);
  const [repairDetails, setRepairDetails] = useState<RepairDetail[]>([]);
  const [dailyMechanicPoints, setDailyMechanicPoints] = useState<DailyMechanicPoints[]>([]);
  const [bikeStatuses, setBikeStatuses] = useState<BikeStatus[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [repairTypeStats, setRepairTypeStats] = useState<{ name: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7');
  const [mechanicNames, setMechanicNames] = useState<string[]>([]);
  const [selectedMechanic, setSelectedMechanic] = useState<MechanicStats | null>(null);
  const [mechanicDetailPeriod, setMechanicDetailPeriod] = useState<'1' | '7' | '30' | '365'>('7');
  const [mechanicRepairStats, setMechanicRepairStats] = useState<{ name: string; count: number }[]>([]);
  const [mechanicBikes, setMechanicBikes] = useState<{
    bikeId: string;
    frameNumber: string;
    model: string;
    repairs: { type: string; points: number; completedAt: string }[];
    totalPoints: number;
  }[]>([]);
  const [tableOverviews, setTableOverviews] = useState<TableOverview[]>([]);
  const [bikesWithoutTable, setBikesWithoutTable] = useState<TableBike[]>([]);
  const [allMechanics, setAllMechanics] = useState<MechanicOption[]>([]);
  const [assigningBike, setAssigningBike] = useState<TableBike | null>(null);
  const [selectedMechanicId, setSelectedMechanicId] = useState<string>('');
  const [completedBikes, setCompletedBikes] = useState<CompletedBike[]>([]);
  const [selectedCompletedBike, setSelectedCompletedBike] = useState<CompletedBike | null>(null);
  const [completedBikesSearchQuery, setCompletedBikesSearchQuery] = useState('');
  const [checklistBike, setChecklistBike] = useState<{ id: string; frame_number: string } | null>(null);
  const [removedMechanicsBackup, setRemovedMechanicsBackup] = useState<{ bikeId: string; mechanicId: string }[]>([]);
  const [showClearTablesConfirm, setShowClearTablesConfirm] = useState(false);
  const [deletingBike, setDeletingBike] = useState<TableBike | null>(null);
  const [showDeleteWithoutTableConfirm, setShowDeleteWithoutTableConfirm] = useState(false);
  useEffect(() => {
    fetchAllStats();
    fetchTableOverviews();
    fetchAllMechanics();
    fetchCompletedBikes();
  }, [dateRange]);

  const fetchAllStats = async () => {
    setLoading(true);
    await Promise.all([
      fetchMechanicStats(),
      fetchRepairDetails(),
      fetchBikeStatuses(),
      fetchDailyStats(),
      fetchRepairTypeStats(),
    ]);
    setLoading(false);
  };

  const fetchAllMechanics = async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .order('full_name');

    if (profiles) {
      setAllMechanics(profiles);
    }
  };

  const fetchTableOverviews = async () => {
    // Fetch all active bikes with table numbers
    const { data: bikesWithTables } = await supabase
      .from('bikes')
      .select('id, frame_number, model, workflow_status, table_number, current_mechanic_id, diagnosed_by')
      .neq('workflow_status', 'afgerond')
      .not('table_number', 'is', null)
      .order('table_number');

    // Fetch all active bikes WITHOUT table numbers
    const { data: bikesNoTable } = await supabase
      .from('bikes')
      .select('id, frame_number, model, workflow_status, table_number, current_mechanic_id, diagnosed_by')
      .neq('workflow_status', 'afgerond')
      .is('table_number', null)
      .order('created_at', { ascending: false });

    const allBikes = [...(bikesWithTables || []), ...(bikesNoTable || [])];

    if (allBikes.length === 0) {
      setTableOverviews([]);
      setBikesWithoutTable([]);
      return;
    }

    // Get mechanic and diagnosed_by IDs
    const mechanicIds = allBikes
      .map(b => b.current_mechanic_id)
      .filter((id): id is string => id !== null);
    const diagnosedByIds = allBikes
      .map(b => (b as any).diagnosed_by)
      .filter((id): id is string => id !== null);
    const allProfileIds = [...new Set([...mechanicIds, ...diagnosedByIds])];

    let profileMap: Record<string, string> = {};
    if (allProfileIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', allProfileIds);

      if (profiles) {
        profileMap = profiles.reduce((acc, p) => {
          acc[p.id] = p.full_name;
          return acc;
        }, {} as Record<string, string>);
      }
    }

    // Fetch pending repairs count per bike
    const bikeIds = allBikes.map(b => b.id);
    const { data: registrations } = await supabase
      .from('work_registrations')
      .select('bike_id, completed')
      .in('bike_id', bikeIds)
      .eq('completed', false);

    const pendingMap: Record<string, number> = {};
    registrations?.forEach(r => {
      pendingMap[r.bike_id] = (pendingMap[r.bike_id] || 0) + 1;
    });

    // Process bikes with tables - group by table number
    const tableMap = new Map<string, TableBike[]>();
    (bikesWithTables || []).forEach(bike => {
      const tableNum = bike.table_number || 'Geen tafel';
      if (!tableMap.has(tableNum)) {
        tableMap.set(tableNum, []);
      }
      tableMap.get(tableNum)!.push({
        id: bike.id,
        frame_number: bike.frame_number,
        model: bike.model,
        workflow_status: bike.workflow_status,
        current_mechanic_id: bike.current_mechanic_id,
        current_mechanic_name: bike.current_mechanic_id ? profileMap[bike.current_mechanic_id] : undefined,
        diagnosed_by_name: (bike as any).diagnosed_by ? profileMap[(bike as any).diagnosed_by] : undefined,
        pending_repairs: pendingMap[bike.id] || 0
      });
    });

    // Sort table numbers numerically
    const sortedTables = Array.from(tableMap.entries())
      .sort((a, b) => {
        const numA = parseInt(a[0]) || 999;
        const numB = parseInt(b[0]) || 999;
        return numA - numB;
      })
      .map(([tableNumber, bikes]) => ({ tableNumber, bikes }));

    setTableOverviews(sortedTables);

    // Process bikes without tables
    const noTableBikes = (bikesNoTable || []).map(bike => ({
      id: bike.id,
      frame_number: bike.frame_number,
      model: bike.model,
      workflow_status: bike.workflow_status,
      current_mechanic_id: bike.current_mechanic_id,
      current_mechanic_name: bike.current_mechanic_id ? profileMap[bike.current_mechanic_id] : undefined,
      diagnosed_by_name: (bike as any).diagnosed_by ? profileMap[(bike as any).diagnosed_by] : undefined,
      pending_repairs: pendingMap[bike.id] || 0
    }));

    setBikesWithoutTable(noTableBikes);
  };

  const handleAssignMechanic = async () => {
    if (!assigningBike || !selectedMechanicId) return;

    const { error } = await supabase
      .from('bikes')
      .update({ current_mechanic_id: selectedMechanicId })
      .eq('id', assigningBike.id);

    if (!error) {
      // Refresh data
      fetchTableOverviews();
      setAssigningBike(null);
      setSelectedMechanicId('');
    }
  };

  const handleRemoveMechanic = async (bikeId: string) => {
    const { error } = await supabase
      .from('bikes')
      .update({ current_mechanic_id: null })
      .eq('id', bikeId);

    if (!error) {
      fetchTableOverviews();
    }
  };

  const handleRemoveAllMechanics = async () => {
    // Collect all bikes with mechanics assigned
    const bikesWithMechanics = tableOverviews
      .flatMap(table => table.bikes)
      .filter(bike => bike.current_mechanic_id !== null)
      .map(bike => ({
        bikeId: bike.id,
        mechanicId: bike.current_mechanic_id!
      }));

    if (bikesWithMechanics.length === 0) {
      toast.info(t('noMechanicsToRemove'));
      return;
    }

    // Store backup for undo
    setRemovedMechanicsBackup(bikesWithMechanics);

    // Remove all mechanics
    const bikeIds = bikesWithMechanics.map(b => b.bikeId);
    const { error } = await supabase
      .from('bikes')
      .update({ current_mechanic_id: null })
      .in('id', bikeIds);

    if (!error) {
      fetchTableOverviews();
      toast(t('allMechanicsRemoved'), {
        description: `${bikesWithMechanics.length} ${t('mechanicsRemovedCount')}`,
        action: {
          label: t('undo'),
          onClick: () => handleRestoreMechanics(bikesWithMechanics)
        },
        duration: 10000
      });
    }
  };

  const handleRestoreMechanics = async (backup: { bikeId: string; mechanicId: string }[]) => {
    // Restore all mechanics
    for (const { bikeId, mechanicId } of backup) {
      await supabase
        .from('bikes')
        .update({ current_mechanic_id: mechanicId })
        .eq('id', bikeId);
    }
    
    fetchTableOverviews();
    setRemovedMechanicsBackup([]);
    toast.success(t('mechanicsRestored'));
  };

  const handleStatusChange = async (bikeId: string, frameNumber: string, newStatus: string) => {
    // If trying to set to 'afgerond', show checklist instead
    if (newStatus === 'afgerond') {
      setChecklistBike({ id: bikeId, frame_number: frameNumber });
      return;
    }

    const { error } = await supabase
      .from('bikes')
      .update({ workflow_status: newStatus as 'diagnose_nodig' | 'wacht_op_akkoord' | 'klaar_voor_reparatie' | 'in_reparatie' })
      .eq('id', bikeId);

    if (!error) {
      fetchTableOverviews();
    }
  };

  const handleChecklistComplete = () => {
    setChecklistBike(null);
    fetchTableOverviews();
    fetchCompletedBikes();
  };

  const handleClearAllTables = async () => {
    // Get all bikes with table numbers
    const bikesOnTables = tableOverviews.flatMap(table => table.bikes);
    
    if (bikesOnTables.length === 0) {
      toast.info(t('noActiveBikesOnTables'));
      setShowClearTablesConfirm(false);
      return;
    }
    
    // Remove table numbers from all bikes - update each bike to trigger realtime
    const bikeIds = bikesOnTables.map(b => b.id);
    
    // Update with timestamp to ensure realtime triggers
    const { error } = await supabase
      .from('bikes')
      .update({ 
        table_number: null,
        updated_at: new Date().toISOString()
      })
      .in('id', bikeIds);
    
    if (!error) {
      fetchTableOverviews();
      toast.success(t('tablesCleared'), {
        description: `${bikesOnTables.length} ${t('tablesClearedCount')}`
      });
    }
    
    setShowClearTablesConfirm(false);
  };

  const handleDeleteBike = async (bike: TableBike) => {
    // First delete all related records
    const { error: regError } = await supabase
      .from('work_registrations')
      .delete()
      .eq('bike_id', bike.id);
    
    if (regError) {
      toast.error(t('errorDeletingBike'));
      setDeletingBike(null);
      return;
    }
    
    const { error: commentError } = await supabase
      .from('bike_comments')
      .delete()
      .eq('bike_id', bike.id);
    
    if (commentError) {
      toast.error(t('errorDeletingBike'));
      setDeletingBike(null);
      return;
    }
    
    const { error: checklistError } = await supabase
      .from('bike_checklist_completions')
      .delete()
      .eq('bike_id', bike.id);
    
    if (checklistError) {
      toast.error(t('errorDeletingBike'));
      setDeletingBike(null);
      return;
    }
    
    // Now delete the bike
    const { error: bikeError } = await supabase
      .from('bikes')
      .delete()
      .eq('id', bike.id);
    
    if (bikeError) {
      toast.error(t('errorDeletingBike'));
    } else {
      toast.success(t('bikeDeleted'));
      fetchTableOverviews();
    }
    
    setDeletingBike(null);
  };

  const handleDeleteAllBikesWithoutTable = async () => {
    if (bikesWithoutTable.length === 0) {
      toast.info(t('noBikesWithoutTable'));
      setShowDeleteWithoutTableConfirm(false);
      return;
    }

    const bikeIds = bikesWithoutTable.map(b => b.id);
    let deletedCount = 0;

    // Delete all related records and bikes
    for (const bikeId of bikeIds) {
      // Delete work registrations
      await supabase.from('work_registrations').delete().eq('bike_id', bikeId);
      // Delete comments
      await supabase.from('bike_comments').delete().eq('bike_id', bikeId);
      // Delete checklist completions
      await supabase.from('bike_checklist_completions').delete().eq('bike_id', bikeId);
      // Delete bike
      const { error } = await supabase.from('bikes').delete().eq('id', bikeId);
      if (!error) {
        deletedCount++;
      }
    }

    toast.success(`${deletedCount} ${t('bikesDeletedCount')}`);
    fetchTableOverviews();
    setShowDeleteWithoutTableConfirm(false);
  };

  const fetchCompletedBikes = async () => {
    // Fetch all bikes with workflow_status = 'afgerond' in the selected date range
    const { data: bikes } = await supabase
      .from('bikes')
      .select('id, frame_number, model, updated_at, diagnosed_by, diagnosed_at')
      .eq('workflow_status', 'afgerond')
      .gte('updated_at', subDays(new Date(), parseInt(dateRange)).toISOString())
      .order('updated_at', { ascending: false });

    if (!bikes || bikes.length === 0) {
      setCompletedBikes([]);
      return;
    }

    const bikeIds = bikes.map(b => b.id);

    // Fetch all completed work registrations for these bikes (including last_modified_by)
    const { data: registrations } = await supabase
      .from('work_registrations')
      .select(`
        id,
        bike_id,
        mechanic_id,
        completed_at,
        last_modified_by,
        last_modified_at,
        repair_type:repair_types(name, points)
      `)
      .in('bike_id', bikeIds)
      .eq('completed', true);

    // Fetch comments for these bikes
    const { data: comments } = await supabase
      .from('bike_comments')
      .select('id, bike_id, content, author_id, created_at')
      .in('bike_id', bikeIds)
      .order('created_at', { ascending: false });

    // Fetch checklist completions to find who completed the bike (last checklist action)
    const { data: checklistCompletions } = await supabase
      .from('bike_checklist_completions')
      .select('bike_id, completed_by, completed_at')
      .in('bike_id', bikeIds)
      .order('completed_at', { ascending: false });

    // Collect all profile IDs
    const mechanicIds = [...new Set((registrations || []).map((r: any) => r.mechanic_id).filter(Boolean))];
    const modifierIds = [...new Set((registrations || []).map((r: any) => r.last_modified_by).filter(Boolean))];
    const authorIds = [...new Set((comments || []).map((c: any) => c.author_id).filter(Boolean))];
    const diagnosedByIds = [...new Set(bikes.map((b: any) => b.diagnosed_by).filter(Boolean))];
    const completedByIds = [...new Set((checklistCompletions || []).map((c: any) => c.completed_by).filter(Boolean))];
    const allProfileIds = [...new Set([...mechanicIds, ...modifierIds, ...authorIds, ...diagnosedByIds, ...completedByIds])];

    let profileMap: Record<string, string> = {};
    if (allProfileIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', allProfileIds);

      if (profiles) {
        profileMap = profiles.reduce((acc, p) => {
          acc[p.id] = p.full_name;
          return acc;
        }, {} as Record<string, string>);
      }
    }

    // Build completed bikes data
    const completedBikesData: CompletedBike[] = bikes.map(bike => {
      const bikeRegistrations = (registrations || []).filter((r: any) => r.bike_id === bike.id);
      const bikeComments = (comments || []).filter((c: any) => c.bike_id === bike.id);

      // Get unique mechanics
      const mechanicSet = new Map<string, string>();
      bikeRegistrations.forEach((r: any) => {
        if (r.mechanic_id && !mechanicSet.has(r.mechanic_id)) {
          mechanicSet.set(r.mechanic_id, profileMap[r.mechanic_id] || 'Onbekend');
        }
      });

      const repairs = bikeRegistrations.map((r: any) => ({
        type: r.repair_type?.name || 'Onbekend',
        points: r.repair_type?.points || 0,
        completedAt: r.completed_at,
        mechanicName: r.mechanic_id ? profileMap[r.mechanic_id] || 'Onbekend' : 'Onbekend'
      }));

      const totalPoints = repairs.reduce((sum: number, r: any) => sum + r.points, 0);

      // Find the latest completion date
      const latestCompletion = bikeRegistrations
        .filter((r: any) => r.completed_at)
        .map((r: any) => new Date(r.completed_at))
        .sort((a: Date, b: Date) => b.getTime() - a.getTime())[0];

      // Find last modifier of registrations (diagnosis changes)
      const modifiedRegs = bikeRegistrations
        .filter((r: any) => r.last_modified_by)
        .sort((a: any, b: any) => new Date(b.last_modified_at || 0).getTime() - new Date(a.last_modified_at || 0).getTime());
      const lastModifier = modifiedRegs[0];

      // Find who completed the bike (first checklist completion = the person who triggered it)
      const bikeChecklistCompletions = (checklistCompletions || []).filter((c: any) => c.bike_id === bike.id);
      const completedByUser = bikeChecklistCompletions.length > 0 ? bikeChecklistCompletions[bikeChecklistCompletions.length - 1] : null;

      return {
        id: bike.id,
        frame_number: bike.frame_number,
        model: bike.model,
        completed_at: latestCompletion?.toISOString() || bike.updated_at,
        diagnosed_by_name: (bike as any).diagnosed_by ? profileMap[(bike as any).diagnosed_by] : undefined,
        diagnosed_at: (bike as any).diagnosed_at || undefined,
        last_modified_by_name: lastModifier?.last_modified_by ? profileMap[lastModifier.last_modified_by] : undefined,
        last_modified_at: lastModifier?.last_modified_at || undefined,
        completed_by_name: completedByUser?.completed_by ? profileMap[completedByUser.completed_by] : undefined,
        mechanics: Array.from(mechanicSet.entries()).map(([id, name]) => ({ id, name })),
        repairs,
        comments: bikeComments.map((c: any) => ({
          content: c.content,
          authorName: c.author_id ? profileMap[c.author_id] || 'Onbekend' : 'Onbekend',
          createdAt: c.created_at
        })),
        totalPoints
      };
    });

    setCompletedBikes(completedBikesData);
  };

  const fetchMechanicStats = async () => {
    const { data: registrations } = await supabase
      .from('work_registrations')
      .select(`
        mechanic_id,
        repair_type:repair_types(points)
      `)
      .eq('completed', true)
      .not('mechanic_id', 'is', null)
      .gte('completed_at', subDays(new Date(), parseInt(dateRange)).toISOString());

    if (!registrations) return;

    // Fetch mechanic profiles separately
    const mechanicIds = [...new Set(registrations.map((r: any) => r.mechanic_id).filter(Boolean))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', mechanicIds);

    const profileMap = new Map(profiles?.map((p: any) => [p.id, p.full_name]) || []);

    const statsMap = new Map<string, MechanicStats>();

    registrations.forEach((reg: any) => {
      if (!reg.mechanic_id) return;

      const existing = statsMap.get(reg.mechanic_id);
      const points = reg.repair_type?.points || 0;

      if (existing) {
        existing.totalRepairs += 1;
        existing.totalPoints += points;
      } else {
        statsMap.set(reg.mechanic_id, {
          id: reg.mechanic_id,
          name: profileMap.get(reg.mechanic_id) || 'Onbekend',
          totalRepairs: 1,
          totalPoints: points,
        });
      }
    });

    setMechanicStats(Array.from(statsMap.values()).sort((a, b) => b.totalPoints - a.totalPoints));
  };

  const fetchRepairDetails = async () => {
    const { data: registrations } = await supabase
      .from('work_registrations')
      .select(`
        id,
        mechanic_id,
        bike_id,
        created_at,
        completed_at,
        repair_type:repair_types(name, points)
      `)
      .eq('completed', true)
      .not('mechanic_id', 'is', null)
      .gte('completed_at', subDays(new Date(), parseInt(dateRange)).toISOString())
      .order('completed_at', { ascending: false });

    if (!registrations || registrations.length === 0) {
      setRepairDetails([]);
      setDailyMechanicPoints([]);
      setMechanicNames([]);
      return;
    }

    // Fetch mechanic profiles
    const mechanicIds = [...new Set(registrations.map((r: any) => r.mechanic_id).filter(Boolean))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', mechanicIds);

    const profileMap = new Map(profiles?.map((p: any) => [p.id, p.full_name]) || []);

    // Fetch bikes
    const bikeIds = [...new Set(registrations.map((r: any) => r.bike_id).filter(Boolean))];
    const { data: bikes } = await supabase
      .from('bikes')
      .select('id, frame_number, model')
      .in('id', bikeIds);

    const bikeMap = new Map(bikes?.map((b: any) => [b.id, { frame_number: b.frame_number, model: b.model }]) || []);

    const details: RepairDetail[] = registrations.map((reg: any) => {
      const bike = bikeMap.get(reg.bike_id) || { frame_number: 'Onbekend', model: 'Onbekend' };
      const durationMinutes = reg.created_at && reg.completed_at
        ? differenceInMinutes(new Date(reg.completed_at), new Date(reg.created_at))
        : null;

      return {
        id: reg.id,
        mechanicId: reg.mechanic_id,
        mechanicName: profileMap.get(reg.mechanic_id) || 'Onbekend',
        bikeFrameNumber: bike.frame_number,
        bikeModel: bike.model,
        repairType: reg.repair_type?.name || 'Onbekend',
        points: reg.repair_type?.points || 0,
        durationMinutes,
        completedAt: reg.completed_at,
      };
    });

    setRepairDetails(details);

    // Calculate daily points per mechanic
    const days = parseInt(dateRange);
    const dailyData: DailyMechanicPoints[] = [];
    const allMechanics = new Set<string>();

    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const displayDate = format(date, 'EEE d MMM', { locale: nl });

      const dayEntry: DailyMechanicPoints = { date: displayDate };

      details.forEach(detail => {
        if (detail.completedAt && format(new Date(detail.completedAt), 'yyyy-MM-dd') === dateStr) {
          allMechanics.add(detail.mechanicName);
          dayEntry[detail.mechanicName] = ((dayEntry[detail.mechanicName] as number) || 0) + detail.points;
        }
      });

      dailyData.push(dayEntry);
    }

    setDailyMechanicPoints(dailyData);
    setMechanicNames(Array.from(allMechanics));
  };

  const fetchBikeStatuses = async () => {
    const { data: bikes } = await supabase
      .from('bikes')
      .select('id, frame_number, model, workflow_status')
      .neq('workflow_status', 'afgerond')
      .order('updated_at', { ascending: false })
      .limit(20);

    if (!bikes) return;

    // Fetch work registrations for these bikes
    const bikeIds = bikes.map((b: any) => b.id);
    const { data: registrations } = await supabase
      .from('work_registrations')
      .select('bike_id, completed')
      .in('bike_id', bikeIds);

    const regMap = new Map<string, { pending: number; completed: number }>();
    registrations?.forEach((r: any) => {
      const existing = regMap.get(r.bike_id) || { pending: 0, completed: 0 };
      if (r.completed) {
        existing.completed += 1;
      } else {
        existing.pending += 1;
      }
      regMap.set(r.bike_id, existing);
    });

    const statuses = bikes.map((bike: any) => {
      const regs = regMap.get(bike.id) || { pending: 0, completed: 0 };
      return {
        id: bike.id,
        frame_number: bike.frame_number,
        model: bike.model,
        status: bike.workflow_status,
        pendingRepairs: regs.pending,
        completedRepairs: regs.completed,
      };
    });

    setBikeStatuses(statuses);
  };

  const fetchDailyStats = async () => {
    const days = parseInt(dateRange);
    const stats: DailyStats[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const start = startOfDay(date).toISOString();
      const end = endOfDay(date).toISOString();

      const { data: registrations } = await supabase
        .from('work_registrations')
        .select('repair_type:repair_types(points)')
        .eq('completed', true)
        .gte('completed_at', start)
        .lte('completed_at', end);

      const repairs = registrations?.length || 0;
      const points = registrations?.reduce((sum: number, r: any) => sum + (r.repair_type?.points || 0), 0) || 0;

      stats.push({
        date: format(date, 'EEE', { locale: nl }),
        repairs,
        points,
      });
    }

    setDailyStats(stats);
  };

  const fetchRepairTypeStats = async () => {
    const { data: registrations } = await supabase
      .from('work_registrations')
      .select('repair_type:repair_types(name)')
      .eq('completed', true)
      .gte('completed_at', subDays(new Date(), parseInt(dateRange)).toISOString());

    if (!registrations) return;

    const countMap = new Map<string, number>();
    registrations.forEach((r: any) => {
      const name = r.repair_type?.name || 'Onbekend';
      countMap.set(name, (countMap.get(name) || 0) + 1);
    });

    const stats = Array.from(countMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    setRepairTypeStats(stats);
  };

  const formatDuration = (minutes: number | null) => {
    if (minutes === null) return '-';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}u ${mins}m`;
  };

  const getStatusLabel = (status: string) => {
    const labelsNL: Record<string, string> = {
      'diagnose_nodig': 'Diagnose nodig',
      'wacht_op_akkoord': 'Wacht op akkoord',
      'klaar_voor_reparatie': 'Klaar voor reparatie',
      'in_reparatie': 'In reparatie',
      'afgerond': 'Afgerond',
    };
    const labelsEN: Record<string, string> = {
      'diagnose_nodig': 'Diagnosis needed',
      'wacht_op_akkoord': 'Waiting for approval',
      'klaar_voor_reparatie': 'Ready for repair',
      'in_reparatie': 'In repair',
      'afgerond': 'Completed',
    };
    const labels = language === 'nl' ? labelsNL : labelsEN;
    return labels[status] || status;
  };
  
  const getStatusLabelEN = (status: string) => {
    const labelsEN: Record<string, string> = {
      'diagnose_nodig': 'Diagnosis needed',
      'wacht_op_akkoord': 'Waiting for approval',
      'klaar_voor_reparatie': 'Ready for repair',
      'in_reparatie': 'In repair',
      'afgerond': 'Completed',
    };
    return labelsEN[status] || status;
  };

  const getDateFromPeriod = (period: string) => {
    const periodNum = parseInt(period);
    if (periodNum === 365) {
      return subYears(new Date(), 1).toISOString();
    }
    return subDays(new Date(), periodNum).toISOString();
  };

  const handleMechanicClick = async (mechanic: MechanicStats) => {
    setSelectedMechanic(mechanic);
    setMechanicDetailPeriod('7'); // Reset to default period
    await fetchMechanicDetails(mechanic.id, '7');
  };

  const fetchMechanicDetails = async (mechanicId: string, period: string) => {
    const fromDate = getDateFromPeriod(period);
    
    // Fetch all repairs by this mechanic
    const { data: registrations } = await supabase
      .from('work_registrations')
      .select(`
        id,
        bike_id,
        completed_at,
        repair_type:repair_types(name, points)
      `)
      .eq('mechanic_id', mechanicId)
      .eq('completed', true)
      .gte('completed_at', fromDate)
      .order('completed_at', { ascending: false });

    if (!registrations) {
      setMechanicBikes([]);
      setMechanicRepairStats([]);
      return;
    }

    // Build repair type statistics for chart
    const repairCountMap = new Map<string, number>();
    registrations.forEach((reg: any) => {
      const repairName = reg.repair_type?.name || 'Onbekend';
      repairCountMap.set(repairName, (repairCountMap.get(repairName) || 0) + 1);
    });
    
    const repairStats = Array.from(repairCountMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    
    setMechanicRepairStats(repairStats);

    // Fetch bikes for these registrations
    const bikeIds = [...new Set(registrations.map((r: any) => r.bike_id))];
    const { data: bikes } = await supabase
      .from('bikes')
      .select('id, frame_number, model')
      .in('id', bikeIds);

    const bikeMap = new Map(bikes?.map((b: any) => [b.id, { frame_number: b.frame_number, model: b.model }]) || []);

    // Group repairs by bike
    const bikesData = new Map<string, {
      bikeId: string;
      frameNumber: string;
      model: string;
      repairs: { type: string; points: number; completedAt: string }[];
      totalPoints: number;
    }>();

    registrations.forEach((reg: any) => {
      const bike = bikeMap.get(reg.bike_id) || { frame_number: 'Onbekend', model: 'Onbekend' };
      const repairType = reg.repair_type?.name || 'Onbekend';
      const points = reg.repair_type?.points || 0;

      if (!bikesData.has(reg.bike_id)) {
        bikesData.set(reg.bike_id, {
          bikeId: reg.bike_id,
          frameNumber: bike.frame_number,
          model: bike.model,
          repairs: [],
          totalPoints: 0
        });
      }

      const bikeData = bikesData.get(reg.bike_id)!;
      bikeData.repairs.push({
        type: repairType,
        points,
        completedAt: reg.completed_at
      });
      bikeData.totalPoints += points;
    });

    setMechanicBikes(Array.from(bikesData.values()));
  };

  const handleMechanicPeriodChange = async (period: '1' | '7' | '30' | '365') => {
    setMechanicDetailPeriod(period);
    if (selectedMechanic) {
      await fetchMechanicDetails(selectedMechanic.id, period);
    }
  };

  const totalRepairs = mechanicStats.reduce((sum, m) => sum + m.totalRepairs, 0);
  const totalPoints = mechanicStats.reduce((sum, m) => sum + m.totalPoints, 0);
  const activeBikes = bikeStatuses.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('adminDashboard')}</h2>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('period')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">{t('today')}</SelectItem>
            <SelectItem value="7">{t('last7Days')}</SelectItem>
            <SelectItem value="30">{t('last30Days')}</SelectItem>
            <SelectItem value="365">{t('lastYear')}</SelectItem>
            <SelectItem value="9999">{t('allTime')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Admin Password Settings - Only visible for super admin */}
      <AdminPasswordSettings />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('totalRepairs')}</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRepairs}</div>
            <p className="text-xs text-muted-foreground">
              {t('inSelectedPeriod')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('totalPoints')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPoints}</div>
            <p className="text-xs text-muted-foreground">
              {t('earnedByMechanics')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('activeBikes')}</CardTitle>
            <Bike className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeBikes}</div>
            <p className="text-xs text-muted-foreground">
              {t('inProgress')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('activeMechanics')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mechanicStats.length}</div>
            <p className="text-xs text-muted-foreground">
              {t('haveWorked')}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <ScrollArea className="w-full pb-2">
          <TabsList className="inline-flex w-max gap-1">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">{t('overview')}</TabsTrigger>
            <TabsTrigger value="tables" className="text-xs sm:text-sm">{t('tables')}</TabsTrigger>
            <TabsTrigger value="completed" className="text-xs sm:text-sm">{t('completed')}</TabsTrigger>
            <TabsTrigger value="warranty" className="text-xs sm:text-sm">{t('warrantyTab')}</TabsTrigger>
            <TabsTrigger value="daily-points" className="text-xs sm:text-sm">{t('dailyPoints')}</TabsTrigger>
            <TabsTrigger value="repairs" className="text-xs sm:text-sm">{t('repairs')}</TabsTrigger>
            <TabsTrigger value="mechanics" className="text-xs sm:text-sm">{t('mechanics')}</TabsTrigger>
            <TabsTrigger value="bikes" className="text-xs sm:text-sm">{t('bikes')}</TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Daily Chart */}
            <Card>
              <CardHeader>
                <CardTitle>{t('dailyRepairs')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="repairs" fill="hsl(var(--primary))" name={t('repairs')} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Repair Types Pie */}
            <Card>
              <CardHeader>
                <CardTitle>{t('topRepairs')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={repairTypeStats}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="count"
                        nameKey="name"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {repairTypeStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tables" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Table2 className="h-5 w-5" />
                  {t('tableOverview')}
                </CardTitle>
                <CardDescription>{t('assignMechanicToBikes')}</CardDescription>
              </div>
              <div className="flex gap-2 flex-wrap">
                {tableOverviews.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowClearTablesConfirm(true)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    {t('clearAllTables')}
                  </Button>
                )}
                {tableOverviews.some(table => table.bikes.some(bike => bike.current_mechanic_id)) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveAllMechanics}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <UserMinus className="h-4 w-4 mr-2" />
                    {t('removeAllMechanics')}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {tableOverviews.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {t('noActiveBikesOnTables')}
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tableOverviews.map((table) => (
                    <Card key={table.tableNumber} className="border-2">
                      <CardHeader className="pb-2 bg-muted/50">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Table2 className="h-4 w-4" />
                          {t('tableLabel')} {table.tableNumber}
                          <Badge variant="secondary" className="ml-auto">
                            {table.bikes.length} {table.bikes.length !== 1 ? t('bikes').toLowerCase() : t('bike').toLowerCase()}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-3 space-y-2">
                        {table.bikes.map((bike) => (
                          <div
                            key={bike.id}
                            className="p-3 rounded-lg border bg-background space-y-2"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <Bike className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="font-mono text-sm font-medium">{bike.frame_number}</p>
                                  <p className="text-xs text-muted-foreground">{bike.model}</p>
                                </div>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {bike.pending_repairs} {t('open')}
                              </Badge>
                            </div>

                            {/* Status selector */}
                            <div className="pt-1">
                              <Select
                                value={bike.workflow_status}
                                onValueChange={(value) => handleStatusChange(bike.id, bike.frame_number, value)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {WORKFLOW_STATUS_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value} className="text-xs">
                                      {getStatusLabel(option.value)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            
                            {bike.current_mechanic_name ? (
                              <div className="flex items-center justify-between bg-primary/10 rounded px-2 py-1">
                                <div className="flex items-center gap-2 text-sm">
                                  <Users className="h-3 w-3 text-primary" />
                                  <span className="font-medium">{bike.current_mechanic_name}</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 hover:bg-destructive/20"
                                  onClick={() => handleRemoveMechanic(bike.id)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full h-8 text-xs"
                                onClick={() => {
                                  setAssigningBike(bike);
                                  setSelectedMechanicId('');
                                }}
                              >
                                <UserPlus className="h-3 w-3 mr-1" />
                                {t('assignMechanic')}
                              </Button>
                            )}
                            
                            {bike.diagnosed_by_name && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground px-2">
                                <Stethoscope className="h-3 w-3" />
                                <span>{t('diagnosedBy')}: {bike.diagnosed_by_name}</span>
                              </div>
                            )}
                            
                            {/* Delete bike button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeletingBike(bike)}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              {t('deleteBike')}
                            </Button>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bikes without table section */}
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <XCircle className="h-5 w-5" />
                    {t('bikesWithoutTable')}
                    {bikesWithoutTable.length > 0 && (
                      <Badge variant="secondary">{bikesWithoutTable.length}</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>{t('bikesWithoutTableDescription')}</CardDescription>
                </div>
                {bikesWithoutTable.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteWithoutTableConfirm(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('deleteAllBikesWithoutTable')}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {bikesWithoutTable.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {t('noBikesWithoutTable')}
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {bikesWithoutTable.map((bike) => (
                    <div
                      key={bike.id}
                      className="p-3 rounded-lg border bg-background space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Bike className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-mono text-sm font-medium">{bike.frame_number}</p>
                            <p className="text-xs text-muted-foreground">{bike.model}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {bike.pending_repairs} {t('open')}
                        </Badge>
                      </div>

                      {/* Status selector */}
                      <div className="pt-1">
                        <Select
                          value={bike.workflow_status}
                          onValueChange={(value) => handleStatusChange(bike.id, bike.frame_number, value)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {WORKFLOW_STATUS_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value} className="text-xs">
                                {getStatusLabel(option.value)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {bike.current_mechanic_name ? (
                        <div className="flex items-center justify-between bg-primary/10 rounded px-2 py-1">
                          <div className="flex items-center gap-2 text-sm">
                            <Users className="h-3 w-3 text-primary" />
                            <span className="font-medium">{bike.current_mechanic_name}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-destructive/20"
                            onClick={() => handleRemoveMechanic(bike.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full h-8 text-xs"
                          onClick={() => {
                            setAssigningBike(bike);
                            setSelectedMechanicId('');
                          }}
                        >
                          <UserPlus className="h-3 w-3 mr-1" />
                          {t('assignMechanic')}
                        </Button>
                      )}
                      
                      {bike.diagnosed_by_name && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground px-2">
                          <Stethoscope className="h-3 w-3" />
                          <span>{t('diagnosedBy')}: {bike.diagnosed_by_name}</span>
                        </div>
                      )}
                      
                      {/* Delete bike button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeletingBike(bike)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        {t('deleteBike')}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Archive className="h-5 w-5" />
                {t('completedBikesTitle')}
              </CardTitle>
              <CardDescription>{t('completedBikesDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search field */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('searchFrameModelMechanic')}
                  value={completedBikesSearchQuery}
                  onChange={(e) => setCompletedBikesSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {(() => {
                const filteredBikes = completedBikes.filter(bike => {
                  if (!completedBikesSearchQuery) return true;
                  const query = completedBikesSearchQuery.toLowerCase();
                  return (
                    bike.frame_number.toLowerCase().includes(query) ||
                    bike.model.toLowerCase().includes(query) ||
                    bike.mechanics.some(m => m.name.toLowerCase().includes(query)) ||
                    (bike.diagnosed_by_name && bike.diagnosed_by_name.toLowerCase().includes(query))
                  );
                });
                
                return filteredBikes.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    {completedBikesSearchQuery 
                      ? t('noBikesForSearch') 
                      : t('noCompletedBikesInPeriod')}
                  </p>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-3">
                      {filteredBikes.map((bike) => (
                        <button
                          key={bike.id}
                          onClick={() => setSelectedCompletedBike(bike)}
                          className="w-full flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                              <Bike className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-mono font-medium">{bike.frame_number}</p>
                              <p className="text-sm text-muted-foreground">VanMoof {bike.model}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(bike.completed_at), 'dd MMM yyyy HH:mm', { locale: dateLocale })}
                                </span>
                              </div>
                              {bike.diagnosed_by_name && (
                                <div className="flex items-center gap-1 mt-0.5">
                                  <Stethoscope className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">{t('diagnosedBy')}: {bike.diagnosed_by_name}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <Badge variant="default">{bike.totalPoints} pt</Badge>
                              <p className="text-xs text-muted-foreground mt-1">
                                {bike.repairs.length} {bike.repairs.length !== 1 ? t('repairs').toLowerCase() : t('repairType').toLowerCase()}
                              </p>
                            </div>
                            {bike.mechanics.length > 0 && (
                              <div className="flex -space-x-2">
                                {bike.mechanics.slice(0, 3).map((m, idx) => (
                                  <div
                                    key={m.id}
                                    className="w-8 h-8 rounded-full bg-secondary border-2 border-background flex items-center justify-center text-xs font-medium"
                                    title={m.name}
                                  >
                                    {m.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                  </div>
                                ))}
                                {bike.mechanics.length > 3 && (
                                  <div className="w-8 h-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs">
                                    +{bike.mechanics.length - 3}
                                  </div>
                                )}
                              </div>
                            )}
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="warranty">
          <WarrantyOverview dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="daily-points" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Punten per Monteur per Dag</CardTitle>
              <CardDescription>Overzicht van verdiende punten per dag</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyMechanicPoints}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {mechanicNames.map((name, index) => (
                      <Bar
                        key={name}
                        dataKey={name}
                        stackId="a"
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Daily points table */}
          <Card>
            <CardHeader>
              <CardTitle>Dagelijks Puntenoverzicht</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <div className="min-w-[400px]">
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-background">Datum</TableHead>
                        {mechanicNames.map(name => (
                          <TableHead key={name} className="text-right whitespace-nowrap">{name}</TableHead>
                        ))}
                        <TableHead className="text-right font-bold">Totaal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailyMechanicPoints.map((day, index) => {
                        const total = mechanicNames.reduce((sum, name) => sum + ((day[name] as number) || 0), 0);
                        return (
                          <TableRow key={index}>
                            <TableCell className="font-medium sticky left-0 bg-background whitespace-nowrap">{day.date}</TableCell>
                            {mechanicNames.map(name => (
                              <TableCell key={name} className="text-right">
                                {(day[name] as number) || 0}
                              </TableCell>
                            ))}
                            <TableCell className="text-right font-bold">{total}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="repairs">
          <Card>
            <CardHeader>
              <CardTitle>Uitgevoerde Reparaties</CardTitle>
              <CardDescription>Gedetailleerd overzicht per monteur met fiets, duur en punten</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <div className="min-w-[600px]">
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">Monteur</TableHead>
                        <TableHead className="whitespace-nowrap">Fiets</TableHead>
                        <TableHead className="whitespace-nowrap">Reparatie</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Duur</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Punten</TableHead>
                        <TableHead className="whitespace-nowrap">Afgerond</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {repairDetails.map((detail) => (
                        <TableRow key={detail.id}>
                          <TableCell className="font-medium whitespace-nowrap">{detail.mechanicName}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-mono text-sm whitespace-nowrap">{detail.bikeFrameNumber}</span>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">VanMoof {detail.bikeModel}</span>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{detail.repairType}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className="whitespace-nowrap">
                              <Clock className="h-3 w-3 mr-1" />
                              {formatDuration(detail.durationMinutes)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge className="whitespace-nowrap">{detail.points} pt</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {format(new Date(detail.completedAt), 'dd MMM HH:mm', { locale: nl })}
                          </TableCell>
                        </TableRow>
                      ))}
                      {repairDetails.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Geen reparaties in deze periode
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mechanics">
          <Card>
            <CardHeader>
              <CardTitle>Monteur Prestaties</CardTitle>
              <CardDescription>Klik op een monteur voor details</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {mechanicStats.map((mechanic, index) => (
                    <button
                      key={mechanic.id}
                      onClick={() => handleMechanicClick(mechanic)}
                      className="w-full flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{mechanic.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {mechanic.totalRepairs} reparaties
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="text-lg px-3 py-1">
                          {mechanic.totalPoints} punten
                        </Badge>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </button>
                  ))}
                  {mechanicStats.length === 0 && (
                    <p className="text-muted-foreground text-center py-8">
                      Geen gegevens voor deze periode
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bikes">
          <Card>
            <CardHeader>
              <CardTitle>Actieve Fietsen</CardTitle>
              <CardDescription>Fietsen die nog in behandeling zijn</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {bikeStatuses.map(bike => (
                    <div
                      key={bike.id}
                      className="flex items-center justify-between p-4 rounded-lg border"
                    >
                      <div className="flex items-center gap-4">
                        <Bike className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <p className="font-medium font-mono">{bike.frame_number}</p>
                          <p className="text-sm text-muted-foreground">
                            VanMoof {bike.model}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {getStatusLabel(bike.status)}
                        </Badge>
                        <div className="flex items-center gap-1 text-sm text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          <span>{bike.completedRepairs}</span>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-amber-600">
                          <Clock className="h-4 w-4" />
                          <span>{bike.pendingRepairs}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {bikeStatuses.length === 0 && (
                    <p className="text-muted-foreground text-center py-8">
                      Geen actieve fietsen
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Mechanic Detail Dialog */}
      <Dialog open={!!selectedMechanic} onOpenChange={(open) => !open && setSelectedMechanic(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {selectedMechanic?.name}
            </DialogTitle>
            <DialogDescription>
              Overzicht van gerepareerde fietsen en reparatiefrequentie
            </DialogDescription>
          </DialogHeader>
          
          {/* Period selector */}
          <div className="flex items-center gap-2 py-2 border-b">
            <span className="text-sm text-muted-foreground">Periode:</span>
            <div className="flex gap-1">
              {[
                { value: '1' as const, label: 'Vandaag' },
                { value: '7' as const, label: '7 dagen' },
                { value: '30' as const, label: 'Maand' },
                { value: '365' as const, label: 'Jaar' },
              ].map((option) => (
                <Button
                  key={option.value}
                  variant={mechanicDetailPeriod === option.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleMechanicPeriodChange(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-4 py-2">
            <Badge variant="outline" className="text-base">
              <Wrench className="h-4 w-4 mr-1" />
              {mechanicBikes.reduce((sum, b) => sum + b.repairs.length, 0)} reparaties
            </Badge>
            <Badge variant="default" className="text-base">
              <TrendingUp className="h-4 w-4 mr-1" />
              {mechanicBikes.reduce((sum, b) => sum + b.totalPoints, 0)} punten
            </Badge>
          </div>

          {/* Repair frequency chart */}
          {mechanicRepairStats.length > 0 && (
            <div className="py-2">
              <h4 className="font-medium mb-2 text-sm">Reparatie frequentie</h4>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mechanicRepairStats} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      width={150}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`${value}x uitgevoerd`, 'Aantal']}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-4">
              {mechanicBikes.map((bike) => (
                <Card key={bike.bikeId}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Bike className="h-6 w-6 text-primary" />
                        <div>
                          <CardTitle className="text-base font-mono">{bike.frameNumber}</CardTitle>
                          <CardDescription>VanMoof {bike.model}</CardDescription>
                        </div>
                      </div>
                      <Badge>{bike.totalPoints} pt</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {bike.repairs.map((repair, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span>{repair.type}</span>
                          </div>
                          <div className="flex items-center gap-3 text-muted-foreground">
                            <span>{repair.points} pt</span>
                            <span>{format(new Date(repair.completedAt), 'dd MMM HH:mm', { locale: nl })}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {mechanicBikes.length === 0 && (
                <p className="text-muted-foreground text-center py-8">
                  Geen fietsen gerepareerd in deze periode
                </p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Assign Mechanic Dialog */}
      <Dialog open={!!assigningBike} onOpenChange={(open) => !open && setAssigningBike(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Monteur Toewijzen
            </DialogTitle>
            <DialogDescription>
              Selecteer een monteur voor fiets {assigningBike?.frame_number}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Bike className="h-6 w-6 text-primary" />
              <div>
                <p className="font-mono font-medium">{assigningBike?.frame_number}</p>
                <p className="text-sm text-muted-foreground">{assigningBike?.model}</p>
              </div>
            </div>

            <Select value={selectedMechanicId} onValueChange={setSelectedMechanicId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecteer een monteur" />
              </SelectTrigger>
              <SelectContent>
                {allMechanics.map((mechanic) => (
                  <SelectItem key={mechanic.id} value={mechanic.id}>
                    {mechanic.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAssigningBike(null)}>
                Annuleren
              </Button>
              <Button onClick={handleAssignMechanic} disabled={!selectedMechanicId}>
                Toewijzen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Completed Bike Detail Dialog */}
      <Dialog open={!!selectedCompletedBike} onOpenChange={(open) => !open && setSelectedCompletedBike(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5" />
              {selectedCompletedBike?.frame_number}
            </DialogTitle>
            <DialogDescription>
              VanMoof {selectedCompletedBike?.model} - Afgerond op {selectedCompletedBike && format(new Date(selectedCompletedBike.completed_at), 'dd MMMM yyyy HH:mm', { locale: nl })}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex items-center gap-4 py-2">
            <Badge variant="default" className="text-base">
              <TrendingUp className="h-4 w-4 mr-1" />
              {selectedCompletedBike?.totalPoints} punten
            </Badge>
            <Badge variant="outline" className="text-base">
              <Users className="h-4 w-4 mr-1" />
              {selectedCompletedBike?.mechanics.length} monteur{selectedCompletedBike?.mechanics.length !== 1 ? 's' : ''}
            </Badge>
          </div>

          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-6">
              {/* Diagnosed by */}
              {selectedCompletedBike?.diagnosed_by_name && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Stethoscope className="h-4 w-4" />
                    {t('diagnosedBy')}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{selectedCompletedBike.diagnosed_by_name}</Badge>
                    {selectedCompletedBike.diagnosed_at && (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(selectedCompletedBike.diagnosed_at), 'dd MMM yyyy HH:mm', { locale: dateLocale })}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Diagnosis modified by */}
              {selectedCompletedBike?.last_modified_by_name && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {language === 'nl' ? 'Diagnose aangepast door' : 'Diagnosis modified by'}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{selectedCompletedBike.last_modified_by_name}</Badge>
                    {selectedCompletedBike.last_modified_at && (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(selectedCompletedBike.last_modified_at), 'dd MMM yyyy HH:mm', { locale: dateLocale })}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Completed by */}
              {selectedCompletedBike?.completed_by_name && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    {language === 'nl' ? 'Afgerond door' : 'Completed by'}
                  </h4>
                  <Badge variant="outline">{selectedCompletedBike.completed_by_name}</Badge>
                </div>
              )}

              {/* Mechanics */}
              {selectedCompletedBike?.mechanics && selectedCompletedBike.mechanics.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Monteurs die hebben gewerkt
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedCompletedBike.mechanics.map((m) => (
                      <Badge key={m.id} variant="secondary">
                        {m.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Repairs */}
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  Uitgevoerde reparaties
                </h4>
                <div className="space-y-2">
                  {selectedCompletedBike?.repairs.map((repair, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-primary" />
                        <span>{repair.type}</span>
                        <span className="text-muted-foreground">• {repair.mechanicName}</span>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <Badge variant="outline">{repair.points} pt</Badge>
                        <span>{repair.completedAt && format(new Date(repair.completedAt), 'dd MMM HH:mm', { locale: nl })}</span>
                      </div>
                    </div>
                  ))}
                  {(!selectedCompletedBike?.repairs || selectedCompletedBike.repairs.length === 0) && (
                    <p className="text-muted-foreground text-sm">Geen reparaties geregistreerd</p>
                  )}
                </div>
              </div>

              {/* Comments */}
              {selectedCompletedBike?.comments && selectedCompletedBike.comments.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Opmerkingen
                  </h4>
                  <div className="space-y-3">
                    {selectedCompletedBike.comments.map((comment, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">{comment.authorName}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(comment.createdAt), 'dd MMM HH:mm', { locale: nl })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{comment.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Completion Checklist Dialog */}
      {checklistBike && (
        <CompletionChecklistDialog
          bikeId={checklistBike.id}
          bikeFrameNumber={checklistBike.frame_number}
          open={!!checklistBike}
          onOpenChange={(open) => !open && setChecklistBike(null)}
          onComplete={handleChecklistComplete}
        />
      )}

      {/* Clear All Tables Confirmation Dialog */}
      <AlertDialog open={showClearTablesConfirm} onOpenChange={setShowClearTablesConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('clearAllTables')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('clearAllTablesConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAllTables}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('clearAllTables')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Bike Confirmation Dialog */}
      <AlertDialog open={!!deletingBike} onOpenChange={(open) => !open && setDeletingBike(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteBike')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteBikeConfirm')}
              {deletingBike && (
                <span className="block mt-2 font-mono font-medium">
                  {deletingBike.frame_number} ({deletingBike.model})
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingBike && handleDeleteBike(deletingBike)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Bikes Without Table Confirmation Dialog */}
      <AlertDialog open={showDeleteWithoutTableConfirm} onOpenChange={setShowDeleteWithoutTableConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteAllBikesWithoutTable')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteAllBikesWithoutTableConfirm')}
              <span className="block mt-2 font-medium">
                {bikesWithoutTable.length} {t('bikes').toLowerCase()}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAllBikesWithoutTable}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
