import React from "react";
import Image from "next/image";
import { Button } from "./ui/Button";
import { usePrivy } from "@privy-io/react-auth";
import { truncateAddress } from "~/lib/truncateAddress";

const ConnectWallet: React.FC = () => {
  const { login, logout, authenticated, user } = usePrivy();

  const walletAddress = user?.wallet?.address;

  return (
    <div className="flex flex-col min-h-screen bg-black">
      {/* Hero Section - Responsive */}
      <div className="w-full h-[50vh] md:h-[60vh] lg:h-[70vh] relative">
        <Image
          src="/dca-logo.svg"
          alt="DCA Logo"
          fill
          className="object-cover"
          priority
          draggable={false}
        />
      </div>

      {/* Connect Section - Responsive */}
      <div className="flex flex-col items-center justify-center flex-1 px-4 py-8 md:px-8 lg:px-12">
        {authenticated ? (
          <>
            <Button
              onClick={logout}
              className="bg-[#F7931A] hover:bg-[#e07e0b] text-black text-lg font-medium rounded-xl py-4 px-8 w-[90vw] max-w-md mb-4 shadow-lg transition-colors"
            >
              Disconnect
            </Button>
            {walletAddress && (
              <div className="text-white text-sm mb-4">
                Connected: {truncateAddress(walletAddress)}
              </div>
            )}
          </>
        ) : (
          <Button
            onClick={login}
            className="bg-[#F7931A] hover:bg-[#e07e0b] text-black text-lg font-medium rounded-xl py-4 px-8 w-[90vw] max-w-md mb-4 shadow-lg transition-colors"
          >
            Connect Wallet
          </Button>
        )}

        <p className="text-center text-neutral-400 text-base max-w-md">
          By connecting your wallet you agree to our{" "}
          <span className="text-white font-semibold">terms</span> &{" "}
          <span className="text-white font-semibold">services</span>.
        </p>
      </div>
    </div>
  );
};

export default ConnectWallet;
