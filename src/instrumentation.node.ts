import {
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
  type DiagLogger,
} from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { SimpleLogRecordProcessor } from "@opentelemetry/sdk-logs";
import {
  AggregationType,
  createAllowListAttributesProcessor,
  PeriodicExportingMetricReader,
  type ViewOptions,
} from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";

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

// Honor the standard OTEL_METRICS_EXPORTER=none (previously inert because
// the exporter is constructed explicitly). Staging sets it so redeploy
// churn stops minting duplicate series against Grafana Cloud's free-tier
// active-series cap.
const metricsDisabled = process.env.OTEL_METRICS_EXPORTER === "none";

// Series-identity: Grafana Cloud keys metric series on service.name +
// service.instance.id; the SDK default id is a random UUID per process, so
// every redeploy strands a duplicate series set. Constant env-qualified id
// keeps series continuous (deployment_environment is NOT part of series
// identity, hence the env suffix).
// ⚠️ Single-replica assumption — this service is user-facing and may scale
// out later: at >1 replica set SERVICE_INSTANCE_ID per-replica (e.g.
// $RAILWAY_REPLICA_ID) or replicas will write into one series and corrupt
// every counter.
const serviceInstanceId =
  process.env.SERVICE_INSTANCE_ID ??
  `${process.env.OTEL_SERVICE_NAME ?? "pp-dashboard"}-${
    process.env.ENV ?? process.env.RAILWAY_ENVIRONMENT_NAME ?? "development"
  }`;
if (!process.env.OTEL_RESOURCE_ATTRIBUTES?.includes("service.instance.id=")) {
  process.env.OTEL_RESOURCE_ATTRIBUTES = [
    process.env.OTEL_RESOURCE_ATTRIBUTES,
    `service.instance.id=${serviceInstanceId}`,
  ]
    .filter(Boolean)
    .join(",");
}

// Cardinality diet, future-proofed for the user-facing role: KEEP per-route
// server latency (slim buckets) and DB operation latency; drop what has
// never been queried (client-call histograms x2 semconv generations, GC
// pauses, per-heap-space memory breakdowns — totals kept).
const metricViews: ViewOptions[] = [
  {
    instrumentName: "http.client.duration",
    aggregation: { type: AggregationType.DROP },
  },
  {
    instrumentName: "http.client.request.duration",
    aggregation: { type: AggregationType.DROP },
  },
  {
    instrumentName: "v8js.gc.duration",
    aggregation: { type: AggregationType.DROP },
  },
  {
    instrumentName: "v8js.memory.heap.space.available_size",
    aggregation: { type: AggregationType.DROP },
  },
  {
    instrumentName: "v8js.memory.heap.space.physical_size",
    aggregation: { type: AggregationType.DROP },
  },
  {
    instrumentName: "v8js.memory.heap.used",
    attributesProcessors: [createAllowListAttributesProcessor([])],
  },
  {
    instrumentName: "v8js.memory.heap.limit",
    attributesProcessors: [createAllowListAttributesProcessor([])],
  },
  {
    instrumentName: "http.server.duration",
    aggregation: {
      type: AggregationType.EXPLICIT_BUCKET_HISTOGRAM,
      options: { boundaries: [10, 50, 100, 250, 500, 1000, 2500, 10000] },
    },
  },
  {
    instrumentName: "db.client.operation.duration",
    aggregation: {
      type: AggregationType.EXPLICIT_BUCKET_HISTOGRAM,
      options: { boundaries: [0.005, 0.025, 0.1, 0.25, 0.5, 1, 2.5, 10] },
    },
  },
];

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter(),
  ...(metricsDisabled
    ? {}
    : {
        metricReaders: [
          new PeriodicExportingMetricReader({
            exporter: new OTLPMetricExporter(),
          }),
        ],
        views: metricViews,
      }),
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
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
