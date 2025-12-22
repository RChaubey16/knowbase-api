ALTER TABLE "documents" RENAME COLUMN "created_by" TO "created_by_member_id";--> statement-breakpoint
ALTER TABLE "documents" DROP CONSTRAINT "documents_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_member_id_organisation_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."organisation_members"("id") ON DELETE restrict ON UPDATE no action;