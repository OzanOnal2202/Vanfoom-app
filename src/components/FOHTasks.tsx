import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { Plus, ClipboardList, Clock, PlayCircle, CheckCircle2, Trash2, Edit, Calendar, User, Bike, Search, Eye, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';

type TaskStatus = 'nog_niet_gestart' | 'in_behandeling' | 'afgerond';

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

interface FohTask {
  id: string;
  task_number: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  assigned_to: string | null;
  created_by: string;
  deadline: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  bike_id: string | null;
  assignee?: Profile | null;
  creator?: Profile | null;
  bike?: BikeOption | null;
}

const STATUS_CONFIG: Record<TaskStatus, { label: string; labelEN: string; color: string; icon: React.ReactNode }> = {
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

export function FOHTasks() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [tasks, setTasks] = useState<FohTask[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeBikes, setActiveBikes] = useState<BikeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<FohTask | null>(null);
  
  // Filters
  const [showCompleted, setShowCompleted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Detail dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<FohTask | null>(null);
  const [taskNote, setTaskNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [deadline, setDeadline] = useState('');
  const [notes, setNotes] = useState('');
  const [bikeId, setBikeId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const dateLocale = language === 'nl' ? nl : enUS;

  useEffect(() => {
    fetchData();
    
    // Set up realtime subscription
    const channel = supabase
      .channel('foh-tasks-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'foh_tasks' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    try {
      // Fetch tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('foh_tasks')
        .select('*')
        .order('task_number', { ascending: true });

      if (tasksError) throw tasksError;

      // Fetch all active profiles (anyone can be assigned a task)
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles_limited')
        .select('id, full_name')
        .eq('is_active', true)
        .order('full_name');

      if (profilesError) throw profilesError;
      
      setProfiles(profilesData || []);

      // Fetch active bikes (not completed)
      const { data: bikesData, error: bikesError } = await supabase
        .from('bikes')
        .select('id, frame_number, model, table_number')
        .neq('workflow_status', 'afgerond')
        .order('table_number');

      if (bikesError) throw bikesError;
      
      setActiveBikes(bikesData || []);

      // Create maps for enriching tasks
      const profileMap = new Map((profilesData || []).map(p => [p.id, p]));
      const bikeMap = new Map((bikesData || []).map(b => [b.id, b]));
      
      const enrichedTasks = (tasksData || []).map(task => ({
        ...task,
        assignee: task.assigned_to ? profileMap.get(task.assigned_to) : null,
        creator: profileMap.get(task.created_by),
        bike: task.bike_id ? bikeMap.get(task.bike_id) : null,
      }));

      setTasks(enrichedTasks as FohTask[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const openEditDialog = (task: FohTask) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setAssignedTo(task.assigned_to || '');
    setDeadline(task.deadline || '');
    setBikeId(task.bike_id || '');
    setNotes(task.notes || '');
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
        // Update existing task
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
        // Create new task
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
      toast({
        title: t('error'),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    try {
      const { error } = await supabase
        .from('foh_tasks')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) throw error;

      toast({ title: t('fohTaskStatusUpdated') });
      fetchData();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: t('error'),
        variant: 'destructive',
      });
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
      toast({
        title: t('error'),
        variant: 'destructive',
      });
    }
  };

  const openDetailDialog = (task: FohTask) => {
    setSelectedTask(task);
    setTaskNote(task.notes || '');
    setDetailDialogOpen(true);
  };

  const saveTaskNote = async () => {
    if (!selectedTask) return;
    setSavingNote(true);

    try {
      const { error } = await supabase
        .from('foh_tasks')
        .update({ notes: taskNote.trim() || null })
        .eq('id', selectedTask.id);

      if (error) throw error;

      toast({ title: t('fohNotesSaved') });
      fetchData();
      
      // Update selected task with new notes
      setSelectedTask({ ...selectedTask, notes: taskNote.trim() || null });
    } catch (error) {
      console.error('Error saving note:', error);
      toast({ title: t('error'), variant: 'destructive' });
    } finally {
      setSavingNote(false);
    }
  };

  // Filter tasks based on search and completion status
  const filteredTasks = tasks.filter(task => {
    // Filter by completion status
    if (!showCompleted && task.status === 'afgerond') return false;
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = task.title.toLowerCase().includes(query);
      const matchesDescription = task.description?.toLowerCase().includes(query) || false;
      const matchesNotes = task.notes?.toLowerCase().includes(query) || false;
      const matchesAssignee = task.assignee?.full_name.toLowerCase().includes(query) || false;
      const matchesCreator = task.creator?.full_name.toLowerCase().includes(query) || false;
      const matchesTaskNumber = task.task_number.toString().includes(query);
      
      return matchesTitle || matchesDescription || matchesNotes || matchesAssignee || matchesCreator || matchesTaskNumber;
    }
    
    return true;
  });

  // Group tasks by status for overview (always use all tasks for stats)
  const tasksByStatus = {
    nog_niet_gestart: tasks.filter(t => t.status === 'nog_niet_gestart'),
    in_behandeling: tasks.filter(t => t.status === 'in_behandeling'),
    afgerond: tasks.filter(t => t.status === 'afgerond'),
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-muted-foreground">{t('loading')}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                {t('fohTasksTitle')}
              </CardTitle>
              <CardDescription>{t('fohTasksDescription')}</CardDescription>
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
                    {editingTask ? t('fohEditTaskDescription') : t('fohAddTaskDescription')}
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
                            <div className="flex items-center gap-2">
                              <Bike className="h-3 w-3" />
                              <span>
                                {bike.table_number ? `${t('tableLabel')} ${bike.table_number} - ` : ''}
                                {bike.model} ({bike.frame_number})
                              </span>
                            </div>
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
                  <div className="space-y-2">
                    <Label htmlFor="notes">{t('fohNotes')}</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={t('fohNotesPlaceholder')}
                      rows={2}
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
        </CardHeader>
        <CardContent>
          {/* Stats overview */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800">
              <div className="text-2xl font-bold text-yellow-600">{tasksByStatus.nog_niet_gestart.length}</div>
              <div className="text-xs text-muted-foreground">{language === 'nl' ? 'Nog niet gestart' : 'Not started'}</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
              <div className="text-2xl font-bold text-blue-600">{tasksByStatus.in_behandeling.length}</div>
              <div className="text-xs text-muted-foreground">{language === 'nl' ? 'In behandeling' : 'In progress'}</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
              <div className="text-2xl font-bold text-green-600">{tasksByStatus.afgerond.length}</div>
              <div className="text-xs text-muted-foreground">{language === 'nl' ? 'Afgerond' : 'Completed'}</div>
            </div>
          </div>
          
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mt-4 pt-4 border-t">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('fohSearchTasks')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="showCompleted"
                checked={showCompleted}
                onCheckedChange={setShowCompleted}
              />
              <Label htmlFor="showCompleted" className="text-sm whitespace-nowrap">
                {t('fohShowCompleted')}
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tasks Table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>{t('fohTaskName')}</TableHead>
                  <TableHead className="w-32">{t('status')}</TableHead>
                  <TableHead className="w-36">{t('fohAssignee')}</TableHead>
                  <TableHead className="w-32">{t('fohLinkedBike')}</TableHead>
                  <TableHead className="w-28">{t('fohDeadline')}</TableHead>
                  <TableHead className="w-24">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {t('fohNoTasks')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTasks.map((task) => (
                    <TableRow key={task.id} className="group">
                      <TableCell className="font-mono text-muted-foreground">
                        {task.task_number}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{task.title}</p>
                          {task.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">{task.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={task.status}
                          onValueChange={(value) => updateTaskStatus(task.id, value as TaskStatus)}
                        >
                          <SelectTrigger className="h-8 w-full">
                            <Badge className={`${STATUS_CONFIG[task.status].color} text-white text-xs flex items-center gap-1`}>
                              {STATUS_CONFIG[task.status].icon}
                              <span className="truncate">
                                {language === 'nl' 
                                  ? STATUS_CONFIG[task.status].label 
                                  : STATUS_CONFIG[task.status].labelEN}
                              </span>
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                              <SelectItem key={key} value={key}>
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${config.color}`} />
                                  {language === 'nl' ? config.label : config.labelEN}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={task.assigned_to || '__none__'}
                          onValueChange={async (value) => {
                            try {
                              await supabase
                                .from('foh_tasks')
                                .update({ assigned_to: value === '__none__' ? null : value })
                                .eq('id', task.id);
                              fetchData();
                            } catch (error) {
                              console.error(error);
                            }
                          }}
                        >
                          <SelectTrigger className="h-8 w-full">
                            <SelectValue>
                              {task.assignee ? (
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  <span className="truncate">{task.assignee.full_name}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </SelectValue>
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
                      </TableCell>
                      <TableCell>
                        {task.bike ? (
                          <div className="flex items-center gap-1 text-xs">
                            <Bike className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {task.bike.table_number ? `${task.bike.table_number} - ` : ''}
                              {task.bike.model}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {task.deadline ? (
                          <div className="flex items-center gap-1 text-xs">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(task.deadline), 'dd-MM-yyyy', { locale: dateLocale })}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openDetailDialog(task)}
                            title={t('fohViewTask')}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEditDialog(task)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => deleteTask(task.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Task Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              {t('fohTaskDetails')} #{selectedTask?.task_number}
            </DialogTitle>
          </DialogHeader>
          
          {selectedTask && (
            <div className="space-y-4 py-4">
              {/* Task Title and Description */}
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">{selectedTask.title}</h3>
                {selectedTask.description && (
                  <p className="text-muted-foreground">{selectedTask.description}</p>
                )}
              </div>
              
              {/* Task Meta */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">{t('status')}</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={`${STATUS_CONFIG[selectedTask.status].color} text-white`}>
                      {STATUS_CONFIG[selectedTask.status].icon}
                      <span className="ml-1">
                        {language === 'nl' 
                          ? STATUS_CONFIG[selectedTask.status].label 
                          : STATUS_CONFIG[selectedTask.status].labelEN}
                      </span>
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('fohAssignee')}</Label>
                  <p className="mt-1">{selectedTask.assignee?.full_name || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('fohCreatedBy')}</Label>
                  <p className="mt-1">{selectedTask.creator?.full_name || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('fohDeadline')}</Label>
                  <p className="mt-1">
                    {selectedTask.deadline 
                      ? format(new Date(selectedTask.deadline), 'dd-MM-yyyy', { locale: dateLocale })
                      : '-'}
                  </p>
                </div>
                {selectedTask.bike && (
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">{t('fohLinkedBike')}</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Bike className="h-4 w-4" />
                      <span>
                        {selectedTask.bike.table_number ? `${t('tableLabel')} ${selectedTask.bike.table_number} - ` : ''}
                        {selectedTask.bike.model} ({selectedTask.bike.frame_number})
                      </span>
                    </div>
                  </div>
                )}
                <div className="col-span-2">
                  <Label className="text-muted-foreground">{t('fohCreatedAt')}</Label>
                  <p className="mt-1">
                    {format(new Date(selectedTask.created_at), 'dd-MM-yyyy HH:mm', { locale: dateLocale })}
                  </p>
                </div>
              </div>
              
              {/* Notes Section */}
              <div className="space-y-2 pt-4 border-t">
                <Label className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  {t('fohNotes')}
                </Label>
                <Textarea
                  value={taskNote}
                  onChange={(e) => setTaskNote(e.target.value)}
                  placeholder={t('fohNotesPlaceholder')}
                  rows={3}
                />
                <Button 
                  onClick={saveTaskNote} 
                  disabled={savingNote || taskNote === (selectedTask.notes || '')}
                  size="sm"
                >
                  {savingNote ? t('saving') : t('save')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
