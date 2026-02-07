"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/supabase/store-supabase";

export default function ConnectWalletRedirect() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useStore();

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      router.replace("/dashboard/connect-wallet");
    } else {
      router.replace("/auth/login");
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="min-h-screen bg-void flex items-center justify-center p-6">
      <div className="text-sm text-cream/60">Redirecting...</div>
    </div>
  );
}
