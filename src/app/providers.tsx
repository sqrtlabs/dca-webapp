"use client";

import { useState } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { base } from "wagmi/chains";
import { RefreshProvider } from "~/components/providers/RefreshProvider";
import { WagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createConfig, http } from "wagmi";
import { Toaster } from "react-hot-toast";

export const wagmiConfig = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(),
  },
  ssr: true,
});

export function Providers({ children }: { children: React.ReactNode }) {
  // Create QueryClient inside useState to avoid recreating on every render
  // and to ensure it's only created on the client
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Disable refetching on window focus during SSR
            refetchOnWindowFocus: false,
            // Prevent immediate refetch on mount
            staleTime: 60 * 1000,
          },
        },
      })
  );

  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ""}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#f97316",
        },
        loginMethods: ["wallet", "email"],
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
        },
        defaultChain: base,
        supportedChains: [base],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
          <RefreshProvider>
            <Toaster
              position="top-center"
              toastOptions={{
                duration: 4000,
                style: {
                  background: "#1A1A1A",
                  color: "#fff",
                  border: "1px solid #2A2A2A",
                  borderRadius: "12px",
                  padding: "16px",
                  fontSize: "14px",
                  maxWidth: "500px",
                },
                success: {
                  duration: 4000,
                  iconTheme: {
                    primary: "#f97316",
                    secondary: "#1A1A1A",
                  },
                  style: {
                    background: "#1A1A1A",
                    color: "#fff",
                    border: "1px solid #f97316",
                  },
                },
                error: {
                  duration: 5000,
                  iconTheme: {
                    primary: "#ef4444",
                    secondary: "#1A1A1A",
                  },
                  style: {
                    background: "#1A1A1A",
                    color: "#fff",
                    border: "1px solid #ef4444",
                  },
                },
                loading: {
                  iconTheme: {
                    primary: "#f97316",
                    secondary: "#1A1A1A",
                  },
                },
              }}
            />
            {children}
          </RefreshProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
