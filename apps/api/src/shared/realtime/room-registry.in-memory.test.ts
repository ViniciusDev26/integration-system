import { describe, expect, it } from "vitest";
import { createInMemoryRoomRegistry } from "./room-registry.in-memory.js";

describe("createInMemoryRoomRegistry", () => {
  it("lists a user that joined", () => {
    const registry = createInMemoryRoomRegistry();

    registry.join("room-1", "user-a");

    expect(registry.members("room-1")).toEqual(["user-a"]);
  });

  it("reports no members for an unknown room", () => {
    const registry = createInMemoryRoomRegistry();

    expect(registry.members("never-used")).toEqual([]);
  });

  it("lists every distinct user in the room, in join order", () => {
    const registry = createInMemoryRoomRegistry();

    registry.join("room-1", "user-a");
    registry.join("room-1", "user-b");

    expect(registry.members("room-1")).toEqual(["user-a", "user-b"]);
  });

  it("keeps rooms independent", () => {
    const registry = createInMemoryRoomRegistry();

    registry.join("room-1", "user-a");
    registry.join("room-2", "user-b");

    expect(registry.members("room-1")).toEqual(["user-a"]);
    expect(registry.members("room-2")).toEqual(["user-b"]);
  });

  it("counts a user once when the same user joins from two connections", () => {
    const registry = createInMemoryRoomRegistry();

    registry.join("room-1", "user-a");
    registry.join("room-1", "user-a");

    expect(registry.members("room-1")).toEqual(["user-a"]);
  });

  it("keeps the user present while another of their connections remains", () => {
    const registry = createInMemoryRoomRegistry();
    const leaveFirstTab = registry.join("room-1", "user-a");
    registry.join("room-1", "user-a");

    leaveFirstTab();

    expect(registry.members("room-1")).toEqual(["user-a"]);
  });

  it("removes the user once their last connection leaves", () => {
    const registry = createInMemoryRoomRegistry();
    const leaveFirstTab = registry.join("room-1", "user-a");
    const leaveSecondTab = registry.join("room-1", "user-a");

    leaveFirstTab();
    leaveSecondTab();

    expect(registry.members("room-1")).toEqual([]);
  });

  it("ignores a leave handle invoked more than once", () => {
    const registry = createInMemoryRoomRegistry();
    const leaveFirstTab = registry.join("room-1", "user-a");
    registry.join("room-1", "user-a");

    leaveFirstTab();
    leaveFirstTab();

    expect(registry.members("room-1")).toEqual(["user-a"]);
  });

  it("answers isMember for present and absent users", () => {
    const registry = createInMemoryRoomRegistry();
    const leave = registry.join("room-1", "user-a");

    expect(registry.isMember("room-1", "user-a")).toBe(true);
    expect(registry.isMember("room-1", "user-b")).toBe(false);
    expect(registry.isMember("room-2", "user-a")).toBe(false);

    leave();

    expect(registry.isMember("room-1", "user-a")).toBe(false);
  });

  it("drops the room once the last member leaves", () => {
    const registry = createInMemoryRoomRegistry();
    const leave = registry.join("room-1", "user-a");
    expect(registry.roomCount()).toBe(1);

    leave();

    expect(registry.roomCount()).toBe(0);
  });
});
