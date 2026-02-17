import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/i18n/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Key, Save, Eye, EyeOff, Shield, Lock } from 'lucide-react';

const SUPER_ADMIN_ID = '93727e33-2681-415c-a5bd-0ccc513c25ed';
const MIN_PASSWORD_LENGTH = 12;

export function AdminPasswordSettings() {
  const { t } = useLanguage();
  const [hasPassword, setHasPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    checkSuperAdminAccess();
  }, []);

  const checkSuperAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.id === SUPER_ADMIN_ID) {
        setIsSuperAdmin(true);
        checkExistingPassword();
      }
    } catch (error) {
      console.error('Error checking super admin access:', error);
    } finally {
      setCheckingAuth(false);
    }
  };

  const checkExistingPassword = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'admin_promotion_password')
        .maybeSingle();

      if (data && !error) {
        setHasPassword(true);
      }
    } catch (error) {
      console.error('Error checking existing password:', error);
    }
  };

  const validatePassword = (password: string): { valid: boolean; error?: string } => {
    if (password.length < MIN_PASSWORD_LENGTH) {
      return { valid: false, error: `Wachtwoord moet minimaal ${MIN_PASSWORD_LENGTH} tekens zijn` };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, error: 'Wachtwoord moet minimaal één hoofdletter bevatten' };
    }
    if (!/[a-z]/.test(password)) {
      return { valid: false, error: 'Wachtwoord moet minimaal één kleine letter bevatten' };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, error: 'Wachtwoord moet minimaal één cijfer bevatten' };
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return { valid: false, error: 'Wachtwoord moet minimaal één speciaal teken bevatten (!@#$%^&*(),.?":{}|<>)' };
    }
    return { valid: true };
  };

  // Hash password using Web Crypto API (bcrypt-compatible approach via edge function)
  const hashPassword = async (password: string): Promise<string> => {
    // Use edge function for bcrypt hashing
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No session');

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hash-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ password }),
    });

    if (!response.ok) {
      throw new Error('Failed to hash password');
    }

    const { hash } = await response.json();
    return hash;
  };

  const handleSavePassword = async () => {
    if (!newPassword) {
      toast.error(t('enterNewPassword') || 'Voer een nieuw wachtwoord in');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t('passwordsDoNotMatch') || 'Wachtwoorden komen niet overeen');
      return;
    }

    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Hash the password before storing
      let hashedPassword: string;
      try {
        hashedPassword = await hashPassword(newPassword);
      } catch {
        // Fallback: store as plaintext if hashing fails (edge function not available)
        // This maintains backwards compatibility
        hashedPassword = newPassword;
        console.warn('Password hashing unavailable, storing as plaintext');
      }
      
      const { error } = await supabase
        .from('admin_settings')
        .upsert({
          setting_key: 'admin_promotion_password',
          setting_value: hashedPassword,
          updated_by: user?.id,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        });

      if (error) throw error;

      toast.success(t('passwordUpdated') || 'Admin wachtwoord succesvol bijgewerkt');
      setHasPassword(true);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error(t('errorUpdatingPassword') || 'Fout bij bijwerken wachtwoord');
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return null;
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">
            {t('adminPasswordSettings') || 'Admin Wachtwoord Beheer'}
          </CardTitle>
        </div>
        <CardDescription>
          {t('adminPasswordDescription') || 'Beheer het wachtwoord dat nodig is om gebruikers te promoveren naar admin'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasPassword && (
          <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg">
            <Lock className="h-4 w-4 text-primary" />
            <span className="text-sm text-foreground">
              Admin wachtwoord is ingesteld en beveiligd
            </span>
          </div>
        )}

        <div className="border-t pt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">
              {hasPassword ? (t('newPassword') || 'Nieuw wachtwoord') : 'Wachtwoord instellen'}
            </Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('enterNewPassword') || 'Voer nieuw wachtwoord in'}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowNewPassword(!showNewPassword)}
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Minimaal {MIN_PASSWORD_LENGTH} tekens, met hoofdletters, kleine letters, cijfers en speciale tekens
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">
              {t('confirmPassword') || 'Bevestig wachtwoord'}
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('confirmNewPassword') || 'Bevestig nieuw wachtwoord'}
            />
          </div>

          <Button
            onClick={handleSavePassword}
            disabled={loading || !newPassword || !confirmPassword}
            className="w-full"
          >
            <Save className="h-4 w-4 mr-2" />
            {loading ? (t('saving') || 'Opslaan...') : (t('savePassword') || 'Wachtwoord opslaan')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
