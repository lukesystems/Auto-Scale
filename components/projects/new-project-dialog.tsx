"use client";

import { useEffect, useState } from "react";
import { NewProjectForm } from "@/app/(app)/projects/new/new-project-form";
import { X } from "lucide-react";

interface NewProjectDialogProps {
  open: boolean;
  onClose: () => void;
}

export function NewProjectDialog({ open, onClose }: NewProjectDialogProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/70 backdrop-blur" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-xl border bg-card shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between border-b bg-card px-5 py-4">
          <div>
            <h2 className="font-semibold">New project</h2>
            <p className="text-xs text-muted-foreground">Paste your product URL — we&apos;ll read the site and build your brief.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">
          <NewProjectForm onSuccess={onClose} />
        </div>
      </div>
    </div>
  );
}
