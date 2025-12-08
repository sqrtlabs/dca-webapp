import React from "react";
import Image from "next/image";

const TokenViewSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-black text-white font-sans">
      {/* Local keyframes for shimmer and dashed line */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes dash {
          to { stroke-dashoffset: -1000; }
        }
      `}</style>

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
              className="flex-shrink-0"
            />
            <nav className="hidden lg:flex items-center gap-1">
              <div className="h-8 w-16 bg-[#1E1E1F] rounded-lg animate-pulse" />
              <div className="h-8 w-20 bg-[#1E1E1F] rounded-lg animate-pulse" />
              <div className="h-8 w-16 bg-[#1E1E1F] rounded-lg animate-pulse" />
            </nav>
            <div className="h-6 w-px bg-gray-700" />
            <div className="h-6 w-6 bg-[#1E1E1F] rounded animate-pulse flex-shrink-0" />
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#1E1E1F] border-2 border-gray-700 flex-shrink-0 animate-pulse" />
              <div className="h-6 w-32 bg-[#1E1E1F] rounded animate-pulse" />
            </div>
          </div>

          {/* Right: Wallet & Balance */}
          <div className="flex-shrink-0">
            <div className="h-10 w-32 bg-[#1E1E1F] rounded-lg animate-pulse" />
          </div>
        </div>
      </div>

      {/* Main Content - Web Layout (70/30 split) on large screens, stacked on mobile */}
      <div className="max-w-[1600px] mx-auto px-4 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-6 mb-6">
          {/* Chart & Actions Section - 70% on web */}
          <div className="w-full lg:w-[70%] space-y-6">
            {/* Chart */}
            <div className="bg-[#131313] rounded-xl p-6 shadow-lg">
              <div className="h-4 w-12 bg-[#2A2A2A] rounded mb-1 animate-pulse" />
              <div className="flex items-center justify-between mb-4">
                <div className="h-10 w-32 bg-[#1E1E1F] rounded animate-pulse" />
                <div className="flex space-x-1 bg-[#1E1E1F] rounded px-4 py-2">
                  <div className="h-6 w-8 bg-black rounded" />
                  <div className="h-6 w-8 bg-transparent rounded border border-black/20" />
                  <div className="h-6 w-8 bg-transparent rounded border border-black/20" />
                  <div className="h-6 w-8 bg-transparent rounded border border-black/20" />
                </div>
              </div>
              <div
                className="relative h-[400px] lg:h-[500px] rounded-lg overflow-hidden"
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
            </div>

            {/* Main Invest/Approve Button Below Chart */}
            <div className="bg-[#131313] rounded-xl shadow-lg">
              <div className="w-full h-14 bg-[#2A2A2A] rounded-lg animate-pulse" />
            </div>
          </div>

          {/* Stats & About Section - 30% on web */}
          <div className="w-full lg:w-[30%] space-y-6">
            {/* Stats */}
            <div className="bg-[#131313] rounded-xl p-6 shadow-lg">
              <div className="h-6 w-16 bg-[#2A2A2A] rounded mb-6 animate-pulse" />

              {/* Market Stats - 2x2 Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="animate-pulse">
                  <div className="h-3 w-20 bg-[#2A2A2A] rounded mb-2" />
                  <div className="h-5 w-24 bg-[#2A2A2A] rounded" />
                </div>
                <div className="animate-pulse">
                  <div className="h-3 w-10 bg-[#2A2A2A] rounded mb-2" />
                  <div className="h-5 w-20 bg-[#2A2A2A] rounded" />
                </div>
                <div className="animate-pulse">
                  <div className="h-3 w-16 bg-[#2A2A2A] rounded mb-2" />
                  <div className="h-5 w-24 bg-[#2A2A2A] rounded" />
                </div>
                <div className="animate-pulse">
                  <div className="h-3 w-20 bg-[#2A2A2A] rounded mb-2" />
                  <div className="h-5 w-20 bg-[#2A2A2A] rounded" />
                </div>
              </div>

              {/* Frequency Section */}
              <div className="mt-6 pt-6 border-t border-gray-800">
                <div className="flex justify-between items-center mb-4 animate-pulse">
                  <div className="h-5 w-20 bg-[#2A2A2A] rounded" />
                  <div className="h-4 w-12 bg-[#2A2A2A] rounded" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center animate-pulse">
                    <div className="h-3 w-16 bg-[#2A2A2A] rounded" />
                    <div className="h-5 w-16 bg-[#2A2A2A] rounded" />
                  </div>
                  <div className="flex justify-between items-center animate-pulse">
                    <div className="h-3 w-16 bg-[#2A2A2A] rounded" />
                    <div className="h-5 w-20 bg-[#2A2A2A] rounded" />
                  </div>
                </div>
              </div>
            </div>

            {/* About Section */}
            <div className="bg-[#131313] rounded-xl p-6 shadow-lg">
              <div className="flex items-center gap-2 mb-4 animate-pulse">
                <div className="w-4 h-4 bg-[#2A2A2A] rounded" />
                <div className="h-6 w-16 bg-[#2A2A2A] rounded" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-full bg-[#2A2A2A] rounded animate-pulse" />
                <div className="h-3 w-4/5 bg-[#2A2A2A] rounded animate-pulse" />
                <div className="h-3 w-3/5 bg-[#2A2A2A] rounded animate-pulse" />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="bg-[#131313] rounded-xl p-6 shadow-lg">
              <div className="space-y-3">
                {/* Show All Executions - Full Width First Row */}
                <div className="w-full h-12 bg-[#1E1E1F] rounded-lg animate-pulse" />

                {/* Pause/Resume and Delete - Second Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-12 bg-[#1E1E1F] rounded-lg animate-pulse" />
                  <div className="h-12 bg-red-500/10 rounded-lg animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TokenViewSkeleton;
