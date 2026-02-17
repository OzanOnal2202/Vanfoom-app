import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { User, Settings, Key, LogOut, ClipboardList, CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { PersonalOverview } from './PersonalOverview';
import { format, parse } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Profile {
  full_name: string;
  email: string;
  date_of_birth: string | null;
  address: string | null;
  job_function: string | null;
  contract: string | null;
}

export function UserProfileMenu() {
  const { user, role, signOut } = useAuth();
  const { t, language } = useLanguage();

  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [overviewDialogOpen, setOverviewDialogOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [profile, setProfile] = useState<Profile>({
    full_name: '',
    email: '',
    date_of_birth: null,
    address: null,
    job_function: null,
    contract: null,
  });
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const isAdmin = role === 'admin';
  const dateLocale = language === 'nl' ? nl : enUS;

  // Generate year options from 1920 to current year
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1920 + 1 }, (_, i) => currentYear - i);
  const months = Array.from({ length: 12 }, (_, i) => i);

  const getSelectedDate = (): Date | undefined => {
    if (!profile.date_of_birth) return undefined;
    try {
      return parse(profile.date_of_birth, 'yyyy-MM-dd', new Date());
    } catch {
      return undefined;
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setProfile((prev) => ({ ...prev, date_of_birth: format(date, 'yyyy-MM-dd') }));
    } else {
      setProfile((prev) => ({ ...prev, date_of_birth: null }));
    }
  };

  const handleYearChange = (year: string) => {
    const newDate = new Date(calendarMonth);
    newDate.setFullYear(parseInt(year));
    setCalendarMonth(newDate);
  };

  const handleMonthChange = (month: string) => {
    const newDate = new Date(calendarMonth);
    newDate.setMonth(parseInt(month));
    setCalendarMonth(newDate);
  };

  const fetchProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, email, date_of_birth, address, job_function, contract')
      .eq('id', user.id)
      .single();

    if (!error && data) {
      setProfile({
        full_name: data.full_name,
        email: data.email,
        date_of_birth: data.date_of_birth,
        address: data.address,
        job_function: data.job_function,
        contract: data.contract,
      });
    }
  };

  const handleOpenProfile = async () => {
    await fetchProfile();
    setProfileDialogOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    setLoading(true);

    const updateData: Record<string, string | null> = {
      full_name: profile.full_name,
      date_of_birth: profile.date_of_birth,
      address: profile.address,
      job_function: profile.job_function,
    };

    // Only admins can update contract
    if (isAdmin) {
      updateData.contract = profile.contract;
    }

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id);

    if (error) {
      toast.error(t('error'));
      console.error('Error updating profile:', error);
    } else {
      toast.success(t('profileUpdated'));
      setProfileDialogOpen(false);
    }

    setLoading(false);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error(t('passwordMinLength'));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t('passwordsNoMatch'));
      return;
    }

    setChangingPassword(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      toast.error(error.message);
      console.error('Error changing password:', error);
    } else {
      toast.success(t('passwordChanged'));
      setPasswordDialogOpen(false);
      setNewPassword('');
      setConfirmPassword('');
    }

    setChangingPassword(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <User className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user?.email}</p>
              <p className="text-xs leading-none text-muted-foreground capitalize">
                {role}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleOpenProfile}>
            <Settings className="mr-2 h-4 w-4" />
            {t('myProfile')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOverviewDialogOpen(true)}>
            <ClipboardList className="mr-2 h-4 w-4" />
            {t('personalOverview')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPasswordDialogOpen(true)}>
            <Key className="mr-2 h-4 w-4" />
            {t('changePassword')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut} className="text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            {t('logout')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Profile Dialog */}
      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('myProfile')}</DialogTitle>
            <DialogDescription>{t('myProfileDescription')}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveProfile();
            }}
          >
            <Tabs defaultValue="personal" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="personal">{t('personalInfo')}</TabsTrigger>
                <TabsTrigger value="work">{t('workOverview')}</TabsTrigger>
              </TabsList>
              
              <TabsContent value="personal" className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="profile-name">{t('fullName')}</Label>
                  <Input
                    id="profile-name"
                    value={profile.full_name}
                    onChange={(e) =>
                      setProfile((prev) => ({ ...prev, full_name: e.target.value }))
                    }
                    placeholder={t('fullName')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-email">{t('email')}</Label>
                  <Input
                    id="profile-email"
                    value={profile.email}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('emailCannotBeChanged')}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>{t('dateOfBirth')}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !profile.date_of_birth && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {profile.date_of_birth
                          ? format(getSelectedDate()!, 'PPP', { locale: dateLocale })
                          : t('selectDate')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <div className="flex gap-2 p-3 border-b">
                        <Select
                          value={calendarMonth.getMonth().toString()}
                          onValueChange={handleMonthChange}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {months.map((month) => (
                              <SelectItem key={month} value={month.toString()}>
                                {format(new Date(2000, month, 1), 'MMMM', { locale: dateLocale })}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={calendarMonth.getFullYear().toString()}
                          onValueChange={handleYearChange}
                        >
                          <SelectTrigger className="w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="max-h-[200px]">
                            {years.map((year) => (
                              <SelectItem key={year} value={year.toString()}>
                                {year}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Calendar
                        mode="single"
                        selected={getSelectedDate()}
                        onSelect={handleDateSelect}
                        month={calendarMonth}
                        onMonthChange={setCalendarMonth}
                        disabled={(date) => date > new Date()}
                        className={cn("p-3 pointer-events-auto")}
                        locale={dateLocale}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-address">{t('address')}</Label>
                  <Input
                    id="profile-address"
                    value={profile.address || ''}
                    onChange={(e) =>
                      setProfile((prev) => ({ ...prev, address: e.target.value || null }))
                    }
                    placeholder={t('address')}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="work" className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="profile-function">{t('jobFunction')}</Label>
                  <Input
                    id="profile-function"
                    value={profile.job_function || ''}
                    onChange={(e) =>
                      setProfile((prev) => ({ ...prev, job_function: e.target.value || null }))
                    }
                    placeholder={t('jobFunction')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-contract">{t('contract')}</Label>
                  <Input
                    id="profile-contract"
                    value={profile.contract || ''}
                    onChange={(e) =>
                      setProfile((prev) => ({ ...prev, contract: e.target.value || null }))
                    }
                    placeholder={t('contract')}
                    disabled={!isAdmin}
                    className={!isAdmin ? 'bg-muted' : ''}
                  />
                  {!isAdmin && (
                    <p className="text-xs text-muted-foreground">
                      {t('contractAdminOnly')}
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
            
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setProfileDialogOpen(false)}
              >
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? t('saving') : t('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Personal Overview Dialog */}
      <Dialog open={overviewDialogOpen} onOpenChange={setOverviewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('personalOverview')}</DialogTitle>
            <DialogDescription>{t('personalOverviewDescription')}</DialogDescription>
          </DialogHeader>
          <PersonalOverview />
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('changePassword')}</DialogTitle>
            <DialogDescription>{t('changePasswordDescription')}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleChangePassword();
            }}
          >
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">{t('newPassword')}</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-new-password">{t('confirmNewPassword')}</Label>
                <Input
                  id="confirm-new-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPasswordDialogOpen(false);
                  setNewPassword('');
                  setConfirmPassword('');
                }}
              >
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                disabled={changingPassword || !newPassword || !confirmPassword}
              >
                {changingPassword ? t('saving') : t('changePassword')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
