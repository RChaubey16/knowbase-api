ALTER TABLE "documents" DROP CONSTRAINT "documents_created_by_member_id_organisation_members_id_fk";
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_member_id_organisation_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."organisation_members"("id") ON DELETE set null ON UPDATE no action;