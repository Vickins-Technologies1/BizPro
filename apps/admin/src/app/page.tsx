import { redirect } from "next/navigation";
import { getPlatformAdminSession } from "../lib/server-session";
import { AdminShell } from "../components/AdminShell";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getPlatformAdminSession();
  if (!session || session.user.isActive === false) redirect("/login");
  return <AdminShell role={session.user.role as any} email={session.user.email} name={session.user.name} section=""/>;
}
