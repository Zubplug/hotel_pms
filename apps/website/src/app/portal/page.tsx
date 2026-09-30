import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function PortalRoot() {
  const session = await auth();
  if (!session?.user) redirect("/portal/login");
  if ((session.user as { isLodgeCoreAdmin?: boolean }).isLodgeCoreAdmin) redirect("/hq");
  redirect("/portal/dashboard");
}
