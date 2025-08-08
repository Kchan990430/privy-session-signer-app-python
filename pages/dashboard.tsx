import { useRouter } from "next/router";
import { useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Head from "next/head";
import { AgentWalletDashboardSDK } from "../components/AgentWalletDashboardSDK";

export default function DashboardPage() {
  const router = useRouter();
  const { ready, authenticated } = usePrivy();

  useEffect(() => {
    if (ready && !authenticated) {
      router.push("/");
    }
  }, [ready, authenticated, router]);

  return (
    <>
      <Head>
        <title>Agent Wallet Dashboard - ACP Privy Integration</title>
      </Head>

      <main className="min-h-screen bg-gray-50 py-6">
        {ready && authenticated ? (
          <AgentWalletDashboardSDK />
        ) : (
          <div className="flex items-center justify-center min-h-screen">
            <div className="animate-pulse text-gray-500">Loading...</div>
          </div>
        )}
      </main>
    </>
  );
}