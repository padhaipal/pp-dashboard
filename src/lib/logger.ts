import { logs, SeverityNumber } from '@opentelemetry/api-logs';

const otelLogger = logs.getLogger('pp-dashboard');

type ConsoleMethod = 'log' | 'warn' | 'error' | 'debug';

function emit(
  severityText: string,
  severityNumber: SeverityNumber,
  consoleMethod: ConsoleMethod,
  message: unknown,
  ...rest: unknown[]
): void {
  console[consoleMethod](message, ...rest);

  const lastParam = rest[rest.length - 1];
  const logContext = typeof lastParam === 'string' ? lastParam : undefined;

  const firstParam = rest[0];
  const stack =
    severityNumber >= SeverityNumber.ERROR &&
    rest.length >= 2 &&
    typeof firstParam === 'string'
      ? firstParam
      : undefined;

  otelLogger.emit({
    severityNumber,
    severityText,
    body: typeof message === 'string' ? message : JSON.stringify(message),
    attributes: {
      ...(logContext !== undefined ? { 'log.context': logContext } : {}),
      ...(stack !== undefined ? { 'exception.stacktrace': stack } : {}),
    },
  });
}

export const logger = {
  info: (m: unknown, ...r: unknown[]) =>
    emit('INFO', SeverityNumber.INFO, 'log', m, ...r),
  warn: (m: unknown, ...r: unknown[]) =>
    emit('WARN', SeverityNumber.WARN, 'warn', m, ...r),
  error: (m: unknown, ...r: unknown[]) =>
    emit('ERROR', SeverityNumber.ERROR, 'error', m, ...r),
  fatal: (m: unknown, ...r: unknown[]) =>
    emit('FATAL', SeverityNumber.FATAL, 'error', m, ...r),
  debug: (m: unknown, ...r: unknown[]) =>
    emit('DEBUG', SeverityNumber.DEBUG, 'debug', m, ...r),
  verbose: (m: unknown, ...r: unknown[]) =>
    emit('TRACE', SeverityNumber.TRACE, 'debug', m, ...r),
};
