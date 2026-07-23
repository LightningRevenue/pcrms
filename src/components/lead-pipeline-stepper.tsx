"use client";

import { useState, useTransition } from "react";
import type { ContactPipelineStage } from "@prisma/client";
import { PipelineStepper } from "@/components/pipeline-stepper";
import { moveContactStage } from "@/lib/actions/contact-pipeline-stages";

// Wraps the shared PipelineStepper with optimistic state + the contact-stage server action —
// same role OpportunityDetailView plays for deals, just scoped to one field on Person instead
// of a whole detail-view component.
export function LeadPipelineStepper({
  personId,
  stage,
  stages,
}: {
  personId: string;
  stage: string | null;
  stages: ContactPipelineStage[];
}) {
  const [current, setCurrent] = useState(stage);
  const [, startTransition] = useTransition();

  if (stages.length === 0) return null;

  function setStage(next: string) {
    setCurrent(next);
    startTransition(() => moveContactStage(personId, next));
  }

  return <PipelineStepper stage={current} stages={stages} onChange={setStage} />;
}
