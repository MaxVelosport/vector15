import { botManager } from './telegram-bot';
import { logger } from './logger';

const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;

export type AlertLevel = 'critical';

export interface AlertContext {
  url?: string;
  method?: string;
  userId?: string;
  errorMessage?: string;
  stack?: string;
  [key: string]: any;
}

/**
 * Отправить админ-алерт в Telegram.
 * Безопасный: никогда не throw, не блокирует приложение.
 * Если TELEGRAM_ADMIN_CHAT_ID не задан — просто warn в console.
 */
export async function sendAdminAlert(
  level: AlertLevel,
  title: string,
  context?: AlertContext
): Promise<void> {
  if (!ADMIN_CHAT_ID) {
    logger.warn('[admin-alerts] TELEGRAM_ADMIN_CHAT_ID не задан, пропускаем алерт');
    return;
  }

  try {
    const time = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const lines: string[] = [];

    lines.push(`🟥 *${level.toUpperCase()}*`);
    lines.push(`📅 ${time} UTC`);
    lines.push('');
    lines.push(`*${escapeMd(title)}*`);

    if (context) {
      if (context.url) {
        lines.push(`🔗 ${context.method || 'GET'} \`${context.url}\``);
      }
      if (context.userId) {
        lines.push(`👤 user: \`${context.userId}\``);
      }
      if (context.errorMessage) {
        const trimmed = context.errorMessage.slice(0, 300);
        const suffix = context.errorMessage.length > 300 ? '...' : '';
        lines.push('');
        lines.push(`💥 ${escapeMd(trimmed)}${suffix}`);
      }
      if (context.stack) {
        const stackTrimmed = context.stack.slice(0, 500);
        lines.push('');
        lines.push('```');
        lines.push(stackTrimmed);
        lines.push('```');
      }
    }

    let message = lines.join('\n');
    if (message.length > 4000) {
      message = message.slice(0, 4000) + '\n...(обрезано)';
    }

    await botManager.sendToChatId(ADMIN_CHAT_ID, message, {
      parse_mode: 'Markdown',
      disable_notification: false,
    });
  } catch (error) {
    logger.error({ err: error }, '[admin-alerts] Ошибка отправки алерта');
  }
}

// Минимальное экранирование для Markdown Telegram (основные спецсимволы)
function escapeMd(text: string): string {
  return text
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/`/g, '\\`');
}
