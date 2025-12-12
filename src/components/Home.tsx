"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAccount } from "wagmi";
import { useRefresh } from "~/components/providers/RefreshProvider";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { BalanceDisplay } from "./ui/BalanceDisplay";
import InvestedPositionTile from "./ui/InvestedPositionTile";
import ExplorePositionTile from "./ui/ExplorePositionTile";
import PositionTileSkeleton from "./ui/PositionTileSkeleton";
import DotsLoader from "./ui/DotsLoader";
import { TokenApprovalPopup } from "./ui/TokenApprovalPopup";
import { TokenAddPopup } from "./ui/TokenAddPopup";

interface Token {
  id: string;
  address: string;
  symbol: string;
  name: string;
  about: string | null;
  decimals: string;
  image: string | null;
  isWrapped: boolean;
  wrappedName: string | null;
  wrappedSymbol: string | null;
  originalAddress: string | null;
  hasPlan: boolean;
  isActive: boolean;
  planCreatedAt: string | null;
  totalInvestedValue: number;
  currentValue: number;
  percentChange: number;
  currentPrice: number;
  fdvUsd: number;
  volume24h: number;
  marketCapUsd: number;
}

interface SearchToken {
  address: string;
  symbol: string;
  name: string;
  image: string | null;
}

interface PortfolioData {
  portfolioCurrentValue: number;
  portfolioInvestedAmount: number;
  portfolioPercentChange: number;
  history?: Array<{
    date: string;
    currentValue: number;
    totalInvestedValue?: number;
    percentChange?: number | null;
  }>;
}

interface PaginationData {
  page: number;
  limit: number;
  totalTokens: number;
  totalPages: number;
  hasMore: boolean;
}

const formatTimeAgo = (dateString: string | null): string => {
  if (!dateString) return "Just started";
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));

  if (diffInDays > 0) {
    return `${diffInDays} day${diffInDays === 1 ? "" : "s"} ago`;
  } else if (diffInHours > 0) {
    return `${diffInHours} hour${diffInHours === 1 ? "" : "s"} ago`;
  } else if (diffInMinutes > 0) {
    return `${diffInMinutes} minute${diffInMinutes === 1 ? "" : "s"} ago`;
  } else {
    return "Just started";
  }
};

const formatCurrency = (value: number): string => {
  if (isNaN(value) || !isFinite(value) || value === 0) return "NA";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatPrice = (price: number): string => {
  if (isNaN(price) || !isFinite(price) || price === 0) return "NA";
  if (price < 0.01) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 6,
      maximumFractionDigits: 6,
    }).format(price);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
};

const formatLargeNumber = (value: number): string => {
  if (isNaN(value) || !isFinite(value) || value === 0) return "NA";
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  else if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  else if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  else
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
};

// Calculate nice scale for chart Y-axis
const calculateNiceScale = (
  minValue: number,
  maxValue: number,
  maxTicks: number = 5
) => {
  const range = maxValue - minValue;
  const roughStep = range / (maxTicks - 1);

  // Calculate the magnitude of the step
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));

  // Calculate the most significant digit
  const mostSignificantDigit = Math.ceil(roughStep / magnitude);

  // Choose a nice step size
  let niceStep;
  if (mostSignificantDigit <= 1) niceStep = magnitude;
  else if (mostSignificantDigit <= 2) niceStep = 2 * magnitude;
  else if (mostSignificantDigit <= 5) niceStep = 5 * magnitude;
  else niceStep = 10 * magnitude;

  // Calculate nice min and max
  const niceMin = Math.floor(minValue / niceStep) * niceStep;
  const niceMax = Math.ceil(maxValue / niceStep) * niceStep;

  // Generate tick values
  const ticks: number[] = [];
  for (let tick = niceMin; tick <= niceMax; tick += niceStep) {
    ticks.push(tick);
  }

  return {
    niceMin,
    niceMax,
    tickSpacing: niceStep,
    ticks,
  };
};

const Home = () => {
  const [selectedPeriod, setSelectedPeriod] = useState("7D");
  const [tokens, setTokens] = useState<Token[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(
    null
  );
  const [chartMode, setChartMode] = useState<"value" | "percent">("value");
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 15,
    totalTokens: 0,
    totalPages: 0,
    hasMore: false,
  });

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchToken[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [showTokenApproval, setShowTokenApproval] = useState(false);
  const [showTokenAdd, setShowTokenAdd] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const { address } = useAccount();
  const router = useRouter();
  const { onTokenRefresh, refreshBalance } = useRefresh();

  const totalPortfolioBalance = tokens
    .filter((t) => t.hasPlan)
    .reduce((acc, t) => acc + t.currentValue, 0);

  const logUserVisit = useCallback(async () => {
    if (address) {
      await fetch("/api/visit/logWebAppVisit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userAddress: address }),
      });
    }
  }, [address]);

  const fetchTokens = useCallback(
    async () => {
      if (!address) return;

      try {
        setIsLoading(true);

        const response = await fetch(
          `/api/plan/getUserPlans/${address}?page=1&limit=50`
        );
        const result = await response.json();

        if (result.success) {
          const newTokens = result.data || [];
          setTokens(newTokens);
          if (result.pagination) {
            setPagination(result.pagination);
          }
          if (result.portfolio) {
            setPortfolioData(result.portfolio);
          }
        }
      } catch (error) {
        console.error("Error fetching tokens:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [address]
  );

  useEffect(() => {
    if (address) {
      fetchTokens();
      logUserVisit();
    }
  }, [address, fetchTokens, logUserVisit]);

  useEffect(() => {
    const unregister = onTokenRefresh(() => {
      fetchTokens();
    });
    return unregister;
  }, [onTokenRefresh, fetchTokens]);

  const handleSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const response = await fetch(
          `/api/token/searchTokens?query=${encodeURIComponent(query)}`
        );
        const result = await response.json();
        if (result.success) {
          setSearchResults(result.data || []);
        }
      } catch (error) {
        console.error("Search error:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    []
  );

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        handleSearch(searchQuery);
      }, 300);
    } else {
      setSearchResults([]);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, handleSearch]);

  const investedTokens = tokens.filter((t) => t.hasPlan);
  const exploreTokens = tokens.filter((t) => !t.hasPlan).slice(0, 8); // Limit to 8 tokens
  const totalExploreTokens = tokens.filter((t) => !t.hasPlan).length;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header - Logo | Explore | History | Search | Wallet */}
      <div className="sticky top-0 bg-black z-40 border-b border-gray-800 px-4 lg:px-8 py-4">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: DCA Logo & Navigation */}
          <div className="flex items-center gap-2 sm:gap-6">
            <Image
              src="/dca2.png"
              alt="DCA"
              width={40}
              height={40}
              className="cursor-pointer w-8 h-8 sm:w-10 sm:h-10"
              onClick={() => router.push("/")}
            />
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              <button
                className="px-4 py-2 text-orange-500 bg-orange-500/10 rounded-lg font-medium"
              >
                Home
              </button>
              <button
                onClick={() => router.push("/explore")}
                className="px-4 py-2 text-gray-400 hover:text-white hover:bg-[#1E1E1F] rounded-lg transition-colors"
              >
                Explore
              </button>
              <button
                onClick={() => router.push("/history")}
                className="px-4 py-2 text-gray-400 hover:text-white hover:bg-[#1E1E1F] rounded-lg transition-colors"
              >
                History
              </button>
            </nav>
            {/* Mobile Hamburger Menu */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden p-2 text-gray-400 hover:text-white hover:bg-[#1E1E1F] rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* Center: Search - Hidden on small mobile, visible on sm+ */}
          <div className="hidden sm:flex flex-1 max-w-[600px]">
            {!showSearch ? (
              <button
                onClick={() => setShowSearch(true)}
                className="flex items-center gap-2 w-full px-4 py-2 bg-[#1E1E1F] border border-[#2A2A2A] rounded-lg text-gray-400 hover:border-gray-600 transition-colors"
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
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <span className="text-sm">Search tokens...</span>
              </button>
            ) : (
              <div className="relative w-full">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or address..."
                  autoFocus
                  className="w-full px-4 py-2 pl-10 bg-[#1E1E1F] border border-[#2A2A2A] rounded-lg text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
                />
                <svg
                  className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setSearchResults([]);
                      setShowSearch(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    ×
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right: Search Icon (mobile only) & Wallet */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowSearch(true)}
              className="sm:hidden p-2 text-gray-400 hover:text-white hover:bg-[#1E1E1F] rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <BalanceDisplay onOpenApproval={() => setShowTokenApproval(true)} />
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {showMobileMenu && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => setShowMobileMenu(false)}
            />
            <div className="absolute top-full left-0 right-0 bg-[#1A1A1A] border-b border-[#2A2A2A] shadow-2xl z-50 md:hidden">
              <nav className="flex flex-col p-2">
                <button
                  onClick={() => {
                    router.push("/");
                    setShowMobileMenu(false);
                  }}
                  className="px-4 py-3 text-left text-orange-500 bg-orange-500/10 rounded-lg font-medium"
                >
                  Home
                </button>
                <button
                  onClick={() => {
                    router.push("/explore");
                    setShowMobileMenu(false);
                  }}
                  className="px-4 py-3 text-left text-gray-400 hover:text-white hover:bg-[#1E1E1F] rounded-lg transition-colors"
                >
                  Explore
                </button>
                <button
                  onClick={() => {
                    router.push("/history");
                    setShowMobileMenu(false);
                  }}
                  className="px-4 py-3 text-left text-gray-400 hover:text-white hover:bg-[#1E1E1F] rounded-lg transition-colors"
                >
                  History
                </button>
              </nav>
            </div>
          </>
        )}

        {/* Mobile Search Overlay */}
        {showSearch && (
          <div className="sm:hidden fixed inset-0 bg-black z-50 p-4">
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                className="text-white p-2"
              >
                ←
              </button>
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or address..."
                  autoFocus
                  className="w-full px-4 py-2 pl-10 bg-[#1E1E1F] border border-[#2A2A2A] rounded-lg text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
                />
                <svg
                  className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>
            {/* Mobile Search Results */}
            {searchQuery && (
              <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl max-h-[calc(100vh-120px)] overflow-y-auto">
            {isSearching ? (
              <div className="p-8 text-center">
                <div className="flex justify-center mb-3">
                  <div className="w-8 h-8 border-2 border-gray-600 border-t-orange-500 rounded-full animate-spin"></div>
                </div>
                <p className="text-gray-400 text-sm">Searching tokens...</p>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="p-2">
                {searchResults.map((token) => (
                  <div
                    key={token.address}
                    onClick={() => {
                      router.push(`/token/${token.address}`);
                      setShowSearch(false);
                      setSearchQuery("");
                      setSearchResults([]);
                    }}
                    className="flex items-center gap-3 p-3 hover:bg-[#2A2A2A] rounded-lg cursor-pointer transition-all duration-200 group"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {token.image &&
                      (token.image.startsWith("http://") ||
                        token.image.startsWith("https://") ||
                        token.image.startsWith("/")) ? (
                        <Image
                          src={token.image}
                          alt={token.symbol}
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-black font-bold text-base">
                          {token.symbol?.[0] || "?"}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold truncate group-hover:text-orange-400 transition-colors">
                          {token.symbol}
                        </span>
                      </div>
                      <div className="text-gray-400 text-sm truncate">
                        {token.name}
                      </div>
                    </div>
                    <svg
                      className="w-5 h-5 text-gray-600 group-hover:text-orange-500 transition-colors"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#2A2A2A] flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-gray-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <p className="text-gray-300 font-medium mb-1">No tokens found</p>
                <p className="text-gray-500 text-sm">Try a different search term</p>
              </div>
            )}
              </div>
            )}
          </div>
        )}

        {/* Desktop Search Results Dropdown */}
        {showSearch && searchQuery && (
          <div className="hidden sm:block absolute left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] lg:w-[600px] mt-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl shadow-2xl max-h-[400px] overflow-y-auto z-50">
            {isSearching ? (
              <div className="p-8 text-center">
                <div className="flex justify-center mb-3">
                  <div className="w-8 h-8 border-2 border-gray-600 border-t-orange-500 rounded-full animate-spin"></div>
                </div>
                <p className="text-gray-400 text-sm">Searching tokens...</p>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="p-2">
                {searchResults.map((token) => (
                  <div
                    key={token.address}
                    onClick={() => {
                      router.push(`/token/${token.address}`);
                      setShowSearch(false);
                      setSearchQuery("");
                      setSearchResults([]);
                    }}
                    className="flex items-center gap-3 p-3 hover:bg-[#2A2A2A] rounded-lg cursor-pointer transition-all duration-200 group"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {token.image &&
                      (token.image.startsWith("http://") ||
                        token.image.startsWith("https://") ||
                        token.image.startsWith("/")) ? (
                        <Image
                          src={token.image}
                          alt={token.symbol}
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-black font-bold text-base">
                          {token.symbol?.[0] || "?"}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold truncate group-hover:text-orange-400 transition-colors">
                          {token.symbol}
                        </span>
                      </div>
                      <div className="text-gray-400 text-sm truncate">
                        {token.name}
                      </div>
                    </div>
                    <svg
                      className="w-5 h-5 text-gray-600 group-hover:text-orange-500 transition-colors"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#2A2A2A] flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-gray-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <p className="text-gray-300 font-medium mb-1">No tokens found</p>
                <p className="text-gray-500 text-sm">Try a different search term</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-4 lg:px-8 py-6">
        {!isLoading && investedTokens.length === 0 && (
          <div className="mb-8 py-12 text-center">
            <div className="text-orange-500 uppercase tracking-widest text-xl lg:text-2xl font-semibold">
              STOP WATCHING, START STACKING
            </div>
          </div>
        )}

        {/* Two Column Layout: (Portfolio + Positions) 70% | Explore Tokens 30% */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Column - Portfolio Chart & DCA Positions - 70% on desktop */}
          <div className="w-full lg:w-[70%] space-y-6">
            {/* Portfolio Overview & Chart - Loading Skeleton */}
            {isLoading && (
              <div className="bg-[#131313] rounded-xl p-6">
                <style>{`
                  @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                  }
                  @keyframes dash {
                    to { stroke-dashoffset: -1000; }
                  }
                `}</style>

                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between mb-6">
                  <div className="space-y-3">
                    <div className="h-4 w-32 bg-[#2A2A2A] rounded animate-pulse" />
                    <div className="h-12 w-48 bg-[#1E1E1F] rounded animate-pulse" />
                    <div className="flex gap-4">
                      <div className="h-5 w-32 bg-[#2A2A2A] rounded animate-pulse" />
                      <div className="h-5 w-32 bg-[#2A2A2A] rounded animate-pulse" />
                    </div>
                  </div>
                  <div className="mt-4 lg:mt-0 h-10 w-24 bg-[#1E1E1F] rounded-full animate-pulse" />
                </div>

                {/* Chart Skeleton */}
                <div
                  className="relative h-[400px] rounded-lg overflow-hidden"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(90deg, #1E1E1F 0, #1E1E1F 1px, transparent 1px, transparent 36px), repeating-linear-gradient(0deg, #1E1E1F 0, #1E1E1F 1px, transparent 1px, transparent 24px)",
                    backgroundColor: "#101010",
                  }}
                >
                  {/* Shimmer sweep */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)",
                      animation: "shimmer 1.7s infinite",
                    }}
                  />
                  {/* Animated dashed line */}
                  <svg
                    className="absolute inset-0 w-full h-full opacity-40"
                    viewBox="0 0 400 400"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M0 300 L40 280 L80 290 L120 250 L160 270 L200 220 L240 260 L280 210 L320 240 L360 200 L400 220"
                      fill="none"
                      stroke="#f97316"
                      strokeWidth="3"
                      strokeLinecap="round"
                      style={{
                        strokeDasharray: "8 8",
                        animation: "dash 2.8s linear infinite",
                      }}
                    />
                  </svg>
                </div>

                {/* Legend Skeleton */}
                <div className="flex items-center justify-center gap-6 mt-4">
                  <div className="h-4 w-28 bg-[#2A2A2A] rounded animate-pulse" />
                  <div className="h-4 w-28 bg-[#2A2A2A] rounded animate-pulse" />
                </div>
              </div>
            )}

            {/* Portfolio Overview & Chart */}
            {!isLoading && investedTokens.length > 0 && (
              <div className="bg-[#131313] rounded-xl p-6">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between mb-6">
                  <div>
                    <div className="text-gray-400 text-sm mb-2">
                      Portfolio balance
                    </div>
                    <div className="text-4xl lg:text-5xl font-light mb-2">
                      {formatCurrency(totalPortfolioBalance)}
                    </div>
                    {portfolioData && (
                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <span className="text-gray-400">Invested:</span>
                          <span className="text-white">
                            {formatCurrency(portfolioData.portfolioInvestedAmount)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-gray-400">Change:</span>
                          <span
                            className={
                              portfolioData.portfolioPercentChange >= 0
                                ? "text-green-400"
                                : "text-red-400"
                            }
                          >
                            {portfolioData.portfolioPercentChange >= 0 ? "+" : ""}
                            {portfolioData.portfolioPercentChange.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Chart Mode Toggle */}
                  <div className="mt-4 lg:mt-0 bg-[#1E1E1F] border border-[#2A2A2A] rounded-full p-1 flex self-start lg:self-auto">
                    <button
                      onClick={() => setChartMode("value")}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        chartMode === "value"
                          ? "bg-black text-white"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      $
                    </button>
                    <button
                      onClick={() => setChartMode("percent")}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        chartMode === "percent"
                          ? "bg-black text-white"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      %
                    </button>
                  </div>
                </div>

                {/* Portfolio Chart */}
                {portfolioData?.history && portfolioData.history.length > 0 && (
                  <div className="relative w-full space-y-4">
                    <div className="h-[250px] sm:h-[350px] lg:h-[400px]">
                    {(() => {
                      const history = portfolioData.history;
                      const width = 1000;
                      const height = 400;
                      const padding = { top: 40, right: 40, bottom: 40, left: 80 };

                      // Get all values for both lines
                      const currentValues = history.map((point) => point.currentValue);
                      const investedValues = history.map((point) => point.totalInvestedValue || 0);
                      const percentValues = history.map((point) => point.percentChange || 0);

                      // Determine min/max based on chart mode
                      let allValues: number[] = [];
                      if (chartMode === "value") {
                        allValues = [...currentValues, ...investedValues];
                      } else {
                        allValues = percentValues;
                      }

                      const minValue = Math.min(...allValues);
                      const maxValue = Math.max(...allValues);

                      // Calculate nice scale
                      const { niceMin, niceMax, ticks } = calculateNiceScale(
                        minValue,
                        maxValue
                      );

                      const chartWidth = width - padding.left - padding.right;
                      const chartHeight = height - padding.top - padding.bottom;

                      // Generate points for current value line
                      const currentPoints = history.map((point, i) => {
                        const x =
                          padding.left + (i / (history.length - 1)) * chartWidth;
                        const value =
                          chartMode === "value"
                            ? point.currentValue
                            : point.percentChange || 0;
                        const y =
                          padding.top +
                          chartHeight -
                          ((value - niceMin) / (niceMax - niceMin)) * chartHeight;
                        return { x, y, value };
                      });

                      // Generate points for invested value line (only in value mode)
                      const investedPoints = chartMode === "value" ? history.map((point, i) => {
                        const x =
                          padding.left + (i / (history.length - 1)) * chartWidth;
                        const value = point.totalInvestedValue || 0;
                        const y =
                          padding.top +
                          chartHeight -
                          ((value - niceMin) / (niceMax - niceMin)) * chartHeight;
                        return { x, y, value };
                      }) : [];

                      // Generate paths
                      const currentLinePath = currentPoints
                        .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
                        .join(" ");

                      const currentAreaPath = `${currentLinePath} L ${currentPoints[currentPoints.length - 1].x} ${
                        padding.top + chartHeight
                      } L ${padding.left} ${padding.top + chartHeight} Z`;

                      const investedLinePath = investedPoints.length > 0 ? investedPoints
                        .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
                        .join(" ") : "";

                      return (
                        <svg
                          className="w-full h-full"
                          viewBox={`0 0 ${width} ${height}`}
                          preserveAspectRatio="none"
                        >
                          <defs>
                            <linearGradient
                              id="chartGradientCurrent"
                              x1="0"
                              x2="0"
                              y1="0"
                              y2="1"
                            >
                              <stop offset="0%" stopColor="#f97316" stopOpacity="0.2" />
                              <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
                            </linearGradient>
                          </defs>

                          {/* Y-axis ticks */}
                          {ticks.map((tick) => {
                            const y =
                              padding.top +
                              chartHeight -
                              ((tick - niceMin) / (niceMax - niceMin)) * chartHeight;
                            return (
                              <g key={tick}>
                                <line
                                  x1={padding.left}
                                  y1={y}
                                  x2={width - padding.right}
                                  y2={y}
                                  stroke="#2A2A2A"
                                  strokeWidth="1"
                                  strokeDasharray="4 4"
                                />
                                <text
                                  x={padding.left - 10}
                                  y={y}
                                  textAnchor="end"
                                  alignmentBaseline="middle"
                                  fill="#6B7280"
                                  fontSize="14"
                                  fontWeight="500"
                                >
                                  {chartMode === "value"
                                    ? formatCurrency(tick)
                                    : `${tick.toFixed(1)}%`}
                                </text>
                              </g>
                            );
                          })}

                          {/* Area under current value line */}
                          <path d={currentAreaPath} fill="url(#chartGradientCurrent)" />

                          {/* Invested value line (only in value mode) */}
                          {chartMode === "value" && investedLinePath && (
                            <path
                              d={investedLinePath}
                              fill="none"
                              stroke="#3b82f6"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          )}

                          {/* Current value line */}
                          <path
                            d={currentLinePath}
                            fill="none"
                            stroke="#f97316"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />

                          {/* Data points for current value */}
                          {currentPoints.map((point, i) => (
                            <circle
                              key={`current-${i}`}
                              cx={point.x}
                              cy={point.y}
                              r="5"
                              fill="#f97316"
                              stroke="#000"
                              strokeWidth="2"
                            />
                          ))}

                          {/* Data points for invested value (only in value mode) */}
                          {chartMode === "value" && investedPoints.map((point, i) => (
                            <circle
                              key={`invested-${i}`}
                              cx={point.x}
                              cy={point.y}
                              r="4"
                              fill="#3b82f6"
                              stroke="#000"
                              strokeWidth="2"
                            />
                          ))}
                        </svg>
                      );
                    })()}
                    </div>

                    {/* Legend below chart */}
                    {chartMode === "value" && (
                      <div className="flex items-center justify-center gap-6 text-sm text-gray-400">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                          <span>Current value</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                          <span>Invested value</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* DCA Positions */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">DCA Positions</h2>
                {investedTokens.length > 0 && (
                  <span className="text-sm text-gray-400">
                    {investedTokens.length} active
                  </span>
                )}
              </div>

              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <PositionTileSkeleton key={i} />
                  ))}
                </div>
              ) : investedTokens.length > 0 ? (
                <div className="space-y-2">
                  {investedTokens.map((token) => (
                    <div
                      key={token.id}
                      onClick={() => router.push(`/token/${token.address}`)}
                      className="cursor-pointer transition-transform hover:scale-[1.01]"
                    >
                      <InvestedPositionTile
                        icon={token.image || undefined}
                        iconBgColor="bg-orange-500"
                        name={token.symbol}
                        currentPrice={formatPrice(token.currentPrice)}
                        startedAgo={formatTimeAgo(token.planCreatedAt)}
                        investedAmount={formatCurrency(token.totalInvestedValue)}
                        currentValue={formatCurrency(token.currentValue)}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-[#1E1E1F] rounded-xl p-8 text-center">
                  <p className="text-gray-400 mb-4">
                    No active DCA positions yet
                  </p>
                  <button
                    onClick={() => router.push(`/explore`)}
                    className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-black font-semibold rounded-lg transition-colors"
                  >
                    Explore tokens
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Explore Tokens - 30% on desktop */}
          <div className="w-full lg:w-[30%]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">Explore Tokens</h2>
                {totalExploreTokens > 0 && (
                  <span className="text-sm text-gray-400">
                    Showing {exploreTokens.length} of {totalExploreTokens}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowTokenAdd(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-black font-medium rounded-lg transition-colors text-sm"
                title="Add Token"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span className="hidden sm:inline">Add Token</span>
              </button>
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <PositionTileSkeleton key={i} />
                ))}
              </div>
            ) : exploreTokens.length > 0 ? (
              <>
                <div className="space-y-2 mb-4">
                  {exploreTokens.map((token) => (
                    <div
                      key={token.id}
                      onClick={() => router.push(`/token/${token.address}`)}
                      className="cursor-pointer transition-transform hover:scale-[1.01]"
                    >
                      <ExplorePositionTile
                        icon={token.image || undefined}
                        iconBgColor="bg-blue-500"
                        name={token.symbol}
                        currentPrice={formatPrice(token.currentPrice)}
                        marketCap={formatLargeNumber(token.marketCapUsd)}
                        volume24h={formatLargeNumber(token.volume24h)}
                        fdv={formatLargeNumber(token.fdvUsd)}
                      />
                    </div>
                  ))}
                </div>

                {/* Explore More Button */}
                {totalExploreTokens > 8 && (
                  <button
                    onClick={() => router.push("/explore")}
                    className="w-full py-3 bg-[#1E1E1F] hover:bg-[#2A2A2A] text-white font-medium rounded-lg transition-colors border border-[#2A2A2A] flex items-center justify-center gap-2"
                  >
                    Explore More Tokens
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                )}
              </>
            ) : (
              <div className="bg-[#1E1E1F] rounded-xl p-8 text-center">
                <p className="text-gray-400 mb-4">No tokens to explore yet</p>
                <button
                  onClick={() => setShowTokenAdd(true)}
                  className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-black font-semibold rounded-lg transition-colors"
                >
                  Add Your First Token
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Popups */}
      <TokenApprovalPopup
        open={showTokenApproval}
        onClose={() => setShowTokenApproval(false)}
        onApprove={() => {
          setShowTokenApproval(false);
          refreshBalance();
        }}
      />
      <TokenAddPopup
        open={showTokenAdd}
        onClose={() => setShowTokenAdd(false)}
        onTokenAdded={() => {
          setShowTokenAdd(false);
          fetchTokens();
        }}
      />
    </div>
  );
};

export default Home;
