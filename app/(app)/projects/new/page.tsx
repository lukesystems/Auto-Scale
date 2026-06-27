import { redirect } from "next/navigation";

export default function NewProjectRedirectPage() {
  redirect("/projects?new=1");
}
