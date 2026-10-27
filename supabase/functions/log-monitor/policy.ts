export const KST_HOURS = [15, 16, 17, 19, 20, 21, 22];
export const THRESHOLDS = { peakSecond: 1000, peakMinute: 3000, serverErrors: 20, errorRate: 0.05 };

export type HttpSummary = {
  source: string;
  requests: number;
  responses: number;
  server_errors: number;
  peak_second: number;
  peak_minute: number;
};

export function isScheduledSlot(date: Date): boolean {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return KST_HOURS.includes(kst.getUTCHours()) && kst.getUTCMinutes() === 10 && kst.getUTCSeconds() === 0 && kst.getUTCMilliseconds() === 0;
}

export function windowFor(end: Date) {
  return { start: new Date(end.getTime() - 10 * 60 * 1000).toISOString(), end: end.toISOString() };
}

export function findingsFor(rows: HttpSummary[]): string[] {
  return rows.flatMap((row) => {
    const label = row.source === 'edge_logs' ? 'API Gateway' : 'Edge Functions';
    const findings: string[] = [];
    if (row.peak_second >= THRESHOLDS.peakSecond) findings.push(`${label}: 초당 최대 ${row.peak_second.toLocaleString('en-US')}건 (기준 1,000건)`);
    if (row.peak_minute >= THRESHOLDS.peakMinute) findings.push(`${label}: 분당 최대 ${row.peak_minute.toLocaleString('en-US')}건 (기준 3,000건)`);
    if (row.server_errors >= THRESHOLDS.serverErrors && row.responses > 0 && row.server_errors / row.responses >= THRESHOLDS.errorRate) {
      findings.push(`${label}: 10분간 서버 오류 ${row.server_errors}건 / 응답 ${row.responses}건 (${(row.server_errors / row.responses * 100).toFixed(1)}%)`);
    }
    return findings;
  });
}

// Count each source separately: gateway and function events can describe the same request.
// Aggregating on the server avoids downloading a truncated list of raw log events.
export const HTTP_SQL = `
select source, sum(minute_requests) as requests, sum(minute_responses) as responses,
       sum(minute_errors) as server_errors, max(minute_peak_second) as peak_second,
       max(minute_requests) as peak_minute
from (
  select source, toStartOfMinute(second) as minute, sum(second_requests) as minute_requests,
         sum(second_responses) as minute_responses, sum(second_errors) as minute_errors,
         max(second_requests) as minute_peak_second
  from (
    select source, toStartOfSecond(timestamp) as second, count() as second_requests,
           countIf(toInt32OrZero(log_attributes['response.status_code']) between 100 and 599) as second_responses,
           countIf(toInt32OrZero(log_attributes['response.status_code']) between 500 and 599) as second_errors
    from logs
    where source in ('edge_logs', 'function_edge_logs')
      and log_attributes['request.method'] != 'OPTIONS'
      and log_attributes['request.path'] != '/functions/v1/log-monitor'
      and log_attributes['request.pathname'] != '/functions/v1/log-monitor'
    group by source, second
  ) group by source, minute
) group by source limit 2`;

export function parseSummaries(value: unknown): HttpSummary[] {
  if (!Array.isArray(value) || value.length > 2) throw new Error('invalid_log_result');
  const seen = new Set<string>();
  return value.map((row) => {
    if (!row || typeof row !== 'object' || !['edge_logs', 'function_edge_logs'].includes(row.source) || seen.has(row.source)) throw new Error('invalid_log_source');
    seen.add(row.source);
    const parsed = { source: row.source } as HttpSummary;
    for (const key of ['requests', 'responses', 'server_errors', 'peak_second', 'peak_minute'] as const) {
      if (row[key] === null || row[key] === '' || !['number', 'string'].includes(typeof row[key])) throw new Error('invalid_log_count');
      const count = Number(row[key]);
      if (!Number.isSafeInteger(count) || count < 0) throw new Error('invalid_log_count');
      parsed[key] = count;
    }
    if (parsed.server_errors > parsed.responses || parsed.responses > parsed.requests || parsed.peak_second > parsed.peak_minute || parsed.peak_minute > parsed.requests) throw new Error('inconsistent_log_count');
    return parsed;
  });
}
