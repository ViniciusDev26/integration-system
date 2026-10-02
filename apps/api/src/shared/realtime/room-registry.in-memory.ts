import type { LeaveRoom, RoomRegistry } from "./room-registry.js";

/**
 * The in-memory registry, plus introspection the port deliberately omits.
 */
export interface InMemoryRoomRegistry extends RoomRegistry {
  /** How many rooms currently have at least one member. */
  roomCount(): number;
}

/**
 * Single-process {@link RoomRegistry} (ADR 0039).
 *
 * A room maps user id → live connection count; insertion order of the `Map`
 * gives `members()` its join order. A user drops out at zero, and the room
 * itself is dropped when its last member leaves, so presence state does not
 * accumulate as rooms come and go.
 *
 * Being in-process, presence is per instance: scaling out needs sticky routing
 * or an external store behind this port (ADR 0039, consequences).
 */
export function createInMemoryRoomRegistry(): InMemoryRoomRegistry {
  const rooms = new Map<string, Map<string, number>>();

  return {
    join(roomId, userId): LeaveRoom {
      const members = rooms.get(roomId) ?? new Map<string, number>();
      members.set(userId, (members.get(userId) ?? 0) + 1);
      rooms.set(roomId, members);

      let released = false;
      return () => {
        if (released) {
          return;
        }
        released = true;

        const current = rooms.get(roomId);
        const connections = current?.get(userId);
        if (current === undefined || connections === undefined) {
          return;
        }
        if (connections > 1) {
          current.set(userId, connections - 1);
          return;
        }
        current.delete(userId);
        if (current.size === 0) {
          rooms.delete(roomId);
        }
      };
    },

    members(roomId) {
      const members = rooms.get(roomId);
      return members === undefined ? [] : [...members.keys()];
    },

    isMember(roomId, userId) {
      return rooms.get(roomId)?.has(userId) ?? false;
    },

    roomCount() {
      return rooms.size;
    },
  };
}
