-- CreateTable
CREATE TABLE "NoteMention" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "NoteMention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NoteMention_userId_idx" ON "NoteMention"("userId");

-- CreateIndex
CREATE INDEX "NoteMention_workspaceId_idx" ON "NoteMention"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "NoteMention_noteId_userId_key" ON "NoteMention"("noteId", "userId");

-- AddForeignKey
ALTER TABLE "NoteMention" ADD CONSTRAINT "NoteMention_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteMention" ADD CONSTRAINT "NoteMention_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteMention" ADD CONSTRAINT "NoteMention_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
