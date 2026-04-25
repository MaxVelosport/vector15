import crypto from 'crypto';
import { randomUUID } from 'crypto';
import { storage } from './storage';
import { BUILTIN_BBB_URL, BUILTIN_BBB_SECRET } from './builtin-config';

let cachedBbbUrl = '';
let cachedBbbSecret = '';
let lastCacheTime = 0;
const CACHE_TTL_MS = 30_000;

async function getBbbConfig(): Promise<{ url: string; secret: string }> {
  const now = Date.now();
  if (now - lastCacheTime < CACHE_TTL_MS && (cachedBbbUrl || process.env.BBB_URL || BUILTIN_BBB_URL)) {
    return {
      url: process.env.BBB_URL || cachedBbbUrl || BUILTIN_BBB_URL,
      secret: process.env.BBB_SECRET || cachedBbbSecret || BUILTIN_BBB_SECRET,
    };
  }
  try {
    const settings = await storage.getAiSettings();
    cachedBbbUrl = settings['bbb_url'] || '';
    cachedBbbSecret = settings['bbb_secret'] || '';
    lastCacheTime = now;
  } catch {
    // fallback to env vars / built-in defaults
  }
  return {
    url: process.env.BBB_URL || cachedBbbUrl || BUILTIN_BBB_URL,
    secret: process.env.BBB_SECRET || cachedBbbSecret || BUILTIN_BBB_SECRET,
  };
}

export function invalidateBbbCache() {
  lastCacheTime = 0;
}

function getApiBase(url: string): string {
  const cleaned = url.replace(/\/$/, '');
  if (cleaned.endsWith('/api')) return cleaned;
  return cleaned + '/api';
}

function getChecksum(apiName: string, queryString: string, secret: string): string {
  return crypto.createHash('sha256').update(apiName + queryString + secret).digest('hex');
}

function buildUrl(apiName: string, params: Record<string, string>, apiBase: string, secret: string): string {
  const queryString = new URLSearchParams(params).toString();
  const checksum = getChecksum(apiName, queryString, secret);
  return `${apiBase}/${apiName}?${queryString}&checksum=${checksum}`;
}

async function fetchXml(url: string): Promise<string> {
  const res = await fetch(url);
  return res.text();
}

function xmlVal(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`));
  return m ? m[1] : null;
}

export async function isBbbConfigured(): Promise<boolean> {
  const { url, secret } = await getBbbConfig();
  return !!(url && secret);
}

export async function getActiveMeetingsCount(): Promise<number> {
  const { url, secret } = await getBbbConfig();
  if (!url || !secret) return 0;
  try {
    const apiBase = getApiBase(url);
    const bbbUrl = buildUrl('getMeetings', {}, apiBase, secret);
    const xml = await fetchXml(bbbUrl);
    return (xml.match(/<meetingID>/g) || []).length;
  } catch {
    return 0;
  }
}

export async function createBbbMeeting(
  meetingId: string,
  title: string,
  attendeePw: string,
  moderatorPw: string,
): Promise<{ success: boolean; error?: string }> {
  const { url, secret } = await getBbbConfig();
  if (!url || !secret) return { success: false, error: 'BBB не настроен' };
  try {
    const apiBase = getApiBase(url);
    const bbbUrl = buildUrl('create', {
      meetingID: meetingId,
      name: title,
      attendeePW: attendeePw,
      moderatorPW: moderatorPw,
      record: 'true',
      autoStartRecording: 'true',
      allowStartStopRecording: 'true',
      endWhenNoModerator: 'true',
      endWhenNoModeratorDelayInMinutes: '30',
    }, apiBase, secret);
    const xml = await fetchXml(bbbUrl);
    const code = xmlVal(xml, 'returncode');
    if (code !== 'SUCCESS' && code !== 'DUPLICATE') {
      return { success: false, error: xmlVal(xml, 'message') || 'Ошибка создания' };
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getBbbJoinUrl(
  meetingId: string,
  fullName: string,
  password: string,
  userId?: string,
  role: 'moderator' | 'viewer' = 'viewer',
): Promise<string> {
  const { url, secret } = await getBbbConfig();
  const apiBase = getApiBase(url);
  const params: Record<string, string> = {
    meetingID: meetingId,
    fullName,
    password,
    redirect: 'true',
    role,
  };
  if (userId) params.userID = userId;
  return buildUrl('join', params, apiBase, secret);
}

export async function endBbbMeeting(
  meetingId: string,
  moderatorPw: string,
): Promise<{ success: boolean }> {
  const { url, secret } = await getBbbConfig();
  if (!url || !secret) return { success: false };
  try {
    await fetchXml(buildUrl('end', { meetingID: meetingId, password: moderatorPw }, getApiBase(url), secret));
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function isBbbMeetingRunning(meetingId: string): Promise<boolean> {
  const { url, secret } = await getBbbConfig();
  if (!url || !secret) return false;
  try {
    const xml = await fetchXml(buildUrl('isMeetingRunning', { meetingID: meetingId }, getApiBase(url), secret));
    return xmlVal(xml, 'running') === 'true';
  } catch {
    return false;
  }
}

export interface BbbRecording {
  recordId: string;
  meetingId: string;
  name: string;
  published: boolean;
  startTime: number;
  endTime: number;
  participants: number;
  playbackUrl: string | null;
}

/**
 * Автоматически создаёт записи конференций в БД для всех учеников всех репетиторов,
 * у которых ещё нет постоянной комнаты.
 * Запускается при старте сервера и при сохранении BBB настроек.
 * BBB-митинг создаётся лениво при первом входе (join endpoint).
 */
export async function ensureConferencesForAllTutors(): Promise<void> {
  try {
    const tutors = await storage.getAllTutors();
    for (const tutor of tutors) {
      try {
        const [students, existingConfs] = await Promise.all([
          storage.getStudentsByTutorId(tutor.id),
          storage.getConferencesByTutorId(tutor.id),
        ]);
        const studentsWithConf = new Set(
          existingConfs.filter(c => c.studentId).map(c => c.studentId)
        );
        for (const student of students) {
          if (!studentsWithConf.has(student.id)) {
            const meetingId = `vektor-${tutor.id.slice(0, 8)}-${randomUUID().slice(0, 8)}`;
            const attendeePw = randomUUID().slice(0, 12);
            const moderatorPw = randomUUID().slice(0, 12);
            const title = `${student.name} — ${tutor.name}`;
            await storage.createConference({
              tutorId: tutor.id,
              studentId: student.id,
              title,
              meetingId,
              attendeePw,
              moderatorPw,
              isOneTime: false,
            });
          }
        }
      } catch (_e) { /* пропускаем ошибку конкретного репетитора */ }
    }
  } catch (_e) { /* некритично — конференции создадутся вручную */ }
}

export async function getBbbRecordings(meetingId?: string): Promise<BbbRecording[]> {
  const { url, secret } = await getBbbConfig();
  if (!url || !secret) return [];
  try {
    const params: Record<string, string> = {};
    if (meetingId) params.meetingID = meetingId;
    const xml = await fetchXml(buildUrl('getRecordings', params, getApiBase(url), secret));
    const recordings: BbbRecording[] = [];
    const recordingBlocks = xml.match(/<recording>[\s\S]*?<\/recording>/g) ?? [];
    for (const block of recordingBlocks) {
      const get = (tag: string) => {
        const m = block.match(new RegExp(`<${tag}>(.*?)<\/${tag}>`));
        return m ? m[1] : '';
      };
      const playbackUrl = block.match(/<url>(.*?)<\/url>/)?.[1] ?? null;
      recordings.push({
        recordId: get('recordID'),
        meetingId: get('meetingID'),
        name: get('name'),
        published: get('published') === 'true',
        startTime: parseInt(get('startTime') || '0', 10),
        endTime: parseInt(get('endTime') || '0', 10),
        participants: parseInt(get('participants') || '0', 10),
        playbackUrl,
      });
    }
    return recordings;
  } catch {
    return [];
  }
}
