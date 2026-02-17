import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { AdminDashboard } from '@/components/AdminDashboard';
import { AccountManagement } from '@/components/AccountManagement';
import { LoginOverview } from '@/components/LoginOverview';
import { TVAnnouncementsManager } from '@/components/TVAnnouncementsManager';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogOut, ArrowLeft, BarChart3, Users, LogIn, Megaphone } from 'lucide-react';

export default function Admin() {
  const { user, role, loading, signOut } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!loading && user && role !== 'admin') {
      navigate('/');
    }
  }, [role, loading, user, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">{t('vanfoomAdmin')}</h1>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button variant="outline" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" />
              {t('logout')}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              {t('dashboard')}
            </TabsTrigger>
            <TabsTrigger value="accounts" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t('accounts')}
            </TabsTrigger>
            <TabsTrigger value="logins" className="flex items-center gap-2">
              <LogIn className="h-4 w-4" />
              {t('logins')}
            </TabsTrigger>
            <TabsTrigger value="tv-announcements" className="flex items-center gap-2">
              <Megaphone className="h-4 w-4" />
              {t('tvAnnouncements')}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="dashboard">
            <AdminDashboard />
          </TabsContent>
          
          <TabsContent value="accounts">
            <AccountManagement />
          </TabsContent>
          
          <TabsContent value="logins">
            <LoginOverview />
          </TabsContent>
          
          <TabsContent value="tv-announcements">
            <TVAnnouncementsManager />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
