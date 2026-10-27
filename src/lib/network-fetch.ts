// Abort the underlying request as well as releasing the caller. This lets auth
// release its lock, so a timed-out startup can genuinely be retried.
export function createNetworkFetch(fetcher: typeof fetch, milliseconds = 15000): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController();
    const signal = init?.signal ?? (typeof Request !== 'undefined' && input instanceof Request ? input.signal : null);
    const abort = () => controller.abort();
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, milliseconds);
    try { return await fetcher(input, { ...init, signal: controller.signal }); }
    finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  };
}
