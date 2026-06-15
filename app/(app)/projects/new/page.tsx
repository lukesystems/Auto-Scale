import { NewProjectForm } from "./new-project-form";
import { PageHeader } from "@/components/app/page-header";

export const metadata = { title: "New project" };

export default function NewProjectPage() {
  return (
    <div className="container py-10 max-w-3xl animate-fade-in">
      <PageHeader
        title="Create a project"
        description="One project = one product + ICP. You can run TrendWatch on each independently."
      />

      <div className="mt-8 rounded-xl border border-border bg-card/80 backdrop-blur-sm p-6 md:p-8 shadow-lg shadow-primary/5">
        <NewProjectForm />
      </div>
    </div>
  );
}
