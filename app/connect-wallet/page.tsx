import dynamic from "next/dynamic";
import { Suspense } from "react";

// ✅ IMPORTANT: this stops wagmi/rainbowkit from running during export/SSR
const ConnectWalletClient = dynamic(() => import("./ConnectWalletClient"), {
  ssr: false,
});

export default function ConnectWalletPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-void flex items-center justify-center p-6">
          <div className="text-sm text-cream/60">Loading wallet…</div>
        </div>
      }
    >
      <ConnectWalletClient />
    </Suspense>
  );
}
