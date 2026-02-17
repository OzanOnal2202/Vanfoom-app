import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Shield, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AdminPromotionProps {
  onSuccess?: () => void;
}

export function AdminPromotion({ onSuccess }: AdminPromotionProps) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password.trim()) {
      toast({
        title: 'Fout',
        description: 'Voer een wachtwoord in',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: 'Fout',
          description: 'Je moet ingelogd zijn',
          variant: 'destructive',
        });
        return;
      }

      const response = await supabase.functions.invoke('promote-to-admin', {
        body: { password },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;

      if (data.success) {
        toast({
          title: 'Succes!',
          description: data.message,
        });
        setOpen(false);
        setPassword('');
        onSuccess?.();
        // Refresh the page to update the role
        window.location.reload();
      } else if (data.error) {
        toast({
          title: 'Fout',
          description: data.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Info',
          description: data.message,
        });
        setOpen(false);
      }
    } catch (error: any) {
      console.error('Error promoting to admin:', error);
      toast({
        title: 'Fout',
        description: error.message || 'Er is een fout opgetreden',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Shield className="h-4 w-4 mr-2" />
          Word Admin
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Admin Worden</DialogTitle>
          <DialogDescription>
            Voer het admin wachtwoord in om jezelf te promoveren naar admin.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-password">Wachtwoord</Label>
            <Input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Voer het admin wachtwoord in"
              disabled={loading}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Annuleren
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Bevestigen
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
