import {
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
  type DiagLogger,
} from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';

const SUPPRESSED_DIAG_WARN_PATTERNS = [/Inconsistent start and end time/i];

const baseDiagLogger = new DiagConsoleLogger();
const filteredDiagLogger: DiagLogger = {
  verbose: (m, ...a) => baseDiagLogger.verbose(m, ...a),
  debug: (m, ...a) => baseDiagLogger.debug(m, ...a),
  info: (m, ...a) => baseDiagLogger.info(m, ...a),
  warn: (m, ...a) => {
    if (SUPPRESSED_DIAG_WARN_PATTERNS.some((p) => p.test(m))) return;
    baseDiagLogger.warn(m, ...a);
  },
  error: (m, ...a) => baseDiagLogger.error(m, ...a),
};
diag.setLogger(filteredDiagLogger, DiagLogLevel.WARN);

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter(),
  metricReaders: [
    new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(),
    }),
  ],
  logRecordProcessors: [new SimpleLogRecordProcessor(new OTLPLogExporter())],
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
