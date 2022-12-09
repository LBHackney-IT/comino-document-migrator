import * as winston from "winston";

export interface Logger {
  log(level: string, message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  debug(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(err: Error, meta?: unknown): void;
}

const errorStackFormat = winston.format((info) => {
  if (info instanceof Error) {
    return {
      ...info,
      stack: info.stack,
      message: info.message,
    };
  }

  if (info.message instanceof Error) {
    return {
      ...info,
      ...info.message,
      stack: info.message.stack,
    };
  }

  return info;
});

const serviceInfoFormat = (service: string) =>
  winston.format((info) => ({
    service,
    ...info,
  }))();

export const createLogger = (service: string, level?: string) =>
  winston.createLogger({
    level,
    format: winston.format.combine(
      errorStackFormat(),
      serviceInfoFormat(service),
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [new winston.transports.Console()],
  });
