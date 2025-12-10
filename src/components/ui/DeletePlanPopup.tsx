import React, { useState } from "react";
import { BottomSheetPopup } from "./BottomSheetPopup";
import { Button } from "./Button";
import { useWriteContract } from "wagmi";
import DCA_ABI from "~/lib/contracts/DCAForwarder.json";
import toast from "react-hot-toast";

interface DeletePlanPopupProps {
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
  tokenSymbol: string;
  tokenAddress: string;
  userAddress: string;
}

export const DeletePlanPopup: React.FC<DeletePlanPopupProps> = ({
  open,
  onClose,
  onDeleted,
  tokenSymbol,
  tokenAddress,
  userAddress,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const { writeContractAsync: cancelPlan } = useWriteContract();
  const DCA_EXECUTOR_ADDRESS = process.env
    .NEXT_PUBLIC_DCA_EXECUTOR_ADDRESS as `0x${string}`;

  const handleDelete = async () => {
    if (!userAddress || !tokenAddress) return;

    try {
      setIsDeleting(true);

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
            userAddress: userAddress,
            tokenOutAddress: tokenAddress,
            action: "delete",
          }),
        });

        const deleteResult = await deleteResponse.json();
        if (deleteResult.success) {
          console.log("Plan deleted from database successfully");
          toast.success("Plan deleted successfully");
          onDeleted();
          onClose();
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
    } catch (error) {
      // Check if user cancelled the transaction
      if (error && typeof error === "object" && "message" in error) {
        const errorMessage = (
          error as { message: string }
        ).message.toLowerCase();
        if (
          errorMessage.includes("user rejected") ||
          errorMessage.includes("user denied") ||
          errorMessage.includes("user cancelled")
        ) {
          toast.error("Transaction cancelled");
          return;
        }
      }

      // Only log non-user-rejection errors
      console.error("Error deleting position:", error);
      toast.error("Failed to delete plan. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const popupContent = (
    <div className="space-y-6 relative">
      {/* Close button */}
      <button
        className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-[#2A2A2A] hover:bg-[#333] text-gray-400 hover:text-white transition-all flex items-center justify-center text-xl font-light z-10"
        onClick={onClose}
        disabled={isDeleting}
      >
        ×
      </button>

      {/* Crying Token Icon */}
      <div className="flex justify-center">
        <div className="relative">
          {/* Animated tears */}
          <div
            className="absolute -left-2 top-12 text-4xl animate-bounce"
            style={{ animationDelay: "0s" }}
          >
            💧
          </div>
          <div
            className="absolute -right-2 top-12 text-4xl animate-bounce"
            style={{ animationDelay: "0.3s" }}
          >
            💧
          </div>

          {/* Crying emoji */}
          <div className="text-8xl mb-4 animate-pulse">😭</div>
        </div>
      </div>

      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white">
          Are You Sure About This?
        </h2>
        <p className="text-orange-400 text-base font-medium">
          ${tokenSymbol.toUpperCase()} might be crying right now...
        </p>
      </div>

      {/* Warning Card with Humor */}
      <div className="bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-2xl p-6 space-y-4">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="flex-shrink-0 mt-1">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
          </div>

          {/* Text Block */}
          <div className="flex-1 space-y-3">
            <p className="text-gray-200 text-sm leading-relaxed">
              Who knows maybe this DCA was your{" "}
              <span className="text-orange-400 font-semibold">
                generational wealth arc
              </span>
              . But hey, don’t let FOMO make your decisions... 👀
            </p>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-400 text-xs">
                <span>📈</span>
                <span>Tomorrow could be the candle of your dreams</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400 text-xs">
                <span>💎</span>
                <span>Diamond hands write history, not exit buttons</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400 text-xs">
                <span>🚀</span>
                <span>Satoshi probably wouldn’t click delete</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info about what happens */}
      <div className="bg-[#1E1E1F] rounded-xl p-4 border border-[#2A2A2A]">
        <p className="text-gray-400 text-xs text-center">
          Don&apos;t worry though - your execution history will be preserved for
          the memories 📸
        </p>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        <Button
          className="bg-[#1A1A1A] hover:bg-[#1E1E1E] text-white text-base font-semibold py-4 rounded-xl w-full flex items-center justify-center gap-2 transition-all duration-200 border-2 border-red-500/50 hover:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleDelete}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <>
              <svg
                className="animate-spin h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Deleting Plan...
            </>
          ) : (
            <>
              <span>💔</span>
              Yes, Delete It
            </>
          )}
        </Button>

        <Button
          className="bg-orange-500 hover:from-orange-600 hover:to-orange-700 text-black text-base font-bold py-4 rounded-xl w-full flex items-center justify-center gap-2 transition-all duration-200 shadow-lg shadow-orange-500/30"
          onClick={onClose}
          disabled={isDeleting}
        >
          Keep Stacking (Smart Choice!)
        </Button>
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
            onClick={!isDeleting ? onClose : undefined}
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

export default DeletePlanPopup;
