import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Bike, Wrench, User, ArrowRight, ClipboardList, Clock, PlayCircle, CheckCircle2, Plus, Trash2, Edit, Calendar, XCircle, Send, AlertTriangle, HandMetal } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';

interface BikeTask {
  id: string;
  frame_number: string;
  model: string;
  table_number: string | null;
  workflow_status: string;
  current_mechanic_id: string | null;
  pending_repairs: number;
  completed_repairs: number;
  mechanic_name?: string;
}

interface Profile {
  id: string;
  full_name: string;
}

interface BikeOption {
  id: string;
  frame_number: string;
  model: string;
  table_number: string | null;
}

type TaskStatus = 'nog_niet_gestart' | 'in_behandeling' | 'afgerond';

interface FohTask {
  id: string;
  task_number: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  deadline: string | null;
  assigned_to: string | null;
  created_by: string;
  notes: string | null;
  bike_id: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  creator_name?: string;
  assignee_name?: string;
  bike?: BikeOption | null;
}

interface MyTasksProps {
  onSelectBike: (frameNumber: string) => void;
}

const workflowStatusLabels: Record<string, { nl: string; en: string }> = {
  diagnose_nodig: { nl: 'Diagnose nodig', en: 'Diagnosis needed' },
  wacht_op_akkoord: { nl: 'Wacht op akkoord', en: 'Waiting for approval' },
  wacht_op_onderdelen: { nl: 'Wacht op onderdelen', en: 'Waiting for parts' },
  klaar_voor_reparatie: { nl: 'Klaar voor reparatie', en: 'Ready for repair' },
  in_reparatie: { nl: 'In reparatie', en: 'In repair' },
  afgerond: { nl: 'Afgerond', en: 'Completed' },
};

const workflowStatusColors: Record<string, string> = {
  diagnose_nodig: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  wacht_op_akkoord: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  wacht_op_onderdelen: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  klaar_voor_reparatie: 'bg-green-500/10 text-green-600 border-green-500/20',
  in_reparatie: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  afgerond: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
};

const fohStatusConfig: Record<string, { label: string; labelEN: string; color: string; icon: React.ReactNode }> = {
  'nog_niet_gestart': { 
    label: 'Nog niet gestart', 
    labelEN: 'Not started', 
    color: 'bg-yellow-500', 
    icon: <Clock className="h-3 w-3" /> 
  },
  'in_behandeling': { 
    label: 'In behandeling', 
    labelEN: 'In progress', 
    color: 'bg-blue-500', 
    icon: <PlayCircle className="h-3 w-3" /> 
  },
  'afgerond': { 
    label: 'Afgerond', 
    labelEN: 'Completed', 
    color: 'bg-green-500', 
    icon: <CheckCircle2 className="h-3 w-3" /> 
  },
};

export function MyTasks({ onSelectBike }: MyTasksProps) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [bikeTasks, setBikeTasks] = useState<BikeTask[]>([]);
  const [availableRepairs, setAvailableRepairs] = useState<BikeTask[]>([]);
  const [myTasks, setMyTasks] = useState<FohTask[]>([]);
  const [assignedByMeTasks, setAssignedByMeTasks] = useState<FohTask[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeBikes, setActiveBikes] = useState<BikeOption[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Task creation/editing
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<FohTask | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [deadline, setDeadline] = useState('');
  const [notes, setNotes] = useState('');
  const [bikeId, setBikeId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  
  // Rejection dialog
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingTask, setRejectingTask] = useState<FohTask | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const dateLocale = language === 'nl' ? nl : enUS;

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user?.id]);

  // Set up realtime subscription
  useEffect(() => {
    if (!user?.id) return;
    
    const channel = supabase
      .channel('my-tasks-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'foh_tasks' },
        () => {
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bikes' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const fetchData = async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      await Promise.all([
        fetchMyBikeTasks(),
        fetchAvailableRepairs(),
        fetchMyFohTasks(),
        fetchAssignedByMeTasks(),
        fetchProfiles(),
        fetchActiveBikes(),
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from('profiles_limited')
      .select('id, full_name')
      .eq('is_active', true)
      .order('full_name');

    if (!error && data) {
      setProfiles(data);
    }
  };

  const fetchActiveBikes = async () => {
    const { data, error } = await supabase
      .from('bikes')
      .select('id, frame_number, model, table_number')
      .neq('workflow_status', 'afgerond')
      .order('table_number');

    if (!error && data) {
      setActiveBikes(data);
    }
  };

  const fetchMyBikeTasks = async () => {
    if (!user?.id) return;

    try {
      // Fetch bikes where the user is explicitly the current mechanic
      // This includes bikes in ANY active status where someone claimed/was assigned the bike
      const { data: assignedBikes, error: assignedError } = await supabase
        .from('bikes')
        .select('id, frame_number, model, table_number, workflow_status, current_mechanic_id')
        .eq('current_mechanic_id', user.id)
        .not('workflow_status', 'in', '(afgerond,wacht_op_akkoord)');

      if (assignedError) throw assignedError;

      // Fetch bikes where the user has work registrations, BUT exclude "klaar_voor_reparatie"
      // Bikes in "klaar_voor_reparatie" should only show if explicitly assigned (current_mechanic_id)
      // This ensures mechanics must actively pick up a bike before it appears in their tasks
      const { data: workedBikes, error: workedError } = await supabase
        .from('work_registrations')
        .select('bike_id, bikes!inner (id, frame_number, model, table_number, workflow_status, current_mechanic_id)')
        .eq('mechanic_id', user.id)
        .not('bikes.workflow_status', 'in', '(afgerond,wacht_op_akkoord,klaar_voor_reparatie)');

      if (workedError) throw workedError;

      // Combine and deduplicate
      const bikeMap = new Map<string, any>();
      assignedBikes?.forEach(bike => bikeMap.set(bike.id, bike));
      workedBikes?.forEach(item => {
        const bike = item.bikes as any;
        if (bike && !bikeMap.has(bike.id)) {
          bikeMap.set(bike.id, bike);
        }
      });

      const allBikes = Array.from(bikeMap.values());

      // Fetch repair counts
      const bikesWithCounts: BikeTask[] = await Promise.all(
        allBikes.map(async (bike) => {
          const { data: repairs } = await supabase
            .from('work_registrations')
            .select('completed')
            .eq('bike_id', bike.id);

          const pending = repairs?.filter(r => !r.completed).length || 0;
          const completed = repairs?.filter(r => r.completed).length || 0;

          let mechanicName: string | undefined;
          if (bike.current_mechanic_id) {
            const { data: profile } = await supabase
              .from('profiles_limited')
              .select('full_name')
              .eq('id', bike.current_mechanic_id)
              .single();
            mechanicName = profile?.full_name;
          }

          return {
            id: bike.id,
            frame_number: bike.frame_number,
            model: bike.model,
            table_number: bike.table_number,
            workflow_status: bike.workflow_status,
            current_mechanic_id: bike.current_mechanic_id,
            pending_repairs: pending,
            completed_repairs: completed,
            mechanic_name: mechanicName,
          };
        })
      );

      // Sort by workflow status priority
      const statusOrder = ['in_reparatie', 'klaar_voor_reparatie', 'wacht_op_onderdelen', 'diagnose_nodig'];
      bikesWithCounts.sort((a, b) => {
        const aIndex = statusOrder.indexOf(a.workflow_status);
        const bIndex = statusOrder.indexOf(b.workflow_status);
        return aIndex - bIndex;
      });

      setBikeTasks(bikesWithCounts);
    } catch (error) {
      console.error('Error fetching bike tasks:', error);
    }
  };

  const fetchAvailableRepairs = async () => {
    try {
      const { data: bikes, error } = await supabase
        .from('bikes')
        .select('id, frame_number, model, table_number, workflow_status, current_mechanic_id')
        .eq('workflow_status', 'klaar_voor_reparatie')
        .is('current_mechanic_id', null);

      if (error) throw error;

      const bikesWithCounts: BikeTask[] = await Promise.all(
        (bikes || []).map(async (bike) => {
          const { data: repairs } = await supabase
            .from('work_registrations')
            .select('completed')
            .eq('bike_id', bike.id);

          const pending = repairs?.filter(r => !r.completed).length || 0;
          const completed = repairs?.filter(r => r.completed).length || 0;

          return {
            id: bike.id,
            frame_number: bike.frame_number,
            model: bike.model,
            table_number: bike.table_number,
            workflow_status: bike.workflow_status,
            current_mechanic_id: bike.current_mechanic_id,
            pending_repairs: pending,
            completed_repairs: completed,
          };
        })
      );

      setAvailableRepairs(bikesWithCounts);
    } catch (error) {
      console.error('Error fetching available repairs:', error);
    }
  };

  const claimBike = async (bikeId: string) => {
    if (!user?.id) return;
    try {
      const { error } = await supabase
        .from('bikes')
        .update({ 
          current_mechanic_id: user.id, 
          workflow_status: 'in_reparatie' as any 
        })
        .eq('id', bikeId);

      if (error) throw error;

      toast({ title: t('bikeClaimed') });
      fetchData();
    } catch (error) {
      console.error('Error claiming bike:', error);
      toast({ title: t('error'), variant: 'destructive' });
    }
  };
  const fetchMyFohTasks = async () => {
    if (!user?.id) return;

    try {
      // Fetch tasks assigned to the current user (not completed, not rejected)
      const { data: tasksData, error } = await supabase
        .from('foh_tasks')
        .select('*')
        .eq('assigned_to', user.id)
        .neq('status', 'afgerond')
        .is('rejected_at', null)
        .order('task_number');

      if (error) throw error;

      // Enrich with creator names and bikes
      const enrichedTasks = await enrichTasks(tasksData || []);
      setMyTasks(enrichedTasks);
    } catch (error) {
      console.error('Error fetching my FOH tasks:', error);
    }
  };

  const fetchAssignedByMeTasks = async () => {
    if (!user?.id) return;

    try {
      // Fetch tasks created by the current user that are assigned to others (not completed)
      const { data: tasksData, error } = await supabase
        .from('foh_tasks')
        .select('*')
        .eq('created_by', user.id)
        .not('assigned_to', 'is', null)
        .neq('assigned_to', user.id)
        .neq('status', 'afgerond')
        .order('task_number');

      if (error) throw error;

      // Enrich with assignee names and bikes
      const enrichedTasks = await enrichTasks(tasksData || []);
      setAssignedByMeTasks(enrichedTasks);
    } catch (error) {
      console.error('Error fetching assigned by me tasks:', error);
    }
  };

  const enrichTasks = async (tasks: any[]): Promise<FohTask[]> => {
    const userIds = [...new Set([
      ...tasks.map(t => t.created_by),
      ...tasks.filter(t => t.assigned_to).map(t => t.assigned_to),
    ])];
    const bikeIds = [...new Set(tasks.filter(t => t.bike_id).map(t => t.bike_id))];

    let profileMap = new Map<string, string>();
    let bikeMap = new Map<string, BikeOption>();

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles_limited')
        .select('id, full_name')
        .in('id', userIds);
      profiles?.forEach(p => profileMap.set(p.id, p.full_name));
    }

    if (bikeIds.length > 0) {
      const { data: bikes } = await supabase
        .from('bikes')
        .select('id, frame_number, model, table_number')
        .in('id', bikeIds);
      bikes?.forEach(b => bikeMap.set(b.id, b));
    }

    return tasks.map(task => ({
      id: task.id,
      task_number: task.task_number,
      title: task.title,
      description: task.description,
      status: task.status as TaskStatus,
      deadline: task.deadline,
      assigned_to: task.assigned_to,
      created_by: task.created_by,
      notes: task.notes,
      bike_id: task.bike_id,
      rejected_at: task.rejected_at,
      rejection_reason: task.rejection_reason,
      creator_name: profileMap.get(task.created_by),
      assignee_name: task.assigned_to ? profileMap.get(task.assigned_to) : undefined,
      bike: task.bike_id ? bikeMap.get(task.bike_id) : null,
    }));
  };

  const getStatusLabel = (status: string) => {
    return workflowStatusLabels[status]?.[language] || status;
  };

  const updateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    try {
      const { error } = await supabase
        .from('foh_tasks')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: newStatus === 'afgerond' ? t('taskCompleted') : t('fohTaskStatusUpdated'),
      });

      fetchData();
    } catch (error) {
      console.error('Error updating task status:', error);
      toast({ title: t('error'), variant: 'destructive' });
    }
  };

  const openRejectDialog = (task: FohTask) => {
    setRejectingTask(task);
    setRejectionReason('');
    setRejectDialogOpen(true);
  };

  const handleRejectTask = async () => {
    if (!rejectingTask || !rejectionReason.trim()) {
      toast({
        title: t('error'),
        description: t('rejectionReasonPlaceholder'),
        variant: 'destructive',
      });
      return;
    }

    setRejecting(true);

    try {
      const { error } = await supabase
        .from('foh_tasks')
        .update({
          rejected_at: new Date().toISOString(),
          rejection_reason: rejectionReason.trim(),
        })
        .eq('id', rejectingTask.id);

      if (error) throw error;

      toast({ title: t('taskRejected') });
      setRejectDialogOpen(false);
      setRejectingTask(null);
      setRejectionReason('');
      fetchData();
    } catch (error) {
      console.error('Error rejecting task:', error);
      toast({ title: t('error'), variant: 'destructive' });
    } finally {
      setRejecting(false);
    }
  };

  // Task creation functions
  const resetForm = () => {
    setTitle('');
    setDescription('');
    setAssignedTo('');
    setDeadline('');
    setNotes('');
    setBikeId('');
    setEditingTask(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!user || !title.trim()) {
      toast({
        title: t('error'),
        description: t('fohTaskTitleRequired'),
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    try {
      if (editingTask) {
        const { error } = await supabase
          .from('foh_tasks')
          .update({
            title: title.trim(),
            description: description.trim() || null,
            assigned_to: assignedTo && assignedTo !== '__none__' ? assignedTo : null,
            deadline: deadline || null,
            notes: notes.trim() || null,
            bike_id: bikeId && bikeId !== '__none__' ? bikeId : null,
          })
          .eq('id', editingTask.id);

        if (error) throw error;
        toast({ title: t('fohTaskUpdated') });
      } else {
        const { error } = await supabase
          .from('foh_tasks')
          .insert({
            title: title.trim(),
            description: description.trim() || null,
            assigned_to: assignedTo && assignedTo !== '__none__' ? assignedTo : null,
            deadline: deadline || null,
            notes: notes.trim() || null,
            bike_id: bikeId && bikeId !== '__none__' ? bikeId : null,
            created_by: user.id,
          });

        if (error) throw error;
        toast({ title: t('fohTaskCreated') });
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving task:', error);
      toast({ title: t('error'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('foh_tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
      toast({ title: t('fohTaskDeleted') });
      fetchData();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({ title: t('error'), variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const TaskCard = ({ task, showAssignee = false, showCreator = false, canReject = false }: { 
    task: FohTask; 
    showAssignee?: boolean; 
    showCreator?: boolean;
    canReject?: boolean;
  }) => {
    const [detailOpen, setDetailOpen] = useState(false);

    return (
      <>
        <div 
          className={`p-4 rounded-lg border cursor-pointer transition-colors hover:bg-accent/50 ${task.rejected_at ? 'border-red-300 bg-red-50 dark:bg-red-950/20' : 'border-border bg-card'}`}
          onClick={() => setDetailOpen(true)}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-muted-foreground">#{task.task_number}</span>
                <Badge className={`${fohStatusConfig[task.status]?.color} text-white text-xs`}>
                  {fohStatusConfig[task.status]?.icon}
                  <span className="ml-1">
                    {language === 'nl' ? fohStatusConfig[task.status]?.label : fohStatusConfig[task.status]?.labelEN}
                  </span>
                </Badge>
                {task.deadline && (
                  <Badge variant="outline" className="text-xs">
                    <Calendar className="h-3 w-3 mr-1" />
                    {format(new Date(task.deadline), 'dd MMM', { locale: dateLocale })}
                  </Badge>
                )}
              </div>
              <h4 className="font-medium truncate">{task.title}</h4>
              {task.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{task.description}</p>
              )}
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                {showCreator && task.creator_name && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {language === 'nl' ? 'Van' : 'From'}: {task.creator_name}
                  </span>
                )}
                {showAssignee && task.assignee_name && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {task.assignee_name}
                  </span>
                )}
                {task.bike && (
                  <span className="flex items-center gap-1">
                    <Bike className="h-3 w-3" />
                    {task.bike.table_number ? `T${task.bike.table_number}` : ''} {task.bike.model}
                  </span>
                )}
              </div>
              {task.rejected_at && (
                <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 rounded text-xs">
                  <div className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                    <AlertTriangle className="h-3 w-3" />
                    {t('taskWasRejected')}
                  </div>
                  <p className="text-red-700 dark:text-red-300 mt-1 line-clamp-1">{task.rejection_reason}</p>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
              {!task.rejected_at && (
                <>
                  {task.status !== 'in_behandeling' && task.status !== 'afgerond' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateTaskStatus(task.id, 'in_behandeling')}
                      className="text-xs"
                    >
                      <PlayCircle className="h-3 w-3 mr-1" />
                      {language === 'nl' ? 'Start' : 'Start'}
                    </Button>
                  )}
                  {task.status === 'in_behandeling' && (
                    <Button
                      size="sm"
                      onClick={() => updateTaskStatus(task.id, 'afgerond')}
                      className="text-xs"
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {language === 'nl' ? 'Afronden' : 'Complete'}
                    </Button>
                  )}
                  {canReject && task.status !== 'afgerond' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openRejectDialog(task)}
                      className="text-xs text-destructive hover:text-destructive"
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      {t('rejectTask')}
                    </Button>
                  )}
                </>
              )}
              {task.created_by === user?.id && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteTask(task.id)}
                  className="text-xs text-muted-foreground"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Task Detail Dialog */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">#{task.task_number}</span>
                <Badge className={`${fohStatusConfig[task.status]?.color} text-white text-xs`}>
                  {fohStatusConfig[task.status]?.icon}
                  <span className="ml-1">
                    {language === 'nl' ? fohStatusConfig[task.status]?.label : fohStatusConfig[task.status]?.labelEN}
                  </span>
                </Badge>
              </div>
              <DialogTitle className="text-left">{task.title}</DialogTitle>
            </DialogHeader>
            
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-4 pb-4">
                {/* Description */}
                {task.description && (
                  <div>
                    <Label className="text-xs text-muted-foreground">{t('description')}</Label>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{task.description}</p>
                  </div>
                )}

                {/* Meta info */}
                <div className="grid grid-cols-2 gap-4">
                  {task.creator_name && (
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        {language === 'nl' ? 'Aangemaakt door' : 'Created by'}
                      </Label>
                      <p className="mt-1 text-sm flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {task.creator_name}
                      </p>
                    </div>
                  )}
                  {task.assignee_name && (
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        {language === 'nl' ? 'Toegewezen aan' : 'Assigned to'}
                      </Label>
                      <p className="mt-1 text-sm flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {task.assignee_name}
                      </p>
                    </div>
                  )}
                  {task.deadline && (
                    <div>
                      <Label className="text-xs text-muted-foreground">{t('fohDeadline')}</Label>
                      <p className="mt-1 text-sm flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(task.deadline), 'dd MMMM yyyy', { locale: dateLocale })}
                      </p>
                    </div>
                  )}
                  {task.bike && (
                    <div>
                      <Label className="text-xs text-muted-foreground">{t('fohLinkBike')}</Label>
                      <p className="mt-1 text-sm flex items-center gap-1">
                        <Bike className="h-3 w-3" />
                        {task.bike.table_number ? `T${task.bike.table_number} - ` : ''}{task.bike.model}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">{task.bike.frame_number}</p>
                    </div>
                  )}
                </div>

                {/* Rejection info */}
                {task.rejected_at && (
                  <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                    <div className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium text-sm">
                      <AlertTriangle className="h-4 w-4" />
                      {t('taskWasRejected')}
                    </div>
                    <p className="text-red-700 dark:text-red-300 mt-2 text-sm whitespace-pre-wrap">{task.rejection_reason}</p>
                    <span className="text-red-500 text-xs mt-2 block">
                      {format(new Date(task.rejected_at), 'dd MMM yyyy HH:mm', { locale: dateLocale })}
                    </span>
                  </div>
                )}

                {/* Notes */}
                {task.notes && (
                  <div>
                    <Label className="text-xs text-muted-foreground">{t('notes')}</Label>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{task.notes}</p>
                  </div>
                )}
              </div>
            </ScrollArea>

            <DialogFooter className="flex-shrink-0 pt-4 border-t">
              <div className="flex gap-2 w-full justify-between">
                <div className="flex gap-2">
                  {!task.rejected_at && (
                    <>
                      {task.status !== 'in_behandeling' && task.status !== 'afgerond' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            updateTaskStatus(task.id, 'in_behandeling');
                            setDetailOpen(false);
                          }}
                        >
                          <PlayCircle className="h-4 w-4 mr-1" />
                          {language === 'nl' ? 'Start' : 'Start'}
                        </Button>
                      )}
                      {task.status === 'in_behandeling' && (
                        <Button
                          size="sm"
                          onClick={() => {
                            updateTaskStatus(task.id, 'afgerond');
                            setDetailOpen(false);
                          }}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          {language === 'nl' ? 'Afronden' : 'Complete'}
                        </Button>
                      )}
                      {canReject && task.status !== 'afgerond' && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setDetailOpen(false);
                            openRejectDialog(task);
                          }}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          {t('rejectTask')}
                        </Button>
                      )}
                    </>
                  )}
                </div>
                <Button variant="outline" onClick={() => setDetailOpen(false)}>
                  {t('close')}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with Create Task button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t('myTasks')}</h2>
          <p className="text-sm text-muted-foreground">{t('myTasksDescription')}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              {t('fohAddTask')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingTask ? t('fohEditTask') : t('fohAddTask')}
              </DialogTitle>
              <DialogDescription>
                {t('fohAddTaskDescription')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">{t('fohTaskName')} *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('fohTaskNamePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">{t('description')}</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('fohTaskDescriptionPlaceholder')}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assignee">{t('fohAssignee')}</Label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('fohSelectAssignee')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">-</SelectItem>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bike">{t('fohLinkBike')}</Label>
                <Select value={bikeId} onValueChange={setBikeId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('fohSelectBike')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">-</SelectItem>
                    {activeBikes.map((bike) => (
                      <SelectItem key={bike.id} value={bike.id}>
                        {bike.table_number ? `T${bike.table_number} - ` : ''}{bike.model} ({bike.frame_number})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="deadline">{t('fohDeadline')}</Label>
                <Input
                  id="deadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {t('cancel')}
              </Button>
              <Button onClick={handleSubmit} disabled={submitting || !title.trim()}>
                {submitting ? t('saving') : t('save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* My Bike Tasks (for mechanics) */}
      {bikeTasks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wrench className="h-5 w-5" />
              {t('myTasks')} - {language === 'nl' ? 'Fietsen' : 'Bikes'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {bikeTasks.map((bike) => (
                <div
                  key={bike.id}
                  onClick={() => onSelectBike(bike.frame_number)}
                  className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted font-semibold">
                      {bike.table_number || '-'}
                    </div>
                    <div>
                      <p className="font-medium">{bike.model}</p>
                      <p className="text-xs text-muted-foreground font-mono">{bike.frame_number}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={workflowStatusColors[bike.workflow_status]}>
                      {getStatusLabel(bike.workflow_status)}
                    </Badge>
                    {bike.pending_repairs > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {bike.pending_repairs} {t('open')}
                      </Badge>
                    )}
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Repairs - unassigned bikes ready for repair */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <HandMetal className="h-5 w-5" />
            {t('availableRepairs')}
            {availableRepairs.length > 0 && (
              <Badge variant="secondary">{availableRepairs.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>{t('availableRepairsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {availableRepairs.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">{t('noAvailableRepairs')}</p>
          ) : (
            <div className="space-y-2">
              {availableRepairs.map((bike) => (
                <div
                  key={bike.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted font-semibold">
                      {bike.table_number || '-'}
                    </div>
                    <div>
                      <p className="font-medium">{bike.model}</p>
                      <p className="text-xs text-muted-foreground font-mono">{bike.frame_number}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={workflowStatusColors[bike.workflow_status]}>
                      {getStatusLabel(bike.workflow_status)}
                    </Badge>
                    {bike.pending_repairs > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {bike.pending_repairs} {t('open')}
                      </Badge>
                    )}
                    <Button size="sm" onClick={() => claimBike(bike.id)}>
                      <Wrench className="h-4 w-4 mr-1" />
                      {t('claimBike')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* My FOH Tasks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-5 w-5" />
            {t('myTasksSectionTitle')}
          </CardTitle>
          <CardDescription>{t('myTasksSectionDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {myTasks.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">{t('noMyTasks')}</p>
          ) : (
            <div className="space-y-3">
              {myTasks.map((task) => (
                <TaskCard key={task.id} task={task} showCreator canReject />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tasks I assigned to others */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Send className="h-5 w-5" />
            {t('assignedByMe')}
          </CardTitle>
          <CardDescription>{t('assignedByMeDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {assignedByMeTasks.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">{t('noAssignedByMeTasks')}</p>
          ) : (
            <div className="space-y-3">
              {assignedByMeTasks.map((task) => (
                <TaskCard key={task.id} task={task} showAssignee />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rejection Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('rejectTaskTitle')}</DialogTitle>
            <DialogDescription>{t('rejectTaskDescription')}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="rejection-reason">{t('rejectionReason')}</Label>
            <Textarea
              id="rejection-reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder={t('rejectionReasonPlaceholder')}
              rows={3}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleRejectTask} 
              disabled={rejecting || !rejectionReason.trim()}
            >
              {rejecting ? t('processing') : t('rejectTask')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
