import type { EventBus, SubscribeOptions } from "./event-bus.js";

/**
 * A queued event. Wrapping it means `queue.shift()` returning `undefined`
 * unambiguously means "empty", for any `TEvent` — including one that could
 * itself be `undefined` — without a non-null assertion (ADR 0009).
 */
interface Queued<TEvent> {
  event: TEvent;
}

interface Subscriber<TEvent> {
  queue: Queued<TEvent>[];
  /** Resolves the consumer's pending wait, when it is parked. */
  wake: (() => void) | null;
}

/**
 * The in-memory bus, plus introspection the port deliberately omits.
 */
export interface InMemoryEventBus<TEvent> extends EventBus<TEvent> {
  /** How many live subscribers `topic` currently has. */
  subscriberCount(topic: string): number;
}

/**
 * Single-process {@link EventBus} (ADR 0039). Each subscriber gets its own
 * queue, so a slow consumer cannot drop events for a fast one, and nothing is
 * lost between iterations.
 *
 * Subscribers are released when their iteration ends — normally, by `break`, by
 * a thrown error, or by the abort signal — and a topic with no subscribers left
 * is dropped, so neither map nor set grows unbounded as rooms come and go.
 */
export function createInMemoryEventBus<TEvent>(): InMemoryEventBus<TEvent> {
  const topics = new Map<string, Set<Subscriber<TEvent>>>();

  function release(topic: string, subscriber: Subscriber<TEvent>): void {
    const subscribers = topics.get(topic);
    if (subscribers === undefined) {
      return;
    }
    subscribers.delete(subscriber);
    if (subscribers.size === 0) {
      topics.delete(topic);
    }
  }

  return {
    publish(topic, event) {
      const subscribers = topics.get(topic);
      if (subscribers === undefined) {
        return;
      }
      for (const subscriber of subscribers) {
        subscriber.queue.push({ event });
        const { wake } = subscriber;
        subscriber.wake = null;
        wake?.();
      }
    },

    subscribe(topic, options?: SubscribeOptions): AsyncIterable<TEvent> {
      const subscriber: Subscriber<TEvent> = { queue: [], wake: null };
      const subscribers = topics.get(topic) ?? new Set<Subscriber<TEvent>>();
      subscribers.add(subscriber);
      topics.set(topic, subscribers);

      const signal = options?.signal;
      // Registered once (not per wait) so a long-lived subscription does not
      // accumulate listeners on the signal.
      const onAbort = (): void => {
        const { wake } = subscriber;
        subscriber.wake = null;
        wake?.();
      };
      signal?.addEventListener("abort", onAbort, { once: true });

      async function* iterate(): AsyncGenerator<TEvent> {
        try {
          while (signal?.aborted !== true) {
            const next = subscriber.queue.shift();
            if (next !== undefined) {
              yield next.event;
              continue;
            }
            await new Promise<void>((resolve) => {
              subscriber.wake = resolve;
            });
            subscriber.wake = null;
          }
        } finally {
          signal?.removeEventListener("abort", onAbort);
          release(topic, subscriber);
        }
      }

      return iterate();
    },

    subscriberCount(topic) {
      return topics.get(topic)?.size ?? 0;
    },
  };
}
