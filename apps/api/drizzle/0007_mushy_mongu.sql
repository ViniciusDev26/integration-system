CREATE TABLE "room_members" (
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_members_room_id_user_id_pk" PRIMARY KEY("room_id","user_id"),
	CONSTRAINT "room_members_type_check" CHECK ("room_members"."type" in ('OWNER', 'MEMBER'))
);
--> statement-breakpoint
CREATE TABLE "room_musics" (
	"room_id" uuid NOT NULL,
	"music_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_musics_room_id_music_id_pk" PRIMARY KEY("room_id","music_id")
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"current_music_id" uuid,
	"position_ms" integer DEFAULT 0 NOT NULL,
	"is_playing" boolean DEFAULT false NOT NULL,
	"playback_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rooms_position_ms_check" CHECK ("rooms"."position_ms" >= 0)
);
--> statement-breakpoint
ALTER TABLE "invites" DROP CONSTRAINT "invites_resource_type_check";--> statement-breakpoint
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_musics" ADD CONSTRAINT "room_musics_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_musics" ADD CONSTRAINT "room_musics_music_id_musics_id_fk" FOREIGN KEY ("music_id") REFERENCES "public"."musics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_current_music_id_musics_id_fk" FOREIGN KEY ("current_music_id") REFERENCES "public"."musics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "room_members_user_id_idx" ON "room_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "room_musics_music_id_idx" ON "room_musics" USING btree ("music_id");--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_resource_type_check" CHECK ("invites"."resource_type" in ('PLAYLIST', 'ROOM'));