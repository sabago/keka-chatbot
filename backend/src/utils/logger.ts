import crypto from 'crypto';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event_type: string;
  session_id?: string;
  ip_hash?: string;
  details?: Record<string, any>;
}

class Logger {
  private logLevel: LogLevel;

  constructor() {
    this.logLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  private formatLog(entry: LogEntry): string {
    return JSON.stringify(entry);
  }

  private log(level: LogLevel, event_type: string, details?: Record<string, any>): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      event_type,
      ...details,
    };

    const message = this.formatLog(entry);

    switch (level) {
      case 'error':
        console.error(message);
        break;
      case 'warn':
        console.warn(message);
        break;
      case 'debug':
        console.debug(message);
        break;
      default:
        console.log(message);
    }
  }

  // Hash IP for privacy-preserving logging
  hashIP(ip: string): string {
    return crypto.createHash('sha256').update(ip + (process.env.HASH_SALT || 'keka-salt')).digest('hex').substring(0, 16);
  }

  info(event_type: string, details?: Record<string, any>): void {
    this.log('info', event_type, details);
  }

  warn(event_type: string, details?: Record<string, any>): void {
    this.log('warn', event_type, details);
  }

  error(event_type: string, details?: Record<string, any>): void {
    this.log('error', event_type, details);
  }

  debug(event_type: string, details?: Record<string, any>): void {
    this.log('debug', event_type, details);
  }
}

export const logger = new Logger();
