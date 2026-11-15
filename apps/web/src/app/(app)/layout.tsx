import { Suspense } from "react";
import { supabaseEnv } from "@/lib/env";
import { NotConfigured } from "@/components/NotConfigured";
import { Rail } from "@/components/MenuLinks";

export default function AppLayout({ children }: LayoutProps<"/">) {
  if (!supabaseEnv()) return <NotConfigured />;
  return (
    <div className="flex-1 flex">
      <Suspense fallback={null}>
        <Rail />
      </Suspense>
      <div className="flex-1 min-w-0 flex flex-col">{children}</div>
    </div>
  );
}
