import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, Megaphone, Calendar, Eye, Maximize2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/i18n/LanguageContext';

interface Announcement {
  id: string;
  message: string;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
  background_color: string;
  text_color: string;
  icon: string;
  is_fullscreen: boolean;
}

const COLOR_OPTIONS = [
  { value: 'blue-cyan', label: 'Blauw/Cyaan', gradient: 'from-blue-600 via-cyan-500 to-teal-500' },
  { value: 'red-orange', label: 'Rood/Oranje', gradient: 'from-red-600 via-orange-500 to-yellow-500' },
  { value: 'green-emerald', label: 'Groen/Smaragd', gradient: 'from-green-600 via-emerald-500 to-teal-500' },
  { value: 'purple-pink', label: 'Paars/Roze', gradient: 'from-purple-600 via-pink-500 to-rose-500' },
  { value: 'yellow-amber', label: 'Geel/Amber', gradient: 'from-yellow-500 via-amber-500 to-orange-500' },
  { value: 'gray-slate', label: 'Grijs/Leisteen', gradient: 'from-gray-600 via-slate-500 to-zinc-500' },
  { value: 'indigo-blue', label: 'Indigo/Blauw', gradient: 'from-indigo-600 via-blue-500 to-sky-500' },
];

const TEXT_COLOR_OPTIONS = [
  { value: 'white', label: 'Wit', className: 'text-white' },
  { value: 'black', label: 'Zwart', className: 'text-black' },
  { value: 'yellow', label: 'Geel', className: 'text-yellow-300' },
];

const ICON_OPTIONS = ['📢', '⚠️', '🔔', '💡', '🎉', '🔧', '📌', '❗', '✨', '🚨', '📣', '💬'];

const getGradientClass = (colorValue: string) => {
  return COLOR_OPTIONS.find(c => c.value === colorValue)?.gradient || COLOR_OPTIONS[0].gradient;
};

const getTextColorClass = (colorValue: string) => {
  return TEXT_COLOR_OPTIONS.find(c => c.value === colorValue)?.className || 'text-white';
};

export const TVAnnouncementsManager = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('blue-cyan');
  const [textColor, setTextColor] = useState('white');
  const [icon, setIcon] = useState('📢');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    const { data, error } = await supabase
      .from('tv_announcements')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching announcements:', error);
    } else {
      setAnnouncements((data || []).map(d => ({
        ...d,
        background_color: d.background_color || 'blue-cyan',
        text_color: d.text_color || 'white',
        icon: d.icon || '📢',
        is_fullscreen: d.is_fullscreen || false
      })));
    }
    setLoading(false);
  };

  const addAnnouncement = async () => {
    if (!newMessage.trim()) return;

    const { data: userData } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from('tv_announcements')
      .insert({
        message: newMessage.trim(),
        created_by: userData.user?.id,
        expires_at: expiresAt || null,
        background_color: backgroundColor,
        text_color: textColor,
        icon: icon,
        is_fullscreen: isFullscreen
      });

    if (error) {
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive'
      });
    } else {
      toast({
        title: t('success'),
        description: t('announcementAdded')
      });
      setNewMessage('');
      setExpiresAt('');
      setBackgroundColor('blue-cyan');
      setTextColor('white');
      setIcon('📢');
      setIsFullscreen(false);
      fetchAnnouncements();
    }
  };

  const toggleActive = async (id: string, currentState: boolean) => {
    const { error } = await supabase
      .from('tv_announcements')
      .update({ is_active: !currentState })
      .eq('id', id);

    if (error) {
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive'
      });
    } else {
      fetchAnnouncements();
    }
  };

  const toggleFullscreen = async (id: string, currentState: boolean) => {
    const { error } = await supabase
      .from('tv_announcements')
      .update({ is_fullscreen: !currentState })
      .eq('id', id);

    if (error) {
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive'
      });
    } else {
      fetchAnnouncements();
    }
  };

  const deleteAnnouncement = async (id: string) => {
    const { error } = await supabase
      .from('tv_announcements')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive'
      });
    } else {
      toast({
        title: t('success'),
        description: t('announcementDeleted')
      });
      fetchAnnouncements();
    }
  };

  if (loading) {
    return <div className="text-center py-8">{t('loading')}</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            {t('addAnnouncement')}
          </CardTitle>
          <CardDescription>{t('tvAnnouncementsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Message input */}
          <div>
            <Label htmlFor="message">{t('message')}</Label>
            <Textarea
              id="message"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={t('enterAnnouncement')}
              rows={2}
            />
          </div>

          {/* Styling options */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>{t('backgroundColor')}</Label>
              <Select value={backgroundColor} onValueChange={setBackgroundColor}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLOR_OPTIONS.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded bg-gradient-to-r ${color.gradient}`} />
                        {color.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{t('textColor')}</Label>
              <Select value={textColor} onValueChange={setTextColor}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEXT_COLOR_OPTIONS.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded border ${color.value === 'white' ? 'bg-white' : color.value === 'black' ? 'bg-black' : 'bg-yellow-300'}`} />
                        {color.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{t('icon')}</Label>
              <Select value={icon} onValueChange={setIcon}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map((emoji) => (
                    <SelectItem key={emoji} value={emoji}>
                      <span className="text-xl">{emoji}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="expires">{t('expiresAt')}</Label>
              <Input
                id="expires"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>

          {/* Fullscreen toggle */}
          <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
            <Switch
              id="fullscreen"
              checked={isFullscreen}
              onCheckedChange={setIsFullscreen}
            />
            <div className="flex-1">
              <Label htmlFor="fullscreen" className="flex items-center gap-2 cursor-pointer">
                <Maximize2 className="h-4 w-4" />
                {t('fullscreenMode')}
              </Label>
              <p className="text-sm text-muted-foreground">{t('fullscreenModeDescription')}</p>
            </div>
          </div>

          {/* Preview */}
          {newMessage && (
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <Eye className="h-4 w-4" />
                {t('preview')}
              </Label>
              <div className={`bg-gradient-to-r ${getGradientClass(backgroundColor)} rounded-xl p-4`}>
                <div className="flex items-center gap-4">
                  <span className="text-2xl">{icon}</span>
                  <p className={`text-lg font-medium ${getTextColorClass(textColor)}`}>
                    {newMessage}
                  </p>
                </div>
              </div>
            </div>
          )}

          <Button onClick={addAnnouncement} disabled={!newMessage.trim()}>
            <Plus className="h-4 w-4 mr-2" />
            {t('add')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('activeAnnouncements')}</CardTitle>
        </CardHeader>
        <CardContent>
          {announcements.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">{t('noAnnouncements')}</p>
          ) : (
            <div className="space-y-3">
              {announcements.map((announcement) => (
                <div
                  key={announcement.id}
                  className="border rounded-lg overflow-hidden"
                >
                  {/* Preview banner */}
                  <div className={`bg-gradient-to-r ${getGradientClass(announcement.background_color)} p-3 ${announcement.is_fullscreen ? 'border-l-4 border-white' : ''}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{announcement.icon}</span>
                      <p className={`font-medium ${getTextColorClass(announcement.text_color)} ${!announcement.is_active ? 'opacity-50 line-through' : ''}`}>
                        {announcement.message}
                      </p>
                      {announcement.is_fullscreen && (
                        <span className="ml-auto px-2 py-0.5 bg-white/20 rounded text-xs font-medium">
                          <Maximize2 className="h-3 w-3 inline mr-1" />
                          {t('fullscreen')}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Controls */}
                  <div className="flex items-center justify-between p-3 bg-muted/50">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>
                        {new Date(announcement.created_at).toLocaleDateString('nl-NL', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      {announcement.expires_at && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {t('expires')}: {new Date(announcement.expires_at).toLocaleDateString('nl-NL', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={announcement.is_fullscreen}
                          onCheckedChange={() => toggleFullscreen(announcement.id, announcement.is_fullscreen)}
                        />
                        <Label className="text-sm flex items-center gap-1">
                          <Maximize2 className="h-3 w-3" />
                          {t('fullscreen')}
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={announcement.is_active}
                          onCheckedChange={() => toggleActive(announcement.id, announcement.is_active)}
                        />
                        <Label className="text-sm">{t('active')}</Label>
                      </div>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => deleteAnnouncement(announcement.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
