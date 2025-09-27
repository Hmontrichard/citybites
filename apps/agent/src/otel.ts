import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

function parseHeaders(input?: string) {
  const headers: Record<string, string> = {};
  if (!input) return headers;
  for (const part of input.split(',')) {
    const [k, v] = part.split('=');
    if (k && v) headers[k.trim()] = v.trim();
  }
  return headers;
}

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
const headers = parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS);

const exporter = endpoint ? new OTLPTraceExporter({ url: endpoint, headers }) : undefined;

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'citybites-agent',
  }),
  traceExporter: exporter,
  instrumentations: [getNodeAutoInstrumentations({})],
});

sdk.start().catch((e) => {
  // eslint-disable-next-line no-console
  console.warn('[otel] failed to start', e?.message || e);
});