import { redirect } from "next/navigation";

/** Legacy URL — connections live in a modal on `/`. */
export default function SetupRedirect() {
  redirect("/?connections=1");
}
