import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Bike, ClipboardCheck, Clock, ThumbsUp, Wrench, Check, Tv, User, Cake, PartyPopper, Calendar, MessageSquare } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type BikeWorkflowStatus = Database['public']['Enums']['bike_workflow_status'];
type VanmoofModel = Database['public']['Enums']['vanmoof_model'];

interface RepairInfo {
  id: string;
  name: string;
  completed: boolean;
  mechanic_name?: string;
}

interface BikeData {
  id: string;
  frame_number: string;
  model: VanmoofModel;
  workflow_status: BikeWorkflowStatus;
  table_number: string | null;
  current_mechanic_id: string | null;
  updated_at: string;
  created_at: string;
  mechanic_name?: string;
  repairs: RepairInfo[];
}

// Helper function to calculate days on table
const getDaysOnTable = (createdAt: string): number => {
  const created = new Date(createdAt);
  const now = new Date();
  // Reset to start of day for both
  created.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diffTime = now.getTime() - created.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1; // Dag 1 is de eerste dag
};

interface TableData {
  table_number: string;
  bike: BikeData | null;
}

interface BirthdayPerson {
  id: string;
  full_name: string;
}

interface TVAnnouncement {
  id: string;
  message: string;
  is_active: boolean;
  expires_at: string | null;
  background_color: string;
  text_color: string;
  icon: string;
  is_fullscreen: boolean;
}

const COLOR_GRADIENTS: Record<string, string> = {
  'blue-cyan': 'from-blue-600 via-cyan-500 to-teal-500',
  'red-orange': 'from-red-600 via-orange-500 to-yellow-500',
  'green-emerald': 'from-green-600 via-emerald-500 to-teal-500',
  'purple-pink': 'from-purple-600 via-pink-500 to-rose-500',
  'yellow-amber': 'from-yellow-500 via-amber-500 to-orange-500',
  'gray-slate': 'from-gray-600 via-slate-500 to-zinc-500',
  'indigo-blue': 'from-indigo-600 via-blue-500 to-sky-500',
};

const TEXT_COLORS: Record<string, string> = {
  'white': 'text-white',
  'black': 'text-black',
  'yellow': 'text-yellow-300',
};

const NUMBERED_TABLES = Array.from({ length: 21 }, (_, i) => String(i + 1));
const LETTER_TABLES = ['A', 'B', 'C', 'D', 'E', 'F'];

// Solid background colors for TV display - BOLD, vibrant colors that pop
const WORKFLOW_STATUS_CONFIG: Record<BikeWorkflowStatus, { label: string; bgColor: string; textColor: string; icon: React.ReactNode }> = {
  'diagnose_nodig': { 
    label: 'Diagnose nodig', 
    bgColor: 'bg-red-600', 
    textColor: 'text-white',
    icon: <ClipboardCheck className="h-4 w-4" /> 
  },
  'diagnose_bezig': { 
    label: 'Diagnose bezig', 
    bgColor: 'bg-yellow-400', 
    textColor: 'text-black',
    icon: <ClipboardCheck className="h-4 w-4" /> 
  },
  'wacht_op_akkoord': { 
    label: 'Wacht op akkoord', 
    bgColor: 'bg-orange-500', 
    textColor: 'text-white',
    icon: <Clock className="h-4 w-4" /> 
  },
  'wacht_op_onderdelen': { 
    label: 'Wacht op onderdelen', 
    bgColor: 'bg-fuchsia-600', 
    textColor: 'text-white',
    icon: <Clock className="h-4 w-4" /> 
  },
  'klaar_voor_reparatie': { 
    label: 'Klaar voor reparatie', 
    bgColor: 'bg-cyan-500', 
    textColor: 'text-black',
    icon: <ThumbsUp className="h-4 w-4" /> 
  },
  'in_reparatie': { 
    label: 'In reparatie', 
    bgColor: 'bg-green-500', 
    textColor: 'text-white',
    icon: <Wrench className="h-4 w-4" /> 
  },
  'afgerond': { 
    label: 'Afgerond', 
    bgColor: 'bg-zinc-600', 
    textColor: 'text-white',
    icon: <Check className="h-4 w-4" /> 
  },
};

export default function TVDisplay() {
  const [tables, setTables] = useState<TableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [birthdayPeople, setBirthdayPeople] = useState<BirthdayPerson[]>([]);
  const [announcements, setAnnouncements] = useState<TVAnnouncement[]>([]);

  useEffect(() => {
    fetchData();
    fetchBirthdays();
    fetchAnnouncements();

    // Subscribe to realtime updates for bikes
    const bikesChannel = supabase
      .channel('bikes-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bikes' },
        () => fetchData()
      )
      .subscribe();

    // Subscribe to realtime updates for announcements
    const announcementsChannel = supabase
      .channel('announcements-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tv_announcements' },
        () => fetchAnnouncements()
      )
      .subscribe();

    // Subscribe to realtime updates for profiles
    const profilesChannel = supabase
      .channel('profiles-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          fetchData();
          fetchBirthdays();
        }
      )
      .subscribe();

    // Update time every second
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Polling interval every 5 seconds as backup
    const pollingInterval = setInterval(() => {
      fetchData();
      fetchAnnouncements();
    }, 5000);

    return () => {
      supabase.removeChannel(bikesChannel);
      supabase.removeChannel(announcementsChannel);
      supabase.removeChannel(profilesChannel);
      clearInterval(timeInterval);
      clearInterval(pollingInterval);
    };
  }, []);

  const fetchData = async () => {
    // Fetch all active bikes with table numbers
    const { data: bikesData } = await supabase
      .from('bikes')
      .select('id, frame_number, model, table_number, workflow_status, current_mechanic_id, updated_at, created_at')
      .not('table_number', 'is', null)
      .neq('workflow_status', 'afgerond');

    // Fetch mechanic names
    const mechanicIds = (bikesData || [])
      .map(b => b.current_mechanic_id)
      .filter((id): id is string => id !== null);
    
    let mechanicMap = new Map<string, string>();
    if (mechanicIds.length > 0) {
      const { data: mechanicProfiles } = await supabase
        .from('profiles_limited')
        .select('id, full_name')
        .in('id', [...new Set(mechanicIds)]);
      
      (mechanicProfiles || []).forEach(p => {
        mechanicMap.set(p.id, p.full_name);
      });
    }

    // Fetch work registrations for each bike
    const bikeIds = (bikesData || []).map(b => b.id);
    let repairsMap = new Map<string, RepairInfo[]>();
    if (bikeIds.length > 0) {
      const { data: registrations } = await supabase
        .from('work_registrations')
        .select(`
          id,
          bike_id,
          completed,
          mechanic_id,
          repair_type:repair_types(id, name)
        `)
        .in('bike_id', bikeIds);
      
      // Also fetch mechanic names for completed repairs
      const completedMechanicIds = (registrations || [])
        .filter(r => r.completed && r.mechanic_id)
        .map(r => r.mechanic_id as string);
      
      if (completedMechanicIds.length > 0) {
        const { data: completedMechanics } = await supabase
          .from('profiles_limited')
          .select('id, full_name')
          .in('id', [...new Set(completedMechanicIds)]);
        
        (completedMechanics || []).forEach(p => {
          if (!mechanicMap.has(p.id)) {
            mechanicMap.set(p.id, p.full_name);
          }
        });
      }
      
      // Group repairs by bike
      (registrations || []).forEach(r => {
        const bikeRepairs = repairsMap.get(r.bike_id) || [];
        const repairType = r.repair_type as { id: string; name: string } | null;
        if (repairType) {
          bikeRepairs.push({
            id: r.id,
            name: repairType.name,
            completed: r.completed,
            mechanic_name: r.completed && r.mechanic_id ? mechanicMap.get(r.mechanic_id) : undefined,
          });
        }
        repairsMap.set(r.bike_id, bikeRepairs);
      });
    }

    // Create bike map by table
    const bikesByTable = new Map<string, BikeData>();
    (bikesData || []).forEach((bike) => {
      if (bike.table_number) {
        bikesByTable.set(bike.table_number, {
          ...bike,
          mechanic_name: bike.current_mechanic_id ? mechanicMap.get(bike.current_mechanic_id) : undefined,
          repairs: repairsMap.get(bike.id) || [],
        } as BikeData);
      }
    });

    // Build table data for all tables
    const allTables = [...NUMBERED_TABLES, ...LETTER_TABLES];
    const tableData: TableData[] = allTables.map((tableNum) => ({
      table_number: tableNum,
      bike: bikesByTable.get(tableNum) || null,
    }));

    setTables(tableData);
    setLoading(false);
    setLastUpdated(new Date());
  };

  const fetchBirthdays = async () => {
    const { data: birthdayProfiles } = await supabase
      .rpc('get_todays_birthdays');
    
    if (birthdayProfiles) {
      setBirthdayPeople(birthdayProfiles.map((p: { id: string; full_name: string }) => ({
        id: p.id,
        full_name: p.full_name
      })));
    }
  };

  const fetchAnnouncements = async () => {
    const now = new Date().toISOString();
    
    const { data } = await supabase
      .from('tv_announcements')
      .select('id, message, is_active, expires_at, background_color, text_color, icon, is_fullscreen')
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('created_at', { ascending: false });

    if (data) {
      setAnnouncements(data.map(d => ({
        ...d,
        background_color: d.background_color || 'blue-cyan',
        text_color: d.text_color || 'white',
        icon: d.icon || '📢',
        is_fullscreen: d.is_fullscreen || false
      })));
    }
  };

  // Count bikes per status
  const statusCounts = tables.reduce((acc, table) => {
    if (table.bike) {
      const status = table.bike.workflow_status;
      acc[status] = (acc[status] || 0) + 1;
    }
    return acc;
  }, {} as Record<BikeWorkflowStatus, number>);

  const fullscreenAnnouncement = announcements.find(a => a.is_fullscreen);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-2xl">Laden...</div>
      </div>
    );
  }

  // Fullscreen announcement mode
  if (fullscreenAnnouncement) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${COLOR_GRADIENTS[fullscreenAnnouncement.background_color] || COLOR_GRADIENTS['blue-cyan']} flex flex-col`}>
        <div className="absolute top-6 right-6 text-right">
          <p className={`text-2xl font-mono ${TEXT_COLORS[fullscreenAnnouncement.text_color] || 'text-white'} opacity-80`}>
            {currentTime.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className={`text-sm ${TEXT_COLORS[fullscreenAnnouncement.text_color] || 'text-white'} opacity-60`}>
            {currentTime.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-12">
          <div className="text-center max-w-5xl">
            <span className="text-[120px] block mb-8 animate-bounce">{fullscreenAnnouncement.icon}</span>
            <p className={`text-5xl md:text-6xl lg:text-7xl font-bold ${TEXT_COLORS[fullscreenAnnouncement.text_color] || 'text-white'} leading-tight`}>
              {fullscreenAnnouncement.message}
            </p>
          </div>
        </div>

        <div className={`p-6 text-center ${TEXT_COLORS[fullscreenAnnouncement.text_color] || 'text-white'} opacity-60`}>
          <p className="text-lg">VanFoom Werkplaats</p>
        </div>
      </div>
    );
  }

  const numberedTables = tables.filter(t => NUMBERED_TABLES.includes(t.table_number));
  const letterTables = tables.filter(t => LETTER_TABLES.includes(t.table_number));

  return (
    <div className="h-screen bg-gray-900 text-white p-4 flex flex-col overflow-hidden">
      {/* Birthday Banner */}
      {birthdayPeople.length > 0 && (
        <div className="mb-3 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 rounded-xl p-3">
          <div className="flex items-center justify-center gap-4">
            <PartyPopper className="h-6 w-6 text-yellow-300 animate-bounce" />
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-lg font-bold text-white">
                <Cake className="h-5 w-5" />
                <span>🎉 Gefeliciteerd! 🎉</span>
                <Cake className="h-5 w-5" />
              </div>
              <p className="text-white text-sm">
                {birthdayPeople.length === 1 
                  ? `${birthdayPeople[0].full_name} is vandaag jarig!`
                  : `${birthdayPeople.map(p => p.full_name).join(' & ')} zijn vandaag jarig!`
                }
              </p>
            </div>
            <PartyPopper className="h-6 w-6 text-yellow-300 animate-bounce" style={{ animationDelay: '0.5s' }} />
          </div>
        </div>
      )}

      {/* Announcements */}
      {announcements.length > 0 && announcements.map((announcement) => (
        <div 
          key={announcement.id}
          className={`mb-3 bg-gradient-to-r ${COLOR_GRADIENTS[announcement.background_color] || COLOR_GRADIENTS['blue-cyan']} rounded-xl p-3`}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl flex-shrink-0">{announcement.icon}</span>
            <p className={`text-lg font-medium ${TEXT_COLORS[announcement.text_color] || 'text-white'}`}>
              {announcement.message}
            </p>
          </div>
        </div>
      ))}

      {/* Header with inline legend */}
      <div className="flex items-center justify-between mb-3 gap-4">
        <div className="flex items-center gap-3 flex-shrink-0">
          <Tv className="h-6 w-6 text-blue-400" />
          <div>
            <h1 className="text-xl font-bold">VanFoom Werkplaats</h1>
            <p className="text-gray-400 text-xs">Real-time tafelbezetting</p>
          </div>
        </div>
        
        {/* Legend - With labels always visible */}
        <div className="flex items-center gap-2 flex-wrap justify-center flex-1">
          {Object.entries(WORKFLOW_STATUS_CONFIG).filter(([key]) => key !== 'afgerond').map(([status, config]) => (
            <div 
              key={status} 
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${config.bgColor} ${config.textColor} shadow-md`}
            >
              <span className="opacity-80 scale-75">{config.icon}</span>
              <span className="text-xs font-medium">{config.label}</span>
              <span className="text-sm font-bold ml-0.5">
                {statusCounts[status as BikeWorkflowStatus] || 0}
              </span>
            </div>
          ))}
        </div>
        
        <div className="text-right flex-shrink-0">
          <p className="text-xl font-mono">{currentTime.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}</p>
          <p className="text-gray-400 text-xs">{currentTime.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
        </div>
      </div>

      {/* Numbered Tables Grid */}
      <Card className="bg-gray-800/50 border-gray-700 mb-4 flex-1">
        <CardHeader className="py-2 px-4">
          <CardTitle className="text-base text-gray-200">Tafels 1-21</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 h-full">
          <div className="grid grid-cols-7 gap-2 h-full">
            {numberedTables.map((table) => {
              const bike = table.bike;
              const config = bike ? WORKFLOW_STATUS_CONFIG[bike.workflow_status] : null;
              const daysOnTable = bike ? getDaysOnTable(bike.created_at) : 0;
              const isLongStay = daysOnTable >= 5;
              
              return (
                <div
                  key={table.table_number}
                  className={`
                    rounded-xl p-2 flex flex-col text-center relative
                    transition-all shadow-lg
                    ${bike 
                      ? `${config?.bgColor} ${config?.textColor} ring-2 ring-white/10` 
                      : 'bg-gray-800/60 border border-gray-700'
                    }
                  `}
                >
                  {/* Days indicator badge - top right corner */}
                  {bike && (
                    <div className={`absolute top-1 right-1 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold shadow-md ${
                      isLongStay ? 'bg-red-600 text-white animate-pulse' : 'bg-black/40 text-white/90'
                    }`}>
                      <Calendar className="h-2.5 w-2.5" />
                      <span>{daysOnTable}</span>
                    </div>
                  )}
                  
                  {/* Table Number - Centered at top */}
                  <span className={`text-3xl font-black leading-none drop-shadow-md ${bike ? '' : 'text-gray-600'}`}>
                    {table.table_number}
                  </span>
                  
                  {bike && (
                    <div className="flex flex-col items-center gap-1 mt-1">
                      {/* Model badge */}
                      <div className="flex items-center gap-1 bg-black/20 px-2 py-0.5 rounded-full">
                        <Bike className="h-3 w-3" />
                        <span className="text-xs font-bold">{bike.model}</span>
                      </div>
                      
                      {/* Frame number */}
                      <span className="text-[10px] opacity-75 font-mono">
                        {bike.frame_number}
                      </span>
                      
                      {/* Current Mechanic */}
                      {bike.mechanic_name && (
                        <div className="flex items-center gap-1 opacity-90">
                          <User className="h-3 w-3" />
                          <span className="text-[11px] font-medium">
                            {bike.mechanic_name.split(' ')[0]}
                          </span>
                        </div>
                      )}
                      
                      {/* Repairs as separate badges */}
                      {bike.repairs.length > 0 && (
                        <div className="flex flex-wrap gap-1 justify-center mt-1">
                          {bike.repairs.map((repair) => (
                            <span
                              key={repair.id}
                              className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                                repair.completed 
                                  ? 'bg-black/30 opacity-70' 
                                  : 'bg-white/20'
                              }`}
                            >
                              <span className={repair.completed ? 'line-through' : ''}>
                                {repair.name}
                              </span>
                              {repair.completed && repair.mechanic_name && (
                                <span className="ml-0.5 opacity-75">
                                  ({repair.mechanic_name.split(' ')[0]})
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Empty state */}
                  {!bike && (
                    <span className="text-xs text-gray-500 mt-1">Vrij</span>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Letter Tables Grid */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader className="py-2 px-4">
          <CardTitle className="text-base text-gray-200">Tafels A-F</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="grid grid-cols-6 gap-2">
            {letterTables.map((table) => {
              const bike = table.bike;
              const config = bike ? WORKFLOW_STATUS_CONFIG[bike.workflow_status] : null;
              const daysOnTable = bike ? getDaysOnTable(bike.created_at) : 0;
              const isLongStay = daysOnTable >= 5;
              
              return (
                <div
                  key={table.table_number}
                  className={`
                    rounded-xl p-2 flex flex-col text-center relative
                    transition-all shadow-lg min-h-[100px]
                    ${bike 
                      ? `${config?.bgColor} ${config?.textColor} ring-2 ring-white/10` 
                      : 'bg-gray-800/60 border border-gray-700'
                    }
                  `}
                >
                  {/* Days indicator badge */}
                  {bike && (
                    <div className={`absolute top-1 right-1 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold shadow-md ${
                      isLongStay ? 'bg-red-600 text-white animate-pulse' : 'bg-black/40 text-white/90'
                    }`}>
                      <Calendar className="h-2.5 w-2.5" />
                      <span>{daysOnTable}</span>
                    </div>
                  )}
                  
                  {/* Table Number - Centered at top */}
                  <span className={`text-3xl font-black leading-none drop-shadow-md ${bike ? '' : 'text-gray-600'}`}>
                    {table.table_number}
                  </span>
                  
                  {bike && (
                    <div className="flex flex-col items-center gap-1 mt-1">
                      {/* Model badge */}
                      <div className="flex items-center gap-1 bg-black/20 px-2 py-0.5 rounded-full">
                        <Bike className="h-3 w-3" />
                        <span className="text-xs font-bold">{bike.model}</span>
                      </div>
                      
                      {/* Frame number */}
                      <span className="text-[10px] opacity-75 font-mono">
                        {bike.frame_number}
                      </span>
                      
                      {/* Current Mechanic */}
                      {bike.mechanic_name && (
                        <div className="flex items-center gap-1 opacity-90">
                          <User className="h-3 w-3" />
                          <span className="text-[11px] font-medium">
                            {bike.mechanic_name.split(' ')[0]}
                          </span>
                        </div>
                      )}
                      
                      {/* Repairs as separate badges */}
                      {bike.repairs.length > 0 && (
                        <div className="flex flex-wrap gap-1 justify-center mt-1">
                          {bike.repairs.map((repair) => (
                            <span
                              key={repair.id}
                              className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                                repair.completed 
                                  ? 'bg-black/30 opacity-70' 
                                  : 'bg-white/20'
                              }`}
                            >
                              <span className={repair.completed ? 'line-through' : ''}>
                                {repair.name}
                              </span>
                              {repair.completed && repair.mechanic_name && (
                                <span className="ml-0.5 opacity-75">
                                  ({repair.mechanic_name.split(' ')[0]})
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Empty state */}
                  {!bike && (
                    <span className="text-xs text-gray-500 mt-1">Vrij</span>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="fixed bottom-2 left-1/2 -translate-x-1/2 text-gray-500 text-xs flex items-center gap-1.5">
        <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
        Live updates • {lastUpdated.toLocaleTimeString('nl-NL')}
      </div>
    </div>
  );
}
