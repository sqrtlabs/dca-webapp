import React from "react";
import Image from "next/image";
import { Button } from "./ui/Button";
import { usePrivy } from "@privy-io/react-auth";
import { truncateAddress } from "~/lib/truncateAddress";

const ConnectWallet: React.FC = () => {
  const { login, logout, authenticated, user } = usePrivy();

  const walletAddress = user?.wallet?.address;

  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      {/* Full Screen Background Image - 60% */}
      <div className="fixed inset-0 w-full h-full">
        <Image
          src="/login-poster.svg"
          alt="DCA Logo"
          fill
          className="object-cover"
          priority
          draggable={false}
        />
      </div>

      {/* Connect Section - Bottom 40%, Overlapping with opacity */}
      <div className="absolute bottom-0 left-0 right-0 h-[30vh] z-10">
        {/* Semi-transparent background with blur */}
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

        {/* Content */}
        <div className="relative flex flex-col items-center justify-center h-full px-4 py-8 md:px-8 lg:px-12">
          {authenticated ? (
            <>
              <Button
                onClick={logout}
                className="bg-orange-500 hover:bg-orange-600 text-black text-lg font-semibold rounded-xl py-4 px-8 w-[90vw] max-w-md mb-4 shadow-2xl transition-colors"
              >
                Disconnect
              </Button>
              {walletAddress && (
                <div className="text-white text-sm mb-4 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/20">
                  Connected: {truncateAddress(walletAddress)}
                </div>
              )}
            </>
          ) : (
            <Button
              onClick={login}
              className="bg-orange-500 hover:bg-orange-600 text-black text-lg font-semibold rounded-xl py-4 px-8 w-[90vw] max-w-md mb-4 shadow-2xl transition-colors"
            >
              Connect Wallet
            </Button>
          )}

          <p className="text-center text-gray-300 text-base max-w-md">
            By connecting your wallet you agree to our{" "}
            <span className="text-white font-semibold">terms</span> &{" "}
            <span className="text-white font-semibold">services</span>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ConnectWallet;
