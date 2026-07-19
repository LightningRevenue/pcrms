-- CreateTable
CREATE TABLE "NoteOpportunity" (
    "noteId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,

    CONSTRAINT "NoteOpportunity_pkey" PRIMARY KEY ("noteId","opportunityId")
);

-- CreateIndex
CREATE INDEX "NoteOpportunity_opportunityId_idx" ON "NoteOpportunity"("opportunityId");

-- AddForeignKey
ALTER TABLE "NoteOpportunity" ADD CONSTRAINT "NoteOpportunity_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteOpportunity" ADD CONSTRAINT "NoteOpportunity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
