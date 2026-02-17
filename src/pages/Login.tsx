import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from '@/hooks/use-toast';
import { Wrench } from 'lucide-react';
import vanfoomLogo from '@/assets/vanfoom-logo.png';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';

const loginSchema = z.object({
  email: z.string().email('Ongeldig e-mailadres'),
  password: z.string().min(6, 'Wachtwoord moet minimaal 6 tekens zijn'),
  rememberMe: z.boolean().default(false),
});

const registerSchema = loginSchema.extend({
  fullName: z.string().min(2, 'Naam moet minimaal 2 tekens zijn'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Wachtwoorden komen niet overeen',
  path: ['confirmPassword'],
});

const newPasswordSchema = z.object({
  newPassword: z.string().min(6, 'Wachtwoord moet minimaal 6 tekens zijn'),
  confirmNewPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: 'Wachtwoorden komen niet overeen',
  path: ['confirmNewPassword'],
});

export default function Login() {
  const { signIn, signUp } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [updatePasswordLoading, setUpdatePasswordLoading] = useState(false);

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', confirmPassword: '', fullName: '' },
  });

  const newPasswordForm = useForm<z.infer<typeof newPasswordSchema>>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { newPassword: '', confirmNewPassword: '' },
  });

  // Listen for password recovery event and check URL hash on mount
  useEffect(() => {
    // Check if there's a recovery token in the URL hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const type = hashParams.get('type');
    
    if (accessToken && type === 'recovery') {
      // Set the session from the recovery token
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: hashParams.get('refresh_token') || '',
      }).then(() => {
        setIsRecoveryMode(true);
        // Clean up the URL
        window.history.replaceState(null, '', window.location.pathname);
      });
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleUpdatePassword = async (data: z.infer<typeof newPasswordSchema>) => {
    setUpdatePasswordLoading(true);
    const { error } = await supabase.auth.updateUser({ password: data.newPassword });
    setUpdatePasswordLoading(false);

    if (error) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t('passwordChanged'), description: t('passwordChangedSuccess') });
      setIsRecoveryMode(false);
      // Sign out so user can log in with new password
      await supabase.auth.signOut();
    }
  };

  const handleLogin = async (data: z.infer<typeof loginSchema>) => {
    setLoading(true);
    const { error } = await signIn(data.email, data.password, data.rememberMe);
    setLoading(false);

    if (error) {
      toast({ title: t('loginFailed'), description: error.message, variant: 'destructive' });
    } else {
      navigate('/');
    }
  };

  const handleRegister = async (data: z.infer<typeof registerSchema>) => {
    setLoading(true);
    const { error } = await signUp(data.email, data.password, data.fullName);
    setLoading(false);

    if (error) {
      toast({ title: t('registerFailed'), description: error.message, variant: 'destructive' });
    } else {
      toast({ 
        title: t('accountCreated'), 
        description: t('accountPendingApproval'),
      });
      // Don't navigate - they need approval first
    }
  };

  const handlePasswordReset = async () => {
    if (!resetEmail) {
      toast({ title: t('error'), description: t('emailRequired'), variant: 'destructive' });
      return;
    }
    
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/login`,
    });
    setResetLoading(false);
    
    if (error) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    } else {
      toast({ 
        title: t('passwordResetSent'), 
        description: t('passwordResetSentDescription'),
      });
      setResetDialogOpen(false);
      setResetEmail('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* Language switcher in top right */}
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={vanfoomLogo} alt="VanFoom" className="h-44 mx-auto mb-4 mix-blend-multiply" />
          <p className="text-muted-foreground flex items-center justify-center gap-2 mt-2">
            <Wrench className="h-4 w-4" />
            {t('workRegistrationSystem')}
          </p>
        </div>

        {/* Show password update form if in recovery mode */}
        {isRecoveryMode ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('setNewPassword')}</CardTitle>
              <CardDescription>{t('setNewPasswordDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...newPasswordForm}>
                <form onSubmit={newPasswordForm.handleSubmit(handleUpdatePassword)} className="space-y-4">
                  <FormField
                    control={newPasswordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('newPassword')}</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={newPasswordForm.control}
                    name="confirmNewPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('confirmNewPassword')}</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={updatePasswordLoading}>
                    {updatePasswordLoading ? t('processing') : t('savePassword')}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">{t('login')}</TabsTrigger>
                <TabsTrigger value="register">{t('register')}</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <CardHeader>
                  <CardTitle>{t('welcomeBack')}</CardTitle>
                  <CardDescription>{t('loginWithAccount')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                      <FormField
                        control={loginForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('email')}</FormLabel>
                            <FormControl>
                              <Input placeholder="naam@vanfoom.nl" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('password')}</FormLabel>
                            <FormControl>
                              <Input type="password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={loginForm.control}
                        name="rememberMe"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="text-sm font-normal cursor-pointer">
                              {t('rememberMe')}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? t('processing') : t('login')}
                      </Button>
                      <Button
                        type="button"
                        variant="link"
                        className="w-full text-sm text-muted-foreground"
                        onClick={() => setResetDialogOpen(true)}
                      >
                        {t('forgotPassword')}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </TabsContent>

            <TabsContent value="register">
              <CardHeader>
                <CardTitle>{t('createAccount')}</CardTitle>
                <CardDescription>{t('createNewAccount')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...registerForm}>
                  <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
                    <FormField
                      control={registerForm.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('fullName')}</FormLabel>
                          <FormControl>
                            <Input placeholder="Jan Jansen" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('email')}</FormLabel>
                          <FormControl>
                            <Input placeholder="naam@vanfoom.nl" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('password')}</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('confirmPassword')}</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? t('processing') : t('register')}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </TabsContent>
            </Tabs>
          </Card>
        )}
      </div>

      {/* Password Reset Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('forgotPassword')}</DialogTitle>
            <DialogDescription>{t('forgotPasswordDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="reset-email" className="text-sm font-medium">
                {t('email')}
              </label>
              <Input
                id="reset-email"
                type="email"
                placeholder="naam@vanfoom.nl"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
              />
            </div>
            <Button 
              className="w-full" 
              onClick={handlePasswordReset}
              disabled={resetLoading}
            >
              {resetLoading ? t('processing') : t('sendResetLink')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
