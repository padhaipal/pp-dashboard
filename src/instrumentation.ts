import { registerOTel } from '@vercel/otel';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

export async function register() {
  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'pp-dashboard',
  });

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);

    const { logs } = await import('@opentelemetry/api-logs');
    const { LoggerProvider, SimpleLogRecordProcessor } = await import(
      '@opentelemetry/sdk-logs'
    );
    const { OTLPLogExporter } = await import(
      '@opentelemetry/exporter-logs-otlp-proto'
    );
    const { resourceFromAttributes } = await import(
      '@opentelemetry/resources'
    );

    const loggerProvider = new LoggerProvider({
      resource: resourceFromAttributes({
        'service.name': process.env.OTEL_SERVICE_NAME ?? 'pp-dashboard',
      }),
      processors: [new SimpleLogRecordProcessor(new OTLPLogExporter())],
    });
    logs.setGlobalLoggerProvider(loggerProvider);
  }
}
