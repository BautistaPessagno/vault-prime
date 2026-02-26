ALTER TABLE "entries" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "entries" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "entries" ALTER COLUMN "user_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "entries" ALTER COLUMN "copied_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "entries" ALTER COLUMN "copied_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "entries" ALTER COLUMN "copied_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "entries" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "entries" ALTER COLUMN "updated_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();