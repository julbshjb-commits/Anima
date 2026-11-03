import { supabaseEnv } from "@/lib/env";
import { NotConfigured } from "@/components/NotConfigured";

export default function AppLayout({ children }: LayoutProps<"/">) {
  if (!supabaseEnv()) return <NotConfigured />;
  return <div className="flex-1 flex flex-col">{children}</div>;
}
