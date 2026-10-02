import type { ResourceMembership } from "../invite/resource-membership.js";
import type { RoomRepository } from "./repository/room.repository.js";
import type { RoomEventBus } from "./room.events.js";
import { roomTopic } from "./room.events.js";

export interface RoomResourceMembershipOptions {
  roomRepository: RoomRepository;
  /** Where a new member is announced to whoever is already in the room. */
  eventBus: RoomEventBus;
}

/**
 * Room adapter for the invite module's {@link ResourceMembership} port
 * (ADR 0040/0041).
 *
 * This file is the entire cost of making rooms invitable: the invite module was
 * not touched, and `ROOM` became a valid resource type by adding it to the enum
 * and the check constraint. That was the bet ADR 0040 made, and it paid.
 *
 * Only an `OWNER` may invite; redeeming grants `MEMBER`.
 */
export function createRoomResourceMembership(
  options: RoomResourceMembershipOptions,
): ResourceMembership {
  const { roomRepository, eventBus } = options;

  return {
    async exists(resourceId) {
      return (await roomRepository.findById(resourceId)) !== null;
    },

    async canInvite(resourceId, userId) {
      return (
        (await roomRepository.getMemberType(resourceId, userId)) === "OWNER"
      );
    },

    async grant(resourceId, userId) {
      const joined = await roomRepository.addMember({
        roomId: resourceId,
        userId,
        type: "MEMBER",
      });

      // Only a real join is announced — redeeming a link twice is normal.
      if (joined) {
        eventBus.publish(roomTopic(resourceId), {
          type: "MEMBER_JOINED",
          roomId: resourceId,
          actorId: userId,
        });
      }
    },
  };
}
