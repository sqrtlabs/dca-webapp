"use client";

import { usePrivy } from "@privy-io/react-auth";
import ConnectWallet from "~/components/ConnectWallet";
import Home from "~/components/Home";

export default function App() {
  const { authenticated, ready } = usePrivy();

  // // Show loading state while Privy is initializing
  // if (!ready) {
  //   return (
  //     <div className="flex items-center justify-center min-h-screen bg-black">
  //       <div className="text-white text-lg">Loading...</div>
  //     </div>
  //   );
  // }

  return authenticated ? <Home /> : <ConnectWallet />;
}
