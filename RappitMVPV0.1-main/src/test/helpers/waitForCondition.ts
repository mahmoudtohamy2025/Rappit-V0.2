/**
 * Wait for condition with exponential backoff
 *
 * @param condition - Function that returns true when condition is met
 * @param timeoutMs - Maximum time to wait (default: 5000ms)
 * @param intervalMs - Initial polling interval (default: 100ms)
 * @param maxIntervalMs - Maximum polling interval (default: 1000ms)
 */
export async function waitForCondition(
  condition: () => Promise<boolean> | boolean,
  timeoutMs: number = 5000,
  intervalMs: number = 100,
  maxIntervalMs: number = 1000,
): Promise<void> {
  const startTime = Date.now();
  let currentInterval = intervalMs;

  while (Date.now() - startTime < timeoutMs) {
    try {
      const result = await condition();
      if (result) {
        return;
      }
    } catch (error) {
      // Condition threw error, continue polling
    }

    // Wait with exponential backoff
    await new Promise((resolve) => setTimeout(resolve, currentInterval));

    // Increase interval (exponential backoff)
    currentInterval = Math.min(currentInterval * 1.5, maxIntervalMs);
  }

  throw new Error(
    `Condition not met within ${timeoutMs}ms`,
  );
}

/**
 * Wait for database record to exist
 */
export async function waitForRecord(
  findFn: () => Promise<any>,
  timeoutMs: number = 5000,
): Promise<any> {
  let record: any = null;

  await waitForCondition(async () => {
    record = await findFn();
    return !!record;
  }, timeoutMs);

  return record;
}

/**
 * Wait for count to reach expected value
 */
export async function waitForCount(
  countFn: () => Promise<number>,
  expectedCount: number,
  timeoutMs: number = 5000,
): Promise<void> {
  await waitForCondition(async () => {
    const count = await countFn();
    return count === expectedCount;
  }, timeoutMs);
}
