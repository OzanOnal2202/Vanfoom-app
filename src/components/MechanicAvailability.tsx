import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format, startOfWeek, addDays, isSameDay, isBefore, startOfDay } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';
import { CalendarIcon, Plus, Trash2, Clock, CheckCircle, XCircle, AlertCircle, CalendarDays, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Availability {
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
}

export function MechanicAvailability() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const dateLocale = language === 'nl' ? nl : enUS;
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMultiDayDialogOpen, setIsMultiDayDialogOpen] = useState(false);
  const [editingAvailability, setEditingAvailability] = useState<Availability | null>(null);
  const [formData, setFormData] = useState({
    date: new Date(),
    startTime: '09:00',
    endTime: '17:00',
    notes: '',
  });
  
  // Multi-day selection state
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [multiDayFormData, setMultiDayFormData] = useState({
    startTime: '09:00',
    endTime: '17:00',
    notes: '',
  });

  // Fetch user's availability
  const { data: availabilities, isLoading } = useQuery({
    queryKey: ['mechanic-availability', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('mechanic_availability')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: true });
      if (error) throw error;
      return data as Availability[];
    },
    enabled: !!user?.id,
  });

  // Save availability mutation
  const saveMutation = useMutation({
    mutationFn: async (data: { date: string; startTime: string; endTime: string; notes: string }) => {
      if (!user?.id) throw new Error('Not logged in');
      
      const payload = {
        user_id: user.id,
        date: data.date,
        start_time: data.startTime,
        end_time: data.endTime,
        notes: data.notes || null,
        status: 'pending' as const,
      };

      if (editingAvailability) {
        const { error } = await supabase
          .from('mechanic_availability')
          .update(payload)
          .eq('id', editingAvailability.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('mechanic_availability')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(t('availabilitySaved'));
      queryClient.invalidateQueries({ queryKey: ['mechanic-availability'] });
      setIsDialogOpen(false);
      setEditingAvailability(null);
      resetForm();
    },
    onError: () => {
      toast.error(t('errorSavingAvailability'));
    },
  });

  // Save multiple days mutation
  const saveMultipleDaysMutation = useMutation({
    mutationFn: async (data: { dates: Date[]; startTime: string; endTime: string; notes: string }) => {
      if (!user?.id) throw new Error('Not logged in');
      
      const payloads = data.dates.map(date => ({
        user_id: user.id,
        date: format(date, 'yyyy-MM-dd'),
        start_time: data.startTime,
        end_time: data.endTime,
        notes: data.notes || null,
        status: 'pending' as const,
      }));

      const { error } = await supabase
        .from('mechanic_availability')
        .insert(payloads);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success(`${variables.dates.length} ${t('availabilitySaved')}`);
      queryClient.invalidateQueries({ queryKey: ['mechanic-availability'] });
      setIsMultiDayDialogOpen(false);
      setSelectedDates([]);
      setMultiDayFormData({
        startTime: '09:00',
        endTime: '17:00',
        notes: '',
      });
    },
    onError: () => {
      toast.error(t('errorSavingAvailability'));
    },
  });

  // Delete availability mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('mechanic_availability')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('availabilityDeleted'));
      queryClient.invalidateQueries({ queryKey: ['mechanic-availability'] });
    },
    onError: () => {
      toast.error(t('errorDeletingAvailability'));
    },
  });

  const resetForm = () => {
    setFormData({
      date: new Date(),
      startTime: '09:00',
      endTime: '17:00',
      notes: '',
    });
  };

  const handleAddClick = () => {
    resetForm();
    setEditingAvailability(null);
    setIsDialogOpen(true);
  };

  const handleMultiDayClick = () => {
    setSelectedDates([]);
    setMultiDayFormData({
      startTime: '09:00',
      endTime: '17:00',
      notes: '',
    });
    setIsMultiDayDialogOpen(true);
  };

  const handleEditClick = (availability: Availability) => {
    setEditingAvailability(availability);
    setFormData({
      date: new Date(availability.date),
      startTime: availability.start_time.slice(0, 5),
      endTime: availability.end_time.slice(0, 5),
      notes: availability.notes || '',
    });
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    saveMutation.mutate({
      date: format(formData.date, 'yyyy-MM-dd'),
      startTime: formData.startTime,
      endTime: formData.endTime,
      notes: formData.notes,
    });
  };

  const handleSaveMultipleDays = () => {
    if (selectedDates.length === 0) {
      toast.error(t('selectDates'));
      return;
    }
    saveMultipleDaysMutation.mutate({
      dates: selectedDates,
      startTime: multiDayFormData.startTime,
      endTime: multiDayFormData.endTime,
      notes: multiDayFormData.notes,
    });
  };

  // Handle multi-day calendar selection
  const handleMultiDaySelect = (date: Date | undefined) => {
    if (!date) return;
    
    // Don't allow selecting past dates
    if (isBefore(date, startOfDay(new Date()))) return;
    
    // Check if date is already selected
    const existingIndex = selectedDates.findIndex(d => isSameDay(d, date));
    
    if (existingIndex >= 0) {
      // Remove date
      setSelectedDates(prev => prev.filter((_, i) => i !== existingIndex));
    } else {
      // Add date
      setSelectedDates(prev => [...prev, date].sort((a, b) => a.getTime() - b.getTime()));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge variant="default" className="bg-primary hover:bg-primary/90">
            <CheckCircle className="h-3 w-3 mr-1" />
            {t('approved')}
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            {t('rejected')}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <AlertCircle className="h-3 w-3 mr-1" />
            {t('pending')}
          </Badge>
        );
    }
  };

  // Get week days for the calendar header
  const weekStart = startOfWeek(selectedDate || new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Get availabilities for each day
  const getAvailabilityForDate = (date: Date) => {
    return availabilities?.find(a => isSameDay(new Date(a.date), date));
  };

  // Check if date is already taken
  const isDateTaken = (date: Date) => {
    return availabilities?.some(a => isSameDay(new Date(a.date), date)) || false;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {t('myAvailability')}
            </CardTitle>
            <CardDescription>{t('setAvailability')}</CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleMultiDayClick} className="text-xs sm:text-sm">
              <CalendarDays className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('addMultipleDays')}</span>
            </Button>
            <Button size="sm" onClick={handleAddClick} className="text-xs sm:text-sm">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('addAvailability')}</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Week view - hidden on mobile, shown on tablet+ */}
        <div className="hidden sm:grid grid-cols-7 gap-2 mb-6">
          {weekDays.map((day, index) => {
            const availability = getAvailabilityForDate(day);
            const isToday = isSameDay(day, new Date());
            const dayNames = [
              t('mondayShort'), t('tuesdayShort'), t('wednesdayShort'),
              t('thursdayShort'), t('fridayShort'), t('saturdayShort'), t('sundayShort')
            ];
            
            return (
              <div
                key={index}
                className={cn(
                  "p-2 rounded-lg border text-center min-h-[100px]",
                  isToday && "border-primary bg-primary/5",
                  availability?.status === 'approved' && "bg-primary/10 border-primary/30",
                  availability?.status === 'rejected' && "bg-destructive/10 border-destructive/30",
                  availability?.status === 'pending' && "bg-secondary border-secondary/30"
                )}
              >
                <div className="text-xs font-medium text-muted-foreground">
                  {dayNames[index]}
                </div>
                <div className={cn("text-lg font-semibold", isToday && "text-primary")}>
                  {format(day, 'd')}
                </div>
                {availability && (
                  <div className="mt-2 space-y-1">
                    <div className="text-xs">
                      {availability.start_time.slice(0, 5)} - {availability.end_time.slice(0, 5)}
                    </div>
                    <div className="flex justify-center">
                      {getStatusBadge(availability.status)}
                    </div>
                    {availability.status === 'pending' && (
                      <div className="flex justify-center gap-1 mt-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleEditClick(availability)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={() => deleteMutation.mutate(availability.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* List of all availabilities */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm text-muted-foreground mb-3">{t('overview')}</h4>
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground">{t('loading')}</div>
          ) : availabilities && availabilities.length > 0 ? (
            <div className="space-y-2">
              {availabilities.map((availability) => (
                <div
                  key={availability.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border bg-card gap-2"
                >
                  <div className="flex items-start sm:items-center gap-3 sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm sm:text-base">
                        {format(new Date(availability.date), 'EEEE d MMMM yyyy', { locale: dateLocale })}
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        {availability.start_time.slice(0, 5)} - {availability.end_time.slice(0, 5)}
                        {availability.notes && ` • ${availability.notes}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 justify-between sm:justify-end">
                    {getStatusBadge(availability.status)}
                    {availability.status === 'pending' && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEditClick(availability)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => deleteMutation.mutate(availability.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">{t('noAvailability')}</div>
          )}
        </div>

        {/* Add/Edit Single Day Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingAvailability ? t('editAvailability') : t('addAvailability')}
              </DialogTitle>
              <DialogDescription>
                {t('setAvailability')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t('date')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(formData.date, 'PPP', { locale: dateLocale })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.date}
                      onSelect={(date) => date && setFormData({ ...formData, date })}
                      locale={dateLocale}
                      disabled={(date) => isBefore(date, startOfDay(new Date()))}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('startTime')}</Label>
                  <Input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('endTime')}</Label>
                  <Input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('notes')}</Label>
                <Textarea
                  placeholder={t('notesPlaceholder')}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                {t('cancel')}
              </Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? t('processing') : t('save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Multi-Day Dialog */}
        <Dialog open={isMultiDayDialogOpen} onOpenChange={setIsMultiDayDialogOpen}>
          <DialogContent className="max-w-sm sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader className="pb-2">
              <DialogTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4" />
                {t('addMultipleDays')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {/* Calendar for multi-day selection */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">{t('selectDates')}</Label>
                  {selectedDates.length > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-xs"
                      onClick={() => setSelectedDates([])}
                    >
                      {t('clearSelection')}
                    </Button>
                  )}
                </div>
                <Calendar
                  mode="single"
                  selected={undefined}
                  onSelect={handleMultiDaySelect}
                  locale={dateLocale}
                  disabled={(date) => isBefore(date, startOfDay(new Date())) || isDateTaken(date)}
                  modifiers={{
                    selected: selectedDates,
                  }}
                  modifiersClassNames={{
                    selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                  }}
                  className="rounded-md border mx-auto pointer-events-auto"
                />
              </div>

              {/* Selected dates display */}
              {selectedDates.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-sm">{t('selectedDays')} ({selectedDates.length})</Label>
                  <div className="flex flex-wrap gap-1 max-h-16 overflow-auto">
                    {selectedDates.map((date, index) => (
                      <Badge 
                        key={index} 
                        variant="secondary"
                        className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground text-xs py-0.5"
                        onClick={() => setSelectedDates(prev => prev.filter((_, i) => i !== index))}
                      >
                        {format(date, 'd MMM', { locale: dateLocale })}
                        <span className="ml-1">×</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Time settings */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t('startTime')}</Label>
                  <Input
                    type="time"
                    className="h-9"
                    value={multiDayFormData.startTime}
                    onChange={(e) => setMultiDayFormData({ ...multiDayFormData, startTime: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t('endTime')}</Label>
                  <Input
                    type="time"
                    className="h-9"
                    value={multiDayFormData.endTime}
                    onChange={(e) => setMultiDayFormData({ ...multiDayFormData, endTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-sm">{t('notes')}</Label>
                <Textarea
                  placeholder={t('notesPlaceholder')}
                  className="min-h-[60px]"
                  value={multiDayFormData.notes}
                  onChange={(e) => setMultiDayFormData({ ...multiDayFormData, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter className="flex-row gap-2 pt-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setIsMultiDayDialogOpen(false)}>
                {t('cancel')}
              </Button>
              <Button 
                size="sm"
                className="flex-1"
                onClick={handleSaveMultipleDays} 
                disabled={saveMultipleDaysMutation.isPending || selectedDates.length === 0}
              >
                {saveMultipleDaysMutation.isPending ? t('processing') : `${t('save')} (${selectedDates.length})`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
