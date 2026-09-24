import { requireAdmin } from "@/features/auth/session";

/**
 * Admin area. The role is checked here for rendering, again inside every admin
 * action, and once more by RLS in Postgres — hiding a button is never the
 * control.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return children;
}
