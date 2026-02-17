import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/i18n/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { ShieldAlert, Users, Wrench, Bike, AlertTriangle, TrendingUp } from 'lucide-react';
import { format, subMonths, subDays, subYears } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';

interface WarrantyCase {
  id: string;
  bikeId: string;
  frameNumber: string;
  model: string;
  repairType: string;
  mechanicId: string | null;
  mechanicName: string;
  completedAt: string;
  originalCompletedAt: string;
  daysSinceOriginal: number;
}

interface MechanicWarrantyStats {
  id: string;
  name: string;
  totalWarrantyCases: number;
  repairTypes: { name: string; count: number }[];
}

interface RepairTypeWarrantyStats {
  name: string;
  count: number;
}

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4'];

interface WarrantyOverviewProps {
  dateRange: string;
}

export function WarrantyOverview({ dateRange }: WarrantyOverviewProps) {
  const { t, language } = useLanguage();
  const dateLocale = language === 'nl' ? nl : enUS;
  
  const [warrantyCases, setWarrantyCases] = useState<WarrantyCase[]>([]);
  const [mechanicStats, setMechanicStats] = useState<MechanicWarrantyStats[]>([]);
  const [repairTypeStats, setRepairTypeStats] = useState<RepairTypeWarrantyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMechanicId, setSelectedMechanicId] = useState<string>('all');

  useEffect(() => {
    fetchWarrantyData();
  }, [dateRange]);

  const getDateFromPeriod = (period: string) => {
    const periodNum = parseInt(period);
    if (periodNum === 9999) {
      return subYears(new Date(), 10).toISOString(); // Effectively all time
    }
    if (periodNum === 365) {
      return subYears(new Date(), 1).toISOString();
    }
    return subDays(new Date(), periodNum).toISOString();
  };

  const fetchWarrantyData = async () => {
    setLoading(true);
    const fromDate = getDateFromPeriod(dateRange);
    
    // Fetch all completed work registrations in the period
    const { data: registrations } = await supabase
      .from('work_registrations')
      .select(`
        id,
        bike_id,
        mechanic_id,
        completed_at,
        repair_type:repair_types(id, name)
      `)
      .eq('completed', true)
      .gte('completed_at', fromDate)
      .order('completed_at', { ascending: false });

    if (!registrations || registrations.length === 0) {
      setWarrantyCases([]);
      setMechanicStats([]);
      setRepairTypeStats([]);
      setLoading(false);
      return;
    }

    // Get all unique bike IDs
    const bikeIds = [...new Set(registrations.map((r: any) => r.bike_id))];
    
    // Fetch bike information
    const { data: bikes } = await supabase
      .from('bikes')
      .select('id, frame_number, model')
      .in('id', bikeIds);

    const bikeMap = new Map(bikes?.map((b: any) => [b.id, { frame_number: b.frame_number, model: b.model }]) || []);

    // Fetch ALL completed registrations for these bikes to check warranty (including before the period)
    const { data: allBikeRegistrations } = await supabase
      .from('work_registrations')
      .select(`
        id,
        bike_id,
        mechanic_id,
        completed_at,
        repair_type_id,
        repair_type:repair_types(id, name)
      `)
      .in('bike_id', bikeIds)
      .eq('completed', true)
      .order('completed_at', { ascending: true });

    // Fetch mechanic profiles
    const mechanicIds = [...new Set((registrations || []).map((r: any) => r.mechanic_id).filter(Boolean))];
    let profileMap: Record<string, string> = {};
    
    if (mechanicIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles_limited')
        .select('id, full_name')
        .in('id', mechanicIds);

      if (profiles) {
        profileMap = profiles.reduce((acc, p) => {
          acc[p.id] = p.full_name;
          return acc;
        }, {} as Record<string, string>);
      }
    }

    // Find warranty cases: repairs of the same type on the same bike within 6 months
    const warrantyCasesList: WarrantyCase[] = [];
    const sixMonthsMs = 6 * 30 * 24 * 60 * 60 * 1000; // 6 months in milliseconds

    // Group registrations by bike and repair type
    const bikeRepairHistory = new Map<string, Map<string, any[]>>();
    
    allBikeRegistrations?.forEach((reg: any) => {
      const repairTypeId = reg.repair_type?.id || reg.repair_type_id;
      if (!repairTypeId) return;
      
      if (!bikeRepairHistory.has(reg.bike_id)) {
        bikeRepairHistory.set(reg.bike_id, new Map());
      }
      const bikeHistory = bikeRepairHistory.get(reg.bike_id)!;
      
      if (!bikeHistory.has(repairTypeId)) {
        bikeHistory.set(repairTypeId, []);
      }
      bikeHistory.get(repairTypeId)!.push(reg);
    });

    // Check each registration in the selected period for warranty
    registrations.forEach((reg: any) => {
      const repairTypeId = reg.repair_type?.id;
      if (!repairTypeId) return;
      
      const bikeHistory = bikeRepairHistory.get(reg.bike_id);
      if (!bikeHistory) return;
      
      const repairHistory = bikeHistory.get(repairTypeId);
      if (!repairHistory || repairHistory.length < 2) return;
      
      // Find previous repair of the same type on this bike
      const currentDate = new Date(reg.completed_at);
      const previousRepairs = repairHistory
        .filter((r: any) => r.id !== reg.id && new Date(r.completed_at) < currentDate)
        .sort((a: any, b: any) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());
      
      if (previousRepairs.length === 0) return;
      
      const previousRepair = previousRepairs[0];
      const previousDate = new Date(previousRepair.completed_at);
      const daysDiff = Math.floor((currentDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // If within 6 months (180 days), it's a warranty case
      if (daysDiff <= 180) {
        const bike = bikeMap.get(reg.bike_id) || { frame_number: 'Onbekend', model: 'Onbekend' };
        warrantyCasesList.push({
          id: reg.id,
          bikeId: reg.bike_id,
          frameNumber: bike.frame_number,
          model: bike.model,
          repairType: reg.repair_type?.name || 'Onbekend',
          mechanicId: reg.mechanic_id,
          mechanicName: reg.mechanic_id ? profileMap[reg.mechanic_id] || 'Onbekend' : 'Onbekend',
          completedAt: reg.completed_at,
          originalCompletedAt: previousRepair.completed_at,
          daysSinceOriginal: daysDiff
        });
      }
    });

    setWarrantyCases(warrantyCasesList);

    // Calculate mechanic statistics
    const mechanicStatsMap = new Map<string, MechanicWarrantyStats>();
    
    warrantyCasesList.forEach((wc) => {
      if (!wc.mechanicId) return;
      
      if (!mechanicStatsMap.has(wc.mechanicId)) {
        mechanicStatsMap.set(wc.mechanicId, {
          id: wc.mechanicId,
          name: wc.mechanicName,
          totalWarrantyCases: 0,
          repairTypes: []
        });
      }
      
      const stats = mechanicStatsMap.get(wc.mechanicId)!;
      stats.totalWarrantyCases += 1;
      
      const existingType = stats.repairTypes.find(rt => rt.name === wc.repairType);
      if (existingType) {
        existingType.count += 1;
      } else {
        stats.repairTypes.push({ name: wc.repairType, count: 1 });
      }
    });

    setMechanicStats(
      Array.from(mechanicStatsMap.values())
        .sort((a, b) => b.totalWarrantyCases - a.totalWarrantyCases)
    );

    // Calculate repair type statistics
    const repairTypeStatsMap = new Map<string, number>();
    
    warrantyCasesList.forEach((wc) => {
      repairTypeStatsMap.set(wc.repairType, (repairTypeStatsMap.get(wc.repairType) || 0) + 1);
    });

    setRepairTypeStats(
      Array.from(repairTypeStatsMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
    );

    setLoading(false);
  };

  const filteredCases = selectedMechanicId === 'all' 
    ? warrantyCases 
    : warrantyCases.filter(wc => wc.mechanicId === selectedMechanicId);

  const filteredRepairTypeStats = selectedMechanicId === 'all'
    ? repairTypeStats
    : (() => {
        const statsMap = new Map<string, number>();
        filteredCases.forEach(wc => {
          statsMap.set(wc.repairType, (statsMap.get(wc.repairType) || 0) + 1);
        });
        return Array.from(statsMap.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);
      })();

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">{t('loading')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('totalWarrantyCases')}</CardTitle>
            <ShieldAlert className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{warrantyCases.length}</div>
            <p className="text-xs text-muted-foreground">
              {t('inSelectedPeriod')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('mechanicsWithWarranty')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mechanicStats.length}</div>
            <p className="text-xs text-muted-foreground">
              {t('haveWarrantyCases')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('uniqueRepairTypes')}</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{repairTypeStats.length}</div>
            <p className="text-xs text-muted-foreground">
              {t('withWarrantyIssues')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Mechanic Filter */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium">{t('filterByMechanic')}:</span>
        <Select value={selectedMechanicId} onValueChange={setSelectedMechanicId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t('allMechanics')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allMechanics')}</SelectItem>
            {mechanicStats.map((mechanic) => (
              <SelectItem key={mechanic.id} value={mechanic.id}>
                {mechanic.name} ({mechanic.totalWarrantyCases})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">{t('overview')}</TabsTrigger>
          <TabsTrigger value="mechanics">{t('perMechanic')}</TabsTrigger>
          <TabsTrigger value="all-cases">{t('allWarrantyCases')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Warranty by Repair Type Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-destructive" />
                  {t('warrantyByRepairType')}
                </CardTitle>
                <CardDescription>{t('warrantyDistribution')}</CardDescription>
              </CardHeader>
              <CardContent>
                {filteredRepairTypeStats.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">{t('noWarrantyCasesInPeriod')}</p>
                ) : (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={filteredRepairTypeStats.slice(0, 8)}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="count"
                          nameKey="name"
                          label={({ name, percent }) => `${name.substring(0, 15)}${name.length > 15 ? '...' : ''} (${(percent * 100).toFixed(0)}%)`}
                        >
                          {filteredRepairTypeStats.slice(0, 8).map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Warranty by Mechanic Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {t('warrantyByMechanic')}
                </CardTitle>
                <CardDescription>{t('casesPerMechanic')}</CardDescription>
              </CardHeader>
              <CardContent>
                {mechanicStats.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">{t('noWarrantyCasesInPeriod')}</p>
                ) : (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={mechanicStats.slice(0, 10)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="totalWarrantyCases" fill="hsl(var(--destructive))" name={t('warrantyCases')} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top Warranty Repair Types Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                {t('topWarrantyRepairTypes')}
              </CardTitle>
              <CardDescription>{t('mostFrequentWarrantyRepairs')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>{t('repairType')}</TableHead>
                      <TableHead className="text-right">{t('warrantyCount')}</TableHead>
                      <TableHead className="text-right">{t('percentage')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRepairTypeStats.map((stat, index) => (
                      <TableRow key={stat.name}>
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell>{stat.name}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="destructive">{stat.count}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {filteredCases.length > 0 
                            ? ((stat.count / filteredCases.length) * 100).toFixed(1) 
                            : 0}%
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredRepairTypeStats.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          {t('noWarrantyCasesInPeriod')}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mechanics">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {t('warrantyPerMechanic')}
              </CardTitle>
              <CardDescription>{t('detailedWarrantyPerMechanic')}</CardDescription>
            </CardHeader>
            <CardContent>
              {mechanicStats.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">{t('noWarrantyCasesInPeriod')}</p>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {mechanicStats.map((mechanic) => (
                      <Card key={mechanic.id} className="border-l-4 border-l-destructive">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">{mechanic.name}</CardTitle>
                            <Badge variant="destructive" className="text-base">
                              {mechanic.totalWarrantyCases} {t('cases')}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            {mechanic.repairTypes
                              .sort((a, b) => b.count - a.count)
                              .map((rt) => (
                                <Badge key={rt.name} variant="outline" className="flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3 text-destructive" />
                                  {rt.name}
                                  <span className="ml-1 bg-muted px-1.5 py-0.5 rounded text-xs">
                                    {rt.count}x
                                  </span>
                                </Badge>
                              ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all-cases">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-destructive" />
                {t('allWarrantyCasesTitle')}
              </CardTitle>
              <CardDescription>{t('completeWarrantyOverview')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('bike')}</TableHead>
                      <TableHead>{t('model')}</TableHead>
                      <TableHead>{t('repairType')}</TableHead>
                      <TableHead>{t('mechanic')}</TableHead>
                      <TableHead>{t('warrantyDate')}</TableHead>
                      <TableHead>{t('originalDate')}</TableHead>
                      <TableHead className="text-right">{t('daysSince')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCases.map((wc) => (
                      <TableRow key={wc.id}>
                        <TableCell className="font-mono font-medium">{wc.frameNumber}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{wc.model}</Badge>
                        </TableCell>
                        <TableCell>{wc.repairType}</TableCell>
                        <TableCell>{wc.mechanicName}</TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(wc.completedAt), 'dd MMM yyyy', { locale: dateLocale })}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(wc.originalCompletedAt), 'dd MMM yyyy', { locale: dateLocale })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={wc.daysSinceOriginal < 30 ? 'destructive' : 'secondary'}>
                            {wc.daysSinceOriginal} {t('days')}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredCases.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          {t('noWarrantyCasesInPeriod')}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
