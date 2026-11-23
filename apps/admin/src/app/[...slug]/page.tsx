import { notFound, redirect } from "next/navigation";
import { getPlatformAdminSession } from "../../lib/server-session";
import { AdminShell } from "../../components/AdminShell";

export const dynamic = "force-dynamic";

export default async function SectionPage({ params }: { params: { slug: string[] } }) {
  const section = params.slug.join("/");
  const allowed = new Set(["businesses", "employees", "subscriptions", "payments", "devices", "sync", "system-errors", "incidents", "system-health", "api-monitoring", "settings", "support", "reports", "audit-logs", "admin-users"]);
  if (!allowed.has(params.slug[0] ?? "") || (params.slug[0] !== "businesses" && params.slug.length > 1)) notFound();
  const session = await getPlatformAdminSession();
  if (!session || session.user.isActive === false) redirect("/login");
  const businessId = params.slug[0] === "businesses" ? params.slug[1] : undefined;
  return <AdminShell role={session.user.role as any} email={session.user.email} name={session.user.name} section={section} {...(businessId ? { businessId } : {})}/>;
}
