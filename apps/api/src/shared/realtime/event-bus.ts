/** Options for {@link EventBus.subscribe}. */
export interface SubscribeOptions {
  /**
   * Ends the iteration when aborted. tRPC hands subscription resolvers a signal
   * that fires when the client goes away, so passing it through is what releases
   * the subscriber.
   */
  signal?: AbortSignal;
}

/**
 * Port for server-initiated fan-out (ADR 0039). Publishers push an event onto a
 * **topic**; every live subscriber of that topic receives it, in publication
 * order, as an async iterable — the shape tRPC subscription resolvers consume
 * directly.
 *
 * Topics are opaque strings. The convention is `<kind>:<id>` (e.g. `room:<uuid>`),
 * which is how a room's fan-out is expressed without a rooms primitive.
 *
 * Adapters: `createInMemoryEventBus` (single process). Crossing processes would
 * need a pub/sub-backed adapter behind this same port — see ADR 0039's
 * consequences on horizontal scaling.
 */
export interface EventBus<TEvent> {
  /** Delivers `event` to every current subscriber of `topic`. */
  publish(topic: string, event: TEvent): void;
  /**
   * Subscribes to `topic`. The subscriber is registered **eagerly**, before the
   * returned iterable is first awaited, so events published in between are
   * buffered rather than lost. Iterating to completion (or aborting the signal)
   * releases it.
   */
  subscribe(topic: string, options?: SubscribeOptions): AsyncIterable<TEvent>;
}
