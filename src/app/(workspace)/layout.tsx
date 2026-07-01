import { AppShell } from "../../components/app-shell";
import { requireSession } from "../../lib/auth/session";

export default async function WorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireSession();
  return <AppShell user={user}>{children}</AppShell>;
}
