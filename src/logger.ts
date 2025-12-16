type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_COLORS = {
  debug: '\x1b[36m', // cyan
  info: '\x1b[32m',  // green
  warn: '\x1b[33m',  // yellow
  error: '\x1b[31m', // red
  reset: '\x1b[0m',
  dim: '\x1b[2m',
};

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private minLevel: LogLevel = 'debug';
  private context?: string;

  constructor(context?: string) {
    this.context = context;
    const envLevel = process.env.LOG_LEVEL as LogLevel;
    if (envLevel && LOG_LEVEL_PRIORITY[envLevel] !== undefined) {
      this.minLevel = envLevel;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel];
  }

  private formatTimestamp(): string {
    const now = new Date();
    return now.toISOString().replace('T', ' ').slice(0, -1);
  }

  private formatMessage(level: LogLevel, message: string, data?: Record<string, unknown>): string {
    const timestamp = `${LOG_COLORS.dim}${this.formatTimestamp()}${LOG_COLORS.reset}`;
    const levelStr = `${LOG_COLORS[level]}${level.toUpperCase().padEnd(5)}${LOG_COLORS.reset}`;
    const contextStr = this.context ? `${LOG_COLORS.dim}[${this.context}]${LOG_COLORS.reset} ` : '';

    let output = `${timestamp} ${levelStr} ${contextStr}${message}`;

    if (data && Object.keys(data).length > 0) {
      const dataStr = Object.entries(data)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(' ');
      output += ` ${LOG_COLORS.dim}${dataStr}${LOG_COLORS.reset}`;
    }

    return output;
  }

  debug(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, data));
    }
  }

  info(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, data));
    }
  }

  warn(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, data));
    }
  }

  error(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, data));
    }
  }

  child(context: string): Logger {
    const childLogger = new Logger(this.context ? `${this.context}:${context}` : context);
    childLogger.minLevel = this.minLevel;
    return childLogger;
  }
}

export const logger = new Logger();
export const createLogger = (context: string) => new Logger(context);
