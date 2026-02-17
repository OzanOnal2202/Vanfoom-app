import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { format, startOfWeek, startOfMonth, endOfMonth, addDays, addWeeks, subWeeks, addMonths, subMonths, isSameDay, isWithinInterval, parseISO, isSaturday, getDay } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';
import { CalendarIcon, ChevronLeft, ChevronRight, Check, X, Clock, Users, Search, UserCircle, Edit, FileText, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AvailabilityWithProfile {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'approved' | 'rejected';
  notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  profiles: {
    id: string;
    full_name: string;
    email: string;
  } | null;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

export function AdminAvailability() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const dateLocale = language === 'nl' ? nl : enUS;
  
  const [viewType, setViewType] = useState<'week' | 'day' | 'month'>('week');
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMechanicId, setSelectedMechanicId] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAvailability, setEditingAvailability] = useState<AvailabilityWithProfile | null>(null);
  const [editFormData, setEditFormData] = useState({
    startTime: '09:00',
    endTime: '17:00',
    notes: '',
  });

  // Fetch all availabilities
  const { data: availabilities, isLoading } = useQuery({
    queryKey: ['admin-availability'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mechanic_availability')
        .select(`
          *,
          profiles!mechanic_availability_user_id_fkey (
            id,
            full_name,
            email
          )
        `)
        .order('date', { ascending: true });
      if (error) throw error;
      return data as AvailabilityWithProfile[];
    },
  });

  // Fetch all profiles for mechanic search
  const { data: profiles } = useQuery({
    queryKey: ['all-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name');
      if (error) throw error;
      return data as Profile[];
    },
  });

  // Update availability status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'approved' | 'rejected' }) => {
      const { error } = await supabase
        .from('mechanic_availability')
        .update({
          status,
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success(variables.status === 'approved' ? t('availabilityApproved') : t('availabilityRejected'));
      queryClient.invalidateQueries({ queryKey: ['admin-availability'] });
    },
    onError: () => {
      toast.error(t('error'));
    },
  });

  // Update availability details mutation (for admin editing)
  const updateAvailabilityMutation = useMutation({
    mutationFn: async ({ id, startTime, endTime, notes }: { id: string; startTime: string; endTime: string; notes: string }) => {
      const { error } = await supabase
        .from('mechanic_availability')
        .update({
          start_time: startTime,
          end_time: endTime,
          notes: notes || null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('availabilityUpdated'));
      queryClient.invalidateQueries({ queryKey: ['admin-availability'] });
      setEditDialogOpen(false);
      setEditingAvailability(null);
    },
    onError: () => {
      toast.error(t('error'));
    },
  });

  // Handle edit click
  const handleEditClick = (availability: AvailabilityWithProfile) => {
    setEditingAvailability(availability);
    setEditFormData({
      startTime: availability.start_time.slice(0, 5),
      endTime: availability.end_time.slice(0, 5),
      notes: availability.notes || '',
    });
    setEditDialogOpen(true);
  };

  // Handle save edit
  const handleSaveEdit = () => {
    if (!editingAvailability) return;
    updateAvailabilityMutation.mutate({
      id: editingAvailability.id,
      startTime: editFormData.startTime,
      endTime: editFormData.endTime,
      notes: editFormData.notes,
    });
  };

  // Calculate hours with break deduction
  const calculateNetHours = (startTime: string, endTime: string) => {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    let durationMinutes = endMinutes - startMinutes;
    
    // Deduct 30 minutes break if worked more than 6 hours
    if (durationMinutes > 360) {
      durationMinutes -= 30;
    }
    
    return durationMinutes;
  };

  // Generate PDF report for all mechanics
  const generateAllMechanicsPDFReport = () => {
    if (!availabilities) return;

    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    
    // Get all mechanics with approved availability in this month
    const monthlyData = availabilities.filter(a => 
      a.status === 'approved' &&
      isWithinInterval(parseISO(a.date), { start: monthStart, end: monthEnd })
    );

    if (monthlyData.length === 0) {
      toast.error(t('noWorkInMonth'));
      return;
    }

    // Group by mechanic
    const mechanicData = new Map<string, { name: string; days: { date: string; hours: number; isSaturday: boolean }[] }>();
    
    for (const availability of monthlyData) {
      const mechanicId = availability.user_id;
      const mechanicName = availability.profiles?.full_name || t('unknown');
      
      if (!mechanicData.has(mechanicId)) {
        mechanicData.set(mechanicId, { name: mechanicName, days: [] });
      }
      
      const netMinutes = calculateNetHours(availability.start_time, availability.end_time);
      const date = parseISO(availability.date);
      
      mechanicData.get(mechanicId)!.days.push({
        date: availability.date,
        hours: netMinutes / 60,
        isSaturday: isSaturday(date),
      });
    }

    // Create PDF
    const doc = new jsPDF();
    const monthName = format(selectedMonth, 'MMMM yyyy', { locale: dateLocale });
    
    // Title
    doc.setFontSize(18);
    doc.text(`${t('monthlyReportTitle')} - ${monthName}`, 14, 20);
    
    doc.setFontSize(10);
    doc.text(`${t('generatedOn')}: ${format(new Date(), 'dd-MM-yyyy HH:mm', { locale: dateLocale })}`, 14, 28);
    doc.text(`${t('allMechanicsReport')}`, 14, 34);
    
    let yPos = 46;
    
    // Sort mechanics by name
    const sortedMechanics = Array.from(mechanicData.entries()).sort((a, b) => 
      a[1].name.localeCompare(b[1].name)
    );
    
    // Table for each mechanic
    sortedMechanics.forEach(([mechanicId, data]) => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(data.name, 14, yPos);
      yPos += 8;
      
      // Sort days by date
      data.days.sort((a, b) => a.date.localeCompare(b.date));
      
      // Calculate total
      const totalHours = data.days.reduce((sum, d) => sum + d.hours, 0);
      
      const tableData = data.days.map(day => {
        const date = parseISO(day.date);
        const dayName = format(date, 'EEEE', { locale: dateLocale });
        const dateStr = format(date, 'dd-MM-yyyy', { locale: dateLocale });
        const hoursStr = `${Math.floor(day.hours)}:${String(Math.round((day.hours % 1) * 60)).padStart(2, '0')}`;
        return [dateStr, dayName, hoursStr, day.isSaturday ? '●' : ''];
      });
      
      // Add total row
      const totalHoursStr = `${Math.floor(totalHours)}:${String(Math.round((totalHours % 1) * 60)).padStart(2, '0')}`;
      tableData.push([t('total'), '', totalHoursStr, '']);
      
      autoTable(doc, {
        startY: yPos,
        head: [[t('date'), t('day'), t('hoursShort'), t('saturdayIndicator')]],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 9 },
        headStyles: { fillColor: [66, 139, 202] },
        didParseCell: (cellData) => {
          // Mark Saturday rows in red
          if (cellData.section === 'body' && cellData.row.index < tableData.length - 1) {
            const originalData = cellData.row.raw as string[];
            if (originalData[3] === '●') {
              cellData.cell.styles.textColor = [220, 53, 69];
              cellData.cell.styles.fontStyle = 'bold';
            }
          }
          // Bold the total row
          if (cellData.section === 'body' && cellData.row.index === tableData.length - 1) {
            cellData.cell.styles.fontStyle = 'bold';
            cellData.cell.styles.fillColor = [240, 240, 240];
          }
        },
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 15;
    });
    
    // Grand total at the end
    const grandTotal = sortedMechanics.reduce(
      (sum, [_, data]) => sum + data.days.reduce((s, d) => s + d.hours, 0),
      0
    );
    
    if (yPos > 260) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const grandTotalStr = `${Math.floor(grandTotal)}:${String(Math.round((grandTotal % 1) * 60)).padStart(2, '0')}`;
    doc.text(`${t('grandTotal')}: ${grandTotalStr} ${t('hoursShort')}`, 14, yPos);
    
    // Legend
    yPos += 15;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(220, 53, 69);
    doc.text(`● = ${t('saturdayLegend')}`, 14, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 6;
    doc.text(t('breakDeductionNote'), 14, yPos);
    
    // Save
    doc.save(`${t('monthlyReportFilename')}_${t('allMechanics')}_${format(selectedMonth, 'yyyy-MM')}.pdf`);
    toast.success(t('pdfGenerated'));
  };

  // Generate PDF report for selected mechanic
  const generatePDFReport = () => {
    if (!selectedMechanicId || !availabilities) return;

    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    
    // Get selected mechanic's availability in this month
    const monthlyData = availabilities.filter(a => 
      a.user_id === selectedMechanicId &&
      a.status === 'approved' &&
      isWithinInterval(parseISO(a.date), { start: monthStart, end: monthEnd })
    );

    // Group by mechanic (just one in this case)
    const mechanicData = new Map<string, { name: string; days: { date: string; hours: number; isSaturday: boolean }[] }>();
    
    for (const availability of monthlyData) {
      const mechanicId = availability.user_id;
      const mechanicName = availability.profiles?.full_name || t('unknown');
      
      if (!mechanicData.has(mechanicId)) {
        mechanicData.set(mechanicId, { name: mechanicName, days: [] });
      }
      
      const netMinutes = calculateNetHours(availability.start_time, availability.end_time);
      const date = parseISO(availability.date);
      
      mechanicData.get(mechanicId)!.days.push({
        date: availability.date,
        hours: netMinutes / 60,
        isSaturday: isSaturday(date),
      });
    }

    // Create PDF
    const doc = new jsPDF();
    const monthName = format(selectedMonth, 'MMMM yyyy', { locale: dateLocale });
    
    // Title
    doc.setFontSize(18);
    doc.text(`${t('monthlyReportTitle')} - ${monthName}`, 14, 20);
    
    doc.setFontSize(10);
    doc.text(`${t('generatedOn')}: ${format(new Date(), 'dd-MM-yyyy HH:mm', { locale: dateLocale })}`, 14, 28);
    
    let yPos = 40;
    
    // Table for each mechanic
    mechanicData.forEach((data, mechanicId) => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(data.name, 14, yPos);
      yPos += 8;
      
      // Sort days by date
      data.days.sort((a, b) => a.date.localeCompare(b.date));
      
      // Calculate total
      const totalHours = data.days.reduce((sum, d) => sum + d.hours, 0);
      
      const tableData = data.days.map(day => {
        const date = parseISO(day.date);
        const dayName = format(date, 'EEEE', { locale: dateLocale });
        const dateStr = format(date, 'dd-MM-yyyy', { locale: dateLocale });
        const hoursStr = `${Math.floor(day.hours)}:${String(Math.round((day.hours % 1) * 60)).padStart(2, '0')}`;
        return [dateStr, dayName, hoursStr, day.isSaturday ? '●' : ''];
      });
      
      // Add total row
      const totalHoursStr = `${Math.floor(totalHours)}:${String(Math.round((totalHours % 1) * 60)).padStart(2, '0')}`;
      tableData.push([t('total'), '', totalHoursStr, '']);
      
      autoTable(doc, {
        startY: yPos,
        head: [[t('date'), t('day'), t('hoursShort'), t('saturdayIndicator')]],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 9 },
        headStyles: { fillColor: [66, 139, 202] },
        didParseCell: (data) => {
          // Mark Saturday rows in red
          if (data.section === 'body' && data.row.index < tableData.length - 1) {
            const originalData = data.row.raw as string[];
            if (originalData[3] === '●') {
              data.cell.styles.textColor = [220, 53, 69];
              data.cell.styles.fontStyle = 'bold';
            }
          }
          // Bold the total row
          if (data.section === 'body' && data.row.index === tableData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [240, 240, 240];
          }
        },
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 15;
    });
    
    // Grand total at the end
    const grandTotal = Array.from(mechanicData.values()).reduce(
      (sum, data) => sum + data.days.reduce((s, d) => s + d.hours, 0),
      0
    );
    
    if (yPos > 260) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const grandTotalStr = `${Math.floor(grandTotal)}:${String(Math.round((grandTotal % 1) * 60)).padStart(2, '0')}`;
    doc.text(`${t('grandTotal')}: ${grandTotalStr} ${t('hoursShort')}`, 14, yPos);
    
    // Legend
    yPos += 15;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(220, 53, 69);
    doc.text(`● = ${t('saturdayLegend')}`, 14, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 6;
    doc.text(t('breakDeductionNote'), 14, yPos);
    
    // Save
    doc.save(`${t('monthlyReportFilename')}_${format(selectedMonth, 'yyyy-MM')}.pdf`);
    toast.success(t('pdfGenerated'));
  };

  // Filter mechanics based on search
  const filteredMechanics = useMemo(() => {
    if (!profiles) return [];
    if (!searchQuery.trim()) return profiles;
    const query = searchQuery.toLowerCase();
    return profiles.filter(p => 
      p.full_name.toLowerCase().includes(query) || 
      p.email.toLowerCase().includes(query)
    );
  }, [profiles, searchQuery]);

  // Get selected mechanic
  const selectedMechanic = useMemo(() => {
    return profiles?.find(p => p.id === selectedMechanicId) || null;
  }, [profiles, selectedMechanicId]);

  // Get availabilities for selected mechanic in selected month
  const mechanicMonthlyAvailabilities = useMemo(() => {
    if (!selectedMechanicId || !availabilities) return [];
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    return availabilities.filter(a => 
      a.user_id === selectedMechanicId && 
      a.status === 'approved' &&
      isWithinInterval(parseISO(a.date), { start: monthStart, end: monthEnd })
    );
  }, [availabilities, selectedMechanicId, selectedMonth]);

  // Calculate total hours for the month (with break deduction)
  const totalMonthlyHours = useMemo(() => {
    let totalMinutes = 0;
    for (const availability of mechanicMonthlyAvailabilities) {
      totalMinutes += calculateNetHours(availability.start_time, availability.end_time);
    }
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return { hours, minutes, totalMinutes };
  }, [mechanicMonthlyAvailabilities]);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(selectedWeekStart, i));
  const dayNamesShort = [
    t('mondayShort'), t('tuesdayShort'), t('wednesdayShort'),
    t('thursdayShort'), t('fridayShort'), t('saturdayShort'), t('sundayShort')
  ];

  const getAvailabilitiesForDate = (date: Date) => {
    return availabilities?.filter(a => isSameDay(new Date(a.date), date)) || [];
  };

  const getAvailabilitiesForWeek = () => {
    const weekEnd = addDays(selectedWeekStart, 6);
    return availabilities?.filter(a => {
      const availDate = new Date(a.date);
      return isWithinInterval(availDate, { start: selectedWeekStart, end: weekEnd });
    }) || [];
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="default" className="bg-primary">{t('approved')}</Badge>;
      case 'rejected':
        return <Badge variant="destructive">{t('rejected')}</Badge>;
      default:
        return <Badge variant="secondary">{t('pending')}</Badge>;
    }
  };

  const pendingCount = availabilities?.filter(a => a.status === 'pending').length || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t('availability')}
              {pendingCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {pendingCount} {t('pending')}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>{t('allMechanics')}</CardDescription>
          </div>
          <div className="overflow-x-auto pb-2">
            <Tabs value={viewType} onValueChange={(v) => setViewType(v as 'week' | 'day' | 'month')}>
              <TabsList className="inline-flex w-max">
                <TabsTrigger value="week" className="text-xs sm:text-sm">{t('weekView')}</TabsTrigger>
                <TabsTrigger value="day" className="text-xs sm:text-sm">{t('dayView')}</TabsTrigger>
                <TabsTrigger value="month" className="text-xs sm:text-sm">{t('monthlyOverview')}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {viewType === 'week' ? (
          <div>
            {/* Week navigation */}
            <div className="flex items-center justify-between mb-4 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedWeekStart(subWeeks(selectedWeekStart, 1))}
                className="text-xs sm:text-sm"
              >
                <ChevronLeft className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">{t('previousWeek')}</span>
              </Button>
              <div className="font-medium text-xs sm:text-sm text-center">
                {format(selectedWeekStart, 'd MMM', { locale: dateLocale })} - {format(addDays(selectedWeekStart, 6), 'd MMM yyyy', { locale: dateLocale })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedWeekStart(addWeeks(selectedWeekStart, 1))}
                className="text-xs sm:text-sm"
              >
                <span className="hidden sm:inline">{t('nextWeek')}</span>
                <ChevronRight className="h-4 w-4 sm:ml-1" />
              </Button>
            </div>

            {/* Week grid - list view on mobile, grid on desktop */}
            <div className="hidden sm:block overflow-x-auto pb-2">
              <div className="grid grid-cols-7 gap-2 min-w-[600px]">
                {weekDays.map((day, index) => {
                  const dayAvailabilities = getAvailabilitiesForDate(day);
                  const isToday = isSameDay(day, new Date());
                  const isSaturdayDay = isSaturday(day);
                  
                  return (
                    <div
                      key={index}
                      className={cn(
                        "p-2 rounded-lg border min-h-[150px]",
                        isToday && "border-primary bg-primary/5",
                        isSaturdayDay && "bg-destructive/5 border-destructive/30"
                      )}
                    >
                      <div className={cn(
                        "text-xs font-medium text-muted-foreground text-center",
                        isSaturdayDay && "text-destructive"
                      )}>
                        {dayNamesShort[index]}
                      </div>
                      <div className={cn(
                        "text-lg font-semibold text-center mb-2",
                        isToday && "text-primary",
                        isSaturdayDay && "text-destructive"
                      )}>
                        {format(day, 'd')}
                      </div>
                      
                      {dayAvailabilities.length > 0 ? (
                        <div className="space-y-1">
                          {dayAvailabilities.map((availability) => (
                            <div
                              key={availability.id}
                              className={cn(
                                "p-1.5 rounded text-xs border",
                                availability.status === 'approved' && "bg-primary/10 border-primary/30",
                                availability.status === 'rejected' && "bg-destructive/10 border-destructive/30",
                                availability.status === 'pending' && "bg-secondary border-secondary"
                              )}
                            >
                              <div className="font-medium truncate">
                                {availability.profiles?.full_name || t('unknown')}
                              </div>
                              <div className="text-muted-foreground">
                                {availability.start_time.slice(0, 5)}-{availability.end_time.slice(0, 5)}
                              </div>
                              <div className="flex gap-1 mt-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 bg-muted hover:bg-muted/80"
                                  onClick={() => handleEditClick(availability)}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                {availability.status === 'pending' && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 bg-primary/20 hover:bg-primary/30"
                                      onClick={() => updateStatusMutation.mutate({ id: availability.id, status: 'approved' })}
                                    >
                                      <Check className="h-3 w-3 text-primary" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 bg-destructive/20 hover:bg-destructive/30"
                                      onClick={() => updateStatusMutation.mutate({ id: availability.id, status: 'rejected' })}
                                    >
                                      <X className="h-3 w-3 text-destructive" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground text-center py-2">-</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mobile week view - vertical list */}
            <div className="sm:hidden space-y-2">
              {weekDays.map((day, index) => {
                const dayAvailabilities = getAvailabilitiesForDate(day);
                const isToday = isSameDay(day, new Date());
                const isSaturdayDay = isSaturday(day);
                
                return (
                  <div
                    key={index}
                    className={cn(
                      "p-3 rounded-lg border",
                      isToday && "border-primary bg-primary/5",
                      isSaturdayDay && "bg-destructive/5 border-destructive/30"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className={cn(
                        "font-medium",
                        isToday && "text-primary",
                        isSaturdayDay && "text-destructive"
                      )}>
                        {dayNamesShort[index]} {format(day, 'd MMM', { locale: dateLocale })}
                      </div>
                      {dayAvailabilities.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {dayAvailabilities.length}
                        </Badge>
                      )}
                    </div>
                    
                    {dayAvailabilities.length > 0 ? (
                      <div className="space-y-2">
                        {dayAvailabilities.map((availability) => (
                          <div
                            key={availability.id}
                            className={cn(
                              "p-2 rounded border flex items-center justify-between gap-2",
                              availability.status === 'approved' && "bg-primary/10 border-primary/30",
                              availability.status === 'rejected' && "bg-destructive/10 border-destructive/30",
                              availability.status === 'pending' && "bg-secondary border-secondary"
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm truncate">
                                {availability.profiles?.full_name || t('unknown')}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {availability.start_time.slice(0, 5)} - {availability.end_time.slice(0, 5)}
                              </div>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 bg-muted hover:bg-muted/80"
                                onClick={() => handleEditClick(availability)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              {availability.status === 'pending' && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 bg-primary/20 hover:bg-primary/30"
                                    onClick={() => updateStatusMutation.mutate({ id: availability.id, status: 'approved' })}
                                  >
                                    <Check className="h-4 w-4 text-primary" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 bg-destructive/20 hover:bg-destructive/30"
                                    onClick={() => updateStatusMutation.mutate({ id: availability.id, status: 'rejected' })}
                                  >
                                    <X className="h-4 w-4 text-destructive" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">-</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Summary for the week */}
            <div className="mt-6 p-4 rounded-lg bg-muted/50">
              <h4 className="font-medium mb-3">{t('overview')}</h4>
              {getAvailabilitiesForWeek().length > 0 ? (
                <div className="grid gap-2">
                  {getAvailabilitiesForWeek()
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map((availability) => {
                      const date = new Date(availability.date);
                      const isSaturdayDay = isSaturday(date);
                      
                      return (
                        <div
                          key={availability.id}
                          className={cn(
                            "flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded bg-background border gap-2",
                            isSaturdayDay && "bg-destructive/5 border-destructive/30"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className="min-w-0 flex-1">
                              <div className={cn("font-medium text-sm", isSaturdayDay && "text-destructive")}>
                                {availability.profiles?.full_name}
                              </div>
                              <div className={cn("text-xs text-muted-foreground", isSaturdayDay && "text-destructive/70")}>
                                {format(date, 'EEE d MMM', { locale: dateLocale })} • {availability.start_time.slice(0, 5)} - {availability.end_time.slice(0, 5)}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {getStatusBadge(availability.status)}
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleEditClick(availability)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            {availability.status === 'pending' && (
                              <div className="flex gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => updateStatusMutation.mutate({ id: availability.id, status: 'approved' })}
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs text-destructive"
                                  onClick={() => updateStatusMutation.mutate({ id: availability.id, status: 'rejected' })}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="text-muted-foreground text-center py-4">{t('noAvailability')}</div>
              )}
            </div>
          </div>
        ) : viewType === 'day' ? (
          <div className="space-y-4">
            {/* Navigation buttons */}
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(addDays(selectedDate, -1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="font-medium text-sm sm:text-base text-center">
                {format(selectedDate, 'd MMM yyyy', { locale: dateLocale })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(new Date())}
              >
                {t('today') || 'Vandaag'}
              </Button>
            </div>

            {/* Day details */}
            <div>
              <h4 className={cn(
                "font-medium mb-3 text-base sm:text-lg",
                isSaturday(selectedDate) && "text-destructive"
              )}>
                {format(selectedDate, 'EEEE d MMMM yyyy', { locale: dateLocale })}
                {isSaturday(selectedDate) && <Badge variant="destructive" className="ml-2">{t('saturday')}</Badge>}
              </h4>
              {getAvailabilitiesForDate(selectedDate).length > 0 ? (
                <div className="space-y-3">
                  {getAvailabilitiesForDate(selectedDate).map((availability) => (
                    <div
                      key={availability.id}
                      className="p-3 rounded-lg border bg-card"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div className="font-medium">{availability.profiles?.full_name}</div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {getStatusBadge(availability.status)}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditClick(availability)}
                          >
                            <Edit className="h-3 w-3 sm:mr-1" />
                            <span className="hidden sm:inline">{t('edit')}</span>
                          </Button>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {availability.start_time.slice(0, 5)} - {availability.end_time.slice(0, 5)}
                      </div>
                      {availability.notes && (
                        <div className="text-sm mt-2 p-2 rounded bg-muted">
                          {availability.notes}
                        </div>
                      )}
                      {availability.status === 'pending' && (
                        <div className="flex gap-2 mt-3 flex-wrap">
                          <Button
                            size="sm"
                            onClick={() => updateStatusMutation.mutate({ id: availability.id, status: 'approved' })}
                          >
                            <Check className="h-4 w-4 sm:mr-1" />
                            <span className="hidden sm:inline">{t('approve')}</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive"
                            onClick={() => updateStatusMutation.mutate({ id: availability.id, status: 'rejected' })}
                          >
                            <X className="h-4 w-4 sm:mr-1" />
                            <span className="hidden sm:inline">{t('reject')}</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground border rounded-lg">
                  {t('noAvailabilityForDate')}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Monthly overview with mechanic search */
          <div className="space-y-6">
            {/* Month navigation + Download all button */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
                  className="text-xs sm:text-sm"
                >
                  <ChevronLeft className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">{t('previousMonth')}</span>
                </Button>
                <div className="font-medium text-sm sm:text-lg px-2 sm:px-4">
                  {format(selectedMonth, 'MMM yyyy', { locale: dateLocale })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
                  className="text-xs sm:text-sm"
                >
                  <span className="hidden sm:inline">{t('nextMonth')}</span>
                  <ChevronRight className="h-4 w-4 sm:ml-1" />
                </Button>
              </div>
              <Button onClick={generateAllMechanicsPDFReport} variant="default" size="sm" className="text-xs sm:text-sm w-full sm:w-auto">
                <Download className="h-4 w-4 mr-2" />
                {t('downloadAllMechanicsPDF')}
              </Button>
            </div>

            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('searchMechanicPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Mechanic list */}
            {searchQuery && (
              <div className="border rounded-lg max-h-48 overflow-auto">
                {filteredMechanics.length > 0 ? (
                  filteredMechanics.map((mechanic) => (
                    <button
                      key={mechanic.id}
                      className={cn(
                        "w-full p-3 text-left hover:bg-muted/50 flex items-center gap-3 border-b last:border-b-0 transition-colors",
                        selectedMechanicId === mechanic.id && "bg-primary/10"
                      )}
                      onClick={() => {
                        setSelectedMechanicId(mechanic.id);
                        setSearchQuery('');
                      }}
                    >
                      <UserCircle className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{mechanic.full_name}</div>
                        <div className="text-sm text-muted-foreground">{mechanic.email}</div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    {t('unknown')}
                  </div>
                )}
              </div>
            )}

            {/* Selected mechanic overview */}
            {selectedMechanic ? (
              <div className="space-y-4">
                {/* Mechanic header */}
                <div className="flex items-center justify-between p-3 sm:p-4 bg-muted/50 rounded-lg gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <UserCircle className="h-8 w-8 sm:h-10 sm:w-10 text-primary shrink-0" />
                    <div className="min-w-0">
                      <div className="font-semibold text-base sm:text-lg truncate">{selectedMechanic.full_name}</div>
                      <div className="text-xs sm:text-sm text-muted-foreground truncate">{selectedMechanic.email}</div>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="shrink-0"
                    onClick={() => setSelectedMechanicId(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Month navigation */}
                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
                  >
                    <ChevronLeft className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">{t('previousMonth')}</span>
                  </Button>
                  <div className="font-medium text-sm sm:text-lg text-center">
                    {format(selectedMonth, 'MMM yyyy', { locale: dateLocale })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
                  >
                    <span className="hidden sm:inline">{t('nextMonth')}</span>
                    <ChevronRight className="h-4 w-4 sm:ml-1" />
                  </Button>
                </div>

                {/* Total hours summary - stacked on mobile */}
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="pt-4 sm:pt-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-primary shrink-0" />
                        <div>
                          <div className="text-xs sm:text-sm text-muted-foreground">{t('totalHoursWorked')}</div>
                          <div className="text-xl sm:text-3xl font-bold text-primary">
                            {totalMonthlyHours.hours}:{String(totalMonthlyHours.minutes).padStart(2, '0')} {t('hoursShort')}
                          </div>
                          <div className="text-xs text-muted-foreground">{t('breakDeductionNote')}</div>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <Badge variant="secondary" className="text-sm sm:text-lg px-3 sm:px-4 py-1.5 sm:py-2 text-center">
                          {mechanicMonthlyAvailabilities.length} {t('approvedHours')}
                        </Badge>
                        <Button onClick={generatePDFReport} variant="outline" size="sm" className="w-full sm:w-auto">
                          <Download className="h-4 w-4 mr-2" />
                          {t('downloadPDF')}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Daily breakdown */}
                {mechanicMonthlyAvailabilities.length > 0 ? (
                  <div className="border rounded-lg divide-y">
                    {mechanicMonthlyAvailabilities
                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                      .map((availability) => {
                        const netMinutes = calculateNetHours(availability.start_time, availability.end_time);
                        const hours = Math.floor(netMinutes / 60);
                        const mins = netMinutes % 60;
                        const date = parseISO(availability.date);
                        const isSaturdayDay = isSaturday(date);
                        
                        // Calculate gross hours for comparison
                        const [startH, startM] = availability.start_time.split(':').map(Number);
                        const [endH, endM] = availability.end_time.split(':').map(Number);
                        const grossMinutes = (endH * 60 + endM) - (startH * 60 + startM);
                        const hasBreakDeduction = grossMinutes > 360;
                        
                        return (
                          <div 
                            key={availability.id}
                            className={cn(
                              "p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2",
                              isSaturdayDay && "bg-destructive/5"
                            )}
                          >
                            <div className="min-w-0">
                              <div className={cn("font-medium text-sm sm:text-base flex flex-wrap items-center gap-1", isSaturdayDay && "text-destructive")}>
                                <span className="truncate">{format(date, 'EEE d MMM', { locale: dateLocale })}</span>
                                {isSaturdayDay && <Badge variant="destructive" className="text-xs">{t('saturday')}</Badge>}
                              </div>
                              <div className={cn("text-xs sm:text-sm text-muted-foreground flex items-center gap-1 sm:gap-2 flex-wrap", isSaturdayDay && "text-destructive/70")}>
                                <Clock className="h-3 w-3 shrink-0" />
                                <span>{availability.start_time.slice(0, 5)} - {availability.end_time.slice(0, 5)}</span>
                                {hasBreakDeduction && (
                                  <span className="text-xs text-warning">(-30m)</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-2">
                              <div className="flex items-center gap-2">
                                <div className={cn("font-semibold text-sm sm:text-base", isSaturdayDay ? "text-destructive" : "text-primary")}>
                                  {hours}:{String(mins).padStart(2, '0')}
                                </div>
                                {getStatusBadge(availability.status)}
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3"
                                onClick={() => handleEditClick(availability)}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground border rounded-lg">
                    {t('noWorkInMonth')}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground border rounded-lg">
                <UserCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>{t('selectMechanicToView')}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editAvailability')}</DialogTitle>
            <DialogDescription>
              {editingAvailability && (
                <span>
                  {editingAvailability.profiles?.full_name} - {format(parseISO(editingAvailability.date), 'EEEE d MMMM yyyy', { locale: dateLocale })}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('startTime')}</Label>
                <Input
                  type="time"
                  value={editFormData.startTime}
                  onChange={(e) => setEditFormData({ ...editFormData, startTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('endTime')}</Label>
                <Input
                  type="time"
                  value={editFormData.endTime}
                  onChange={(e) => setEditFormData({ ...editFormData, endTime: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('notes')}</Label>
              <Textarea
                placeholder={t('notesPlaceholder')}
                value={editFormData.notes}
                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateAvailabilityMutation.isPending}>
              {updateAvailabilityMutation.isPending ? t('processing') : t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
