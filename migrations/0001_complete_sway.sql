CREATE TABLE "system_metrics" (
	"id" text PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"db_size_bytes" real NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
