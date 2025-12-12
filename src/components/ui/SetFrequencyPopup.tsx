import React, { useState } from "react";
import { BottomSheetPopup } from "./BottomSheetPopup";
import { Button } from "./Button";
import { Input } from "./input";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import DCA_ABI from "~/lib/contracts/DCAForwarder.json";
import { USDC_ABI } from "~/lib/contracts/abi";
import { base } from "viem/chains";
import { waitForTransactionReceipt } from "viem/actions";
import { createPublicClient, http, isAddress } from "viem";
import { executeInitialInvestment } from "~/lib/utils";
import { AmountInput } from "./AmountInput";
import toast from "react-hot-toast";

interface SetFrequencyPopupProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (
    amount: number,
    frequency: string,
    planHash?: string,
    approvalNeeded?: boolean,
    recipient?: `0x${string}`
  ) => void;
  tokenOut: `0x${string}`;
  initialAmount?: number;
  initialFrequency?: string;
  editMode?: boolean;
}

const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;
const quickAmounts = [0.5, 1, 2, 5, 10, 50, 100, 500, 1000];

// Create a public client for waiting for transaction receipt
const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

export const SetFrequencyPopup: React.FC<SetFrequencyPopupProps> = ({
  open,
  onClose,
  onConfirm,
  tokenOut,
  initialAmount = 10,
  initialFrequency = "Daily",
  editMode = false,
}) => {
  const [amount, setAmount] = useState(initialAmount.toString());
  const [frequency, setFrequency] = useState(initialFrequency);
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [amountError, setAmountError] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customRecipient, setCustomRecipient] = useState("");
  const [recipientError, setRecipientError] = useState("");
  const { address } = useAccount();
  const DCA_EXECUTOR_ADDRESS = process.env
    .NEXT_PUBLIC_DCA_EXECUTOR_ADDRESS as `0x${string}`;
  const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;

  // Check current USDC allowance
  const { data: currentAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "allowance",
    args: [address as `0x${string}`, DCA_EXECUTOR_ADDRESS],
    query: {
      enabled: !!address,
    },
  });

  const {
    writeContractAsync: createPlan,
    isPending,
    error,
    isSuccess,
  } = useWriteContract();

  // Wait for transaction receipt
  const {
    data: receipt,
    isSuccess: isConfirmed,
    isLoading: isConfirming,
  } = useWaitForTransactionReceipt({
    hash: txHash,
    query: {
      enabled: !!txHash,
    },
  });

  // Debug logs
  React.useEffect(() => {
    console.log("Debug - txHash:", txHash);
    console.log("Debug - isConfirmed:", isConfirmed);
    console.log("Debug - isConfirming:", isConfirming);
    console.log("Debug - receipt:", receipt);
  }, [txHash, isConfirmed, isConfirming, receipt]);

  // Sync initial values when opening (preserve current plan values on edit)
  React.useEffect(() => {
    if (open) {
      setAmount(initialAmount.toString());
      setFrequency(initialFrequency);
      setAmountError(false);
      setShowAdvanced(false);
      setCustomRecipient("");
      setRecipientError("");
    }
  }, [open, initialAmount, initialFrequency]);

  // Validate recipient address
  const validateRecipient = (addr: string): boolean => {
    if (!addr || addr.trim() === "") {
      setRecipientError("");
      return true;
    }
    if (!isAddress(addr)) {
      setRecipientError("Invalid Ethereum address");
      return false;
    }
    setRecipientError("");
    return true;
  };

  const getFrequencyInSeconds = (frequency: string): number => {
    switch (frequency) {
      case "5 Minutes":
        return 300; // 5 minutes
      case "10 Minutes":
        return 600; // 10 minutes
      case "15 Minutes":
        return 900; // 15 minutes
      case "30 Minutes":
        return 1800; // 30 minutes
      case "Hourly":
        return 3600; // 1 hour
      case "Daily":
        return 86400; // 24 hours
      case "Weekly":
        return 604800; // 7 days
      case "Monthly":
        return 2592000; // 30 days
      default:
        return 86400; // Default to daily
    }
  };

  const handleConfirm = async () => {
    if (!address) return;
    if (!amount || Number(amount) <= 0) {
      setAmountError(true);
      return;
    }

    // Validate custom recipient if provided
    if (customRecipient && !validateRecipient(customRecipient)) {
      return;
    }

    // Determine final recipient: custom if provided and valid, otherwise user's address
    const finalRecipient = (customRecipient && isAddress(customRecipient)
      ? customRecipient
      : address) as `0x${string}`;

    try {
      setIsLoading(true);
      if (editMode) {
        // Update existing plan
        console.log("Updating plan frequency...");

        const freqSeconds = getFrequencyInSeconds(frequency);

        console.log("Updating plan frequency...");
        console.log("freqSeconds", freqSeconds);
        console.log("amount", amount);
        console.log("tokenOut", tokenOut);
        console.log("address", address);

        const response = await fetch("/api/plan/updateFrequency", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userAddress: address,
            tokenOutAddress: tokenOut,
            amountIn: Number(amount) * 1_000_000,
            frequency: freqSeconds,
          }),
        });

        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || "Failed to update plan");
        }

        console.log("Plan updated successfully");
        toast.success(`Plan updated: $${amount} ${frequency.toLowerCase()}`);
        onConfirm(Number(amount), frequency, undefined, false, finalRecipient);
        setIsLoading(false);
        return;
      }

      // New plan flow: Always create plan on-chain (even if it exists in DB)
      const freqSeconds = getFrequencyInSeconds(frequency);
      const amountInWei = Number(amount) * 1_000_000;

      // Always create plan on-chain
      console.log("Creating plan on-chain...");
      const hash = await createPlan({
        address: DCA_EXECUTOR_ADDRESS,
        abi: DCA_ABI.abi,
        functionName: "createPlan",
        args: [tokenOut, finalRecipient],
      });

      setTxHash(hash);
      await waitForTransactionReceipt(publicClient, { hash });

      // Create/update plan in DB
      const finalResp = await fetch("/api/plan/createPlan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: address,
          tokenOutAddress: tokenOut,
          recipient: finalRecipient,
          amountIn: amountInWei,
          frequency: freqSeconds,
          finalize: true,
        }),
      });
      const finalJson = await finalResp.json();
      if (!finalJson.success) {
        throw new Error(finalJson.error || "Failed to create/update plan in DB");
      }

      console.log("Plan created/updated successfully");

      // Check if user has enough allowance for initial investment
      const requiredAllowance = BigInt(amountInWei);
      const hasSufficientAllowance =
        currentAllowance && currentAllowance >= requiredAllowance;

      const createdPlanHash = finalJson.data?.planHash as string | undefined;

      // Only execute initial investment if user has enough allowance
      if (hasSufficientAllowance && createdPlanHash) {
        try {
          const invest = await executeInitialInvestment(createdPlanHash);
          if (!invest.success) {
            console.warn("Initial investment failed:", invest.error);
          } else {
            console.log("Initial investment executed successfully:", invest.txHash);
          }
        } catch (e) {
          console.warn("Initial investment error:", e);
        }
      }

      toast.success("Plan created successfully!");

      // Always show approval popup (even if they have enough allowance)
      // Pass whether initial investment still needs to happen (!hasSufficientAllowance)
      onConfirm(Number(amount), frequency, createdPlanHash, !hasSufficientAllowance, finalRecipient);

      setIsLoading(false);
    } catch (error) {
      // Check if user cancelled the transaction
      if (error && typeof error === "object" && "message" in error) {
        const errorMessage = (error as { message: string }).message.toLowerCase();
        if (errorMessage.includes("user rejected") || errorMessage.includes("user denied") || errorMessage.includes("user cancelled")) {
          toast.error("Transaction cancelled");
          setIsLoading(false);
          return;
        }
      }

      // Only log non-user-rejection errors
      console.error("Error creating plan:", error);
      toast.error("Failed to create plan. Please try again.");
      setIsLoading(false);
    }
  };

  const popupContent = (
    <>
      <div className="flex justify-between items-center mb-6">
        <span className="text-2xl font-semibold text-white">Set frequency</span>
        <button
          className="text-gray-400 hover:text-white text-2xl transition-colors"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="mb-6 text-gray-300 text-sm leading-relaxed">
        <p>
          You will invest <span className="font-semibold text-white">${amount}</span> into the selected token{" "}
          {frequency.toLowerCase().includes("minute") ||
          frequency.toLowerCase().includes("hour")
            ? `every ${frequency}`
            : frequency}
          .
        </p>
        <p className="mt-2 text-gray-400 text-xs">
          With each DCA execution, purchased tokens are transferred to your
          connected wallet.
        </p>
      </div>
      <div className="mb-6">
        <label className="block text-gray-400 mb-2 text-sm">Amount (USDC)</label>
        <AmountInput value={amount} onChange={setAmount} />
      </div>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {quickAmounts.map((amt) => (
          <button
            key={amt}
            className={`py-2 rounded-xl text-base font-medium transition-colors ${
              amount === amt.toString()
                ? "bg-orange-500 text-white"
                : "bg-[#2A2A2A] text-white hover:bg-[#333333]"
            }`}
            onClick={() => setAmount(amt.toString())}
          >
            ${amt}
          </button>
        ))}
      </div>
      <div className="mb-6">
        <label className="block text-gray-400 mb-2 text-sm">Frequency</label>
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
          className="w-full bg-[#2A2A2A] text-white border-none rounded-lg px-4 py-3 text-base focus:ring-2 focus:ring-orange-500 outline-none"
        >
          <option value="5 Minutes">5 Minutes</option>
          <option value="10 Minutes">10 Minutes</option>
          <option value="15 Minutes">15 Minutes</option>
          <option value="30 Minutes">30 Minutes</option>
          <option value="Hourly">Hourly</option>
          <option value="Daily">Daily</option>
          <option value="Weekly">Weekly</option>
          <option value="Monthly">Monthly</option>
        </select>
      </div>
      {!editMode && (
        <>
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-orange-500 hover:text-orange-400 text-sm font-medium flex items-center gap-1 transition-colors"
            >
              <span>{showAdvanced ? "▼" : "▶"}</span>
              Advanced: Custom Recipient
            </button>
          </div>
          {showAdvanced && (
            <div className="mb-6">
              <label className="block text-gray-400 mb-2 text-sm">
                Recipient Address (Optional)
              </label>
              <Input
                type="text"
                value={customRecipient}
                onChange={(e) => {
                  setCustomRecipient(e.target.value);
                  validateRecipient(e.target.value);
                }}
                placeholder="0x... (leave empty to use your wallet)"
                className={`w-full bg-[#2A2A2A] text-white border ${
                  recipientError ? "border-red-500" : "border-gray-700"
                } rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none`}
              />
              {recipientError && (
                <p className="mt-2 text-red-400 text-xs">{recipientError}</p>
              )}
              <p className="mt-2 text-gray-400 text-xs">
                Tokens will be sent to this address instead of your wallet. Leave empty to receive tokens in your connected wallet.
              </p>
            </div>
          )}
        </>
      )}
      {!editMode && (
        <div className="mb-6 p-4 bg-[#2A2A2A] rounded-lg text-gray-300 text-xs leading-relaxed">
          Creating your plan may ask you to approve USDC and confirm a
          transaction. Your USDC approval is scoped to this DCA executor and
          cannot be misused — it&apos;s only used to execute your scheduled
          buys, and you can revoke it anytime.
        </div>
      )}
      <Button
        className="bg-orange-500 hover:bg-orange-600 text-black text-lg font-semibold py-3 rounded-xl w-full disabled:bg-gray-600 disabled:text-gray-400"
        onClick={handleConfirm}
        disabled={isLoading || amount === "" || Number(amount) === 0 || !!recipientError}
      >
        {(() => {
          if (isLoading) {
            return editMode ? "Updating Plan..." : "Creating Plan...";
          }

          if (editMode) {
            return "Confirm";
          }

          // For new plans, check if user has sufficient allowance
          const requiredAllowance = BigInt(Number(amount) * 1_000_000);
          const hasSufficientAllowance =
            currentAllowance && currentAllowance >= requiredAllowance;

          return hasSufficientAllowance ? "Create Plan" : "Proceed";
        })()}
      </Button>
    </>
  );

  return (
    <>
      {/* Mobile: Bottom Sheet */}
      <div className="lg:hidden">
        <BottomSheetPopup open={open} onClose={onClose}>
          {popupContent}
        </BottomSheetPopup>
      </div>

      {/* Desktop: Sidebar overlapping right 30% */}
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
