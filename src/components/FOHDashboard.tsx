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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Search, Bike, MessageSquare, Check, X, Clock, ThumbsUp, Wrench, ClipboardCheck, Send, Package, Euro, CheckCircle2, XCircle, Plus, PlusCircle } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Database } from '@/integrations/supabase/types';

type BikeWorkflowStatus = Database['public']['Enums']['bike_workflow_status'];
type VanmoofModel = Database['public']['Enums']['vanmoof_model'];

interface RepairType {
  id: string;
  name: string;
  price: number;
}

interface WorkRegistration {
  id: string;
  completed: boolean;
  repair_type: RepairType;
}

interface BikeComment {
  id: string;
  content: string;
  created_at: string;
  author: { full_name: string } | null;
}

interface BikeData {
  id: string;
  frame_number: string;
  model: VanmoofModel;
  workflow_status: BikeWorkflowStatus;
  table_number: string | null;
}

const WORKFLOW_STATUS_CONFIG: Record<BikeWorkflowStatus, { label: string; labelEN: string; color: string; icon: React.ReactNode }> = {
  'diagnose_nodig': { label: 'Diagnose nodig', labelEN: 'Diagnosis needed', color: 'bg-orange-500', icon: <ClipboardCheck className="h-4 w-4" /> },
  'diagnose_bezig': { label: 'Diagnose bezig', labelEN: 'Diagnosis in progress', color: 'bg-orange-400', icon: <ClipboardCheck className="h-4 w-4" /> },
  'wacht_op_akkoord': { label: 'Wacht op akkoord', labelEN: 'Waiting for approval', color: 'bg-yellow-500', icon: <Clock className="h-4 w-4" /> },
  'wacht_op_onderdelen': { label: 'Wacht op onderdelen', labelEN: 'Waiting for parts', color: 'bg-purple-500', icon: <Package className="h-4 w-4" /> },
  'klaar_voor_reparatie': { label: 'Klaar voor reparatie', labelEN: 'Ready for repair', color: 'bg-green-500', icon: <ThumbsUp className="h-4 w-4" /> },
  'in_reparatie': { label: 'In reparatie', labelEN: 'In repair', color: 'bg-cyan-500', icon: <Wrench className="h-4 w-4" /> },
  'afgerond': { label: 'Afgerond', labelEN: 'Completed', color: 'bg-gray-500', icon: <Check className="h-4 w-4" /> },
};

export function FOHDashboard() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [bike, setBike] = useState<BikeData | null>(null);
  const [registrations, setRegistrations] = useState<WorkRegistration[]>([]);
  const [comments, setComments] = useState<BikeComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [approvedRepairs, setApprovedRepairs] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  
  // Extra repairs state
  const [availableRepairTypes, setAvailableRepairTypes] = useState<RepairType[]>([]);
  const [addRepairOpen, setAddRepairOpen] = useState(false);
  const [addingRepair, setAddingRepair] = useState(false);
  const [repairSearchQuery, setRepairSearchQuery] = useState('');

  // Fetch available repair types on mount
  useEffect(() => {
    const fetchRepairTypes = async () => {
      const { data } = await supabase
        .from('repair_types')
        .select('id, name, price')
        .order('name');
      setAvailableRepairTypes((data || []) as RepairType[]);
    };
    fetchRepairTypes();
  }, []);

  const searchBike = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    setBike(null);
    setRegistrations([]);
    setComments([]);
    setApprovedRepairs(new Set());

    try {
      // Search by frame number or table number
      // Support formats: "tafel 1", "Tafel 1", "1", "A", etc.
      const tableMatch = searchQuery.match(/^tafel\s*(\w+)$/i);
      const isJustNumber = /^\d+$/.test(searchQuery.trim());
      const isJustLetter = /^[A-Fa-f]$/.test(searchQuery.trim());
      const tableNumber = tableMatch ? tableMatch[1] : 
                         (isJustNumber || isJustLetter) ? searchQuery.trim() : null;

      let bikeData: BikeData | null = null;

      // First try exact frame number match (unless it's clearly a table number)
      if (!tableNumber || searchQuery.length > 2) {
        const { data: byFrame } = await supabase
          .from('bikes')
          .select('id, frame_number, model, workflow_status, table_number')
          .eq('frame_number', searchQuery.trim())
          .maybeSingle();

        if (byFrame) {
          bikeData = byFrame;
        }
      }
      
      // Try by table number if not found and we have a table number
      if (!bikeData && tableNumber) {
        const { data: byTable } = await supabase
          .from('bikes')
          .select('id, frame_number, model, workflow_status, table_number')
          .eq('table_number', tableNumber.toUpperCase())
          .neq('workflow_status', 'afgerond')
          .maybeSingle();
        
        if (byTable) {
          bikeData = byTable;
        }
      }
      
      // Also try lowercase table number (for numeric tables stored as "1", "2", etc.)
      if (!bikeData && tableNumber) {
        const { data: byTableLower } = await supabase
          .from('bikes')
          .select('id, frame_number, model, workflow_status, table_number')
          .eq('table_number', tableNumber)
          .neq('workflow_status', 'afgerond')
          .maybeSingle();
        
        if (byTableLower) {
          bikeData = byTableLower;
        }
      }

      if (!bikeData) {
        toast({
          title: t('bikeNotFound'),
          description: t('checkFrameNumber'),
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      setBike(bikeData);

      // Fetch work registrations (open repairs from diagnosis)
      const { data: regs } = await supabase
        .from('work_registrations')
        .select(`
          id,
          completed,
          repair_type:repair_types(id, name, price)
        `)
        .eq('bike_id', bikeData.id)
        .eq('completed', false);

      setRegistrations((regs || []) as unknown as WorkRegistration[]);
      
      // Pre-select all repairs as approved by default
      const allRepairIds = new Set((regs || []).map(r => r.id));
      setApprovedRepairs(allRepairIds);

      // Fetch comments
      const { data: commentsData } = await supabase
        .from('bike_comments')
        .select('id, content, created_at, author_id')
        .eq('bike_id', bikeData.id)
        .order('created_at', { ascending: false });

      // Fetch author names
      const commentsWithAuthor = await Promise.all(
        (commentsData || []).map(async (comment) => {
          if (comment.author_id) {
            const { data: profile } = await supabase
              .from('profiles_limited')
              .select('full_name')
              .eq('id', comment.author_id)
              .maybeSingle();
            return { ...comment, author: profile };
          }
          return { ...comment, author: null };
        })
      );

      setComments(commentsWithAuthor as unknown as BikeComment[]);
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: t('error'),
        description: t('searchError'),
        variant: 'destructive',
      });
    }

    setLoading(false);
  };

  const addExtraRepair = async (repairTypeId: string) => {
    if (!bike) return;
    
    setAddingRepair(true);
    
    try {
      // Check if repair already exists for this bike
      const existingReg = registrations.find(r => r.repair_type?.id === repairTypeId);
      if (existingReg) {
        toast({
          title: t('fohRepairAlreadyAdded'),
          variant: 'destructive',
        });
        setAddingRepair(false);
        return;
      }

      const { data: newReg, error } = await supabase
        .from('work_registrations')
        .insert({
          bike_id: bike.id,
          repair_type_id: repairTypeId,
          completed: false,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Refresh registrations
      const { data: regs } = await supabase
        .from('work_registrations')
        .select(`id, completed, repair_type:repair_types(id, name, price)`)
        .eq('bike_id', bike.id)
        .eq('completed', false);

      setRegistrations((regs || []) as unknown as WorkRegistration[]);
      
      // Auto-approve the new repair
      setApprovedRepairs(prev => new Set([...prev, newReg.id]));

      toast({
        title: t('fohRepairAdded'),
      });

      setAddRepairOpen(false);
      setRepairSearchQuery('');
    } catch (error) {
      console.error('Add repair error:', error);
      toast({
        title: t('error'),
        variant: 'destructive',
      });
    }

    setAddingRepair(false);
  };

  const updateWorkflowStatus = async (newStatus: BikeWorkflowStatus) => {
    if (!bike) return;

    try {
      const { error } = await supabase
        .from('bikes')
        .update({ workflow_status: newStatus })
        .eq('id', bike.id);

      if (error) throw error;

      setBike({ ...bike, workflow_status: newStatus });
      toast({
        title: t('statusUpdated'),
        description: `${t('statusIsNow')} ${language === 'nl' ? WORKFLOW_STATUS_CONFIG[newStatus].label : WORKFLOW_STATUS_CONFIG[newStatus].labelEN}`,
      });
    } catch (error) {
      toast({
        title: t('error'),
        description: t('couldNotUpdateStatus'),
        variant: 'destructive',
      });
    }
  };

  const toggleRepairApproval = (registrationId: string) => {
    setApprovedRepairs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(registrationId)) {
        newSet.delete(registrationId);
      } else {
        newSet.add(registrationId);
      }
      return newSet;
    });
  };

  const submitApprovals = async () => {
    if (!bike || !user) return;
    
    setSubmitting(true);

    try {
      // Delete rejected repairs (not in approved set)
      const rejectedIds = registrations
        .filter(r => !approvedRepairs.has(r.id))
        .map(r => r.id);

      if (rejectedIds.length > 0) {
        // We need to delete the rejected work registrations
        for (const id of rejectedIds) {
          await supabase
            .from('work_registrations')
            .delete()
            .eq('id', id);
        }
      }

      // Update bike status to ready for repair (if there are approved repairs)
      if (approvedRepairs.size > 0) {
        await supabase
          .from('bikes')
          .update({ workflow_status: 'klaar_voor_reparatie' })
          .eq('id', bike.id);

        setBike({ ...bike, workflow_status: 'klaar_voor_reparatie' });
      }

      // Calculate totals for feedback
      const approvedCount = approvedRepairs.size;
      const rejectedCount = rejectedIds.length;
      const totalPrice = registrations
        .filter(r => approvedRepairs.has(r.id))
        .reduce((sum, r) => sum + (r.repair_type?.price || 0), 0);

      toast({
        title: t('fohApprovalSubmitted'),
        description: `${approvedCount} ${t('fohApprovedRepairs')}, ${rejectedCount} ${t('fohRejectedRepairs')}. ${t('total')}: €${totalPrice.toFixed(2)}`,
      });

      // Refresh registrations
      const { data: regs } = await supabase
        .from('work_registrations')
        .select(`id, completed, repair_type:repair_types(id, name, price)`)
        .eq('bike_id', bike.id)
        .eq('completed', false);

      setRegistrations((regs || []) as unknown as WorkRegistration[]);
      setApprovedRepairs(new Set((regs || []).map(r => r.id)));

    } catch (error) {
      console.error('Submit error:', error);
      toast({
        title: t('error'),
        variant: 'destructive',
      });
    }

    setSubmitting(false);
  };

  const addComment = async () => {
    if (!bike || !user || !newComment.trim()) return;

    try {
      const { data: insertData, error } = await supabase
        .from('bike_comments')
        .insert({
          bike_id: bike.id,
          author_id: user.id,
          content: newComment.trim(),
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error inserting comment:', error);
        throw error;
      }

      // Refresh comments
      const { data: commentsData } = await supabase
        .from('bike_comments')
        .select('id, content, created_at, author_id')
        .eq('bike_id', bike.id)
        .order('created_at', { ascending: false });

      const commentsWithAuthor = await Promise.all(
        (commentsData || []).map(async (comment) => {
          if (comment.author_id) {
            const { data: profile } = await supabase
              .from('profiles_limited')
              .select('full_name')
              .eq('id', comment.author_id)
              .maybeSingle();
            return { ...comment, author: profile };
          }
          return { ...comment, author: null };
        })
      );

      setComments(commentsWithAuthor as unknown as BikeComment[]);
      setNewComment('');

      toast({ title: t('fohCommentAdded') });
    } catch (error) {
      console.error('Comment save failed:', error);
      toast({
        title: t('error'),
        description: String(error),
        variant: 'destructive',
      });
    }
  };

  const totalApprovedPrice = registrations
    .filter(r => approvedRepairs.has(r.id))
    .reduce((sum, r) => sum + (r.repair_type?.price || 0), 0);

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bike className="h-5 w-5" />
            {t('fohSearchBike')}
          </CardTitle>
          <CardDescription>{t('fohSearchDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('enterFrameOrTable')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchBike()}
                className="pl-10"
              />
            </div>
            <Button onClick={searchBike} disabled={loading}>
              {loading ? t('searching') : t('search')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bike Found */}
      {bike && (
        <>
          {/* Bike Info Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Bike className="h-5 w-5" />
                    {bike.frame_number}
                  </CardTitle>
                  <CardDescription>
                    {bike.model} • {bike.table_number ? `${t('tableLabel')} ${bike.table_number}` : t('noTable')}
                  </CardDescription>
                </div>
                <Badge className={`${WORKFLOW_STATUS_CONFIG[bike.workflow_status].color} text-white flex items-center gap-1`}>
                  {WORKFLOW_STATUS_CONFIG[bike.workflow_status].icon}
                  {language === 'nl' 
                    ? WORKFLOW_STATUS_CONFIG[bike.workflow_status].label 
                    : WORKFLOW_STATUS_CONFIG[bike.workflow_status].labelEN}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {/* Quick Status Buttons */}
              <div className="space-y-2">
                <Label>{t('fohQuickStatus')}</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Button
                    size="sm"
                    variant={bike.workflow_status === 'wacht_op_akkoord' ? 'default' : 'outline'}
                    onClick={() => updateWorkflowStatus('wacht_op_akkoord')}
                    className="text-xs sm:text-sm justify-start sm:justify-center"
                  >
                    <Clock className="h-4 w-4 mr-1.5 shrink-0" />
                    <span className="truncate">{t('waitingForApproval')}</span>
                  </Button>
                  <Button
                    size="sm"
                    variant={bike.workflow_status === 'wacht_op_onderdelen' ? 'default' : 'outline'}
                    onClick={() => updateWorkflowStatus('wacht_op_onderdelen')}
                    className="text-xs sm:text-sm justify-start sm:justify-center"
                  >
                    <Package className="h-4 w-4 mr-1.5 shrink-0" />
                    <span className="truncate">{t('waitingForParts')}</span>
                  </Button>
                  <Button
                    size="sm"
                    variant={bike.workflow_status === 'klaar_voor_reparatie' ? 'default' : 'outline'}
                    onClick={() => updateWorkflowStatus('klaar_voor_reparatie')}
                    className="text-xs sm:text-sm justify-start sm:justify-center"
                  >
                    <ThumbsUp className="h-4 w-4 mr-1.5 shrink-0" />
                    <span className="truncate">{t('readyForRepair')}</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Repair Approvals */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5" />
                    {t('fohRepairApprovals')}
                  </CardTitle>
                  <CardDescription>{t('fohRepairApprovalsDescription')}</CardDescription>
                </div>
                {/* Add Extra Repair Button */}
                <Popover open={addRepairOpen} onOpenChange={setAddRepairOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full sm:w-auto">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      {t('fohAddExtraRepair')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="end">
                    <Command>
                      <CommandInput 
                        placeholder={t('fohSearchRepair')}
                        value={repairSearchQuery}
                        onValueChange={setRepairSearchQuery}
                      />
                      <CommandList>
                        <CommandEmpty>{t('fohNoRepairsFound')}</CommandEmpty>
                        <CommandGroup>
                          {availableRepairTypes
                            .filter(rt => !registrations.some(r => r.repair_type?.id === rt.id))
                            .filter(rt => rt.name.toLowerCase().includes(repairSearchQuery.toLowerCase()))
                            .slice(0, 10)
                            .map((repairType) => (
                              <CommandItem
                                key={repairType.id}
                                value={repairType.name}
                                onSelect={() => addExtraRepair(repairType.id)}
                                disabled={addingRepair}
                                className="cursor-pointer"
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span>{repairType.name}</span>
                                  <span className="text-muted-foreground text-sm">€{repairType.price.toFixed(2)}</span>
                                </div>
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {registrations.length > 0 ? (
                <>
                  <ScrollArea className="max-h-[300px]">
                    <div className="space-y-2">
                      {registrations.map((reg) => (
                        <div
                          key={reg.id}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border transition-colors gap-2 ${
                            approvedRepairs.has(reg.id)
                              ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
                              : 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={approvedRepairs.has(reg.id)}
                              onCheckedChange={() => toggleRepairApproval(reg.id)}
                            />
                            <div className="min-w-0">
                              <p className="font-medium text-sm sm:text-base truncate">{reg.repair_type?.name}</p>
                              <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                                <Euro className="h-3 w-3 shrink-0" />
                                {reg.repair_type?.price?.toFixed(2) || '0.00'}
                              </p>
                            </div>
                          </div>
                          <div className="ml-8 sm:ml-0">
                            {approvedRepairs.has(reg.id) ? (
                              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                {t('fohApproved')}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300 text-xs">
                                <XCircle className="h-3 w-3 mr-1" />
                                {t('fohRejected')}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  {/* Summary and Submit */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-4 border-t gap-3">
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {approvedRepairs.size} {t('fohApprovedRepairs')}, {registrations.length - approvedRepairs.size} {t('fohRejectedRepairs')}
                      </p>
                      <p className="font-semibold">
                        {t('total')}: €{totalApprovedPrice.toFixed(2)}
                      </p>
                    </div>
                    <Button onClick={submitApprovals} disabled={submitting} className="w-full sm:w-auto">
                      {submitting ? t('processing') : t('fohSubmitApprovals')}
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-4">
                  {t('fohNoRepairsFound')}. {t('fohAddExtraRepair')}?
                </p>
              )}
            </CardContent>
          </Card>

          {/* Comments Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {t('comments')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Comment */}
              <div className="flex gap-2">
                <Textarea
                  placeholder={t('commentPlaceholder')}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="min-h-[80px]"
                />
                <Button onClick={addComment} disabled={!newComment.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>

              {/* Existing Comments */}
              {comments.length > 0 && (
                <ScrollArea className="max-h-[200px]">
                  <div className="space-y-2">
                    {comments.map((comment) => (
                      <div key={comment.id} className="p-3 rounded-lg bg-muted">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span>{comment.author?.full_name || t('unknown')}</span>
                          <span>{new Date(comment.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-sm">{comment.content}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
