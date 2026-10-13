import { redirect } from "next/navigation";

// Staff and customers share one sign-in now; old links land there.
export default function OldStaffLogin() {
  redirect("/login");
}
