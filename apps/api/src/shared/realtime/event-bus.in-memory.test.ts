import { describe, expect, it } from "vitest";
import { createInMemoryEventBus } from "./event-bus.in-memory.js";

interface TestEvent {
  value: string;
}

/** Collects `count` events, then returns them. Fails the test if it hangs. */
async function take<T>(
  iterable: AsyncIterable<T>,
  count: number,
): Promise<T[]> {
  const received: T[] = [];
  for await (const event of iterable) {
    received.push(event);
    if (received.length === count) {
      break;
    }
  }
  return received;
}

describe("createInMemoryEventBus", () => {
  it("delivers an event published after subscribing", async () => {
    const bus = createInMemoryEventBus<TestEvent>();
    const events = take(bus.subscribe("room:1"), 1);

    bus.publish("room:1", { value: "hello" });

    await expect(events).resolves.toEqual([{ value: "hello" }]);
  });

  it("delivers the same event to every subscriber of a topic", async () => {
    const bus = createInMemoryEventBus<TestEvent>();
    const first = take(bus.subscribe("room:1"), 1);
    const second = take(bus.subscribe("room:1"), 1);

    bus.publish("room:1", { value: "broadcast" });

    expect(await first).toEqual([{ value: "broadcast" }]);
    expect(await second).toEqual([{ value: "broadcast" }]);
  });

  it("does not deliver events published to a different topic", async () => {
    const bus = createInMemoryEventBus<TestEvent>();
    const events = take(bus.subscribe("room:1"), 1);

    bus.publish("room:2", { value: "other room" });
    bus.publish("room:1", { value: "mine" });

    await expect(events).resolves.toEqual([{ value: "mine" }]);
  });

  it("buffers events published while the consumer is between iterations", async () => {
    const bus = createInMemoryEventBus<TestEvent>();
    const iterable = bus.subscribe("room:1");

    // Published before anyone awaits: must not be dropped.
    bus.publish("room:1", { value: "first" });
    bus.publish("room:1", { value: "second" });

    await expect(take(iterable, 2)).resolves.toEqual([
      { value: "first" },
      { value: "second" },
    ]);
  });

  it("preserves publication order", async () => {
    const bus = createInMemoryEventBus<TestEvent>();
    const iterable = bus.subscribe("room:1");

    for (const value of ["a", "b", "c"]) {
      bus.publish("room:1", { value });
    }

    await expect(take(iterable, 3)).resolves.toEqual([
      { value: "a" },
      { value: "b" },
      { value: "c" },
    ]);
  });

  it("ends the iteration when the signal is aborted", async () => {
    const bus = createInMemoryEventBus<TestEvent>();
    const controller = new AbortController();
    const drained = (async () => {
      const received: TestEvent[] = [];
      for await (const event of bus.subscribe("room:1", {
        signal: controller.signal,
      })) {
        received.push(event);
      }
      return received;
    })();

    bus.publish("room:1", { value: "before abort" });
    // Let the consumer pick it up before aborting.
    await new Promise((resolve) => setImmediate(resolve));
    controller.abort();

    await expect(drained).resolves.toEqual([{ value: "before abort" }]);
  });

  it("yields nothing when the signal is already aborted", async () => {
    const bus = createInMemoryEventBus<TestEvent>();
    const received: TestEvent[] = [];

    for await (const event of bus.subscribe("room:1", {
      signal: AbortSignal.abort(),
    })) {
      received.push(event);
    }

    expect(received).toEqual([]);
  });

  it("stops tracking a subscriber once its iteration ends", async () => {
    const bus = createInMemoryEventBus<TestEvent>();
    const iterable = bus.subscribe("room:1");
    expect(bus.subscriberCount("room:1")).toBe(1);

    bus.publish("room:1", { value: "last one" });
    // Breaking out of the loop must release the subscriber.
    await take(iterable, 1);

    expect(bus.subscriberCount("room:1")).toBe(0);
  });

  it("reports no subscribers for an unknown topic", () => {
    const bus = createInMemoryEventBus<TestEvent>();

    expect(bus.subscriberCount("nobody-here")).toBe(0);
  });

  it("publishing to a topic with no subscribers is a no-op", () => {
    const bus = createInMemoryEventBus<TestEvent>();

    expect(() => bus.publish("empty", { value: "dropped" })).not.toThrow();
  });
});
