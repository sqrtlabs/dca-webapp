"use client";
import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useAccount } from "wagmi";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { BalanceDisplay } from "~/components/ui/BalanceDisplay";
import { TokenApprovalPopup } from "~/components/ui/TokenApprovalPopup";

interface Execution {
  txHash: string;
  planHash: string;
  token: {
    address: string;
    symbol: string;
    name: string;
    image: string | null;
    decimals: number;
  };
  amountIn: number;
  amountOut: number;
  feeAmount: number;
  executedAt: string;
}

interface TokenFilter {
  address: string;
  symbol: string;
  name: string;
  image: string | null;
}

interface HistoryData {
  executions: Execution[];
  executionsByDate: Record<string, number>;
  tokens: TokenFilter[];
  stats: {
    totalExecutions: number;
    totalInvested: number;
  };
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasMore: boolean;
  };
}

const formatCurrency = (value: number): string => {
  if (isNaN(value) || !isFinite(value) || value === 0) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatTokenAmount = (value: number, decimals?: number): string => {
  if (isNaN(value) || !isFinite(value)) return "0";
  // Show more decimals for small amounts
  if (value < 0.0001) return value.toFixed(8);
  if (value < 1) return value.toFixed(6);
  if (value < 1000) return value.toFixed(4);
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatAddress = (addr: string) => {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

function HistoryPageContent() {
  const { address } = useAccount();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Extract token from URL params
  const tokenFromUrl = searchParams.get('token');

  const [historyData, setHistoryData] = useState<HistoryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedToken, setSelectedToken] = useState<string | null>(tokenFromUrl);
  const [showTokenApproval, setShowTokenApproval] = useState(false);
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Check for token filter in URL params - reactive to URL changes
  useEffect(() => {
    // Always sync with URL params
    setSelectedToken(tokenFromUrl);
    if (tokenFromUrl) {
      setCurrentPage(1); // Reset to page 1 when filter is applied
    }
  }, [tokenFromUrl]); // Use the actual token value as dependency

  const fetchHistory = useCallback(async () => {
    if (!address) return;

    try {
      setIsLoading(true);

      // Build URL with filters
      const params = new URLSearchParams();
      params.append("page", currentPage.toString());
      params.append("limit", "20");

      if (selectedToken) {
        params.append("token", selectedToken);
      }

      if (selectedDate) {
        params.append("date", selectedDate);
      }

      const url = `/api/execution/getHistory/${address}?${params.toString()}`;

      const response = await fetch(url);
      const result = await response.json();

      if (result.success) {
        setHistoryData(result.data);
      }
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setIsLoading(false);
    }
  }, [address, selectedToken, currentPage, selectedDate]);

  useEffect(() => {
    if (address) {
      fetchHistory();
    }
  }, [address, selectedToken, currentPage, selectedDate, fetchHistory]);

  // Generate activity grid grouped by month
  const generateMonthlyActivityGrids = () => {
    if (!historyData) return [];

    const today = new Date();
    const months: Array<{
      month: string;
      year: number;
      weeks: Array<Array<{ date: Date; count: number; dayName: string }>>;
    }> = [];

    // Generate last 12 months
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthName = monthDate.toLocaleDateString("en-US", { month: "short" });
      const year = monthDate.getFullYear();

      // Get first and last day of month
      const firstDay = new Date(year, monthDate.getMonth(), 1);
      const lastDay = new Date(year, monthDate.getMonth() + 1, 0);

      // Start from Sunday before first day
      const startDate = new Date(firstDay);
      startDate.setDate(startDate.getDate() - startDate.getDay());

      const weeks: Array<Array<{ date: Date; count: number; dayName: string }>> = [];
      let currentWeek: Array<{ date: Date; count: number; dayName: string }> = [];

      // Calculate total days to show (complete weeks)
      const totalDays = 7 * Math.ceil((firstDay.getDay() + lastDay.getDate()) / 7);

      for (let day = 0; day < totalDays; day++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + day);

        const dateStr = date.toISOString().split("T")[0];
        const count = historyData.executionsByDate[dateStr] || 0;
        const dayName = date.toLocaleDateString("en-US", { weekday: "short" });

        currentWeek.push({ date, count, dayName });

        if (currentWeek.length === 7) {
          weeks.push(currentWeek);
          currentWeek = [];
        }
      }

      if (currentWeek.length > 0) {
        weeks.push(currentWeek);
      }

      months.push({ month: monthName, year, weeks });
    }

    return months;
  };

  const getActivityColor = (count: number): string => {
    if (count === 0) return "bg-[#1E1E1F]";
    if (count === 1) return "bg-orange-900/40";
    if (count === 2) return "bg-orange-700/60";
    if (count === 3) return "bg-orange-600/80";
    return "bg-orange-500";
  };

  if (!address) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Connect Your Wallet</h1>
          <p className="text-gray-400">
            Please connect your wallet to view your DCA history
          </p>
        </div>
      </div>
    );
  }

  const monthlyGrids = historyData ? generateMonthlyActivityGrids() : [];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header - Logo | Explore | History | Search | Wallet */}
      <div className="sticky top-0 bg-black z-40 border-b border-gray-800 px-4 lg:px-8 py-4">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
          {/* Left: DCA Logo & Navigation */}
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
                onClick={() => router.push("/explore")}
                className="px-4 py-2 text-gray-400 hover:text-white hover:bg-[#1E1E1F] rounded-lg transition-colors"
              >
                Explore
              </button>
              <button
                onClick={() => router.push("/history")}
                className="px-4 py-2 text-orange-500 bg-orange-500/10 rounded-lg font-medium"
              >
                History
              </button>
            </nav>
          </div>

          {/* Right: Wallet & Balance */}
          <div className="flex-shrink-0">
            <BalanceDisplay onOpenApproval={() => setShowTokenApproval(true)} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            {selectedDate
              ? (() => {
                  const date = new Date(selectedDate);
                  const month = date.toLocaleDateString("en-US", { month: "long" });
                  const day = date.getDate();
                  const year = String(date.getFullYear()).slice(-2);
                  return `Showing executions for ${month} ${day}, ${year}`;
                })()
              : "DCA History"
            }
          </h1>
          <p className="text-gray-400">
            {selectedDate
              ? `All DCA executions from this day`
              : "Track all your dollar-cost averaging executions"
            }
          </p>
          {selectedDate && (
            <button
              onClick={() => setSelectedDate(null)}
              className="mt-2 text-sm text-orange-500 hover:text-orange-400 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              View all executions
            </button>
          )}
        </div>

        {isLoading && currentPage === 1 ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-8 h-8 border-2 border-gray-600 border-t-orange-500 rounded-full animate-spin"></div>
          </div>
        ) : historyData && historyData.stats.totalExecutions > 0 ? (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-6">
                <div className="text-gray-400 text-sm mb-2">Total Executions</div>
                <div className="text-3xl font-bold text-white">
                  {historyData.stats.totalExecutions}
                </div>
              </div>
              <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-6">
                <div className="text-gray-400 text-sm mb-2">Total Invested</div>
                <div className="text-3xl font-bold text-white">
                  {formatCurrency(historyData.stats.totalInvested)}
                </div>
              </div>
            </div>

            {/* Activity Grid by Month */}
            <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-6 mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Activity</h2>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>Less</span>
                  <div className="flex gap-1">
                    <div className="w-3 h-3 rounded-sm bg-[#1E1E1F]"></div>
                    <div className="w-3 h-3 rounded-sm bg-orange-900/40"></div>
                    <div className="w-3 h-3 rounded-sm bg-orange-700/60"></div>
                    <div className="w-3 h-3 rounded-sm bg-orange-600/80"></div>
                    <div className="w-3 h-3 rounded-sm bg-orange-500"></div>
                  </div>
                  <span>More</span>
                </div>
              </div>

              <div className="flex items-start gap-4 flex-wrap">
                {/* Day labels - shown once on the left for first month only */}
                <div className="flex flex-col gap-1 text-xs text-gray-500 pt-7">
                  <div className="h-3"></div>
                  <div className="h-3 flex items-center">Mon</div>
                  <div className="h-3"></div>
                  <div className="h-3 flex items-center">Wed</div>
                  <div className="h-3"></div>
                  <div className="h-3 flex items-center">Fri</div>
                  <div className="h-3"></div>
                </div>

                {monthlyGrids.map((monthData, monthIndex) => {
                  const monthDate = new Date(monthData.year, new Date(Date.parse(monthData.month + " 1, 2000")).getMonth(), 1);

                  return (
                    <div key={monthIndex} className="flex-shrink-0">
                      <div className="text-sm font-medium text-gray-400 mb-2">
                        {monthData.month} {monthData.year}
                      </div>
                      <div className="flex gap-1">
                        {monthData.weeks.map((week, weekIndex) => (
                          <div key={weekIndex} className="flex flex-col gap-1">
                            {week.map((day, dayIndex) => {
                              const isCurrentMonth = day.date.getMonth() === monthDate.getMonth();
                              const isToday =
                                day.date.toDateString() === new Date().toDateString();
                              const dateStr = day.date.toISOString().split("T")[0];
                              const isSelected = selectedDate === dateStr;
                              const hasExecutions = day.count > 0;

                              return (
                                <div
                                  key={dayIndex}
                                  onClick={() => {
                                    if (isCurrentMonth && hasExecutions) {
                                      setSelectedDate(dateStr);
                                      setCurrentPage(1);
                                    }
                                  }}
                                  className={`w-3 h-3 rounded-sm ${
                                    isCurrentMonth
                                      ? getActivityColor(day.count)
                                      : "bg-transparent"
                                  } ${
                                    isToday && isCurrentMonth ? "ring-1 ring-orange-500 ring-offset-1 ring-offset-[#1A1A1A]" : ""
                                  } ${
                                    isSelected ? "ring-1 ring-blue-400 ring-offset-1 ring-offset-[#1A1A1A]" : ""
                                  } ${
                                    isCurrentMonth && hasExecutions
                                      ? "hover:ring-1 hover:ring-gray-500 cursor-pointer"
                                      : isCurrentMonth
                                      ? "cursor-default"
                                      : ""
                                  } transition-all`}
                                  title={`${day.date.toLocaleDateString()} (${day.dayName}): ${
                                    day.count
                                  } execution${day.count !== 1 ? "s" : ""}`}
                                ></div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Token Filter Dropdown */}
            <div className="mb-6">
              <div className="relative">
                <button
                  onClick={() => setShowTokenDropdown(!showTokenDropdown)}
                  className="flex items-center justify-between gap-2 px-4 py-2.5 bg-[#1E1E1F] border border-[#2A2A2A] rounded-lg hover:border-gray-600 transition-colors min-w-[200px]"
                >
                  <div className="flex items-center gap-2">
                    {selectedToken ? (
                      <>
                        {historyData.tokens.find((t) => t.address === selectedToken)?.image && (
                          <Image
                            src={historyData.tokens.find((t) => t.address === selectedToken)!.image!}
                            alt=""
                            width={20}
                            height={20}
                            className="rounded-full"
                          />
                        )}
                        <span className="text-white">
                          {historyData.tokens.find((t) => t.address === selectedToken)?.symbol}
                        </span>
                      </>
                    ) : (
                      <span className="text-white">All Tokens</span>
                    )}
                  </div>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${
                      showTokenDropdown ? "rotate-180" : ""
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

                {showTokenDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowTokenDropdown(false)}
                    />
                    <div className="absolute top-full left-0 mt-2 w-64 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg shadow-2xl z-20 max-h-80 overflow-y-auto">
                      <button
                        onClick={() => {
                          setShowTokenDropdown(false);
                          router.push('/history');
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#2A2A2A] transition-colors ${
                          !selectedToken ? "bg-orange-500/10 text-orange-500" : "text-white"
                        }`}
                      >
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center">
                          <span className="text-xs">All</span>
                        </div>
                        <span className="font-medium">All Tokens</span>
                      </button>
                      {historyData.tokens.map((token) => (
                        <button
                          key={token.address}
                          onClick={() => {
                            setShowTokenDropdown(false);
                            router.push(`/history?token=${token.address}`);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#2A2A2A] transition-colors ${
                            selectedToken === token.address
                              ? "bg-orange-500/10 text-orange-500"
                              : "text-white"
                          }`}
                        >
                          {token.image ? (
                            <Image
                              src={token.image}
                              alt={token.symbol}
                              width={24}
                              height={24}
                              className="rounded-full"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                              <span className="text-xs text-black font-bold">
                                {token.symbol[0]}
                              </span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{token.symbol}</div>
                            <div className="text-xs text-gray-400 truncate">{token.name}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Execution List */}
            <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl overflow-hidden mb-6">
              <div className="px-6 py-4 border-b border-[#2A2A2A]">
                <h2 className="text-lg font-semibold">
                  Executions ({historyData.pagination.totalCount})
                </h2>
              </div>
              <div className="divide-y divide-[#2A2A2A]">
                {isLoading ? (
                  <div className="p-8 text-center">
                    <div className="w-8 h-8 border-2 border-gray-600 border-t-orange-500 rounded-full animate-spin mx-auto"></div>
                  </div>
                ) : historyData.executions.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    No executions found for this {selectedDate ? "day" : "filter"}
                  </div>
                ) : (
                  historyData.executions.map((execution) => (
                    <div
                      key={execution.txHash}
                      className="px-6 py-4 hover:bg-[#1E1E1F] transition-colors"
                    >
                      <div className="flex items-center justify-between gap-4">
                        {/* Token Info */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {execution.token.image ? (
                              <Image
                                src={execution.token.image}
                                alt={execution.token.symbol}
                                width={40}
                                height={40}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-black font-bold">
                                {execution.token.symbol[0]}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-white">
                              {execution.token.symbol}
                            </div>
                            <div className="text-sm text-gray-400">
                              {formatDate(execution.executedAt)}
                            </div>
                          </div>
                        </div>

                        {/* Amounts */}
                        <div className="hidden md:flex flex-col items-end">
                          <div className="text-sm text-gray-400">Invested</div>
                          <div className="font-medium text-white">
                            {formatCurrency(execution.amountIn)}
                          </div>
                        </div>

                        <div className="hidden md:flex flex-col items-end">
                          <div className="text-sm text-gray-400">Received</div>
                          <div className="font-medium text-green-400">
                            {formatTokenAmount(execution.amountOut, execution.token.decimals)}{" "}
                            {execution.token.symbol}
                          </div>
                        </div>

                        {/* TX Hash */}
                        <a
                          href={`https://basescan.org/tx/${execution.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-orange-500 hover:text-orange-400 transition-colors"
                        >
                          <span className="text-sm font-mono hidden lg:inline">
                            {formatAddress(execution.txHash)}
                          </span>
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
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </a>
                      </div>

                      {/* Mobile amounts */}
                      <div className="flex md:hidden justify-between mt-3 text-sm">
                        <div>
                          <span className="text-gray-400">Invested: </span>
                          <span className="text-white font-medium">
                            {formatCurrency(execution.amountIn)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">Received: </span>
                          <span className="text-green-400 font-medium">
                            {formatTokenAmount(execution.amountOut, execution.token.decimals)}{" "}
                            {execution.token.symbol}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Pagination */}
            {historyData.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  Showing {(currentPage - 1) * 20 + 1} to{" "}
                  {Math.min(currentPage * 20, historyData.pagination.totalCount)} of{" "}
                  {historyData.pagination.totalCount} executions
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-[#1E1E1F] border border-[#2A2A2A] rounded-lg hover:bg-[#2A2A2A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, historyData.pagination.totalPages) }, (_, i) => {
                      let pageNum;
                      if (historyData.pagination.totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= historyData.pagination.totalPages - 2) {
                        pageNum = historyData.pagination.totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <button
                          key={i}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-4 py-2 rounded-lg transition-colors ${
                            currentPage === pageNum
                              ? "bg-orange-500 text-black font-medium"
                              : "bg-[#1E1E1F] border border-[#2A2A2A] hover:bg-[#2A2A2A]"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() =>
                      setCurrentPage((p) =>
                        Math.min(historyData.pagination.totalPages, p + 1)
                      )
                    }
                    disabled={currentPage === historyData.pagination.totalPages}
                    className="px-4 py-2 bg-[#1E1E1F] border border-[#2A2A2A] rounded-lg hover:bg-[#2A2A2A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#2A2A2A] flex items-center justify-center">
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
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">No Executions Yet</h3>
            <p className="text-gray-400 mb-6">
              Start your DCA journey to see your execution history here
            </p>
            <button
              onClick={() => router.push("/explore")}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-black font-semibold rounded-lg transition-colors"
            >
              Create Your First Plan, explore plans
            </button>
          </div>
        )}
      </div>

      {/* Popups */}
      <TokenApprovalPopup
        open={showTokenApproval}
        onClose={() => setShowTokenApproval(false)}
        onApprove={() => {
          setShowTokenApproval(false);
        }}
      />
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-600 border-t-orange-500 rounded-full animate-spin"></div>
      </div>
    }>
      <HistoryPageContent />
    </Suspense>
  );
}
