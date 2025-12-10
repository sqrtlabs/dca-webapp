import React from "react";
import Image from "next/image";
import { BottomSheetPopup } from "./BottomSheetPopup";
import { Button } from "./Button";

interface PlanCreatedSharePopupProps {
  open: boolean;
  onClose: () => void;
  tokenSymbol: string;
  frequencyLabel: string;
}

const IMAGES = [
  "/dca1.png",
  "/dca2.png",
  "/dca3.png",
  "/dca4.png",
  "/dca5.png",
] as const;

export const PlanCreatedSharePopup: React.FC<PlanCreatedSharePopupProps> = ({
  open,
  onClose,
  tokenSymbol,
  frequencyLabel,
}) => {
  const [imageIndex, setImageIndex] = React.useState(0);

  React.useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => {
      setImageIndex((prev) => (prev + 1) % IMAGES.length);
    }, 400);
    return () => clearInterval(interval);
  }, [open]);

  const handleShareOnX = () => {
    const text = `I started my DCA journey on $${tokenSymbol.toUpperCase()}.\nInvest smartly. Stop watching, start stacking.`;
    const shareUrl = process.env.NEXT_PUBLIC_URL || window.location.origin;

    // Open X (Twitter) share with prefilled text
    const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      text
    )}&url=${encodeURIComponent(shareUrl)}`;
    window.open(xUrl, "_blank");
  };

  const popupContent = (
    <div className="space-y-8 relative">
      {/* Close button */}
      <button
        className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-[#2A2A2A] hover:bg-[#333] text-gray-400 hover:text-white transition-all flex items-center justify-center text-xl font-light z-10"
        onClick={onClose}
      >
        ×
      </button>

      {/* Success Header with Animation */}
      <div className="text-center space-y-2">
        <div className="w-full flex justify-center mb-4">
          <div className="relative">
            {/* Animated rings */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-500/20 to-orange-600/20 animate-ping"></div>
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-500/30 to-orange-600/30 animate-pulse"></div>
            {/* Logo container */}
            <div className="relative bg-gradient-to-br p-5 rounded-full shadow-lg shadow-orange-500/50">
              <Image
                src={IMAGES[imageIndex]}
                alt="DCA logo"
                width={80}
                height={80}
                className="w-20 h-20"
                priority
              />
            </div>
          </div>
        </div>
        <h2 className="text-3xl font-bold text-white">
          Plan Created Successfully!
        </h2>
        <p className="text-orange-400 text-lg font-medium">
          Your DCA journey has begun
        </p>
      </div>

      {/* Plan Details Card */}
      <div className="bg-gradient-to-br from-[#1E1E1F] to-[#1A1A1A] rounded-2xl p-6 border border-[#2A2A2A] space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-sm font-medium">Token</span>
          <span className="text-white text-lg font-bold">${tokenSymbol.toUpperCase()}</span>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-[#2A2A2A] to-transparent"></div>
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-sm font-medium">Frequency</span>
          <span className="text-orange-400 text-base font-semibold">
            {frequencyLabel.toLowerCase().includes("minute") ||
            frequencyLabel.toLowerCase().includes("hour")
              ? `Every ${frequencyLabel}`
              : frequencyLabel}
          </span>
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
        <div className="flex gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-gray-300 text-sm leading-relaxed">
              DCA (Dollar Cost Averaging) helps you invest consistently and smooth out market volatility. Your investments will run automatically at your set frequency.
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        <Button
          className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-black text-base font-bold py-4 rounded-xl w-full flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30 transition-all duration-200 transform hover:scale-[1.02]"
          onClick={handleShareOnX}
        >
          <svg
            className="w-5 h-5"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Share on X
        </Button>
        <button
          className="w-full py-3 text-gray-400 hover:text-white text-sm font-medium transition-colors"
          onClick={onClose}
        >
          Skip for now
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile: Bottom Sheet */}
      <div className="lg:hidden">
        <BottomSheetPopup open={open} onClose={onClose}>
          {popupContent}
        </BottomSheetPopup>
      </div>

      {/* Desktop: Sidebar overlapping right */}
      {open && (
        <div className="hidden lg:block">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          {/* Sidebar */}
          <div className="fixed top-0 right-0 h-full w-[35%] max-w-[500px] bg-[#1A1A1A] shadow-2xl z-50 overflow-y-auto">
            <div className="p-8">{popupContent}</div>
          </div>
        </div>
      )}
    </>
  );
};

export default PlanCreatedSharePopup;
