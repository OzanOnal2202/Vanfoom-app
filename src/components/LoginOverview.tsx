import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/i18n/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, ChevronLeft, ChevronRight, Clock, User as UserIcon, LogIn } from 'lucide-react';
import { format, startOfDay, endOfDay, addDays, subDays, isToday } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface LoginLog {
  id: string;
  user_id: string;
  logged_in_at: string;
  user_agent: string | null;
  user_name: string;
  user_email: string;
}

interface DailyLoginSummary {
  user_id: string;
  user_name: string;
  user_email: string;
  login_count: number;
  first_login: string;
  last_login: string;
}

export function LoginOverview() {
  const { t, language } = useLanguage();
  const dateLocale = language === 'nl' ? nl : enUS;
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLoginLogs();
  }, [selectedDate]);

  const fetchLoginLogs = async () => {
    setLoading(true);
    
    const dayStart = startOfDay(selectedDate).toISOString();
    const dayEnd = endOfDay(selectedDate).toISOString();
    
    const { data: logs, error } = await supabase
      .from('login_logs')
      .select('id, user_id, logged_in_at, user_agent')
      .gte('logged_in_at', dayStart)
      .lte('logged_in_at', dayEnd)
      .order('logged_in_at', { ascending: false });

    if (error) {
      console.error('Error fetching login logs:', error);
      setLoading(false);
      return;
    }

    if (!logs || logs.length === 0) {
      setLoginLogs([]);
      setLoading(false);
      return;
    }

    // Get unique user IDs and fetch their profiles
    const userIds = [...new Set(logs.map(l => l.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.id, { name: p.full_name, email: p.email }]) || []);

    const logsWithUsers: LoginLog[] = logs.map(log => ({
      id: log.id,
      user_id: log.user_id,
      logged_in_at: log.logged_in_at,
      user_agent: log.user_agent,
      user_name: profileMap.get(log.user_id)?.name || 'Onbekend',
      user_email: profileMap.get(log.user_id)?.email || '',
    }));

    setLoginLogs(logsWithUsers);
    setLoading(false);
  };

  // Calculate daily summary
  const dailySummary = useMemo((): DailyLoginSummary[] => {
    const summaryMap = new Map<string, DailyLoginSummary>();

    loginLogs.forEach(log => {
      const existing = summaryMap.get(log.user_id);
      if (existing) {
        existing.login_count += 1;
        if (new Date(log.logged_in_at) < new Date(existing.first_login)) {
          existing.first_login = log.logged_in_at;
        }
        if (new Date(log.logged_in_at) > new Date(existing.last_login)) {
          existing.last_login = log.logged_in_at;
        }
      } else {
        summaryMap.set(log.user_id, {
          user_id: log.user_id,
          user_name: log.user_name,
          user_email: log.user_email,
          login_count: 1,
          first_login: log.logged_in_at,
          last_login: log.logged_in_at,
        });
      }
    });

    return Array.from(summaryMap.values()).sort((a, b) => 
      new Date(a.first_login).getTime() - new Date(b.first_login).getTime()
    );
  }, [loginLogs]);

  const goToPreviousDay = () => setSelectedDate(prev => subDays(prev, 1));
  const goToNextDay = () => setSelectedDate(prev => addDays(prev, 1));
  const goToToday = () => setSelectedDate(new Date());

  const uniqueUsersCount = dailySummary.length;
  const totalLogins = loginLogs.length;

  return (
    <div className="space-y-6">
      {/* Date Navigation */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={goToPreviousDay}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[200px] justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedDate, 'EEEE, d MMMM yyyy', { locale: dateLocale })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                    locale={dateLocale}
                  />
                </PopoverContent>
              </Popover>
              
              <Button variant="outline" size="icon" onClick={goToNextDay}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {!isToday(selectedDate) && (
              <Button variant="ghost" onClick={goToToday}>
                {t('today')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <UserIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{uniqueUsersCount}</p>
                <p className="text-sm text-muted-foreground">{t('uniqueLogins')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-secondary">
                <LogIn className="h-6 w-6 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalLogins}</p>
                <p className="text-sm text-muted-foreground">{t('totalLogins')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Summary */}
      <Card>
        <CardHeader>
          <CardTitle>{t('loginOverview')}</CardTitle>
          <CardDescription>
            {t('loginOverviewDescription')} - {format(selectedDate, 'd MMMM yyyy', { locale: dateLocale })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : dailySummary.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <LogIn className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>{t('noLoginsOnDate')}</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('fullName')}</TableHead>
                    <TableHead>{t('email')}</TableHead>
                    <TableHead>{t('firstLogin')}</TableHead>
                    <TableHead>{t('lastLogin')}</TableHead>
                    <TableHead className="text-right">{t('loginCount')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailySummary.map(summary => (
                    <TableRow key={summary.user_id}>
                      <TableCell className="font-medium">{summary.user_name}</TableCell>
                      <TableCell>{summary.user_email}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {format(new Date(summary.first_login), 'HH:mm')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {format(new Date(summary.last_login), 'HH:mm')}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">{summary.login_count}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Detailed Logs */}
      {loginLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('detailedLogs')}</CardTitle>
            <CardDescription>{t('detailedLogsDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('time')}</TableHead>
                    <TableHead>{t('user')}</TableHead>
                    <TableHead>{t('device')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loginLogs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {format(new Date(log.logged_in_at), 'HH:mm:ss')}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{log.user_name}</TableCell>
                      <TableCell className="text-muted-foreground text-xs max-w-[300px] truncate">
                        {log.user_agent ? (
                          log.user_agent.includes('Mobile') ? 'Mobile' : 
                          log.user_agent.includes('Windows') ? 'Windows' :
                          log.user_agent.includes('Mac') ? 'Mac' :
                          log.user_agent.includes('Linux') ? 'Linux' : 'Browser'
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}