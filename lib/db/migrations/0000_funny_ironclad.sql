CREATE TABLE "bag_tags" (
	"bag_id" integer,
	"tag_id" integer,
	CONSTRAINT "bag_tags_bag_id_tag_id_pk" PRIMARY KEY("bag_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "bags" (
	"id" serial PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"filepath" text NOT NULL,
	"size" integer NOT NULL,
	"duration" real,
	"start_time" timestamp,
	"end_time" timestamp,
	"message_count" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"processed" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "frames" (
	"id" serial PRIMARY KEY NOT NULL,
	"topic_id" integer,
	"timestamp" real NOT NULL,
	"sequence_number" integer NOT NULL,
	"file_path" text NOT NULL,
	"width" integer,
	"height" integer
);
--> statement-breakpoint
CREATE TABLE "imu_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"bag_id" integer,
	"timestamp" real NOT NULL,
	"angular_velocity" jsonb,
	"linear_acceleration" jsonb
);
--> statement-breakpoint
CREATE TABLE "pose_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"bag_id" integer,
	"timestamp" real NOT NULL,
	"x" real NOT NULL,
	"y" real NOT NULL,
	"z" real NOT NULL,
	"qx" real NOT NULL,
	"qy" real NOT NULL,
	"qz" real NOT NULL,
	"qw" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"color" text
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" serial PRIMARY KEY NOT NULL,
	"bag_id" integer,
	"name" text NOT NULL,
	"message_type" text NOT NULL,
	"message_count" integer NOT NULL,
	"frequency" real,
	"cover_image_path" text
);
--> statement-breakpoint
ALTER TABLE "bag_tags" ADD CONSTRAINT "bag_tags_bag_id_bags_id_fk" FOREIGN KEY ("bag_id") REFERENCES "public"."bags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bag_tags" ADD CONSTRAINT "bag_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "frames" ADD CONSTRAINT "frames_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imu_data" ADD CONSTRAINT "imu_data_bag_id_bags_id_fk" FOREIGN KEY ("bag_id") REFERENCES "public"."bags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pose_data" ADD CONSTRAINT "pose_data_bag_id_bags_id_fk" FOREIGN KEY ("bag_id") REFERENCES "public"."bags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_bag_id_bags_id_fk" FOREIGN KEY ("bag_id") REFERENCES "public"."bags"("id") ON DELETE cascade ON UPDATE no action;