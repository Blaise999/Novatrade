import dynamic from "next/dynamic";
import { Suspense } from "react";

const ConnectWalletDashboard = dynamic(() => import("./ConnectWalletDashboard"), {
  ssr: false,
});

export default function DashboardConnectWalletPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-12">
          <div className="text-sm text-cream/60">Loading wallet…</div>
        </div>
      }
    >
      <ConnectWalletDashboard />
    </Suspense>
  );
}
