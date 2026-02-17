import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkRegistrationForm } from '@/components/WorkRegistrationForm';
import { AdminDashboard } from '@/components/AdminDashboard';
import { AdminPromotion } from '@/components/AdminPromotion';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { MechanicAvailability } from '@/components/MechanicAvailability';
import { AdminAvailability } from '@/components/AdminAvailability';
import { AccountManagement } from '@/components/AccountManagement';
import { LoginOverview } from '@/components/LoginOverview';
import { PriceListManagement } from '@/components/PriceListManagement';
import { InventoryManagement } from '@/components/InventoryManagement';
import { MyTasks } from '@/components/MyTasks';
import { UserProfileMenu } from '@/components/UserProfileMenu';
import { TVAnnouncementsManager } from '@/components/TVAnnouncementsManager';
import { FOHDashboard } from '@/components/FOHDashboard';
import { FOHTableGrid } from '@/components/FOHTableGrid';
import { FOHTasks } from '@/components/FOHTasks';
import { CallStatusManager } from '@/components/CallStatusManager';
import { WarrantyOverview } from '@/components/WarrantyOverview';
import { Wrench, LayoutDashboard, User, Calendar, Users, LogIn, Euro, Package, ClipboardList, Megaphone, Headphones, Grid3X3, Phone, ShieldAlert, Clock, AlertCircle, ChevronDown } from 'lucide-react';
import vanfoomLogo from '@/assets/vanfoom-logo.png';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useIsMobile } from '@/hooks/use-mobile';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOpenTasksCount } from '@/hooks/useOpenTasksCount';
import { Badge } from '@/components/ui/badge';

export default function Dashboard() {
  const { user, role, isApproved, signOut } = useAuth();
  const { t } = useLanguage();
  const { hasPermission } = usePermissions();
  const isMobile = useIsMobile();
  const openTasksCount = useOpenTasksCount();
  const [scannedFrameNumber, setScannedFrameNumber] = useState('');
  const [activeTab, setActiveTab] = useState(role === 'foh' ? 'foh' : 'register');

  // Admin tab configuration for the dropdown
  const adminTabs = [
    { value: 'register', label: t('registerTab'), icon: Wrench },
    { value: 'tasks', label: t('tasksTab'), icon: ClipboardList },
    { value: 'dashboard', label: t('dashboardTab'), icon: LayoutDashboard },
    { value: 'availability', label: t('availabilityTab'), icon: Calendar },
    { value: 'inventory', label: t('inventory'), icon: Package },
    { value: 'pricelist', label: t('priceList'), icon: Euro },
    { value: 'warranty', label: t('warranty'), icon: ShieldAlert },
    { value: 'accounts', label: t('accounts'), icon: Users },
    { value: 'call-statuses', label: t('callStatusManagement'), icon: Phone },
    { value: 'tv-announcements', label: t('tvAnnouncements'), icon: Megaphone },
    { value: 'logins', label: t('logins'), icon: LogIn },
  ];

  const currentTab = adminTabs.find(tab => tab.value === activeTab);

  // Show pending approval screen if not approved
  if (!isApproved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-warning/20">
              <Clock className="h-8 w-8 text-warning" />
            </div>
            <CardTitle>{t('pendingApprovalTitle')}</CardTitle>
            <CardDescription className="text-base">
              {t('accountPendingApproval')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('accountNotApproved')}</AlertTitle>
              <AlertDescription>
                {user?.email}
              </AlertDescription>
            </Alert>
            <Button variant="outline" className="w-full" onClick={() => signOut()}>
              {t('logout')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <img src={vanfoomLogo} alt="VanFoom" className="h-14 sm:h-20 mix-blend-multiply" />
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden md:flex items-center gap-2 text-sm">
              <span className="truncate max-w-[150px]">{user?.email}</span>
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium capitalize">
                {role}
              </span>
            </div>
            {role === 'monteur' && <AdminPromotion />}
            {role === 'foh' && <AdminPromotion />}
            <LanguageSwitcher />
            <UserProfileMenu />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        {role === 'admin' ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            {/* Mobile: Dropdown selector */}
            {isMobile ? (
              <Select value={activeTab} onValueChange={setActiveTab}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {currentTab && (
                      <span className="flex items-center gap-2">
                        <currentTab.icon className="h-4 w-4" />
                        {currentTab.label}
                        {currentTab.value === 'tasks' && openTasksCount > 0 && (
                          <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs font-medium rounded-full ml-1">
                            {openTasksCount}
                          </Badge>
                        )}
                      </span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {adminTabs.map(tab => (
                    <SelectItem key={tab.value} value={tab.value}>
                      <span className="flex items-center gap-2">
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                        {tab.value === 'tasks' && openTasksCount > 0 && (
                          <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs font-medium rounded-full ml-1">
                            {openTasksCount}
                          </Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              /* Desktop: Keep the original two-row tabs */
              <div className="space-y-2">
                <TabsList className="grid w-full grid-cols-6">
                  <TabsTrigger value="register" className="flex items-center gap-2 px-3">
                    <Wrench className="h-4 w-4 shrink-0" />
                    <span className="text-sm truncate">{t('registerTab')}</span>
                  </TabsTrigger>
                  <TabsTrigger value="tasks" className="flex items-center gap-2 px-3 relative">
                    <ClipboardList className="h-4 w-4 shrink-0" />
                    <span className="text-sm truncate">{t('tasksTab')}</span>
                    {openTasksCount > 0 && (
                      <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs font-medium rounded-full">
                        {openTasksCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="dashboard" className="flex items-center gap-2 px-3">
                    <LayoutDashboard className="h-4 w-4 shrink-0" />
                    <span className="text-sm truncate">{t('dashboardTab')}</span>
                  </TabsTrigger>
                  <TabsTrigger value="availability" className="flex items-center gap-2 px-3">
                    <Calendar className="h-4 w-4 shrink-0" />
                    <span className="text-sm truncate">{t('availabilityTab')}</span>
                  </TabsTrigger>
                  <TabsTrigger value="inventory" className="flex items-center gap-2 px-3">
                    <Package className="h-4 w-4 shrink-0" />
                    <span className="text-sm truncate">{t('inventory')}</span>
                  </TabsTrigger>
                  <TabsTrigger value="pricelist" className="flex items-center gap-2 px-3">
                    <Euro className="h-4 w-4 shrink-0" />
                    <span className="text-sm truncate">{t('priceList')}</span>
                  </TabsTrigger>
                </TabsList>
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="warranty" className="flex items-center gap-2 px-3">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    <span className="text-sm truncate">{t('warranty')}</span>
                  </TabsTrigger>
                  <TabsTrigger value="accounts" className="flex items-center gap-2 px-3">
                    <Users className="h-4 w-4 shrink-0" />
                    <span className="text-sm truncate">{t('accounts')}</span>
                  </TabsTrigger>
                  <TabsTrigger value="call-statuses" className="flex items-center gap-2 px-3">
                    <Phone className="h-4 w-4 shrink-0" />
                    <span className="text-sm truncate">{t('callStatusManagement')}</span>
                  </TabsTrigger>
                  <TabsTrigger value="tv-announcements" className="flex items-center gap-2 px-3">
                    <Megaphone className="h-4 w-4 shrink-0" />
                    <span className="text-sm truncate">{t('tvAnnouncements')}</span>
                  </TabsTrigger>
                  <TabsTrigger value="logins" className="flex items-center gap-2 px-3">
                    <LogIn className="h-4 w-4 shrink-0" />
                    <span className="text-sm truncate">{t('logins')}</span>
                  </TabsTrigger>
                </TabsList>
              </div>
            )}

            <TabsContent value="register">
              <MechanicView
                scannedFrameNumber={scannedFrameNumber}
                setScannedFrameNumber={setScannedFrameNumber}
              />
            </TabsContent>

            <TabsContent value="tasks">
              <MyTasks onSelectBike={(frameNumber) => {
                setScannedFrameNumber(frameNumber);
                setActiveTab('register');
              }} />
            </TabsContent>

            <TabsContent value="dashboard">
              <AdminDashboard />
            </TabsContent>

            <TabsContent value="availability" className="space-y-6">
              <MechanicAvailability />
              <AdminAvailability />
            </TabsContent>

            <TabsContent value="inventory">
              <InventoryManagement />
            </TabsContent>

            <TabsContent value="pricelist">
              <PriceListManagement />
            </TabsContent>

            <TabsContent value="warranty">
              <WarrantyOverview dateRange="30" />
            </TabsContent>

            <TabsContent value="accounts">
              <AccountManagement />
            </TabsContent>

            <TabsContent value="call-statuses">
              <CallStatusManager />
            </TabsContent>

            <TabsContent value="tv-announcements">
              <TVAnnouncementsManager />
            </TabsContent>

            <TabsContent value="logins">
              <LoginOverview />
            </TabsContent>
          </Tabs>
        ) : role === 'foh' ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="foh" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3">
                <Headphones className="h-4 w-4 shrink-0" />
                <span className="text-xs sm:text-sm truncate">{t('fohDashboard')}</span>
              </TabsTrigger>
              <TabsTrigger value="call-grid" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3">
                <Grid3X3 className="h-4 w-4 shrink-0" />
                <span className="text-xs sm:text-sm truncate">{t('fohTableGrid')}</span>
              </TabsTrigger>
              <TabsTrigger value="foh-tasks" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 relative">
                <ClipboardList className="h-4 w-4 shrink-0" />
                <span className="text-xs sm:text-sm truncate">{t('fohTasksTitle')}</span>
                {openTasksCount > 0 && (
                  <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs font-medium rounded-full">
                    {openTasksCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="availability" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3">
                <Calendar className="h-4 w-4 shrink-0" />
                <span className="text-xs sm:text-sm truncate">{t('availabilityTab')}</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="foh">
              <FOHDashboard />
            </TabsContent>

            <TabsContent value="call-grid">
              <FOHTableGrid />
            </TabsContent>

            <TabsContent value="foh-tasks">
              <FOHTasks />
            </TabsContent>

            <TabsContent value="availability">
              <MechanicAvailability />
            </TabsContent>
          </Tabs>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            {(() => {
              const monteurTabs: { value: string; label: string; icon: any; always?: boolean; perm?: string }[] = [
                { value: 'register', label: t('registerTab'), icon: Wrench, always: true },
                { value: 'tasks', label: t('tasksTab'), icon: ClipboardList, always: true },
                { value: 'availability', label: t('availabilityTab'), icon: Calendar, always: true },
                { value: 'inventory', label: t('inventory'), icon: Package, perm: 'inventory' },
                { value: 'pricelist', label: t('priceList'), icon: Euro, perm: 'pricelist' },
                { value: 'warranty', label: t('warranty'), icon: ShieldAlert, perm: 'warranty' },
                { value: 'call-statuses', label: t('callStatusManagement'), icon: Phone, perm: 'call_status' },
                { value: 'tv-announcements', label: t('tvAnnouncements'), icon: Megaphone, perm: 'tv_announcements' },
              ].filter(tab => tab.always || (tab.perm && hasPermission(tab.perm as any)));
              
              const currentMonteurTab = monteurTabs.find(tab => tab.value === activeTab);

              return isMobile ? (
                <Select value={activeTab} onValueChange={setActiveTab}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {currentMonteurTab && (
                        <span className="flex items-center gap-2">
                          <currentMonteurTab.icon className="h-4 w-4" />
                          {currentMonteurTab.label}
                          {currentMonteurTab.value === 'tasks' && openTasksCount > 0 && (
                            <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs font-medium rounded-full ml-1">
                              {openTasksCount}
                            </Badge>
                          )}
                        </span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {monteurTabs.map(tab => (
                      <SelectItem key={tab.value} value={tab.value}>
                        <span className="flex items-center gap-2">
                          <tab.icon className="h-4 w-4" />
                          {tab.label}
                          {tab.value === 'tasks' && openTasksCount > 0 && (
                            <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs font-medium rounded-full ml-1">
                              {openTasksCount}
                            </Badge>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <TabsList className={`grid w-full`} style={{ gridTemplateColumns: `repeat(${monteurTabs.length}, 1fr)` }}>
                  {monteurTabs.map(tab => (
                    <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3">
                      <tab.icon className="h-4 w-4 shrink-0" />
                      <span className="text-xs sm:text-sm truncate">{tab.label}</span>
                      {tab.value === 'tasks' && openTasksCount > 0 && (
                        <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs font-medium rounded-full">
                          {openTasksCount}
                        </Badge>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
              );
            })()}

            <TabsContent value="register">
              <MechanicView
                scannedFrameNumber={scannedFrameNumber}
                setScannedFrameNumber={setScannedFrameNumber}
              />
            </TabsContent>

            <TabsContent value="tasks">
              <MyTasks onSelectBike={(frameNumber) => {
                setScannedFrameNumber(frameNumber);
                setActiveTab('register');
              }} />
            </TabsContent>

            <TabsContent value="availability">
              <MechanicAvailability />
            </TabsContent>

            {hasPermission('inventory') && (
              <TabsContent value="inventory">
                <InventoryManagement />
              </TabsContent>
            )}

            {hasPermission('pricelist') && (
              <TabsContent value="pricelist">
                <PriceListManagement />
              </TabsContent>
            )}

            {hasPermission('warranty') && (
              <TabsContent value="warranty">
                <WarrantyOverview dateRange="30" />
              </TabsContent>
            )}

            {hasPermission('call_status') && (
              <TabsContent value="call-statuses">
                <CallStatusManager />
              </TabsContent>
            )}

            {hasPermission('tv_announcements') && (
              <TabsContent value="tv-announcements">
                <TVAnnouncementsManager />
              </TabsContent>
            )}
          </Tabs>
        )}
      </main>
    </div>
  );
}

interface MechanicViewProps {
  scannedFrameNumber: string;
  setScannedFrameNumber: (frame: string) => void;
}

function MechanicView({
  scannedFrameNumber,
  setScannedFrameNumber,
}: MechanicViewProps) {
  const { t } = useLanguage();
  
  return (
    <div className="space-y-6">
      {/* Work Registration Form */}
      <WorkRegistrationForm
        initialFrameNumber={scannedFrameNumber}
        onComplete={() => setScannedFrameNumber('')}
      />
    </div>
  );
}