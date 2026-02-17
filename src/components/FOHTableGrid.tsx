import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/i18n/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Phone, Bike, Grid3X3, RefreshCw, PhoneCall, Clock, Trash2, MessageSquare, Send, User, Wrench, AlertTriangle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';

interface CallStatus {
  id: string;
  name: string;
  name_en: string;
  color: string;
  sort_order: number;
}

interface TableBike {
  id: string;
  frame_number: string;
  model: string;
  table_number: string;
  call_status_id: string | null;
  customer_phone: string | null;
  workflow_status: string;
  current_mechanic_id: string | null;
  mechanic_name?: string;
}

interface CallHistoryEntry {
  id: string;
  called_at: string;
  called_by: string;
  caller_name: string;
}

interface BikeComment {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  author_name: string;
}

interface TableData {
  table_number: string;
  bike: TableBike | null;
  callStatus: CallStatus | null;
  callHistory: CallHistoryEntry[];
  comments: BikeComment[];
}

const NUMBERED_TABLES = Array.from({ length: 21 }, (_, i) => String(i + 1));
const LETTER_TABLES = ['A', 'B', 'C', 'D', 'E', 'F'];

export function FOHTableGrid() {
  const { t, language } = useLanguage();
  const [callStatuses, setCallStatuses] = useState<CallStatus[]>([]);
  const [tables, setTables] = useState<TableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<TableData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedStatusId, setSelectedStatusId] = useState<string>('');
  const [selectedWorkflowStatus, setSelectedWorkflowStatus] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [registeringCall, setRegisteringCall] = useState(false);
  const [deletingCallId, setDeletingCallId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);

  // Get current user ID on mount
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    getCurrentUser();
  }, []);
  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch call statuses
      const { data: statusData } = await supabase
        .from('table_call_statuses')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      setCallStatuses(statusData || []);

      // Fetch all bikes with table numbers (including completed ones)
      const { data: bikesData } = await supabase
        .from('bikes')
        .select('id, frame_number, model, table_number, call_status_id, customer_phone, workflow_status, current_mechanic_id')
        .not('table_number', 'is', null);

      // Fetch mechanic names for current mechanics
      const mechanicIds = (bikesData || [])
        .map(b => b.current_mechanic_id)
        .filter((id): id is string => id !== null);
      
      let mechanicMap = new Map<string, string>();
      if (mechanicIds.length > 0) {
        const { data: mechanicProfiles } = await supabase
          .from('profiles_limited')
          .select('id, full_name')
          .in('id', [...new Set(mechanicIds)]);
        
        (mechanicProfiles || []).forEach(p => {
          mechanicMap.set(p.id, p.full_name);
        });
      }

      // Fetch call history for all bikes
      const bikeIds = (bikesData || []).map(b => b.id);
      let callHistoryMap = new Map<string, CallHistoryEntry[]>();
      let commentsMap = new Map<string, BikeComment[]>();
      
      if (bikeIds.length > 0) {
        // Fetch call history
        const { data: callHistoryData } = await supabase
          .from('bike_call_history')
          .select(`
            id,
            bike_id,
            called_at,
            called_by,
            profiles!bike_call_history_called_by_fkey(full_name)
          `)
          .in('bike_id', bikeIds)
          .order('called_at', { ascending: false });

        (callHistoryData || []).forEach((entry: any) => {
          const bikeId = entry.bike_id;
          if (!callHistoryMap.has(bikeId)) {
            callHistoryMap.set(bikeId, []);
          }
          callHistoryMap.get(bikeId)!.push({
            id: entry.id,
            called_at: entry.called_at,
            called_by: entry.called_by,
            caller_name: entry.profiles?.full_name || 'Unknown',
          });
        });

        // Fetch comments
        const { data: commentsData } = await supabase
          .from('bike_comments')
          .select(`
            id,
            bike_id,
            content,
            created_at,
            author_id,
            profiles:author_id(full_name)
          `)
          .in('bike_id', bikeIds)
          .order('created_at', { ascending: false });

        (commentsData || []).forEach((comment: any) => {
          const bikeId = comment.bike_id;
          if (!commentsMap.has(bikeId)) {
            commentsMap.set(bikeId, []);
          }
          commentsMap.get(bikeId)!.push({
            id: comment.id,
            content: comment.content,
            created_at: comment.created_at,
            author_id: comment.author_id,
            author_name: comment.profiles?.full_name || 'Unknown',
          });
        });
      }

      // Create table data map with mechanic names
      const bikesByTable = new Map<string, TableBike>();
      (bikesData || []).forEach((bike) => {
        if (bike.table_number) {
          bikesByTable.set(bike.table_number, {
            ...bike,
            mechanic_name: bike.current_mechanic_id ? mechanicMap.get(bike.current_mechanic_id) : undefined,
          } as TableBike);
        }
      });

      // Build table data for all tables
      const allTables = [...NUMBERED_TABLES, ...LETTER_TABLES];
      const tableData: TableData[] = allTables.map((tableNum) => {
        const bike = bikesByTable.get(tableNum) || null;
        const callStatus = bike?.call_status_id 
          ? (statusData || []).find(s => s.id === bike.call_status_id) || null
          : null;
        const callHistory = bike ? (callHistoryMap.get(bike.id) || []) : [];
        const comments = bike ? (commentsMap.get(bike.id) || []) : [];
        return {
          table_number: tableNum,
          bike,
          callStatus,
          callHistory,
          comments,
        };
      });

      setTables(tableData);
    } catch (error) {
      console.error('Error fetching table data:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    // Set up realtime subscription for bikes, call history, and comments
    const channel = supabase
      .channel('foh-table-grid')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bikes' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bike_call_history' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bike_comments' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const openTableDialog = (table: TableData) => {
    if (!table.bike) return;
    setSelectedTable(table);
    setPhoneNumber(table.bike.customer_phone || '');
    // Default to "Moet gebeld worden" if no call status is set
    const defaultCallStatusId = callStatuses.find(s => s.name === 'Moet gebeld worden')?.id || '';
    setSelectedStatusId(table.bike.call_status_id || defaultCallStatusId);
    setSelectedWorkflowStatus(table.bike.workflow_status || '');
    setNewComment('');
    setDialogOpen(true);
  };

  const addComment = async () => {
    if (!selectedTable?.bike || !newComment.trim()) return;
    setAddingComment(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('bike_comments')
        .insert({
          bike_id: selectedTable.bike.id,
          author_id: user.id,
          content: newComment.trim(),
        });

      if (error) {
        console.error('Error inserting comment:', error);
        throw error;
      }

      // Fetch the user's profile name for immediate UI update
      const { data: profile } = await supabase
        .from('profiles_limited')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();

      // Immediately add the comment to selectedTable for instant UI feedback
      const newCommentEntry: BikeComment = {
        id: crypto.randomUUID(),
        content: newComment.trim(),
        created_at: new Date().toISOString(),
        author_id: user.id,
        author_name: profile?.full_name || 'Unknown',
      };

      setSelectedTable(prev => prev ? {
        ...prev,
        comments: [newCommentEntry, ...prev.comments],
      } : null);

      toast({
        title: t('success'),
        description: t('commentAdded'),
      });

      setNewComment('');
      
      // Also refresh background data
      fetchData();
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: t('error'),
        description: String(error),
        variant: 'destructive',
      });
    }

    setAddingComment(false);
  };

  const registerCall = async () => {
    if (!selectedTable?.bike) return;
    setRegisteringCall(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('bike_call_history')
        .insert({
          bike_id: selectedTable.bike.id,
          called_by: user.id,
        });

      if (error) throw error;

      toast({
        title: t('success'),
        description: t('fohCallRegistered'),
      });

      // Immediately update selectedTable for instant UI feedback
      const { data: profile } = await supabase
        .from('profiles_limited')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();

      const newEntry: CallHistoryEntry = {
        id: crypto.randomUUID(),
        called_at: new Date().toISOString(),
        called_by: user.id,
        caller_name: profile?.full_name || 'Unknown',
      };

      setSelectedTable(prev => prev ? {
        ...prev,
        callHistory: [newEntry, ...prev.callHistory],
      } : null);

      // Also refresh background data
      fetchData();
    } catch (error) {
      console.error('Error registering call:', error);
      toast({
        title: t('error'),
        variant: 'destructive',
      });
    }

    setRegisteringCall(false);
  };

  const deleteCallHistoryEntry = async (entryId: string) => {
    setDeletingCallId(entryId);

    try {
      const { error } = await supabase
        .from('bike_call_history')
        .delete()
        .eq('id', entryId);

      if (error) throw error;

      toast({
        title: t('success'),
        description: t('fohCallDeleted'),
      });

      // Immediately update selectedTable
      setSelectedTable(prev => prev ? {
        ...prev,
        callHistory: prev.callHistory.filter(e => e.id !== entryId),
      } : null);

      // Also refresh background data
      fetchData();
    } catch (error) {
      console.error('Error deleting call history:', error);
      toast({
        title: t('error'),
        variant: 'destructive',
      });
    }

    setDeletingCallId(null);
  };

  const saveTableStatus = async () => {
    if (!selectedTable?.bike) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('bikes')
        .update({
          call_status_id: selectedStatusId || null,
          customer_phone: phoneNumber || null,
          workflow_status: selectedWorkflowStatus as any,
        })
        .eq('id', selectedTable.bike.id);

      if (error) throw error;

      toast({
        title: t('statusUpdated'),
        description: t('fohTableStatusUpdated'),
      });

      setDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error updating table status:', error);
      toast({
        title: t('error'),
        variant: 'destructive',
      });
    }

    setSaving(false);
  };

  const getStatusLabel = (status: CallStatus | null) => {
    if (!status) return language === 'nl' ? 'Geen status' : 'No status';
    return language === 'nl' ? status.name : status.name_en;
  };

  const workflowStatuses = [
    { value: 'diagnose_nodig', nl: 'Diagnose nodig', en: 'Needs diagnosis', color: '#dc2626' }, // red-600
    { value: 'diagnose_bezig', nl: 'Diagnose bezig', en: 'Diagnosing', color: '#facc15' }, // yellow-400
    { value: 'wacht_op_akkoord', nl: 'Wacht op akkoord', en: 'Awaiting approval', color: '#f97316' }, // orange-500
    { value: 'wacht_op_onderdelen', nl: 'Wacht op onderdelen', en: 'Awaiting parts', color: '#c026d3' }, // fuchsia-600
    { value: 'klaar_voor_reparatie', nl: 'Klaar voor reparatie', en: 'Ready for repair', color: '#22c55e' }, // green-500
    { value: 'in_reparatie', nl: 'In reparatie', en: 'In repair', color: '#06b6d4' }, // cyan-500
    { value: 'afgerond', nl: 'Afgerond', en: 'Completed', color: '#52525b' }, // zinc-600
  ];

  const getWorkflowLabel = (status: string) => {
    const found = workflowStatuses.find(s => s.value === status);
    if (!found) return status;
    return language === 'nl' ? found.nl : found.en;
  };

  const getWorkflowColor = (status: string) => {
    const found = workflowStatuses.find(s => s.value === status);
    return found?.color || '#9ca3af';
  };

  const formatCallDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'dd MMM HH:mm', { locale: language === 'nl' ? nl : enUS });
  };

  // Get call count for a bike
  const getCallCount = (table: TableData) => {
    return table.callHistory.length;
  };

  // Calculate business hours between two dates (09:00-17:00)
  const calculateBusinessHoursBetween = (start: Date, end: Date): number => {
    let businessHours = 0;
    const current = new Date(start);
    
    while (current < end) {
      const hour = current.getHours();
      const dayOfWeek = current.getDay();
      
      // Only count Monday-Friday (1-5) between 09:00-17:00
      if (dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 9 && hour < 17) {
        businessHours += 1;
      }
      
      // Move to next hour
      current.setHours(current.getHours() + 1);
    }
    
    return businessHours;
  };

  // Check if a bike waiting for approval needs a call (> 3 business hours since last call or since entering status)
  const needsCallAttention = (table: TableData): boolean => {
    if (!table.bike) return false;
    if (table.bike.workflow_status !== 'wacht_op_akkoord') return false;
    
    const now = new Date();
    const currentHour = now.getHours();
    
    // Only check during business hours (09:00-17:00), any day
    if (currentHour < 9 || currentHour >= 17) return false;
    
    // Get the last call time, or use a default "never called" time
    const lastCallTime = table.callHistory.length > 0 
      ? new Date(table.callHistory[0].called_at) // callHistory is sorted by called_at desc
      : null;
    
    if (!lastCallTime) {
      // Never been called - this needs attention
      return true;
    }
    
    // Calculate business hours since last call
    const businessHoursSinceLastCall = calculateBusinessHoursBetween(lastCallTime, now);
    
    return businessHoursSinceLastCall > 3;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Grid3X3 className="h-5 w-5" />
                {t('fohTableGrid')}
              </CardTitle>
              <CardDescription>{t('fohTableGridDescription')}</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {t('refresh')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Legend - based on workflow statuses */}
          <div className="flex flex-wrap gap-2 mb-4">
            {workflowStatuses.map((status) => (
              <div key={status.value} className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: status.color }}
                />
                <span className="text-sm">{language === 'nl' ? status.nl : status.en}</span>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-muted border" />
              <span className="text-sm text-muted-foreground">{t('fohEmptyTable')}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Numbered Tables Grid */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{t('fohNumberedTables')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-2">
            {tables.filter(t => NUMBERED_TABLES.includes(t.table_number)).map((table) => (
              <button
                key={table.table_number}
                onClick={() => openTableDialog(table)}
                disabled={!table.bike}
                className={`
                  aspect-square rounded-lg border-2 p-1.5 sm:p-2 transition-all relative
                  flex flex-col items-center justify-center text-center
                  ${table.bike 
                    ? 'cursor-pointer hover:scale-105 hover:shadow-lg border-transparent' 
                    : 'cursor-default bg-muted/50 border-dashed border-muted-foreground/30'
                  }
                `}
                style={{
                  backgroundColor: table.bike 
                    ? getWorkflowColor(table.bike.workflow_status)
                    : undefined,
                  color: table.bike ? '#fff' : undefined,
                }}
              >
                {/* Warning badge for overdue calls */}
                {needsCallAttention(table) && (
                  <div className="absolute -top-1.5 -left-1.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center animate-pulse" title={language === 'nl' ? 'Meer dan 3 uur niet gebeld' : 'Not called for over 3 hours'}>
                    <AlertTriangle className="h-3 w-3" />
                  </div>
                )}
                {/* Call count badge */}
                {table.bike && getCallCount(table) > 0 && (
                  <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {getCallCount(table)}
                  </div>
                )}
                <span className="font-bold text-base sm:text-lg">{table.table_number}</span>
                {table.bike && (
                  <>
                    <span className="text-[10px] sm:text-xs truncate max-w-full opacity-90">
                      {table.bike.model}
                    </span>
                    <span className="text-[9px] sm:text-[10px] truncate max-w-full opacity-75 font-mono">
                      {table.bike.frame_number}
                    </span>
                    {/* Show mechanic name when in_reparatie */}
                    {table.bike.workflow_status === 'in_reparatie' && table.bike.mechanic_name && (
                      <div className="flex items-center gap-0.5 mt-0.5 bg-black/30 rounded px-1 py-0.5">
                        <Wrench className="h-2.5 w-2.5" />
                        <span className="text-[9px] font-medium truncate max-w-full">
                          {table.bike.mechanic_name.split(' ')[0]}
                        </span>
                      </div>
                    )}
                    {table.bike.customer_phone && (
                      <Phone className="h-2.5 w-2.5 sm:h-3 sm:w-3 mt-0.5 opacity-75" />
                    )}
                  </>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Letter Tables Grid */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{t('fohLetterTables')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {tables.filter(t => LETTER_TABLES.includes(t.table_number)).map((table) => (
              <button
                key={table.table_number}
                onClick={() => openTableDialog(table)}
                disabled={!table.bike}
                className={`
                  aspect-square rounded-lg border-2 p-1.5 sm:p-2 transition-all relative
                  flex flex-col items-center justify-center text-center
                  ${table.bike 
                    ? 'cursor-pointer hover:scale-105 hover:shadow-lg border-transparent' 
                    : 'cursor-default bg-muted/50 border-dashed border-muted-foreground/30'
                  }
                `}
                style={{
                  backgroundColor: table.bike 
                    ? getWorkflowColor(table.bike.workflow_status)
                    : undefined,
                  color: table.bike ? '#fff' : undefined,
                }}
              >
                {/* Warning badge for overdue calls */}
                {needsCallAttention(table) && (
                  <div className="absolute -top-1.5 -left-1.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center animate-pulse" title={language === 'nl' ? 'Meer dan 3 uur niet gebeld' : 'Not called for over 3 hours'}>
                    <AlertTriangle className="h-3 w-3" />
                  </div>
                )}
                {/* Call count badge */}
                {table.bike && getCallCount(table) > 0 && (
                  <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {getCallCount(table)}
                  </div>
                )}
                <span className="font-bold text-lg sm:text-xl">{table.table_number}</span>
                {table.bike && (
                  <>
                    <span className="text-[10px] sm:text-xs truncate max-w-full opacity-90">
                      {table.bike.model}
                    </span>
                    <span className="text-[9px] sm:text-[10px] truncate max-w-full opacity-75 font-mono">
                      {table.bike.frame_number}
                    </span>
                    {/* Show mechanic name when in_reparatie */}
                    {table.bike.workflow_status === 'in_reparatie' && table.bike.mechanic_name && (
                      <div className="flex items-center gap-0.5 mt-0.5 bg-black/30 rounded px-1 py-0.5">
                        <Wrench className="h-2.5 w-2.5" />
                        <span className="text-[9px] font-medium truncate max-w-full">
                          {table.bike.mechanic_name.split(' ')[0]}
                        </span>
                      </div>
                    )}
                    {table.bike.customer_phone && (
                      <Phone className="h-2.5 w-2.5 sm:h-3 sm:w-3 mt-0.5 opacity-75" />
                    )}
                  </>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Table Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bike className="h-5 w-5" />
              {t('tableLabel')} {selectedTable?.table_number}
            </DialogTitle>
            <DialogDescription>
              {selectedTable?.bike?.frame_number} • {selectedTable?.bike?.model}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Workflow Status */}
            <div className="space-y-2">
              <Label>{t('workflowStatus')}</Label>
              <Select 
                value={selectedWorkflowStatus} 
                onValueChange={(val) => {
                  setSelectedWorkflowStatus(val);
                  // Sync: if workflow is "klaar_voor_reparatie", "in_reparatie" or "afgerond", 
                  // automatically set call status to "Akkoord ontvangen"
                  if (val === 'klaar_voor_reparatie' || val === 'in_reparatie' || val === 'afgerond') {
                    const akkordStatus = callStatuses.find(s => s.name === 'Akkoord ontvangen');
                    if (akkordStatus) {
                      setSelectedStatusId(akkordStatus.id);
                    }
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('selectWorkflowStatus')} />
                </SelectTrigger>
                <SelectContent>
                  {workflowStatuses.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {language === 'nl' ? status.nl : status.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Mark as Called Button */}
            <Button 
              onClick={registerCall} 
              disabled={registeringCall}
              className="w-full"
              variant="secondary"
            >
              <PhoneCall className="h-4 w-4 mr-2" />
              {registeringCall ? t('saving') : t('fohMarkCalled')}
            </Button>

            {/* Call History */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {t('fohCallHistory')} 
                {selectedTable && selectedTable.callHistory.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {selectedTable.callHistory.length}x {t('fohTotalCalls')}
                  </Badge>
                )}
              </Label>
              {selectedTable && selectedTable.callHistory.length > 0 ? (
                <ScrollArea className="h-32 rounded-md border p-2">
                  <div className="space-y-2">
                    {selectedTable.callHistory.map((entry, index) => (
                      <div key={entry.id}>
                        <div className="text-sm flex justify-between items-center gap-2">
                          <span className="font-medium">{entry.caller_name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs">
                              {formatCallDate(entry.called_at)}
                            </span>
                            {/* Show delete button only for own entries */}
                            {currentUserId === entry.called_by && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => deleteCallHistoryEntry(entry.id)}
                                disabled={deletingCallId === entry.id}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        {index < selectedTable.callHistory.length - 1 && (
                          <Separator className="mt-2" />
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground">{t('fohNoCallHistory')}</p>
              )}
            </div>

            <Separator />

            {/* Comments Section */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                {t('comments')} 
                {selectedTable && selectedTable.comments.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {selectedTable.comments.length}
                  </Badge>
                )}
              </Label>
              
              {/* Add new comment */}
              <div className="flex gap-2">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={t('commentPlaceholder')}
                  className="min-h-[60px] text-sm"
                />
                <Button
                  onClick={addComment}
                  disabled={addingComment || !newComment.trim()}
                  size="icon"
                  className="shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>

              {/* Existing comments */}
              {selectedTable && selectedTable.comments.length > 0 ? (
                <ScrollArea className="h-32 rounded-md border p-2">
                  <div className="space-y-2">
                    {selectedTable.comments.map((comment, index) => (
                      <div key={comment.id}>
                        <div className="text-sm">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{comment.author_name}</span>
                            <span className="text-muted-foreground text-xs">
                              {formatCallDate(comment.created_at)}
                            </span>
                          </div>
                          <p className="text-muted-foreground mt-1">{comment.content}</p>
                        </div>
                        {index < selectedTable.comments.length - 1 && (
                          <Separator className="mt-2" />
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground">{t('noCommentsForBike')}</p>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>{t('fohCallStatus')}</Label>
              <Select 
                value={selectedStatusId || 'none'} 
                onValueChange={(val) => {
                  const newStatusId = val === 'none' ? '' : val;
                  setSelectedStatusId(newStatusId);
                  // Sync: if "Klant bereikt" is selected, also set workflow to "klaar_voor_reparatie"
                  const selectedStatus = callStatuses.find(s => s.id === newStatusId);
                  if (selectedStatus?.name === 'Klant bereikt') {
                    setSelectedWorkflowStatus('klaar_voor_reparatie');
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('fohSelectCallStatus')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">{t('fohNoStatus')}</span>
                  </SelectItem>
                  {callStatuses.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: status.color }}
                        />
                        {getStatusLabel(status)}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Customer Phone */}
            <div className="space-y-2">
              <Label>{t('fohCustomerPhone')}</Label>
              <Input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder={t('fohPhonePlaceholder')}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={saveTableStatus} disabled={saving}>
              {saving ? t('saving') : t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
