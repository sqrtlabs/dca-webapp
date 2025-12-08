"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useRefresh } from "~/components/providers/RefreshProvider";
import { SetFrequencyPopup } from "~/components/ui/SetFrequencyPopup";
import { TokenApprovalPopup } from "~/components/ui/TokenApprovalPopup";
import { BalanceDisplay } from "~/components/ui/BalanceDisplay";
import TokenViewSkeleton from "~/components/ui/TokenViewSkeleton";
import Image from "next/image";
import { useAccount, useWriteContract } from "wagmi";
import DCA_ABI from "~/lib/contracts/DCAForwarder.json";
import { useRouter } from "next/navigation";
import PlanCreatedSharePopup from "~/components/ui/PlanCreatedSharePopup";
import toast from "react-hot-toast";

interface TokenStats {
  oneYearAgo: number;
  invested: number;
  currentValue: number;
  percentChange: number;
  marketCap: number;
  fdv: number;
  totalSupply: number;
  volume24h: number;
}

interface Token {
  name: string;
  icon: string;
  price: number;
  symbol: string;
  decimals: number;
  stats: TokenStats;
  about: string;
  hasActivePlan: boolean;
  volume24h: number;
}

interface Plan {
  id: string;
  planId: number;
  userId: string;
  tokenInId: string;
  tokenOutId: string;
  recipient: string;
  amountIn: string;
  approvalAmount: string;
  frequency: number;
  lastExecutedAt: number;
  active: boolean;
  createdAt: string;
}

interface TokenApiResponse {
  success: boolean;
  data: {
    address: string;
    symbol: string;
    name: string;
    decimals: string;
    about?: string | null;
    image?: string | null;
    isWrapped: boolean;
    wrappedName?: string | null;
    wrappedSymbol?: string | null;
    originalAddress?: string | null;
    price?: string | null;
    fdv?: string | null;
    marketcap?: string | null;
    price1yAgo?: string | null;
    hasActivePlan: boolean;
    plansOut: Array<Plan>;
    totalInvestedValue: number;
    currentValue: number;
    percentChange: number;
    currentPrice?: number;
    fdvUsd?: number;
    marketCapUsd?: number;
    volume24h?: number;
    totalSupply?: number;
  };
}

interface TokenPageProps {
  params: Promise<{ address: string }>;
}

export default function TokenPage({ params }: TokenPageProps) {
  const [tokenAddress, setTokenAddress] = useState<string>("");
  const [selectedPeriod, setSelectedPeriod] = useState("1h");
  const { onTokenRefresh, refreshBalance } = useRefresh();
  const { address } = useAccount();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [showSetFrequency, setShowSetFrequency] = useState(false);
  const [showTokenApproval, setShowTokenApproval] = useState(false);
  const [showPlanCreatedShare, setShowPlanCreatedShare] = useState(false);
  const [showEditFrequency, setShowEditFrequency] = useState(false);
  const [activePlan, setActivePlan] = useState<Plan | null>(null);

  const [isAboutExpanded, setIsAboutExpanded] = useState(false);
  const [isFrequencyExpanded, setIsFrequencyExpanded] = useState(false);
  const [isCancellingPlan, setIsCancellingPlan] = useState(false);
  const [isStoppingPlan, setIsStoppingPlan] = useState(false);
  const [isResumingPlan, setIsResumingPlan] = useState(false);

  const [frequencyData, setFrequencyData] = useState<{
    amount: number;
    frequency: string;
  } | null>(null);
  const [pendingPlanHash, setPendingPlanHash] = useState<string | undefined>(
    undefined
  );
  const [approvalNeededForNewPlan, setApprovalNeededForNewPlan] = useState<
    boolean | undefined
  >(undefined);
  const [token, setToken] = useState<Token>({
    name: "",
    icon: "",
    price: 0,
    symbol: "",
    decimals: 0,
    stats: {
      oneYearAgo: 0,
      invested: 0,
      currentValue: 0,
      percentChange: 0,
      marketCap: 0,
      fdv: 0,
      totalSupply: 0,
      volume24h: 0,
    },
    about: "",
    hasActivePlan: false,
    volume24h: 0,
  });

  // Get token address from URL params
  useEffect(() => {
    params.then((p) => setTokenAddress(p.address));
  }, [params]);

  const { writeContractAsync: cancelPlan, isPending: isCancelling } =
    useWriteContract();
  const DCA_EXECUTOR_ADDRESS = process.env
    .NEXT_PUBLIC_DCA_EXECUTOR_ADDRESS as `0x${string}`;

  const handleSharePosition = async () => {
    try {
      const text = `I started my DCA journey on $${token.symbol.toUpperCase()}.\nInvest smartly. Stop watching, start stacking.`;
      const shareUrl = `${
        process.env.NEXT_PUBLIC_URL || window.location.origin
      }/token/${tokenAddress}`;

      if (navigator.share) {
        try {
          await navigator.share({
            title: "DCA Journey",
            text: text,
            url: shareUrl,
          });
        } catch (err) {
          console.log("Share cancelled or error:", err);
        }
      } else {
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
          text
        )}&url=${encodeURIComponent(shareUrl)}`;
        window.open(twitterUrl, "_blank");
      }
    } catch (e) {
      console.error("Failed to open share:", e);
    }
  };

  const refetchPlanData = async () => {
    try {
      if (address && tokenAddress) {
        const response = await fetch(
          `/api/plan/getPlan/${address}?tokenAddress=${tokenAddress}`
        );
        const result: TokenApiResponse = await response.json();
        if (result.success) {
          setToken((prev) => ({
            ...prev,
            hasActivePlan: result.data.hasActivePlan,
          }));
          if (result.data.plansOut && result.data.plansOut.length > 0) {
            setActivePlan(result.data.plansOut[0]);
          } else {
            setActivePlan(null);
          }
        }
      }
    } catch (e) {
      console.error("Failed to refetch plan data:", e);
    }
  };

  const handleDeletePosition = async () => {
    if (!address || !tokenAddress) return;

    try {
      setIsCancellingPlan(true);

      const hash = await cancelPlan({
        address: DCA_EXECUTOR_ADDRESS,
        abi: DCA_ABI.abi,
        functionName: "cancelPlan",
        args: [tokenAddress as `0x${string}`],
      });

      console.log("Plan cancellation transaction hash:", hash);

      try {
        const deleteResponse = await fetch("/api/plan/deletePlan", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userAddress: address,
            tokenOutAddress: tokenAddress,
            action: "delete",
          }),
        });

        const deleteResult = await deleteResponse.json();
        if (deleteResult.success) {
          console.log("Plan deleted from database successfully");
          toast.success("Plan deleted successfully");
        } else {
          console.error(
            "Failed to delete plan from database:",
            deleteResult.error
          );
          toast.error("Failed to delete plan from database");
        }
      } catch (dbError) {
        console.error("Error calling deletePlan API:", dbError);
        toast.error("Failed to delete plan");
      }

      await refetchPlanData();
      router.refresh();
    } catch (error) {
      console.error("Error deleting position:", error);

      // Check if user cancelled the transaction
      if (error && typeof error === "object" && "message" in error) {
        const errorMessage = (error as { message: string }).message.toLowerCase();
        if (errorMessage.includes("user rejected") || errorMessage.includes("user denied") || errorMessage.includes("user cancelled")) {
          toast.error("Transaction cancelled");
          return;
        }
      }

      toast.error("Failed to delete plan. Please try again.");
    } finally {
      setIsCancellingPlan(false);
    }
  };

  const handleStopPosition = async () => {
    if (!address || !tokenAddress) return;

    try {
      setIsStoppingPlan(true);
      const resp = await fetch("/api/plan/toggleActive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: address,
          tokenOutAddress: tokenAddress,
          active: false,
        }),
      });
      const resJson = await resp.json();
      if (!resJson.success) {
        console.error("Failed to pause plan:", resJson.error);
        toast.error("Failed to pause plan. Please try again.");
      } else {
        toast.success("Plan paused successfully");
      }

      await refetchPlanData();
      router.refresh();
    } catch (error) {
      console.error("Error pausing position:", error);
      toast.error("Failed to pause plan. Please try again.");
    } finally {
      setIsStoppingPlan(false);
    }
  };

  const handleResumePosition = async () => {
    if (!address || !tokenAddress) return;

    try {
      setIsResumingPlan(true);
      const resp = await fetch("/api/plan/toggleActive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: address,
          tokenOutAddress: tokenAddress,
          active: true,
        }),
      });
      const json = await resp.json();
      if (!json.success) {
        console.error("Failed to resume plan:", json.error);
        toast.error("Failed to resume plan. Please try again.");
      } else {
        toast.success("Plan resumed successfully");
      }
      await refetchPlanData();
      router.refresh();
    } catch (error) {
      console.error("Error resuming position:", error);
      toast.error("Failed to resume plan. Please try again.");
    } finally {
      setIsResumingPlan(false);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1_000_000_000_000)
      return (num / 1_000_000_000_000).toFixed(2) + "T";
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + "B";
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + "M";
    if (num >= 1_000) return (num / 1_000).toFixed(2) + "K";
    return num.toLocaleString();
  };

  const getResolution = (period: string) => {
    switch (period) {
      case "1H":
        return "1h";
      case "D":
        return "1d";
      case "W":
        return "1w";
      case "M":
        return "1month";
      default:
        return "15m";
    }
  };

  const fetchTokenData = useCallback(async () => {
    if (tokenAddress && address) {
      try {
        setIsLoading(true);
        const response = await fetch(
          `/api/plan/getPlan/${address}?tokenAddress=${tokenAddress}`
        );
        const result: TokenApiResponse = await response.json();

        if (result.success) {
          const tokenData = result.data;
          setToken({
            name: tokenData.name,
            icon: tokenData.image || "₿",
            price: parseFloat(tokenData.price || "0") || 0,
            symbol: tokenData.symbol,
            decimals: parseInt(tokenData.decimals) || 18,
            stats: {
              oneYearAgo: parseFloat(tokenData.price1yAgo || "0") || 0,
              invested: tokenData.totalInvestedValue || 0,
              currentValue: tokenData.currentValue || 0,
              percentChange: tokenData.percentChange || 0,
              marketCap: tokenData.marketCapUsd || 0,
              fdv: tokenData.fdvUsd || 0,
              totalSupply: tokenData.totalSupply || 0,
              volume24h: tokenData.volume24h || 0,
            },
            about:
              tokenData?.about ||
              `Information about ${tokenData.name} (${tokenData.symbol}) token.`,
            hasActivePlan: tokenData.hasActivePlan,
            volume24h: tokenData.volume24h || 0,
          });
          if (tokenData.plansOut && tokenData.plansOut.length > 0) {
            setActivePlan(tokenData.plansOut[0]);
          } else {
            setActivePlan(null);
          }
        }
      } catch (error) {
        console.error("Error fetching token data:", error);
      } finally {
        setIsLoading(false);
      }
    }
  }, [tokenAddress, address]);

  useEffect(() => {
    if (tokenAddress) {
      fetchTokenData();
    }
  }, [fetchTokenData, tokenAddress]);

  useEffect(() => {
    const unregister = onTokenRefresh((refreshTokenAddress) => {
      if (!refreshTokenAddress || refreshTokenAddress === tokenAddress) {
        fetchTokenData();
      }
    });
    return unregister;
  }, [onTokenRefresh, fetchTokenData, tokenAddress]);

  if (isLoading) {
    return <TokenViewSkeleton />;
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      {/* Top Bar */}
      <div className="sticky top-0 bg-black z-40 border-b border-gray-800 px-4 lg:px-8 py-4">
        <div className="flex justify-between items-center max-w-[1600px] mx-auto gap-4">
          {/* Left: Logo + Navigation + Back + Token Info */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <Image
              src="/dca2.png"
              alt="DCA"
              width={40}
              height={40}
              className="cursor-pointer flex-shrink-0"
              onClick={() => router.push("/")}
            />
            <nav className="hidden lg:flex items-center gap-1">
              <button
                onClick={() => router.push("/")}
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-[#1E1E1F] rounded-lg transition-colors"
              >
                Home
              </button>
              <button
                onClick={() => router.push("/explore")}
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-[#1E1E1F] rounded-lg transition-colors"
              >
                Explore
              </button>
              <button
                onClick={() => router.push("/history")}
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-[#1E1E1F] rounded-lg transition-colors"
              >
                History
              </button>
            </nav>
            <div className="h-6 w-px bg-gray-700" />
            <button
              onClick={() => router.push("/")}
              className="text-white hover:text-gray-300 transition-colors flex-shrink-0"
            >
              ←
            </button>
            <div className="flex items-center gap-2 min-w-0">
              {token.icon &&
              (token.icon.startsWith("http://") ||
                token.icon.startsWith("https://") ||
                token.icon.startsWith("/")) ? (
                <Image
                  src={token.icon}
                  alt="Token Icon"
                  className="w-8 h-8 rounded-full object-cover border-2 border-orange-700 flex-shrink-0"
                  width={32}
                  height={32}
                />
              ) : (
                <div className="w-8 h-8 rounded-full border-2 border-gray-700 bg-[#1E1E1F] flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">{token.name[0]}</span>
                </div>
              )}
              <span className="text-lg font-medium truncate" title={token.name}>
                {token.name}
              </span>
            </div>
          </div>

          {/* Right: Wallet & Balance */}
          <div className="flex-shrink-0">
            <BalanceDisplay onOpenApproval={() => setShowTokenApproval(true)} />
          </div>
        </div>
      </div>

      {/* Main Content - Web Layout (70/30 split) on large screens, stacked on mobile */}
      <div className="max-w-[1600px] mx-auto px-4 lg:px-8 py-6">
        {/* Chart & Stats Section */}
        <div className="flex flex-col lg:flex-row gap-6 mb-6">
          {/* Chart & Actions Section - 70% on web */}
          <div className="w-full lg:w-[70%] space-y-6">
            {/* Chart */}
            <div className="bg-[#131313] rounded-xl p-6 shadow-lg">
              <div className="text-gray-400 text-sm mb-1">Price</div>
              <div className="flex items-center justify-between mb-4">
                <div className="text-4xl font-light">
                  ${Number(token.price).toFixed(2)}
                </div>
                <div className="flex space-x-1 bg-[#1E1E1F] rounded px-4 py-2">
                  {["1H", "D", "W", "M"].map((period) => (
                    <button
                      key={period}
                      onClick={() => setSelectedPeriod(period)}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                        selectedPeriod === period
                          ? "bg-black text-white"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative h-[400px] lg:h-[500px]">
                <iframe
                  id="geckoterminal-embed"
                  title="GeckoTerminal Embed"
                  src={`https://www.geckoterminal.com/base/pools/${tokenAddress}?embed=1&info=0&swaps=0&light_chart=0&chart_type=market_cap&resolution=${getResolution(
                    selectedPeriod
                  )}&bg_color=131313`}
                  frameBorder="0"
                  allow="clipboard-write"
                  allowFullScreen
                  className="w-full h-full rounded-lg"
                  style={{
                    filter:
                      "brightness(1) saturate(0.7) sepia(0.7) contrast(1.6) hue-rotate(-19deg)",
                  }}
                />
              </div>
            </div>

            {/* Main Invest/Approve Button Below Chart */}
            <div className="bg-[#131313] rounded-xl shadow-lg">
              <button
                className="w-full py-4 rounded-lg text-lg font-semibold bg-orange-500 hover:bg-orange-600 text-black disabled:bg-gray-600 disabled:text-white transition-colors"
                onClick={() => {
                  if (token.hasActivePlan) {
                    if (activePlan && !activePlan.active) {
                      handleResumePosition();
                    } else {
                      setShowTokenApproval(true);
                    }
                  } else if (frequencyData) {
                    setShowTokenApproval(true);
                  } else {
                    setShowSetFrequency(true);
                  }
                }}
                disabled={!address}
              >
                {token.hasActivePlan
                  ? activePlan && !activePlan.active
                    ? "Resume the plan"
                    : "Allow more USDC"
                  : frequencyData
                  ? "Create & Approve"
                  : `Invest in ${token.symbol}`}
              </button>
            </div>
          </div>

          {/* Stats & About Section - 30% on web */}
          <div className="w-full lg:w-[30%] space-y-6">
            {/* Stats */}
            <div className="bg-[#131313] rounded-xl p-6 shadow-lg">
              <h2 className="text-xl font-semibold mb-6">Stats</h2>

              {/* Investment Stats - Only show if invested */}
              {token.stats.invested > 0 && (
                <div className="mb-6 pb-6 border-b border-gray-800">
                  <div className="text-white text-5xl font-bold mb-3">
                    ${token.stats.currentValue.toFixed(2)}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Invested: </span>
                      <span className="text-white font-semibold">
                        ${token.stats.invested.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Change: </span>
                      <span
                        className={`font-semibold ${
                          token.stats.percentChange >= 0
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {token.stats.percentChange >= 0 ? "+" : ""}
                        {token.stats.percentChange.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Market Stats - 2x2 Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-gray-400 text-xs uppercase tracking-wide mb-1.5">
                    Market cap
                  </div>
                  <div className="text-white text-lg font-semibold">
                    ${formatNumber(token.stats.marketCap)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-xs uppercase tracking-wide mb-1.5">
                    FDV
                  </div>
                  <div className="text-white text-lg font-semibold">
                    ${formatNumber(token.stats.fdv)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-xs uppercase tracking-wide mb-1.5">
                    24h volume
                  </div>
                  <div className="text-white text-lg font-semibold">
                    ${formatNumber(token.stats.volume24h)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-xs uppercase tracking-wide mb-1.5">
                    Total supply
                  </div>
                  <div className="text-white text-lg font-semibold">
                    {formatNumber(token.stats.totalSupply)}
                  </div>
                </div>
              </div>

              {/* Frequency Section */}
              {token.hasActivePlan && activePlan && (
                <div className="mt-6 pt-6 border-t border-gray-800">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-base font-semibold">Frequency</h3>
                    <button
                      className="text-orange-500 text-xs font-medium flex items-center gap-1 hover:text-orange-400 transition-colors"
                      onClick={() => setShowEditFrequency(true)}
                    >
                      <svg
                        width="12"
                        height="12"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M15.232 5.232a3 3 0 1 1 4.243 4.243L7.5 21H3v-4.5l12.232-12.268Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Edit
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-xs uppercase tracking-wide">
                        Amount
                      </span>
                      <span className="text-white text-lg font-semibold">
                        ${Number(activePlan.amountIn) / 1_000_000}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-xs uppercase tracking-wide">
                        Frequency
                      </span>
                      <span className="text-white text-lg font-semibold">
                        {(() => {
                          switch (activePlan.frequency) {
                            case 3600:
                              return "Hourly";
                            case 86400:
                              return "Daily";
                            case 604800:
                              return "Weekly";
                            case 2592000:
                              return "Monthly";
                            default:
                              if (activePlan.frequency < 3600) {
                                return `${activePlan.frequency / 60} min`;
                              } else {
                                return `${activePlan.frequency / 3600}h`;
                              }
                          }
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* About Section */}
            <div className="bg-[#131313] rounded-xl p-6 shadow-lg">
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setIsAboutExpanded(!isAboutExpanded)}
                  className="text-white hover:text-gray-300 transition-colors"
                >
                  <svg
                    width="16"
                    height="16"
                    fill="none"
                    viewBox="0 0 24 24"
                    className={`transform transition-transform ${
                      isAboutExpanded ? "rotate-180" : ""
                    }`}
                  >
                    <path
                      d="M6 9l6 6 6-6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <h2 className="text-xl font-semibold">About</h2>
              </div>
              <div className="text-gray-300 text-sm leading-relaxed">
                {isAboutExpanded ? (
                  token.about
                ) : (
                  <div>
                    {token.about.length > 150
                      ? `${token.about.substring(0, 150)}...`
                      : token.about}
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons - Only show if has active plan */}
            {activePlan && (
              <div className="bg-[#131313] rounded-xl p-6 shadow-lg">
                <div className="space-y-3">
                  {/* Show All Executions - Full Width First Row */}
                  <button
                    className="w-full py-3 rounded-lg text-sm font-medium bg-[#1E1E1F] hover:bg-[#2A2A2A] text-white border border-[#2A2A2A] transition-colors"
                    onClick={() =>
                      router.push(`/history?token=${tokenAddress}`)
                    }
                  >
                    Show executions
                  </button>

                  {/* Pause/Resume and Delete - Second Row */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Pause/Resume */}
                    <button
                      className="w-full py-3 rounded-lg text-sm font-medium bg-[#1E1E1F] text-gray-300 border border-[#2A2A2A] hover:bg-[#151515] disabled:opacity-50 transition-colors"
                      onClick={
                        activePlan.active
                          ? handleStopPosition
                          : handleResumePosition
                      }
                      disabled={
                        isStoppingPlan || isCancellingPlan || isResumingPlan
                      }
                    >
                      {activePlan.active ? (
                        isStoppingPlan ? (
                          "Pausing..."
                        ) : (
                          <span className="flex items-center justify-center gap-1">
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                            >
                              <rect
                                x="6"
                                y="4"
                                width="4"
                                height="16"
                                fill="#ffffff"
                              />
                              <rect
                                x="14"
                                y="4"
                                width="4"
                                height="16"
                                fill="#ffffff"
                              />
                            </svg>
                            Pause
                          </span>
                        )
                      ) : isResumingPlan ? (
                        "Resuming..."
                      ) : (
                        <span className="flex items-center justify-center gap-1">
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <polygon points="5,3 19,12 5,21" fill="#ffffff" />
                          </svg>
                          Resume plan
                        </span>
                      )}
                    </button>

                    {/* Delete */}
                    <button
                      className="w-full py-3 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/15 disabled:opacity-50 transition-colors"
                      onClick={handleDeletePosition}
                      disabled={
                        isCancelling ||
                        isCancellingPlan ||
                        isStoppingPlan ||
                        isResumingPlan
                      }
                    >
                      {isCancelling || isCancellingPlan ? (
                        "Deleting..."
                      ) : (
                        <span className="flex items-center justify-center gap-1">
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <path
                              d="M3 6h18"
                              stroke="#f87171"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                            <path
                              d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                              stroke="#f87171"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                            <path
                              d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
                              stroke="#f87171"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M10 11v6M14 11v6"
                              stroke="#f87171"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                          </svg>
                          Delete
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Popups */}
      <SetFrequencyPopup
        open={showSetFrequency}
        onClose={() => setShowSetFrequency(false)}
        onConfirm={(amount, frequency, planHash, approvalNeeded) => {
          setFrequencyData({ amount, frequency });
          setPendingPlanHash(planHash);
          setApprovalNeededForNewPlan(approvalNeeded);
          setShowSetFrequency(false);
          if (approvalNeeded) {
            setTimeout(() => setShowTokenApproval(true), 200);
          } else {
            setTimeout(() => setShowPlanCreatedShare(true), 300);
          }
          setTimeout(async () => {
            await refetchPlanData();
            router.refresh();
          }, 800);
        }}
        tokenOut={tokenAddress as `0x${string}`}
      />
      <TokenApprovalPopup
        open={showTokenApproval}
        onClose={() => setShowTokenApproval(false)}
        onApprove={(amount) => {
          setShowTokenApproval(false);
          setPendingPlanHash(undefined);
          if (approvalNeededForNewPlan) {
            setTimeout(() => setShowPlanCreatedShare(true), 300);
          }
          setApprovalNeededForNewPlan(undefined);
          setTimeout(async () => {
            await refetchPlanData();
            refreshBalance();
            router.refresh();
          }, 800);
        }}
        token="USDC"
        defaultAmount={frequencyData?.amount || 100}
        tokenOutAddress={tokenAddress as `0x${string}`}
        planHash={pendingPlanHash}
        frequencySeconds={(function () {
          const label = frequencyData?.frequency || "Daily";
          if (!label) return 86400;
          const lower = label.toLowerCase();
          if (lower.includes("minute")) {
            const n = parseInt(lower);
            return isNaN(n) ? 300 : n * 60;
          }
          if (lower.includes("hour")) return 3600;
          switch (label) {
            case "5 Minutes":
              return 300;
            case "10 Minutes":
              return 600;
            case "15 Minutes":
              return 900;
            case "30 Minutes":
              return 1800;
            case "Hourly":
              return 3600;
            case "Daily":
              return 86400;
            case "Weekly":
              return 604800;
            case "Monthly":
              return 2592000;
            default:
              return 86400;
          }
        })()}
        hasActivePlan={token.hasActivePlan}
        planAmount={frequencyData?.amount}
      />
      <PlanCreatedSharePopup
        open={showPlanCreatedShare}
        onClose={() => setShowPlanCreatedShare(false)}
        tokenSymbol={token.symbol}
        frequencyLabel={frequencyData?.frequency || "Daily"}
      />
      <SetFrequencyPopup
        open={showEditFrequency}
        onClose={() => setShowEditFrequency(false)}
        onConfirm={async () => {
          setShowEditFrequency(false);
          if (address && tokenAddress) {
            const response = await fetch(
              `/api/plan/getPlan/${address}?tokenAddress=${tokenAddress}`
            );
            const result: TokenApiResponse = await response.json();
            if (
              result.success &&
              result.data.plansOut &&
              result.data.plansOut.length > 0
            ) {
              setActivePlan(result.data.plansOut[0]);
            }
          }
        }}
        tokenOut={tokenAddress as `0x${string}`}
        initialAmount={
          activePlan ? Number(activePlan.amountIn) / 1_000_000 : 10
        }
        initialFrequency={(() => {
          if (!activePlan) return "Daily";
          switch (activePlan.frequency) {
            case 3600:
              return "Hourly";
            case 86400:
              return "Daily";
            case 604800:
              return "Weekly";
            case 2592000:
              return "Monthly";
            default:
              if (activePlan.frequency < 3600) {
                return `${activePlan.frequency / 60} minutes`;
              } else {
                return "Daily";
              }
          }
        })()}
        editMode={true}
      />
    </div>
  );
}
