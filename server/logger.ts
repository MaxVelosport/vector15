import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  transport: !isProduction
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: {
    service: 'vector15',
    env: process.env.NODE_ENV || 'development',
  },
  redact: {
    paths: [
      'password',
      'token',
      'authorization',
      'cookie',
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.token',
    ],
    remove: true,
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: (req) => ({
      method: req.method,
      url: req.url,
      userAgent: req.headers?.['user-agent'],
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function childLogger(context: Record<string, any>) {
  return logger.child(context);
}
