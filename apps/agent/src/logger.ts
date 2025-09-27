import pino from 'pino';
import { context, trace } from '@opentelemetry/api';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: undefined,
  mixin() {
    try {
      const span = trace.getSpan(context.active());
      const sc = span?.spanContext();
      if (sc) {
        return { trace_id: sc.traceId, span_id: sc.spanId };
      }
    } catch {}
    return {};
  },
});
