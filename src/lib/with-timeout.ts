import { StudyError } from './contracts.ts';

// The original operation may still settle. Its result never continues the timed-out caller.
// Mutating callers must keep their persisted request ID and reconcile uncertain outcomes.
export async function withTimeout<T>(operation: Promise<T>, milliseconds: number, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new StudyError('NETWORK', message)), milliseconds);
    })]);
  } finally { clearTimeout(timeout); }
}
