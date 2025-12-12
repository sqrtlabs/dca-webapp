import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useAccount, useBalance, useReadContract } from "wagmi";
import { usePrivy } from "@privy-io/react-auth";
import { useRefresh } from "~/components/providers/RefreshProvider";
import { USDC_ABI } from "~/lib/contracts/abi";
import { Identicon } from "./Identicon";

const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;

const DCA_EXECUTOR_ADDRESS = process.env
  .NEXT_PUBLIC_DCA_EXECUTOR_ADDRESS as `0x${string}`;

interface BalanceDisplayProps {
  className?: string;
  onOpenApproval?: () => void;
}

export const BalanceDisplay: React.FC<BalanceDisplayProps> = ({
  className = "",
  onOpenApproval,
}) => {
  const { address } = useAccount();
  const { login, logout, authenticated, user } = usePrivy();
  const { onBalanceRefresh } = useRefresh();
  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch USDC balance
  const {
    data: balanceData,
    isLoading: balanceLoading,
    refetch: refetchBalance,
  } = useBalance({
    address: address as `0x${string}`,
    token: USDC_ADDRESS as `0x${string}`,
    query: {
      enabled: !!address,
    },
  });

  // Fetch USDC allowance
  const {
    data: allowanceData,
    isLoading: allowanceLoading,
    refetch: refetchAllowance,
  } = useReadContract({
    address: USDC_ADDRESS as `0x${string}`,
    abi: USDC_ABI,
    functionName: "allowance",
    args: [address as `0x${string}`, DCA_EXECUTOR_ADDRESS as `0x${string}`],
    query: {
      enabled: !!address,
    },
  });

  // Register refresh callback
  useEffect(() => {
    const unregister = onBalanceRefresh(() => {
      refetchBalance();
      refetchAllowance();
    });
    return unregister;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onBalanceRefresh]);

  // Format balance to display
  const formatBalance = (balance: bigint | undefined): string => {
    if (!balance) return "$0.00";
    // USDC has 6 decimals
    const usdcAmount = Number(balance) / 1000000;
    return `$${usdcAmount.toFixed(2)}`;
  };

  // Format allowance to display
  const formatAllowance = (allowance: bigint | undefined): string => {
    if (!allowance) return "$0.00";
    // USDC has 6 decimals
    const usdcAmount = Number(allowance) / 1000000;
    return `$${usdcAmount.toFixed(2)}`;
  };

  const isLoading = balanceLoading || allowanceLoading;

  // Format address for display
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Copy address to clipboard
  const copyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy address:", err);
    }
  };

  return (
    <div className={`flex items-center gap-1 sm:gap-2 ${className}`}>
      {authenticated && address && (
        <button
          className="flex items-center bg-[#1F1F1F] hover:bg-[#2A2A2A] rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs lg:text-sm cursor-pointer transition-colors h-8 sm:h-9 lg:h-10"
          onClick={() => onOpenApproval?.()}
        >
          <Image
            src="/usdc.png"
            alt="USDC"
            width={16}
            height={16}
            className="mr-0.5 sm:mr-1 lg:mr-1.5 w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4"
          />
          <span className="font-medium whitespace-nowrap">{isLoading ? "..." : formatBalance(balanceData?.value)}</span>
          <span className="mx-0.5 sm:mx-1 lg:mx-2 text-gray-500">|</span>
          <span className="text-gray-400 whitespace-nowrap">
            {isLoading ? "..." : formatAllowance(allowanceData)}
          </span>
        </button>
      )}

      {/* Wallet Connect/Disconnect */}
      <div className="relative">
        {!authenticated ? (
          <button
            onClick={login}
            className="px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 bg-orange-500 hover:bg-orange-600 text-black font-semibold rounded-lg transition-colors h-8 sm:h-9 lg:h-10 text-[10px] sm:text-xs lg:text-sm whitespace-nowrap"
          >
            Connect Wallet
          </button>
        ) : (
          <>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-[#1F1F1F] hover:bg-[#2A2A2A] rounded-lg transition-colors h-8 sm:h-9 lg:h-10"
            >
              {address && (
                <div className="w-[18px] h-[18px] sm:w-5 sm:h-5 lg:w-6 lg:h-6 flex-shrink-0 flex items-center justify-center overflow-hidden">
                  <Identicon address={address} size={24} />
                </div>
              )}
              <span className="text-white text-[10px] sm:text-xs lg:text-sm hidden md:inline">
                {address && formatAddress(address)}
              </span>
              <svg
                className={`hidden sm:block w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4 text-gray-400 transition-transform ${
                  showDropdown ? "rotate-180" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showDropdown && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowDropdown(false)}
                />

                {/* Dropdown Content */}
                <div className="absolute right-0 mt-2 w-80 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl shadow-2xl z-50 overflow-hidden">
                  {/* Header with Identicon */}
                  <div className="p-4 bg-gradient-to-br from-[#1F1F1F] to-[#1A1A1A]">
                    <div className="flex items-center gap-3 mb-3">
                      {address && <Identicon address={address} size={40} />}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-400 mb-1">Connected Wallet</div>
                        <div className="text-white font-medium text-sm">
                          {address && formatAddress(address)}
                        </div>
                      </div>
                    </div>

                    {/* Full Address with Copy */}
                    <div className="bg-[#0A0A0A] rounded-lg p-3 border border-[#2A2A2A]">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-gray-400 font-mono text-xs break-all flex-1">
                          {address}
                        </div>
                        <button
                          onClick={copyAddress}
                          className="flex-shrink-0 p-2 hover:bg-[#2A2A2A] rounded-lg transition-colors"
                          title="Copy address"
                        >
                          {copied ? (
                            <svg
                              className="w-4 h-4 text-green-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="w-4 h-4 text-gray-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                              />
                            </svg>
                          )}
                        </button>
                      </div>
                      {copied && (
                        <div className="text-green-400 text-xs mt-2">
                          Address copied!
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Disconnect Button */}
                  <button
                    onClick={() => {
                      logout();
                      setShowDropdown(false);
                    }}
                    className="w-full px-4 py-3 text-left text-red-400 hover:bg-[#2A2A2A] transition-colors flex items-center gap-3"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    <span className="font-medium">Disconnect Wallet</span>
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
