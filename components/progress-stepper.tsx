"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Stage } from "@/lib/types";

interface ProgressStepperProps {
  currentStage: Stage;
  onStageClick?: (stage: Stage) => void;
  showOnlyCurrentStep?: boolean;
}

const stages = [
  {
    id: 1,
    label: "Upload Products",
    description: "Add files for each product",
  },
  { id: 2, label: "Preview & Edit", description: "Review and modify data" },
  { id: 3, label: "Justification", description: "Submit for justification" },
] as const;

export function ProgressStepper({
  currentStage,
  onStageClick,
  showOnlyCurrentStep = false,
}: ProgressStepperProps) {
  // Filter stages based on showOnlyCurrentStep prop
  const displayStages = showOnlyCurrentStep
    ? stages.filter((stage) => stage.id === currentStage)
    : stages;

  return (
    // Compact: circle and label share one line, so the whole stepper is one
    // row (~40px) instead of a stacked block. The step description moves to a
    // tooltip - it is orientation, not something to keep on screen.
    <div className="w-full py-2">
      <div className="flex items-center justify-between gap-2">
        {displayStages.map((stage, index) => {
          const isCompleted = currentStage > stage.id;
          const isCurrent = currentStage === stage.id;
          const isClickable = stage.id <= currentStage;

          return (
            <div key={stage.id} className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => isClickable && onStageClick?.(stage.id as Stage)}
                disabled={!isClickable}
                title={`${stage.label} — ${stage.description}`}
                className={cn(
                  "flex items-center gap-2 rounded-full py-0.5 pr-2 pl-0.5 transition-colors",
                  isClickable && "cursor-pointer hover:bg-muted",
                  !isClickable && "cursor-default",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-semibold transition-colors",
                    isCompleted &&
                      "bg-primary border-primary text-primary-foreground",
                    isCurrent && "border-primary bg-primary/10 text-primary",
                    !isCompleted &&
                      !isCurrent &&
                      "border-muted-foreground/30 text-muted-foreground/50",
                  )}
                >
                  {isCompleted ? <Check className="h-3.5 w-3.5" /> : stage.id}
                </span>
                <span
                  className={cn(
                    "truncate text-sm font-medium",
                    isCurrent
                      ? "text-primary"
                      : isCompleted
                        ? "text-foreground"
                        : "text-muted-foreground",
                  )}
                >
                  {stage.label}
                </span>
              </button>

              {index < displayStages.length - 1 && (
                <div
                  className={cn(
                    "hidden h-0.5 w-8 shrink-0 transition-colors sm:block lg:w-16",
                    currentStage > stage.id ? "bg-primary" : "bg-border",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
