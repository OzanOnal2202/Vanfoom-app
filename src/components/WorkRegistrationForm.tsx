import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { Bike, Wrench, MessageSquare, History, Check, ClipboardCheck, Clock, ThumbsUp, Table2, AlertTriangle, Calendar, Shield, Search, ScanLine, PackageX, Package, ArrowRight, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { Database } from '@/integrations/supabase/types';
import { differenceInMonths } from 'date-fns';
import { CompletionChecklistDialog } from './CompletionChecklistDialog';
import { BarcodeScanner } from './BarcodeScanner';
import { AnimatePresence, motion } from 'framer-motion';

type VanmoofModel = Database['public']['Enums']['vanmoof_model'];
type BikeWorkflowStatus = Database['public']['Enums']['bike_workflow_status'];

const VANMOOF_MODELS: VanmoofModel[] = ['S1', 'S2', 'S3', 'S5', 'S6', 'X1', 'X2', 'X3', 'X5', 'A5'];

const WORKFLOW_STATUS_CONFIG: Record<BikeWorkflowStatus, { label: string; color: string; icon: React.ReactNode }> = {
  'diagnose_nodig': { label: 'Diagnose nodig', color: 'bg-orange-500', icon: <ClipboardCheck className="h-4 w-4" /> },
  'diagnose_bezig': { label: 'Diagnose bezig', color: 'bg-orange-400', icon: <ClipboardCheck className="h-4 w-4" /> },
  'wacht_op_akkoord': { label: 'Wacht op akkoord', color: 'bg-yellow-500', icon: <Clock className="h-4 w-4" /> },
  'wacht_op_onderdelen': { label: 'Wacht op onderdelen', color: 'bg-purple-500', icon: <Clock className="h-4 w-4" /> },
  'klaar_voor_reparatie': { label: 'Klaar voor reparatie', color: 'bg-green-500', icon: <ThumbsUp className="h-4 w-4" /> },
  'in_reparatie': { label: 'In reparatie', color: 'bg-blue-500', icon: <Wrench className="h-4 w-4" /> },
  'afgerond': { label: 'Afgerond', color: 'bg-gray-500', icon: <Check className="h-4 w-4" /> },
};

const getStatusLabelEN = (status: BikeWorkflowStatus): string => {
  const labelsEN: Record<BikeWorkflowStatus, string> = {
    'diagnose_nodig': 'Diagnosis needed',
    'diagnose_bezig': 'Diagnosis in progress',
    'wacht_op_akkoord': 'Waiting for approval',
    'wacht_op_onderdelen': 'Waiting for parts',
    'klaar_voor_reparatie': 'Ready for repair',
    'in_reparatie': 'In repair',
    'afgerond': 'Completed',
  };
  return labelsEN[status] || status;
};

const formSchema = z.object({
  searchQuery: z.string().min(1, 'Framenummer of tafelnummer is verplicht'),
  frameNumber: z.string().optional(),
  model: z.enum(['S1', 'S2', 'S3', 'S5', 'S6', 'X1', 'X2', 'X3', 'X5', 'A5'] as const).optional(),
  tableNumber: z.string().optional(),
  comment: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface RepairType {
  id: string;
  name: string;
  description: string | null;
  points: number;
  price: number;
}

interface WorkRegistration {
  id: string;
  completed: boolean;
  completed_at: string | null;
  repair_type: RepairType;
  mechanic: { full_name: string } | null;
}

interface BikeComment {
  id: string;
  content: string;
  created_at: string;
  author: { full_name: string } | null;
  author_role?: 'foh' | 'admin' | 'monteur' | null;
}

interface ExistingBike {
  id: string;
  model: VanmoofModel;
  workflow_status: BikeWorkflowStatus;
  table_number: string | null;
  frame_number: string;
  is_sales_bike: boolean;
  diagnosed_by: string | null;
  diagnosed_at: string | null;
}

interface WorkRegistrationFormProps {
  initialFrameNumber?: string;
  onComplete?: () => void;
}

export function WorkRegistrationForm({ initialFrameNumber = '', onComplete }: WorkRegistrationFormProps) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [allRepairTypes, setAllRepairTypes] = useState<RepairType[]>([]);
  const [repairTypes, setRepairTypes] = useState<RepairType[]>([]);
  const [repairTypeModelMap, setRepairTypeModelMap] = useState<Map<string, string[]>>(new Map());
  const [selectedRepairs, setSelectedRepairs] = useState<string[]>([]);
  const [existingRegistrations, setExistingRegistrations] = useState<WorkRegistration[]>([]);
  const [existingComments, setExistingComments] = useState<BikeComment[]>([]);
  const [existingBike, setExistingBike] = useState<ExistingBike | null>(null);
  const [bikesOnTable, setBikesOnTable] = useState<ExistingBike[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingBike, setLoadingBike] = useState(false);
  const [isReturningCustomer, setIsReturningCustomer] = useState(false);
  const [repairSearchQuery, setRepairSearchQuery] = useState('');
  const [showCompletionChecklist, setShowCompletionChecklist] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [inventoryData, setInventoryData] = useState<Map<string, { quantity: number; min_stock_level: number }>>(new Map());
  const [showStockWarnings, setShowStockWarnings] = useState(true);
  const [diagnosisNotComplete, setDiagnosisNotComplete] = useState(false);
  const [isSalesBike, setIsSalesBike] = useState(false);
  const [diagnosedByName, setDiagnosedByName] = useState<string | null>(null);
  const [myActiveBikes, setMyActiveBikes] = useState<{ id: string; frame_number: string; model: string; table_number: string | null; workflow_status: BikeWorkflowStatus; pending_repairs: number; completed_repairs: number }[]>([]);

  // Check localStorage for stock warnings setting
  useEffect(() => {
    const checkStockWarningsSetting = () => {
      const saved = localStorage.getItem('showStockWarningsInDiagnosis');
      setShowStockWarnings(saved !== null ? JSON.parse(saved) : true);
    };
    checkStockWarningsSetting();
    
    // Listen for storage changes (in case admin updates the setting)
    window.addEventListener('storage', checkStockWarningsSetting);
    return () => window.removeEventListener('storage', checkStockWarningsSetting);
  }, []);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      searchQuery: initialFrameNumber,
      frameNumber: '',
      model: undefined,
      tableNumber: '',
      comment: '',
    },
  });

  // When a barcode is scanned after the form has mounted, we must push it into the search field.
  useEffect(() => {
    const next = (initialFrameNumber || '').trim();
    if (!next) return;
    form.setValue('searchQuery', next, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
  }, [initialFrameNumber, form]);

  const searchQuery = form.watch('searchQuery');
  const selectedModel = form.watch('model');

  useEffect(() => {
    fetchRepairTypesAndModels();
    fetchInventoryData();
    fetchMyActiveBikes();
  }, []);

  const fetchMyActiveBikes = async () => {
    if (!user?.id) return;
    const { data: bikes } = await supabase
      .from('bikes')
      .select('id, frame_number, model, table_number, workflow_status')
      .eq('current_mechanic_id', user.id)
      .in('workflow_status', ['in_reparatie', 'klaar_voor_reparatie', 'diagnose_bezig', 'wacht_op_onderdelen']);

    if (!bikes || bikes.length === 0) {
      setMyActiveBikes([]);
      return;
    }

    const bikesWithCounts = await Promise.all(
      bikes.map(async (bike) => {
        const { data: repairs } = await supabase
          .from('work_registrations')
          .select('completed')
          .eq('bike_id', bike.id);
        return {
          ...bike,
          workflow_status: bike.workflow_status as BikeWorkflowStatus,
          pending_repairs: repairs?.filter(r => !r.completed).length || 0,
          completed_repairs: repairs?.filter(r => r.completed).length || 0,
        };
      })
    );
    setMyActiveBikes(bikesWithCounts);
  };

  // Filter repair types when model changes
  useEffect(() => {
    if (selectedModel && repairTypeModelMap.size > 0) {
      const filteredRepairs = allRepairTypes.filter(repair => {
        const models = repairTypeModelMap.get(repair.id);
        return models?.includes(selectedModel);
      });
      setRepairTypes(filteredRepairs);
      // Clear selected repairs that are no longer available for this model
      setSelectedRepairs(prev => prev.filter(id => filteredRepairs.some(r => r.id === id)));
    } else if (!selectedModel) {
      setRepairTypes(allRepairTypes);
    }
  }, [selectedModel, allRepairTypes, repairTypeModelMap]);

  useEffect(() => {
    if (searchQuery && searchQuery.length > 0) {
      const debounce = setTimeout(() => {
        searchBike(searchQuery);
      }, 500);
      return () => clearTimeout(debounce);
    } else {
      setExistingBike(null);
      setBikesOnTable([]);
      setExistingRegistrations([]);
      setExistingComments([]);
      form.setValue('frameNumber', '');
    }
  }, [searchQuery]);

  const fetchRepairTypesAndModels = async () => {
    // Fetch all repair types
    const { data: repairData, error: repairError } = await supabase
      .from('repair_types')
      .select('*')
      .order('name');

    if (repairError) {
      toast({ title: t('error'), description: t('couldNotLoadRepairTypes'), variant: 'destructive' });
      return;
    }

    // Fetch repair type to model mappings
    const { data: mappingData, error: mappingError } = await supabase
      .from('repair_type_models')
      .select('repair_type_id, model');

    if (mappingError) {
      console.error('Error fetching repair type models:', mappingError);
    }

    // Build the map of repair_type_id -> models[]
    const modelMap = new Map<string, string[]>();
    if (mappingData) {
      for (const mapping of mappingData) {
        const existing = modelMap.get(mapping.repair_type_id) || [];
        existing.push(mapping.model);
        modelMap.set(mapping.repair_type_id, existing);
      }
    }

    setAllRepairTypes(repairData || []);
    setRepairTypeModelMap(modelMap);
    setRepairTypes(repairData || []);
  };

  const fetchInventoryData = async () => {
    const [inventoryRes, groupsRes] = await Promise.all([
      supabase.from('inventory').select('repair_type_id, quantity, min_stock_level, group_id'),
      supabase.from('inventory_groups').select('id, quantity, min_stock_level'),
    ]);

    if (inventoryRes.error) {
      console.error('Error fetching inventory:', inventoryRes.error);
      return;
    }

    const groupMap = new Map<string, { quantity: number; min_stock_level: number }>();
    if (groupsRes.data) {
      for (const g of groupsRes.data) {
        groupMap.set(g.id, { quantity: g.quantity, min_stock_level: g.min_stock_level });
      }
    }

    const inventoryMap = new Map<string, { quantity: number; min_stock_level: number }>();
    if (inventoryRes.data) {
      for (const item of inventoryRes.data) {
        // If item belongs to a group, use group stock
        if (item.group_id && groupMap.has(item.group_id)) {
          inventoryMap.set(item.repair_type_id, groupMap.get(item.group_id)!);
        } else {
          inventoryMap.set(item.repair_type_id, {
            quantity: item.quantity,
            min_stock_level: item.min_stock_level,
          });
        }
      }
    }
    setInventoryData(inventoryMap);
  };

  const getStockStatus = (repairTypeId: string): 'ok' | 'low' | 'out' | null => {
    const inventory = inventoryData.get(repairTypeId);
    if (!inventory) return null; // No inventory tracking for this item
    
    if (inventory.quantity <= 0) return 'out';
    if (inventory.quantity <= inventory.min_stock_level) return 'low';
    return 'ok';
  };

  const searchBike = async (query: string) => {
    setLoadingBike(true);
    setBikesOnTable([]);
    setIsReturningCustomer(false);
    
    // Extract table number if user types "tafel X" or "Tafel X"
    const tableMatch = query.match(/^tafel\s*(\d+)$/i);
    const normalizedTableNumber = tableMatch ? tableMatch[1] : null;
    
    // First try to find by frame number (exact match) - only if not a table search
    if (!normalizedTableNumber) {
      const { data: bikeByFrame } = await supabase
        .from('bikes')
        .select('id, model, workflow_status, table_number, frame_number, is_sales_bike, diagnosed_by, diagnosed_at')
        .eq('frame_number', query)
        .maybeSingle();

      if (bikeByFrame) {
        // Found exact match by frame number
        // Check if this is a returning customer (bike was previously completed)
        if (bikeByFrame.workflow_status === 'afgerond') {
          setIsReturningCustomer(true);
          toast({
            title: '⚠️ Terugkerende klant!',
            description: `Deze fiets (${bikeByFrame.frame_number}) is eerder gerepareerd. Check de geschiedenis voor eerdere reparaties.`,
            variant: 'default',
          });
        }
        await selectBike(bikeByFrame as ExistingBike);
        setLoadingBike(false);
        return;
      }
    }

    // Search by table number (either extracted from "tafel X" or direct number input)
    const tableNumberToSearch = normalizedTableNumber || query;
    const { data: bikesByTable } = await supabase
      .from('bikes')
      .select('id, model, workflow_status, table_number, frame_number, is_sales_bike, diagnosed_by, diagnosed_at')
      .eq('table_number', tableNumberToSearch)
      .neq('workflow_status', 'afgerond');
    
    if (bikesByTable && bikesByTable.length > 0) {
      if (bikesByTable.length === 1) {
        // Only one bike on this table, select it directly
        await selectBike(bikesByTable[0] as ExistingBike);
      } else {
        // Multiple bikes on this table, show selection
        setBikesOnTable(bikesByTable as ExistingBike[]);
        setExistingBike(null);
        setExistingRegistrations([]);
        setExistingComments([]);
      }
    } else {
      // No bike found - this is a new bike
      setExistingBike(null);
      setBikesOnTable([]);
      setExistingRegistrations([]);
      setExistingComments([]);
      form.setValue('frameNumber', query);
    }
    
    setLoadingBike(false);
  };

  const selectBike = async (bike: ExistingBike) => {
    setExistingBike(bike);
    setBikesOnTable([]);
    form.setValue('frameNumber', bike.frame_number);
    form.setValue('model', bike.model);
    setIsSalesBike(bike.is_sales_bike);
    if (bike.table_number) {
      form.setValue('tableNumber', bike.table_number);
    }

    // Fetch existing registrations
    const { data: registrations } = await supabase
      .from('work_registrations')
      .select(`
        id,
        completed,
        completed_at,
        mechanic_id,
        repair_type:repair_types(id, name, description, points, price)
      `)
      .eq('bike_id', bike.id)
      .order('created_at', { ascending: false });

    // Fetch mechanic names separately if needed
    const registrationsWithMechanic = await Promise.all(
      (registrations || []).map(async (reg) => {
        if (reg.mechanic_id) {
          const { data: profile } = await supabase
            .from('profiles_limited')
            .select('full_name')
            .eq('id', reg.mechanic_id)
            .maybeSingle();
          return { ...reg, mechanic: profile };
        }
        return { ...reg, mechanic: null };
      })
    );

    // Fetch comments
    const { data: comments } = await supabase
      .from('bike_comments')
      .select(`
        id,
        content,
        created_at,
        author_id
      `)
      .eq('bike_id', bike.id)
      .order('created_at', { ascending: false });

    // Fetch author names separately if needed
    const commentsWithAuthor = await Promise.all(
      (comments || []).map(async (comment) => {
        let author = null;
        let author_role: string | null = null;
        if (comment.author_id) {
          const { data: profile } = await supabase
            .from('profiles_limited')
            .select('full_name')
            .eq('id', comment.author_id)
            .maybeSingle();
          author = profile;
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', comment.author_id)
            .maybeSingle();
          author_role = roleData?.role || null;
        }
        return { ...comment, author, author_role };
      })
    );

    setExistingRegistrations(registrationsWithMechanic as unknown as WorkRegistration[]);
    setExistingComments(commentsWithAuthor as unknown as BikeComment[]);
    
    // Fetch diagnoser name if available
    if (bike.diagnosed_by) {
      const { data: diagnoserProfile } = await supabase
        .from('profiles_limited')
        .select('full_name')
        .eq('id', bike.diagnosed_by)
        .maybeSingle();
      setDiagnosedByName(diagnoserProfile?.full_name || null);
    } else {
      setDiagnosedByName(null);
    }
    
    // Reset selected repairs when switching bikes
    setSelectedRepairs([]);
  };

  const toggleRepair = (repairId: string) => {
    const isSelecting = !selectedRepairs.includes(repairId);
    
    // Show stock warning when selecting a repair (only if enabled)
    if (isSelecting && showStockWarnings) {
      const stockStatus = getStockStatus(repairId);
      const repairName = allRepairTypes.find(r => r.id === repairId)?.name || 'Dit onderdeel';
      const inventory = inventoryData.get(repairId);
      
      if (stockStatus === 'out') {
        toast({
          title: '🚫 Niet op voorraad',
          description: `${repairName} is niet meer op voorraad (0 stuks). Controleer de voorraad voordat je dit selecteert.`,
          variant: 'destructive',
        });
      } else if (stockStatus === 'low') {
        toast({
          title: '⚠️ Beperkte voorraad',
          description: `${repairName} heeft nog maar ${inventory?.quantity} stuk(s) op voorraad (minimum: ${inventory?.min_stock_level}).`,
          variant: 'default',
        });
      }
    }
    
    setSelectedRepairs(prev =>
      prev.includes(repairId)
        ? prev.filter(id => id !== repairId)
        : [...prev, repairId]
    );
  };

  const deleteRepair = async (registrationId: string) => {
    try {
      const { error } = await supabase
        .from('work_registrations')
        .delete()
        .eq('id', registrationId);

      if (error) throw error;

      // Update local state immediately
      setExistingRegistrations(prev => prev.filter(r => r.id !== registrationId));
      
      toast({
        title: 'Reparatie verwijderd',
        description: 'De reparatie is succesvol verwijderd uit de werklijst.',
      });
    } catch (error) {
      console.error('Error deleting repair:', error);
      toast({
        title: 'Fout',
        description: 'Kon de reparatie niet verwijderen.',
        variant: 'destructive',
      });
    }
  };

  const updateWorkflowStatus = async (newStatus: BikeWorkflowStatus) => {
    if (!existingBike) return;

    try {
      // When changing to "in_reparatie", set the current mechanic
      const updateData: Record<string, unknown> = { workflow_status: newStatus };
      
      if (newStatus === 'in_reparatie' && user) {
        updateData.current_mechanic_id = user.id;
      } else if (newStatus !== 'in_reparatie') {
        // Clear mechanic when not in repair
        updateData.current_mechanic_id = null;
      }

      const { error } = await supabase
        .from('bikes')
        .update(updateData)
        .eq('id', existingBike.id);

      if (error) throw error;

      setExistingBike({ ...existingBike, workflow_status: newStatus });
      
      const statusLabels: Record<BikeWorkflowStatus, string> = {
        'diagnose_nodig': t('diagnosisNeeded'),
        'diagnose_bezig': t('diagnosisInProgress'),
        'wacht_op_akkoord': t('waitingForApproval'),
        'wacht_op_onderdelen': t('waitingForParts'),
        'klaar_voor_reparatie': t('readyForRepair'),
        'in_reparatie': t('inRepair'),
        'afgerond': t('completed'),
      };
      
      toast({
        title: t('statusUpdated'),
        description: `${t('statusIsNow')} ${statusLabels[newStatus]}`,
      });
    } catch (error) {
      toast({ title: t('error'), description: t('couldNotUpdateStatus'), variant: 'destructive' });
    }
  };

  const updateTableNumber = async (tableNumber: string) => {
    if (!existingBike) return;

    try {
      // If bike was previously completed and now being placed on a table again,
      // reset the workflow status to diagnose_nodig
      const updateData: Record<string, unknown> = { table_number: tableNumber || null };
      
      if (existingBike.workflow_status === 'afgerond' && tableNumber) {
        updateData.workflow_status = 'diagnose_nodig';
        toast({
          title: t('bikeReopenedForDiagnosis'),
          description: t('bikeWasPreviouslyCompleted'),
        });
      }

      const { error } = await supabase
        .from('bikes')
        .update(updateData)
        .eq('id', existingBike.id);

      if (error) throw error;

      // Update local state
      const newStatus = updateData.workflow_status 
        ? (updateData.workflow_status as BikeWorkflowStatus) 
        : existingBike.workflow_status;
      
      setExistingBike({ 
        ...existingBike, 
        table_number: tableNumber || null,
        workflow_status: newStatus
      });
      
      if (!updateData.workflow_status) {
        toast({ title: t('tableNumberUpdated') });
      }
    } catch (error) {
      toast({ title: t('error'), description: t('couldNotUpdateTableNumber'), variant: 'destructive' });
    }
  };

  // Determine workflow modes
  const isNewBike = !existingBike;
  const isDiagnosisMode = existingBike?.workflow_status === 'diagnose_nodig' || existingBike?.workflow_status === 'diagnose_bezig';
  const isCompletingRepairs = existingBike?.workflow_status === 'klaar_voor_reparatie' || existingBike?.workflow_status === 'in_reparatie';
  
  // Sales bikes in repair can add new repairs (not just complete existing ones)
  const isSalesBikeInRepair = isSalesBike && isCompletingRepairs;
  
  // Get pending (not completed) repairs for this bike - these are the diagnosed repairs
  const pendingRepairs = existingRegistrations.filter(reg => !reg.completed);
  
  // Determine which repairs can be selected
  // - For new bikes or diagnosis mode: all repair types
  // - For sales bikes in repair: all repair types (they can add new repairs)
  // - For completing repairs (non-sales): only the pending diagnosed repairs
  const availableRepairsForSelection = (isCompletingRepairs && !isSalesBike)
    ? pendingRepairs.map(reg => reg.repair_type).filter((r): r is RepairType => r !== null)
    : repairTypes;

  const onSubmit = async (data: FormData) => {
    if (!user) {
      toast({ title: 'Fout', description: 'Je moet ingelogd zijn', variant: 'destructive' });
      return;
    }

    // If diagnosisNotComplete is checked or it's a sales bike, allow saving without repairs
    if (selectedRepairs.length === 0 && !diagnosisNotComplete && !isSalesBike) {
      toast({ title: 'Fout', description: 'Selecteer minimaal één reparatie', variant: 'destructive' });
      return;
    }

    // For new bikes, validate required fields
    if (!existingBike) {
      const frameNumberValue = data.frameNumber || data.searchQuery;
      if (!frameNumberValue) {
        toast({ title: 'Fout', description: 'Framenummer is verplicht', variant: 'destructive' });
        return;
      }
      if (!data.model) {
        toast({ title: 'Fout', description: 'Selecteer een model', variant: 'destructive' });
        return;
      }
    }

    setLoading(true);

    try {
      let bikeId = existingBike?.id;

      // Create or get bike
      if (!bikeId) {
        // New bike - this is diagnosis mode (or direct to repair for sales bikes)
        const frameNumberValue = data.frameNumber || data.searchQuery;
        
        // Determine initial status:
        // - Sales bikes go directly to in_reparatie
        // - Regular bikes with incomplete diagnosis stay at diagnose_nodig
        // - Regular bikes with complete diagnosis go to wacht_op_akkoord
        let newStatus: BikeWorkflowStatus;
        if (isSalesBike) {
          newStatus = 'in_reparatie';
        } else if (diagnosisNotComplete) {
          newStatus = 'diagnose_nodig';
        } else {
          newStatus = 'wacht_op_akkoord';
        }
        
        const { data: newBike, error: bikeError } = await supabase
          .from('bikes')
          .insert({
            frame_number: frameNumberValue,
            model: data.model!,
            table_number: data.tableNumber || null,
            workflow_status: newStatus,
            is_sales_bike: isSalesBike,
            // For sales bikes, set current mechanic; for regular bikes, record diagnoser if complete
            current_mechanic_id: isSalesBike ? user.id : null,
            diagnosed_by: (!isSalesBike && !diagnosisNotComplete) ? user.id : null,
            diagnosed_at: (!isSalesBike && !diagnosisNotComplete) ? new Date().toISOString() : null,
          })
          .select('id')
          .single();

        if (bikeError) throw bikeError;
        bikeId = newBike.id;

        // Create work registrations if there are selected repairs
        if (selectedRepairs.length > 0) {
          const registrations = selectedRepairs.map(repairTypeId => ({
            bike_id: bikeId!,
            repair_type_id: repairTypeId,
            mechanic_id: user.id,
            // For sales bikes, mark as completed immediately; for regular bikes, just diagnosed
            completed: isSalesBike,
            completed_at: isSalesBike ? new Date().toISOString() : null,
          }));

          const { error: regError } = await supabase
            .from('work_registrations')
            .insert(registrations);

          if (regError) throw regError;
        }

        // Auto-award diagnosis points (0.5) when diagnosis is completed
        if (!isSalesBike && !diagnosisNotComplete) {
          const { data: diagnoseType } = await supabase
            .from('repair_types')
            .select('id')
            .eq('name', 'Diagnose')
            .maybeSingle();

          if (diagnoseType) {
            await supabase
              .from('work_registrations')
              .insert({
                bike_id: bikeId!,
                repair_type_id: diagnoseType.id,
                mechanic_id: user.id,
                completed: true,
                completed_at: new Date().toISOString(),
              });
          }
        }

        if (isSalesBike) {
          toast({
            title: 'Reparaties geregistreerd!',
            description: `${selectedRepairs.length} reparatie(s) uitgevoerd op verkoopfiets.`,
          });
        } else {
          const statusMessage = diagnosisNotComplete ? 'Diagnose nodig' : 'Wacht op akkoord';
          const repairText = selectedRepairs.length > 0 
            ? `${selectedRepairs.length} reparatie(s) genoteerd. ` 
            : 'Fiets gekoppeld aan tafel. ';
          toast({
            title: diagnosisNotComplete ? 'Fiets opgeslagen!' : 'Diagnose opgeslagen!',
            description: `${repairText}Status: ${statusMessage}`,
          });
        }
      }
      
      // If existing bike in diagnose_nodig status, add diagnosed repairs
      if (existingBike && isDiagnosisMode) {
        // Only create work registrations if there are selected repairs
        if (selectedRepairs.length > 0) {
          const registrations = selectedRepairs.map(repairTypeId => ({
            bike_id: existingBike.id,
            repair_type_id: repairTypeId,
            mechanic_id: user.id,
            completed: false,
            completed_at: null,
          }));

          const { error: regError } = await supabase
            .from('work_registrations')
            .insert(registrations);

          if (regError) throw regError;
        }

        // Update status based on diagnosisNotComplete checkbox
        const newStatus = diagnosisNotComplete ? 'diagnose_nodig' as const : 'wacht_op_akkoord' as const;
        
        // Build update object - include diagnosis info only when completing diagnosis
        const updateData: Record<string, unknown> = {
          workflow_status: newStatus,
          table_number: data.tableNumber || existingBike.table_number,
          is_sales_bike: isSalesBike,
        };
        
        // Record diagnosis completion if not already done and diagnosis is now complete
        if (!diagnosisNotComplete && !existingBike.diagnosed_by) {
          updateData.diagnosed_by = user.id;
          updateData.diagnosed_at = new Date().toISOString();
        }
        
        await supabase
          .from('bikes')
          .update(updateData)
          .eq('id', existingBike.id);

        // Auto-award diagnosis points (0.5) when diagnosis is completed
        if (!diagnosisNotComplete && !existingBike.diagnosed_by) {
          const { data: diagnoseType } = await supabase
            .from('repair_types')
            .select('id')
            .eq('name', 'Diagnose')
            .maybeSingle();

          if (diagnoseType) {
            await supabase
              .from('work_registrations')
              .insert({
                bike_id: existingBike.id,
                repair_type_id: diagnoseType.id,
                mechanic_id: user.id,
                completed: true,
                completed_at: new Date().toISOString(),
              });
          }
        }

        const statusMessage = diagnosisNotComplete ? 'Diagnose nodig' : 'Wacht op akkoord';
        const repairText = selectedRepairs.length > 0 
          ? `${selectedRepairs.length} reparatie(s) genoteerd. ` 
          : 'Fiets bijgewerkt. ';
        toast({
          title: diagnosisNotComplete ? 'Fiets opgeslagen!' : 'Diagnose opgeslagen!',
          description: `${repairText}Status: ${statusMessage}`,
        });
      }

      // If completing repairs (klaar_voor_reparatie or in_reparatie)
      if (existingBike && isCompletingRepairs) {
        // For sales bikes, add new repairs as completed
        if (isSalesBike) {
          const registrations = selectedRepairs.map(repairTypeId => ({
            bike_id: existingBike.id,
            repair_type_id: repairTypeId,
            mechanic_id: user.id,
            completed: true,
            completed_at: new Date().toISOString(),
          }));

          const { error: regError } = await supabase
            .from('work_registrations')
            .insert(registrations);

          if (regError) throw regError;
          
          toast({
            title: 'Reparaties geregistreerd!',
            description: `${selectedRepairs.length} reparatie(s) uitgevoerd op verkoopfiets.`,
          });
        } else {
          // For regular bikes, update existing work_registrations to completed
          const completionPromises = selectedRepairs.map(repairTypeId => {
            const pendingReg = pendingRepairs.find(r => r.repair_type?.id === repairTypeId);
            if (pendingReg) {
              return supabase
                .from('work_registrations')
                .update({ 
                  completed: true, 
                  completed_at: new Date().toISOString(),
                  mechanic_id: user.id
                })
                .eq('id', pendingReg.id);
            }
            return null;
          }).filter(Boolean);

          const results = await Promise.all(completionPromises);
          const failedResults = results.filter(r => r && r.error);
          if (failedResults.length > 0) {
            throw new Error(`${failedResults.length} reparatie(s) konden niet worden opgeslagen`);
          }

          toast({
            title: 'Reparaties afgerond!',
            description: `${selectedRepairs.length} reparatie(s) gemarkeerd als voltooid`,
          });
        }

        // Update bike status and current mechanic
        if (existingBike.workflow_status === 'klaar_voor_reparatie') {
          await supabase
            .from('bikes')
            .update({ 
              workflow_status: 'in_reparatie', 
              status: 'in_behandeling',
              current_mechanic_id: user.id 
            })
            .eq('id', existingBike.id);
        } else if (existingBike.workflow_status === 'in_reparatie') {
          // Update current_mechanic_id to the mechanic actually doing the work
          await supabase
            .from('bikes')
            .update({ current_mechanic_id: user.id })
            .eq('id', existingBike.id);
        }
      }

      // Add comment if provided
      if (data.comment?.trim() && bikeId) {
        const { error: commentError } = await supabase
          .from('bike_comments')
          .insert({
            bike_id: bikeId,
            author_id: user.id,
            content: data.comment.trim(),
          });

        if (commentError) throw commentError;
      }

      form.reset();
      setSelectedRepairs([]);
      setExistingBike(null);
      setBikesOnTable([]);
      setExistingRegistrations([]);
      setExistingComments([]);
      setIsReturningCustomer(false);
      setDiagnosisNotComplete(false);
      setIsSalesBike(false);
      fetchMyActiveBikes();
      onComplete?.();
    } catch (error) {
      console.error(error);
      toast({ title: 'Fout', description: 'Kon werkzaamheden niet registreren', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const totalSelectedPoints = selectedRepairs.reduce((sum, repairId) => {
    const repair = availableRepairsForSelection.find(r => r.id === repairId);
    return sum + (repair?.points || 0);
  }, 0);

  const totalSelectedPrice = selectedRepairs.reduce((sum, repairId) => {
    const repair = availableRepairsForSelection.find(r => r.id === repairId);
    return sum + (repair?.price || 0);
  }, 0);

  const formatPrice = (price: number | undefined | null) => {
    if (price === undefined || price === null) return '€0,00';
    return `€${price.toFixed(2).replace('.', ',')}`;
  };

  // Can register repairs when:
  // - New bike (will create bike + diagnosis)
  // - diagnose_nodig status (adding diagnosis)
  // - klaar_voor_reparatie/in_reparatie (completing diagnosed repairs)
  const canRegisterRepairs = isNewBike || isDiagnosisMode || isCompletingRepairs;

  return (
    <div className="space-y-6">
      {/* My Active Bikes */}
      {myActiveBikes.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wrench className="h-5 w-5" />
              {t('myActiveBikes')}
            </CardTitle>
            <CardDescription>{t('myActiveBikesDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {myActiveBikes.map((bike) => (
                <div
                  key={bike.id}
                  onClick={() => {
                    form.setValue('searchQuery', bike.frame_number, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                  }}
                  className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted font-semibold text-sm">
                      {bike.table_number || '-'}
                    </div>
                    <div>
                      <p className="font-medium">{bike.model}</p>
                      <p className="text-xs text-muted-foreground font-mono">{bike.frame_number}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`${WORKFLOW_STATUS_CONFIG[bike.workflow_status].color} text-white text-xs`}>
                      {WORKFLOW_STATUS_CONFIG[bike.workflow_status].icon}
                      <span className="ml-1">
                        {language === 'nl' ? WORKFLOW_STATUS_CONFIG[bike.workflow_status].label : getStatusLabelEN(bike.workflow_status)}
                      </span>
                    </Badge>
                    {bike.pending_repairs > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {bike.pending_repairs} {t('pendingRepairs')}
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bike className="h-5 w-5" />
            {t('bikeRegistration')}
          </CardTitle>
          <CardDescription>
            {t('searchByFrameOrTable')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="searchQuery"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Bike className="h-4 w-4" />
                      {t('searchBike')}
                    </FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input 
                          placeholder={t('enterFrameOrTable')} 
                          {...field} 
                          className="flex-1"
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setShowScanner(true)}
                        title={t('openScanner')}
                      >
                        <ScanLine className="h-4 w-4" />
                      </Button>
                    </div>
                    <FormMessage />
                    {loadingBike && (
                      <p className="text-sm text-muted-foreground">{t('searching')}</p>
                    )}
                    {existingBike && !isReturningCustomer && (
                      <p className="text-sm text-primary">
                        ✓ {t('bikeFound')}: {existingBike.frame_number} ({t('tableLabel')} {existingBike.table_number || t('noTable')})
                      </p>
                    )}
                    {existingBike && isReturningCustomer && (
                      <div className="flex items-center gap-2 p-2 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          {t('returningCustomer')} {t('bikeWasPreviouslyRepaired')}
                        </span>
                      </div>
                    )}
                    {bikesOnTable.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {bikesOnTable.length} {t('bikesFoundOnTable')} {searchQuery}
                      </p>
                    )}
                    {!existingBike && bikesOnTable.length === 0 && searchQuery && searchQuery.length > 0 && !loadingBike && (
                      <p className="text-sm text-muted-foreground">
                        {t('newBikeMessage')}
                      </p>
                    )}
                  </FormItem>
                )}
              />

              {/* Bike selection when multiple bikes found on same table */}
              {bikesOnTable.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{t('selectBikeToWork')}</p>
                  <div className="grid gap-2">
                    {bikesOnTable.map(bike => (
                      <Button
                        key={bike.id}
                        type="button"
                        variant="outline"
                        className="justify-start h-auto p-3"
                        onClick={() => selectBike(bike)}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <Bike className="h-5 w-5 text-primary" />
                          <div className="text-left">
                            <p className="font-medium">{bike.model} - {bike.frame_number}</p>
                            <p className="text-xs text-muted-foreground">
                              {t('status')}: {language === 'nl' ? WORKFLOW_STATUS_CONFIG[bike.workflow_status].label : getStatusLabelEN(bike.workflow_status)}
                            </p>
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Only show frameNumber field for new bikes */}
              {!existingBike && searchQuery && (
                <FormField
                  control={form.control}
                  name="frameNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('frameNumber')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('frameNumberForNewBike')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>VanMoof {t('model')}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!!existingBike}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('selectModel')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {VANMOOF_MODELS.map(model => (
                          <SelectItem key={model} value={model}>
                            VanMoof {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tableNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Table2 className="h-4 w-4" />
                      {t('tableNumber')}
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder={t('tableNumberExample')} 
                        {...field} 
                        onBlur={() => {
                          if (existingBike && field.value !== existingBike.table_number) {
                            updateTableNumber(field.value || '');
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Sales Bike Checkbox */}
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-border bg-muted/30">
                <Checkbox
                  id="salesBike"
                  checked={isSalesBike}
                  onCheckedChange={(checked) => setIsSalesBike(checked === true)}
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="salesBike"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {t('salesBike')}
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {t('salesBikeHint')}
                  </p>
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Workflow Status */}
      {existingBike && (
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                Workflow Status
              </span>
              <Badge className={`${WORKFLOW_STATUS_CONFIG[existingBike.workflow_status].color} text-white`}>
                {WORKFLOW_STATUS_CONFIG[existingBike.workflow_status].icon}
                <span className="ml-1">{WORKFLOW_STATUS_CONFIG[existingBike.workflow_status].label}</span>
              </Badge>
            </CardTitle>
            <CardDescription>
              Werk de status van de fiets bij op basis van het proces
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="w-full pb-2">
              <div className="flex gap-2 min-w-max">
                {(Object.keys(WORKFLOW_STATUS_CONFIG) as BikeWorkflowStatus[]).map(status => (
                  <Button
                    key={status}
                    variant={existingBike.workflow_status === status ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      if (status === 'afgerond') {
                        setShowCompletionChecklist(true);
                      } else {
                        updateWorkflowStatus(status);
                      }
                    }}
                    className="flex items-center gap-1 text-xs whitespace-nowrap shrink-0"
                  >
                    {WORKFLOW_STATUS_CONFIG[status].icon}
                    <span>{WORKFLOW_STATUS_CONFIG[status].label}</span>
                  </Button>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
            
            {existingBike.workflow_status === 'diagnose_nodig' && (
              <p className="text-sm text-orange-600 mt-3 p-2 bg-orange-50 rounded-lg dark:bg-orange-950 dark:text-orange-400">
                ⚠️ Deze fiets moet nog gediagnosticeerd worden. Stel de diagnose vast en update de status.
              </p>
            )}
            {existingBike.workflow_status === 'wacht_op_akkoord' && (
              <p className="text-sm text-yellow-600 mt-3 p-2 bg-yellow-50 rounded-lg dark:bg-yellow-950 dark:text-yellow-400">
                ⏳ Diagnose is uitgevoerd. Wacht op akkoord van de klant voordat reparaties kunnen beginnen.
              </p>
            )}
            {existingBike.workflow_status === 'klaar_voor_reparatie' && (
              <p className="text-sm text-green-600 mt-3 p-2 bg-green-50 rounded-lg dark:bg-green-950 dark:text-green-400">
                ✅ Klantakkoord ontvangen! Monteurs kunnen nu beginnen met de reparaties.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* FOH / Admin Opmerkingen */}
      {existingComments.filter(c => c.author_role === 'foh' || c.author_role === 'admin').length > 0 && (
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
              <MessageSquare className="h-5 w-5" />
              FOH Opmerkingen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[150px]">
              <div className="space-y-3">
                {existingComments
                  .filter(c => c.author_role === 'foh' || c.author_role === 'admin')
                  .map(comment => (
                    <div key={comment.id} className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-700">
                      <p className="text-sm">{comment.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {comment.author?.full_name || 'Onbekend'} 
                        <Badge variant="outline" className="ml-2 text-xs py-0 px-1.5 border-blue-300 text-blue-600 dark:text-blue-300">
                          {comment.author_role === 'admin' ? 'Admin' : 'FOH'}
                        </Badge>
                        {' • '}
                        {new Date(comment.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Monteur Opmerkingen */}
      {existingComments.filter(c => c.author_role !== 'foh' && c.author_role !== 'admin').length > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <MessageSquare className="h-5 w-5" />
              Eerdere Opmerkingen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[150px]">
              <div className="space-y-3">
                {existingComments
                  .filter(c => c.author_role !== 'foh' && c.author_role !== 'admin')
                  .map(comment => (
                    <div key={comment.id} className="p-3 bg-white dark:bg-gray-800 rounded-lg">
                      <p className="text-sm">{comment.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {comment.author?.full_name || 'Onbekend'} - {new Date(comment.created_at).toLocaleDateString('nl-NL')}
                      </p>
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Existing Registrations */}
      {existingRegistrations.length > 0 && (
        <Card className={isReturningCustomer 
          ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950"
          : "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950"
        }>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${
              isReturningCustomer 
                ? "text-amber-800 dark:text-amber-200" 
                : "text-blue-800 dark:text-blue-200"
            }`}>
              <History className="h-5 w-5" />
              Reparatiegeschiedenis
              {isReturningCustomer && (
                <Badge variant="outline" className="ml-2 border-amber-500 text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Terugkerende klant
                </Badge>
              )}
            </CardTitle>
            {/* Show diagnoser info */}
            {diagnosedByName && existingBike?.diagnosed_at && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <ClipboardCheck className="h-4 w-4" />
                <span>
                  {t('diagnosedBy')}: <span className="font-medium">{diagnosedByName}</span>
                  {' • '}
                  {new Date(existingBike.diagnosed_at).toLocaleDateString(language === 'nl' ? 'nl-NL' : 'en-US', { 
                    day: 'numeric', 
                    month: 'short', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {existingRegistrations.map(reg => {
                  // Check if repair was done within 6 months (warranty)
                  const completedDate = reg.completed_at ? new Date(reg.completed_at) : null;
                  const isWithinWarranty = completedDate 
                    ? differenceInMonths(new Date(), completedDate) < 6 
                    : false;
                  
                  return (
                    <div key={reg.id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded-lg">
                      <div className="flex items-center gap-2">
                        {reg.completed && <Check className="h-4 w-4 text-green-600" />}
                        <span className="text-sm">{reg.repair_type?.name}</span>
                        {isReturningCustomer && isWithinWarranty && reg.completed && (
                          <Badge variant="destructive" className="text-xs">
                            <Shield className="h-3 w-3 mr-1" />
                            Garantie
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {/* For returning customers, show date instead of points */}
                        {isReturningCustomer && reg.completed ? (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {completedDate 
                                ? completedDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
                                : 'Onbekend'}
                            </span>
                          </div>
                        ) : !isSalesBike ? (
                          <Badge variant="secondary">{`€${Number(reg.repair_type?.price || 0).toFixed(2).replace('.', ',')}`}</Badge>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          {reg.mechanic?.full_name || 'Onbekend'}
                        </span>
                        {/* Delete button for pending (not completed) repairs */}
                        {!reg.completed && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => deleteRepair(reg.id)}
                            title="Reparatie verwijderen"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            
            {/* Total price for pending repairs (diagnosis total) - hide for sales bikes */}
            {pendingRepairs.length > 0 && !isSalesBike && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">Totaal gediagnosticeerde reparaties:</span>
                  <div className="text-right">
                    <span className="text-lg font-bold text-primary">
                      {formatPrice(pendingRepairs.reduce((sum, reg) => sum + (Number(reg.repair_type?.price) || 0), 0))}
                    </span>
                    <p className="text-xs text-muted-foreground">{pendingRepairs.length} reparatie(s)</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Repair Selection - Only show when allowed */}
      {canRegisterRepairs ? (
        <Card className={(isNewBike || isDiagnosisMode) && !isSalesBike ? 'border-orange-200 dark:border-orange-800' : isSalesBike ? 'border-blue-200 dark:border-blue-800' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                {(isNewBike || isDiagnosisMode) && !isSalesBike ? <ClipboardCheck className="h-5 w-5" /> : <Wrench className="h-5 w-5" />}
                {isSalesBike 
                  ? 'Uitgevoerde Reparaties (Verkoopfiets)' 
                  : (isNewBike || isDiagnosisMode) 
                    ? 'Diagnose - Benodigde Reparaties' 
                    : 'Markeer Voltooide Reparaties'}
              </span>
              {selectedRepairs.length > 0 && (
                <Badge variant="default" className="text-lg px-3 py-1">
                  {selectedRepairs.length} gekozen {!isSalesBike && `(${formatPrice(totalSelectedPrice)})`}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {isSalesBike
                ? `Selecteer de reparaties die je hebt uitgevoerd${selectedModel ? ` voor ${selectedModel}` : ''}`
                : (isNewBike || isDiagnosisMode) 
                  ? `Selecteer alle reparaties die uitgevoerd moeten worden${selectedModel ? ` voor ${selectedModel}` : ''}`
                  : 'Selecteer de reparaties die je hebt uitgevoerd (alleen gediagnosticeerde reparaties)'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Show message if no model selected for new bikes */}
            {(isNewBike || isDiagnosisMode || isSalesBikeInRepair) && !selectedModel && (
              <div className="text-center py-6 text-muted-foreground border-2 border-dashed border-muted rounded-lg">
                <Bike className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="font-medium">Selecteer eerst een model</p>
                <p className="text-sm mt-1">De beschikbare reparaties worden gefilterd op basis van het gekozen VanMoof model.</p>
              </div>
            )}
            {isCompletingRepairs && !isSalesBike && availableRepairsForSelection.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <p>Alle gediagnosticeerde reparaties zijn al voltooid.</p>
                <p className="text-sm mt-2">Update de status naar "Afgerond" als de fiets klaar is.</p>
              </div>
            ) : selectedModel || (!isNewBike && !isDiagnosisMode && !isSalesBikeInRepair) ? (
              <div className="space-y-3">
                {/* Search field for repairs */}
                {(isNewBike || isDiagnosisMode) && availableRepairsForSelection.length > 5 && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Zoek reparatie..."
                      value={repairSearchQuery}
                      onChange={(e) => setRepairSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {(() => {
                    const filteredRepairs = availableRepairsForSelection.filter(repair => {
                      if (!repairSearchQuery) return true;
                      const query = repairSearchQuery.toLowerCase();
                      return (
                        repair.name.toLowerCase().includes(query) ||
                        (repair.description?.toLowerCase().includes(query) ?? false)
                      );
                    });
                    
                    return filteredRepairs.length === 0 ? (
                      <p className="col-span-2 text-center text-muted-foreground py-4">
                        Geen reparaties gevonden voor "{repairSearchQuery}"
                      </p>
                    ) : (
                      filteredRepairs.map(repair => {
                        const stockStatus = showStockWarnings ? getStockStatus(repair.id) : null;
                        const inventory = inventoryData.get(repair.id);
                        
                        return (
                          <div
                            key={repair.id}
                            onClick={() => toggleRepair(repair.id)}
                            className={`
                              flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all
                              ${selectedRepairs.includes(repair.id)
                                ? 'border-primary bg-primary/10'
                                : stockStatus === 'out'
                                  ? 'border-destructive/50 bg-destructive/5'
                                  : stockStatus === 'low'
                                    ? 'border-orange-500/50 bg-orange-50 dark:bg-orange-950/20'
                                    : 'border-border hover:border-primary/50'
                              }
                            `}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={selectedRepairs.includes(repair.id)}
                                onChange={() => {}}
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-sm">{repair.name}</p>
                                  {stockStatus === 'out' && (
                                    <Badge variant="destructive" className="text-xs py-0 px-1.5">
                                      <PackageX className="h-3 w-3 mr-1" />
                                      Op
                                    </Badge>
                                  )}
                                  {stockStatus === 'low' && (
                                    <Badge className="text-xs py-0 px-1.5 bg-orange-500 hover:bg-orange-600">
                                      <Package className="h-3 w-3 mr-1" />
                                      {inventory?.quantity}
                                    </Badge>
                                  )}
                                </div>
                                {repair.description && (
                                  <p className="text-xs text-muted-foreground">{repair.description}</p>
                                )}
                              </div>
                            </div>
                            {!isSalesBike && <Badge variant="outline">{formatPrice(repair.price)}</Badge>}
                          </div>
                        );
                      })
                    );
                  })()}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : existingBike?.workflow_status === 'wacht_op_akkoord' ? (
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
          <CardContent className="pt-6">
            <p className="text-center text-yellow-600 dark:text-yellow-400">
              ⏳ Deze fiets wacht nog op klantakkoord. Reparaties kunnen pas beginnen na goedkeuring.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-muted bg-muted/50">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Selecteer eerst een fiets om reparaties te bekijken of registreren.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Diagnosis Not Complete Checkbox - only show in diagnosis mode for non-sales bikes */}
      {(isNewBike || isDiagnosisMode) && !isSalesBike && (
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
          <CardContent className="pt-4">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="diagnosisNotComplete"
                checked={diagnosisNotComplete}
                onCheckedChange={(checked) => setDiagnosisNotComplete(checked === true)}
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="diagnosisNotComplete"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-orange-800 dark:text-orange-200"
                >
                  {t('diagnosisNotComplete')}
                </label>
                <p className="text-xs text-orange-600 dark:text-orange-400">
                  {t('diagnosisNotCompleteHint')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Opmerking (optioneel)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <FormField
              control={form.control}
              name="comment"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="Voeg een opmerking toe voor de volgende monteur..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </Form>
        </CardContent>
      </Card>

      {/* Submit */}
      <Button
        onClick={form.handleSubmit(onSubmit)}
        disabled={loading || (selectedRepairs.length === 0 && !diagnosisNotComplete && !isSalesBike) || !canRegisterRepairs}
        className="w-full"
        size="lg"
      >
        {loading 
          ? 'Bezig met opslaan...' 
          : diagnosisNotComplete
            ? 'Fiets opslaan'
            : isSalesBike
              ? `Reparaties registreren (${selectedRepairs.length})`
              : (isNewBike || isDiagnosisMode)
                ? `Diagnose opslaan (${selectedRepairs.length} reparatie(s)) - ${formatPrice(totalSelectedPrice)}`
                : `Markeer ${selectedRepairs.length} reparatie(s) als voltooid`
        }
      </Button>

      {/* Completion Checklist Dialog */}
      {existingBike && (
        <CompletionChecklistDialog
          bikeId={existingBike.id}
          bikeFrameNumber={existingBike.frame_number}
          open={showCompletionChecklist}
          onOpenChange={setShowCompletionChecklist}
          onComplete={() => {
            // Reset form after completion
            form.reset();
            setSelectedRepairs([]);
            setExistingBike(null);
            setBikesOnTable([]);
            setExistingRegistrations([]);
            setExistingComments([]);
            setIsReturningCustomer(false);
            onComplete?.();
          }}
        />
      )}

      {/* Barcode Scanner Modal */}
      <AnimatePresence>
        {showScanner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md"
            >
              <BarcodeScanner
                onScan={(code) => {
                  form.setValue('searchQuery', code, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                  setShowScanner(false);
                }}
                onClose={() => setShowScanner(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
