-- Backfill snapshots written before 0011 added these columns (or with NULLs)
-- from the parent skill, so every version can be restored, then enforce NOT NULL.
UPDATE "skill_versions" sv SET
	"name" = COALESCE(sv."name", s."name"),
	"description" = COALESCE(sv."description", s."description"),
	"type" = COALESCE(sv."type", s."type")
FROM "skills" s
WHERE s."id" = sv."skill_id"
	AND (sv."name" IS NULL OR sv."description" IS NULL OR sv."type" IS NULL);--> statement-breakpoint
ALTER TABLE "skill_versions" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "skill_versions" ALTER COLUMN "description" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "skill_versions" ALTER COLUMN "type" SET NOT NULL;