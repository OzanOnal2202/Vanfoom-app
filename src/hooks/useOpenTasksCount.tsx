import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useOpenTasksCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;

    const fetchCount = async () => {
      // Count tasks assigned to the current user that are not completed and not rejected
      const { count: taskCount, error } = await supabase
        .from('foh_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', user.id)
        .neq('status', 'afgerond')
        .is('rejected_at', null);

      if (!error && taskCount !== null) {
        setCount(taskCount);
      }
    };

    fetchCount();

    // Set up realtime subscription
    const channel = supabase
      .channel('open-tasks-count')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'foh_tasks' },
        () => {
          fetchCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return count;
}
