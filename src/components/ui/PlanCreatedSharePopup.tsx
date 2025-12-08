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

  const handleShare = async () => {
    const text = `I started my DCA journey on $${tokenSymbol.toUpperCase()}.\nInvest smartly. Stop watching, start stacking.`;
    const shareUrl = process.env.NEXT_PUBLIC_URL || window.location.origin;

    // Try to use Web Share API if available (mobile devices)
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
      // Fallback: Open Twitter share (or copy to clipboard)
      const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        text
      )}&url=${encodeURIComponent(shareUrl)}`;
      window.open(twitterUrl, "_blank");
    }
  };

  const popupContent = (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <span className="text-2xl font-semibold text-white">
          Plan Created 🎉
        </span>
        <button className="text-gray-400 hover:text-white text-2xl transition-colors" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="w-full flex justify-center">
        <div className="border-2 border-orange-500 p-4 rounded-full">
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
      <div className="space-y-4">
        <p className="text-gray-300 text-base leading-relaxed">
          DCA is one of the most proven ways to stay consistent and smooth out
          market swings.
        </p>
        <p className="text-gray-400 text-sm">
          {tokenSymbol} will be invested{" "}
          {frequencyLabel.toLowerCase().includes("minute") ||
          frequencyLabel.toLowerCase().includes("hour")
            ? `every ${frequencyLabel}`
            : frequencyLabel}
          .
        </p>
      </div>
      <Button
        className="bg-orange-500 hover:bg-orange-600 text-black text-lg font-semibold py-3 rounded-xl w-full"
        onClick={handleShare}
      >
        Share my DCA journey
      </Button>
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
