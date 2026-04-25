export type ConferenceService = 'zoom' | 'google_meet' | 'teams' | 'jitsi' | 'internal' | 'webex' | 'discord' | 'custom';

export interface ConferenceInfo {
  service: ConferenceService;
  displayName: string;
  url: string;
  isInternal: boolean;
  roomName?: string;
  embedUrl?: string;
  color: string;
  bgColor: string;
}

const SERVICE_META: Record<ConferenceService, { displayName: string; color: string; bgColor: string }> = {
  zoom:        { displayName: 'Zoom',                 color: 'text-blue-600',    bgColor: 'bg-blue-500/10 border-blue-500/20' },
  google_meet: { displayName: 'Google Meet',          color: 'text-green-600',   bgColor: 'bg-green-500/10 border-green-500/20' },
  teams:       { displayName: 'Microsoft Teams',      color: 'text-indigo-600',  bgColor: 'bg-indigo-500/10 border-indigo-500/20' },
  webex:       { displayName: 'Cisco Webex',          color: 'text-emerald-600', bgColor: 'bg-emerald-500/10 border-emerald-500/20' },
  jitsi:       { displayName: 'Jitsi Meet',           color: 'text-cyan-600',    bgColor: 'bg-cyan-500/10 border-cyan-500/20' },
  internal:    { displayName: 'Внутренняя конференция', color: 'text-primary',   bgColor: 'bg-primary/10 border-primary/20' },
  discord:     { displayName: 'Discord',              color: 'text-violet-600',  bgColor: 'bg-violet-500/10 border-violet-500/20' },
  custom:      { displayName: 'Конференция',          color: 'text-foreground',  bgColor: 'bg-muted border-border/50' },
};

export function parseConferenceLink(link: string | undefined | null): ConferenceInfo | null {
  if (!link) return null;

  if (link.startsWith('jitsi:')) {
    const roomName = link.slice(6);
    const embedUrl = `https://meet.jit.si/${encodeURIComponent(roomName)}`;
    const meta = SERVICE_META.internal;
    return { service: 'internal', ...meta, url: embedUrl, isInternal: true, roomName, embedUrl };
  }

  const url = link.startsWith('http') ? link : `https://${link}`;

  let service: ConferenceService = 'custom';
  if (url.includes('zoom.us'))                        service = 'zoom';
  else if (url.includes('meet.google.com'))           service = 'google_meet';
  else if (url.includes('teams.microsoft.com') || url.includes('teams.live.com')) service = 'teams';
  else if (url.includes('webex.com'))                 service = 'webex';
  else if (url.includes('meet.jit.si'))               service = 'jitsi';
  else if (url.includes('discord.gg') || url.includes('discord.com')) service = 'discord';

  const meta = SERVICE_META[service];
  return { service, ...meta, url, isInternal: false };
}

export function generateRoomName(studentName: string): string {
  const translit: Record<string, string> = {
    а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"yo",ж:"zh",з:"z",и:"i",й:"y",
    к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",
    х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sch",ы:"y",э:"e",ю:"yu",я:"ya",
  };
  const part = (studentName.split(' ')[0] || 'student').toLowerCase()
    .replace(/[а-яё]/g, c => translit[c] || c)
    .replace(/[^a-z0-9]/g, '');
  const rand = Math.random().toString(36).slice(2, 7);
  return `VektorRoom-${part || 'room'}-${rand}`;
}

export function makeInternalLink(roomName: string): string {
  return `jitsi:${roomName}`;
}

export function getJitsiEmbedUrl(roomName: string, displayName: string): string {
  const params = new URLSearchParams({
    'config.startWithVideoMuted': 'false',
    'config.startWithAudioMuted': 'false',
    'config.disableModeratorIndicator': 'true',
    'config.prejoinPageEnabled': 'false',
    'userInfo.displayName': displayName,
  });
  return `https://meet.jit.si/${encodeURIComponent(roomName)}#${params.toString()}`;
}
