import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type FeaturePermission = 
  | 'inventory'
  | 'pricelist'
  | 'tv_announcements'
  | 'warranty'
  | 'call_status'
  | 'availability';

export function usePermissions() {
  const { user, role } = useAuth();
  const [permissions, setPermissions] = useState<FeaturePermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPermissions([]);
      setLoading(false);
      return;
    }

    // Admins have all permissions
    if (role === 'admin') {
      setPermissions(['inventory', 'pricelist', 'tv_announcements', 'warranty', 'call_status', 'availability']);
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      const { data } = await supabase
        .from('user_permissions')
        .select('permission')
        .eq('user_id', user.id);

      setPermissions((data?.map(d => d.permission) || []) as FeaturePermission[]);
      setLoading(false);
    };

    fetchPermissions();
  }, [user, role]);

  const hasPermission = (perm: FeaturePermission) => {
    if (role === 'admin') return true;
    return permissions.includes(perm);
  };

  return { permissions, hasPermission, loading };
}
