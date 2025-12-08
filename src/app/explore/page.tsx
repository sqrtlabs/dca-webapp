"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import Image from "next/image";
import { BalanceDisplay } from "~/components/ui/BalanceDisplay";
import { TokenAddPopup } from "~/components/ui/TokenAddPopup";
import DotsLoader from "~/components/ui/DotsLoader";

interface Token {
  id: string;
  address: string;
  symbol: string;
  name: string;
  about: string | null;
  decimals: string;
  image: string | null;
  currentPrice: number;
  fdvUsd: number;
  volume24h: number;
  marketCapUsd: number;
  hasPlan: boolean;
}

const formatNumber = (num: number): string => {
  if (isNaN(num) || !isFinite(num) || num === 0) return "-";
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  else if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  else if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
  else return `$${num.toFixed(2)}`;
};

const formatPrice = (price: number): string => {
  if (isNaN(price) || !isFinite(price) || price === 0) return "-";
  if (price < 0.01) return `$${price.toFixed(6)}`;
  if (price < 1) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(2)}`;
};

export default function ExplorePage() {
  const router = useRouter();
  const { address } = useAccount();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [filteredTokens, setFilteredTokens] = useState<Token[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showTokenAdd, setShowTokenAdd] = useState(false);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Token;
    direction: "asc" | "desc";
  }>({
    key: "volume24h",
    direction: "desc",
  });

  const fetchTokens = useCallback(async () => {
    if (!address) return;

    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/plan/getUserPlans/${address}?page=1&limit=100`
      );
      const result = await response.json();

      if (result.success) {
        setTokens(result.data || []);
        setFilteredTokens(result.data || []);
      }
    } catch (error) {
      console.error("Error fetching tokens:", error);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  // Search filter
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTokens(tokens);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = tokens.filter(
      (token) =>
        token.symbol.toLowerCase().includes(query) ||
        token.name.toLowerCase().includes(query) ||
        token.address.toLowerCase().includes(query)
    );
    setFilteredTokens(filtered);
  }, [searchQuery, tokens]);

  // Sorting
  const handleSort = (key: keyof Token) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });

    const sorted = [...filteredTokens].sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];

      if (typeof aVal === "number" && typeof bVal === "number") {
        return direction === "asc" ? aVal - bVal : bVal - aVal;
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        return direction === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return 0;
    });

    setFilteredTokens(sorted);
  };

  const SortIcon = ({ columnKey }: { columnKey: keyof Token }) => {
    if (sortConfig.key !== columnKey) {
      return (
        <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24">
          <path
            d="M8 9l4-4 4 4M16 15l-4 4-4-4"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    }

    return sortConfig.direction === "asc" ? (
      <svg
        className="w-4 h-4 text-orange-500"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="M8 15l4-4 4 4"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ) : (
      <svg
        className="w-4 h-4 text-orange-500"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="M16 9l-4 4-4-4"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 bg-black z-40 border-b border-gray-800 px-4 lg:px-8 py-4">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
          {/* Left: Logo & Navigation */}
          <div className="flex items-center gap-6">
            <Image
              src="/dca2.png"
              alt="DCA"
              width={40}
              height={40}
              className="cursor-pointer"
              onClick={() => router.push("/")}
            />
            <nav className="hidden md:flex items-center gap-1">
              <button
                onClick={() => router.push("/")}
                className="px-4 py-2 text-gray-400 hover:text-white hover:bg-[#1E1E1F] rounded-lg transition-colors"
              >
                Home
              </button>
              <button
                className="px-4 py-2 text-orange-500 bg-orange-500/10 rounded-lg font-medium"
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
          </div>

          

          {/* Right: Wallet & Balance */}
          <div className="flex-shrink-0">
            <BalanceDisplay onOpenApproval={() => {}} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-4 lg:px-8 py-6">
        {/* Search & Actions Bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, symbol, or address..."
              className="w-full px-4 py-3 pl-11 bg-[#1E1E1F] border border-[#2A2A2A] rounded-lg text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
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
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                ×
              </button>
            )}
          </div>

          {/* Add Token Button */}
          <button
            onClick={() => setShowTokenAdd(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-black font-semibold rounded-lg transition-colors"
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Token
          </button>
        </div>

        {/* Results Count */}
        <div className="mb-4 text-sm text-gray-400">
          {filteredTokens.length} {filteredTokens.length === 1 ? "token" : "tokens"} found
        </div>

        {/* Tokens Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <DotsLoader isVisible={true} position="bottom" />
          </div>
        ) : filteredTokens.length > 0 ? (
          <div className="bg-[#131313] rounded-xl overflow-hidden border border-[#2A2A2A]">
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2A2A2A]">
                    <th className="text-left py-4 px-6 text-gray-400 font-medium text-sm">
                      #
                    </th>
                    <th className="text-left py-4 px-6 text-gray-400 font-medium text-sm">
                      <button
                        onClick={() => handleSort("symbol")}
                        className="flex items-center gap-1 hover:text-white transition-colors"
                      >
                        Token
                        <SortIcon columnKey="symbol" />
                      </button>
                    </th>
                    <th className="text-right py-4 px-6 text-gray-400 font-medium text-sm">
                      <button
                        onClick={() => handleSort("currentPrice")}
                        className="flex items-center gap-1 ml-auto hover:text-white transition-colors"
                      >
                        Price
                        <SortIcon columnKey="currentPrice" />
                      </button>
                    </th>
                    <th className="text-right py-4 px-6 text-gray-400 font-medium text-sm">
                      <button
                        onClick={() => handleSort("volume24h")}
                        className="flex items-center gap-1 ml-auto hover:text-white transition-colors"
                      >
                        24h Volume
                        <SortIcon columnKey="volume24h" />
                      </button>
                    </th>
                    <th className="text-right py-4 px-6 text-gray-400 font-medium text-sm">
                      <button
                        onClick={() => handleSort("marketCapUsd")}
                        className="flex items-center gap-1 ml-auto hover:text-white transition-colors"
                      >
                        Market Cap
                        <SortIcon columnKey="marketCapUsd" />
                      </button>
                    </th>
                    <th className="text-right py-4 px-6 text-gray-400 font-medium text-sm">
                      <button
                        onClick={() => handleSort("fdvUsd")}
                        className="flex items-center gap-1 ml-auto hover:text-white transition-colors"
                      >
                        FDV
                        <SortIcon columnKey="fdvUsd" />
                      </button>
                    </th>
                    <th className="text-center py-4 px-6 text-gray-400 font-medium text-sm">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTokens.map((token, index) => (
                    <tr
                      key={token.id}
                      onClick={() => router.push(`/token/${token.address}`)}
                      className="border-b border-[#2A2A2A] hover:bg-[#1A1A1A] transition-colors cursor-pointer"
                    >
                      <td className="py-4 px-6 text-gray-400">{index + 1}</td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {token.image &&
                            (token.image.startsWith("http://") ||
                              token.image.startsWith("https://") ||
                              token.image.startsWith("/")) ? (
                              <Image
                                src={token.image}
                                alt={token.symbol}
                                width={32}
                                height={32}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-black font-semibold text-sm">
                                {token.symbol[0]}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="text-white font-medium">
                              {token.symbol}
                            </div>
                            <div className="text-gray-400 text-xs">
                              {token.name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right text-white">
                        {formatPrice(token.currentPrice)}
                      </td>
                      <td className="py-4 px-6 text-right text-white">
                        {formatNumber(token.volume24h)}
                      </td>
                      <td className="py-4 px-6 text-right text-white">
                        {formatNumber(token.marketCapUsd)}
                      </td>
                      <td className="py-4 px-6 text-right text-white">
                        {formatNumber(token.fdvUsd)}
                      </td>
                      <td className="py-4 px-6 text-center">
                        {token.hasPlan ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
                            <svg
                              className="w-3 h-3"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 bg-gray-700/50 text-gray-400 rounded-full text-xs font-medium">
                            Available
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-[#2A2A2A]">
              {filteredTokens.map((token, index) => (
                <div
                  key={token.id}
                  onClick={() => router.push(`/token/${token.address}`)}
                  className="p-4 hover:bg-[#1A1A1A] transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500 text-sm">#{index + 1}</span>
                      <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center overflow-hidden">
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
                          <span className="text-black font-semibold">
                            {token.symbol[0]}
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="text-white font-medium">{token.symbol}</div>
                        <div className="text-gray-400 text-xs">{token.name}</div>
                      </div>
                    </div>
                    {token.hasPlan ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 bg-gray-700/50 text-gray-400 rounded-full text-xs font-medium">
                        Available
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-gray-400 text-xs mb-1">Price</div>
                      <div className="text-white">{formatPrice(token.currentPrice)}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs mb-1">24h Volume</div>
                      <div className="text-white">{formatNumber(token.volume24h)}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs mb-1">Market Cap</div>
                      <div className="text-white">{formatNumber(token.marketCapUsd)}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs mb-1">FDV</div>
                      <div className="text-white">{formatNumber(token.fdvUsd)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-[#131313] rounded-xl p-12 text-center border border-[#2A2A2A]">
            <div className="w-16 h-16 bg-[#2A2A2A] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-gray-500"
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
            <h3 className="text-xl font-semibold mb-2">No tokens found</h3>
            <p className="text-gray-400 mb-6">
              {searchQuery
                ? "Try adjusting your search query"
                : "Add your first token to get started"}
            </p>
            <button
              onClick={() => setShowTokenAdd(true)}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-black font-semibold rounded-lg transition-colors"
            >
              Add Token
            </button>
          </div>
        )}
      </div>

      {/* Add Token Popup */}
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
}
