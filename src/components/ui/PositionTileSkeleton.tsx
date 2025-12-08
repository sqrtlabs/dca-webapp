import React from "react";

const PositionTileSkeleton: React.FC = () => (
  <div className="bg-[#131313] rounded-xl p-4 mb-3 shadow-lg animate-pulse border border-[#2A2A2A]">
    {/* Header */}
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        {/* Icon skeleton */}
        <div className="w-10 h-10 bg-[#1E1E1F] rounded-full border-2 border-[#2A2A2A]" />
        <div className="flex flex-col gap-1.5">
          {/* Name skeleton */}
          <div className="h-5 bg-[#1E1E1F] rounded w-24" />
          {/* Price badge skeleton */}
          <div className="h-4 bg-[#1E1E1F] rounded-full w-20" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* Calendar icon skeleton */}
        <div className="w-4 h-4 bg-[#1E1E1F] rounded" />
        {/* Date text skeleton */}
        <div className="h-3 bg-[#1E1E1F] rounded w-20" />
      </div>
    </div>

    {/* Divider */}
    <div className="border-t border-gray-800 mb-4" />

    {/* Bottom section */}
    <div className="flex justify-between items-end">
      <div>
        {/* Label skeleton */}
        <div className="h-3 bg-[#1E1E1F] rounded w-20 mb-2" />
        {/* Value skeleton */}
        <div className="h-7 bg-[#1E1E1F] rounded w-24" />
      </div>
      <div className="text-right">
        {/* Label skeleton */}
        <div className="h-3 bg-[#1E1E1F] rounded w-20 mb-2" />
        {/* Value skeleton */}
        <div className="h-7 bg-[#1E1E1F] rounded w-24" />
      </div>
    </div>
  </div>
);

export default PositionTileSkeleton;
