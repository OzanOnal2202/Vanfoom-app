import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Wrench, Bike, Calendar, Clock, Search as SearchIcon, Stethoscope } from 'lucide-react';
import { format } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';

interface RepairWithDetails {
  id: string;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  repair_type: {
    name: string;
  };
  bike: {
    frame_number: string;
    model: string;
  };
}

interface TaskBike {
  id: string;
  frame_number: string;
  model: string;
  workflow_status: string;
  table_number: string | null;
}

interface DiagnosedBike {
  id: string;
  frame_number: string;
  model: string;
  workflow_status: string;
  table_number: string | null;
  diagnosed_at: string | null;
}

export function PersonalOverview() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [repairs, setRepairs] = useState<RepairWithDetails[]>([]);
  const [tasks, setTasks] = useState<TaskBike[]>([]);
  const [diagnoses, setDiagnoses] = useState<DiagnosedBike[]>([]);
  const [loading, setLoading] = useState(true);

  const dateLocale = language === 'nl' ? nl : enUS;

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    setLoading(true);

    // Fetch completed repairs by this mechanic (no limit to show all)
    const { data: repairsData } = await supabase
      .from('work_registrations')
      .select(`
        id,
        completed,
        completed_at,
        created_at,
        repair_type:repair_types(name),
        bike:bikes(frame_number, model)
      `)
      .eq('mechanic_id', user.id)
      .eq('completed', true)
      .order('completed_at', { ascending: false });

    if (repairsData) {
      setRepairs(repairsData as unknown as RepairWithDetails[]);
    }

    // Fetch current tasks (bikes assigned to this mechanic)
    const { data: tasksData } = await supabase
      .from('bikes')
      .select('id, frame_number, model, workflow_status, table_number')
      .eq('current_mechanic_id', user.id)
      .neq('workflow_status', 'afgerond')
      .order('updated_at', { ascending: false });

    // Also fetch bikes diagnosed by this user that are waiting for approval
    const { data: diagnosedData } = await supabase
      .from('bikes')
      .select('id, frame_number, model, workflow_status, table_number')
      .eq('diagnosed_by', user.id)
      .in('workflow_status', ['wacht_op_akkoord', 'wacht_op_onderdelen'])
      .order('updated_at', { ascending: false });

    // Merge and deduplicate
    const allTasks = [...(tasksData || [])];
    if (diagnosedData) {
      for (const bike of diagnosedData) {
        if (!allTasks.some(t => t.id === bike.id)) {
          allTasks.push(bike);
        }
      }
    }
    setTasks(allTasks);

    // Fetch all bikes diagnosed by this user
    const { data: diagnosedBikes } = await supabase
      .from('bikes')
      .select('id, frame_number, model, workflow_status, table_number, diagnosed_at')
      .eq('diagnosed_by', user.id)
      .order('diagnosed_at', { ascending: false });

    if (diagnosedBikes) {
      setDiagnoses(diagnosedBikes as DiagnosedBike[]);
    }

    setLoading(false);
  };

  const getWorkflowStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      diagnose_nodig: t('diagnosisNeeded'),
      wacht_op_akkoord: t('waitingForApproval'),
      wacht_op_onderdelen: t('waitingForParts'),
      klaar_voor_reparatie: t('readyForRepair'),
      in_reparatie: t('inRepair'),
      afgerond: t('completed'),
    };
    return statusMap[status] || status;
  };

  const completedCount = repairs.length;
  const activeTasksCount = tasks.length;
  const diagnosesCount = diagnoses.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <span className="text-muted-foreground">{t('loading')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              {t('completedRepairs')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Stethoscope className="h-4 w-4" />
              {t('totalDiagnoses')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{diagnosesCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Bike className="h-4 w-4" />
              {t('activeTasks')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeTasksCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Active Tasks */}
      {tasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('currentTasks')}</CardTitle>
            <CardDescription>{t('bikesAssignedToYou')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Bike className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{task.frame_number}</p>
                      <p className="text-sm text-muted-foreground">{task.model}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {task.table_number && (
                      <Badge variant="outline">{t('tableLabel')} {task.table_number}</Badge>
                    )}
                    <Badge variant="secondary">{getWorkflowStatusLabel(task.workflow_status)}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Diagnoses History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('myDiagnoses')}</CardTitle>
          <CardDescription>{t('diagnosesDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {diagnoses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t('noDiagnosesYet')}
            </p>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {diagnoses.map((bike) => (
                  <div
                    key={bike.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Stethoscope className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{bike.frame_number}</p>
                        <p className="text-sm text-muted-foreground">{bike.model}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {bike.table_number && (
                        <Badge variant="outline">{t('tableLabel')} {bike.table_number}</Badge>
                      )}
                      <Badge variant="secondary">{getWorkflowStatusLabel(bike.workflow_status)}</Badge>
                      {bike.diagnosed_at && (
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(bike.diagnosed_at), 'dd MMM', { locale: dateLocale })}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Completed Repairs History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('repairHistory')}</CardTitle>
          <CardDescription>{t('recentCompletedRepairs')}</CardDescription>
        </CardHeader>
        <CardContent>
          {repairs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t('noCompletedRepairsYet')}
            </p>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {repairs.map((repair) => (
                  <div
                    key={repair.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Wrench className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{repair.repair_type?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {repair.bike?.frame_number} • {repair.bike?.model}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {repair.completed_at
                        ? format(new Date(repair.completed_at), 'dd MMM yyyy', { locale: dateLocale })
                        : '-'}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
