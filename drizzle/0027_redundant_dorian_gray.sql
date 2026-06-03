CREATE INDEX "attendance_records_status_idx" ON "attendance_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "enrollments_ended_idx" ON "enrollments" USING btree ("ended_at");--> statement-breakpoint
CREATE INDEX "students_archived_idx" ON "students" USING btree ("archived_at");--> statement-breakpoint
CREATE INDEX "trial_leads_class_idx" ON "trial_leads" USING btree ("class_id");