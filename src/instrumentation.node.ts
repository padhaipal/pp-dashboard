import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter(),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter(),
  }),
  logRecordProcessor: new SimpleLogRecordProcessor(new OTLPLogExporter()),
  instrumentations: [getNodeAutoInstrumentations()],
});

try {
  sdk.start();
} catch (error: unknown) {
  const details =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.error(`OTel SDK failed to start: ${details}`);
}

let shutdownStarted = false;
const shutdown = (): void => {
  if (shutdownStarted) return;
  shutdownStarted = true;

  void sdk.shutdown().catch((error: unknown) => {
    const details =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
    console.error(`OTel SDK failed to shutdown: ${details}`);
    process.exitCode = 1;
  });
};
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
