CREATE TABLE "playlist_members" (
	"playlist_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "playlist_members_playlist_id_user_id_pk" PRIMARY KEY("playlist_id","user_id"),
	CONSTRAINT "playlist_members_type_check" CHECK ("playlist_members"."type" in ('OWNER', 'MEMBER'))
);
--> statement-breakpoint
CREATE TABLE "playlist_musics" (
	"playlist_id" uuid NOT NULL,
	"music_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "playlist_musics_playlist_id_music_id_pk" PRIMARY KEY("playlist_id","music_id")
);
--> statement-breakpoint
CREATE TABLE "playlists" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "playlist_members" ADD CONSTRAINT "playlist_members_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_members" ADD CONSTRAINT "playlist_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_musics" ADD CONSTRAINT "playlist_musics_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_musics" ADD CONSTRAINT "playlist_musics_music_id_musics_id_fk" FOREIGN KEY ("music_id") REFERENCES "public"."musics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "playlist_members_user_id_idx" ON "playlist_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "playlist_musics_music_id_idx" ON "playlist_musics" USING btree ("music_id");