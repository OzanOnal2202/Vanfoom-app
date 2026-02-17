import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { Tables } from '@/integrations/supabase/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, Loader2, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';

interface ChecklistItem {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
}

interface CompletionChecklistDialogProps {
  bikeId: string;
  bikeFrameNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function CompletionChecklistDialog({
  bikeId,
  bikeFrameNumber,
  open,
  onOpenChange,
  onComplete,
}: CompletionChecklistDialogProps) {
  const { user, role } = useAuth();
  const { t } = useLanguage();
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [checkingAll, setCheckingAll] = useState(false);

  const isAdmin = role === 'admin';

  useEffect(() => {
    if (open) {
      fetchChecklistData();
    }
  }, [open, bikeId]);

  const fetchChecklistData = async () => {
    setLoading(true);
    
    // Fetch all active checklist items
    const { data: items } = await supabase
      .from('completion_checklist_items')
      .select('id, name, description, sort_order')
      .eq('is_active', true)
      .order('sort_order');

    // Fetch already completed items for this bike
    const { data: completions } = await supabase
      .from('bike_checklist_completions')
      .select('checklist_item_id')
      .eq('bike_id', bikeId);

    if (items) {
      setChecklistItems(items);
    }

    if (completions) {
      setCompletedItems(new Set(completions.map(c => c.checklist_item_id)));
    }

    setLoading(false);
  };

  const handleToggleItem = async (itemId: string, checked: boolean) => {
    if (!user) return;

    if (checked) {
      // Add completion
      const { error } = await supabase
        .from('bike_checklist_completions')
        .insert({
          bike_id: bikeId,
          checklist_item_id: itemId,
          completed_by: user.id,
        });

      if (!error) {
        setCompletedItems(prev => new Set([...prev, itemId]));
      }
    } else {
      // Remove completion
      const { error } = await supabase
        .from('bike_checklist_completions')
        .delete()
        .eq('bike_id', bikeId)
        .eq('checklist_item_id', itemId);

      if (!error) {
        setCompletedItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(itemId);
          return newSet;
        });
      }
    }
  };

  const handleComplete = async () => {
    if (completedItems.size < checklistItems.length) {
      toast.error(t('checkAllBeforeComplete'));
      return;
    }

    setSubmitting(true);

    // Mark all pending work_registrations as completed
    const { error: regError } = await supabase
      .from('work_registrations')
      .update({ 
        completed: true, 
        completed_at: new Date().toISOString(),
        mechanic_id: user?.id || null,
      })
      .eq('bike_id', bikeId)
      .eq('completed', false);

    if (regError) {
      console.error('Error completing work registrations:', regError);
    }

    // Update bike status to afgerond
    const { error } = await supabase
      .from('bikes')
      .update({ workflow_status: 'afgerond' as const })
      .eq('id', bikeId);

    if (error) {
      toast.error(t('errorCompletingBike'));
      setSubmitting(false);
      return;
    }

    toast.success(t('bikeCompletedSuccess'));
    setSubmitting(false);
    onOpenChange(false);
    onComplete();
  };

  const handleCheckAllItems = async () => {
    if (!user || !isAdmin) return;
    
    setCheckingAll(true);
    
    // Find unchecked items
    const uncheckedItems = checklistItems.filter(item => !completedItems.has(item.id));
    
    if (uncheckedItems.length === 0) {
      setCheckingAll(false);
      return;
    }
    
    // Insert all unchecked items at once
    const insertData = uncheckedItems.map(item => ({
      bike_id: bikeId,
      checklist_item_id: item.id,
      completed_by: user.id,
    }));
    
    const { error } = await supabase
      .from('bike_checklist_completions')
      .insert(insertData);
    
    if (!error) {
      // Update local state with all items checked
      const allItemIds = new Set(checklistItems.map(item => item.id));
      setCompletedItems(allItemIds);
      toast.success(t('allItemsChecked'));
    } else {
      toast.error(t('errorCheckingItems'));
    }
    
    setCheckingAll(false);
  };

  const allItemsCompleted = completedItems.size >= checklistItems.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            {t('completionChecklist')}
          </DialogTitle>
          <DialogDescription>
            {t('checkAllItems')} <span className="font-mono font-medium">{bikeFrameNumber}</span> {t('toComplete')}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="max-h-[400px] pr-4">
            <div className="space-y-4">
              {checklistItems.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
                    completedItems.has(item.id)
                      ? 'bg-primary/5 border-primary/20'
                      : 'bg-background border-border'
                  }`}
                >
                  <Checkbox
                    id={item.id}
                    checked={completedItems.has(item.id)}
                    onCheckedChange={(checked) => handleToggleItem(item.id, checked as boolean)}
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor={item.id}
                      className={`font-medium cursor-pointer ${
                        completedItems.has(item.id) ? 'line-through text-muted-foreground' : ''
                      }`}
                    >
                      {item.name}
                    </Label>
                    {item.description && (
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="text-sm text-muted-foreground">
            {completedItems.size} {t('of')} {checklistItems.length} {t('itemsChecked')}
          </div>
          <div className="flex gap-2">
            {isAdmin && !allItemsCompleted && (
              <Button
                variant="secondary"
                onClick={handleCheckAllItems}
                disabled={checkingAll || loading}
              >
                {checkingAll ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCheck className="h-4 w-4 mr-2" />
                )}
                {t('checkAll')}
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleComplete}
              disabled={!allItemsCompleted || submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('processing')}
                </>
              ) : (
                t('completeBike')
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
