CREATE TABLE "folders" (
	"id" uuid PRIMARY KEY,
	"client_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#879c85' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY,
	"client_id" uuid NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"content" text NOT NULL,
	"color" text DEFAULT 'sunflower' NOT NULL,
	"reminder_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY,
	"client_id" uuid NOT NULL,
	"title" text NOT NULL,
	"folder_id" uuid,
	"due_date" date,
	"priority" text DEFAULT 'medium' NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "folders_client_id_idx" ON "folders" ("client_id");--> statement-breakpoint
CREATE INDEX "notes_client_id_idx" ON "notes" ("client_id");--> statement-breakpoint
CREATE INDEX "tasks_client_id_idx" ON "tasks" ("client_id");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_folder_id_folders_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE SET NULL;