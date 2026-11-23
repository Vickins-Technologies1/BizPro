import { redirect } from "next/navigation";
import { getPlatformAdminSession } from "../../lib/server-session";
import { AdminLogin } from "../../components/AdminLogin";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getPlatformAdminSession();
  if (session?.user.isActive !== false && session) redirect("/");
  return <AdminLogin/>;
}
