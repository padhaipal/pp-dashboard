import { registerOTel } from '@vercel/otel';

export async function register() {
  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'pp-dashboard',
  });

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { logs } = await import('@opentelemetry/api-logs');
    const { LoggerProvider, BatchLogRecordProcessor } = await import(
      '@opentelemetry/sdk-logs'
    );
    const { OTLPLogExporter } = await import(
      '@opentelemetry/exporter-logs-otlp-proto'
    );

    const loggerProvider = new LoggerProvider({
      processors: [new BatchLogRecordProcessor(new OTLPLogExporter())],
    });
    logs.setGlobalLoggerProvider(loggerProvider);
  }
}
