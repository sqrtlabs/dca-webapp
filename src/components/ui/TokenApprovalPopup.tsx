import React, { useState } from "react";
import { BottomSheetPopup } from "./BottomSheetPopup";
import { Button } from "./Button";
import { Input } from "./input";
import { useAccount, useWriteContract, useReadContract } from "wagmi";
import { USDC_ABI } from "~/lib/contracts/abi";
import { executeInitialInvestment, publicClient } from "~/lib/utils";
import { waitForTransactionReceipt } from "viem/actions";
import { encodeFunctionData } from "viem";
import DCA_ABI from "~/lib/contracts/DCAForwarder.json";
import { sendCalls, waitForCallsStatus } from "@wagmi/core";
import { wagmiConfig } from "~/app/providers";
import toast from "react-hot-toast";

import { AmountInput } from "./AmountInput";

interface TokenApprovalPopupProps {
  open: boolean;
  onClose: () => void;
  onApprove: (amount: number) => void;
  token?: string;
  defaultAmount?: number;
  tokenOutAddress?: `0x${string}`;
  planHash?: string; // Add planHash for initial investment execution
  frequencySeconds?: number;
  hasActivePlan?: boolean;
  planAmount?: number; // amount selected in SetFrequencyPopup (USDC units)
}

const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;
const DCA_EXECUTOR_ADDRESS = process.env
  .NEXT_PUBLIC_DCA_EXECUTOR_ADDRESS as `0x${string}`;
const quickAmounts = [0.5, 1, 2, 5, 10, 50, 100, 500, 1000];

export const TokenApprovalPopup: React.FC<TokenApprovalPopupProps> = ({
  open,
  onClose,
  onApprove,
  token = "USDC",
  defaultAmount = 100,
  tokenOutAddress,
  planHash,
  frequencySeconds = 86400,
  hasActivePlan = false,
  planAmount,
}) => {
  // Use planAmount as default if available, otherwise use defaultAmount
  const [amount, setAmount] = useState(
    planAmount?.toString() || defaultAmount.toString()
  );
  const [isLoading, setIsLoading] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<string>("");
  const { address } = useAccount();

  // Update amount when popup opens with new planAmount
  React.useEffect(() => {
    if (open && planAmount) {
      setAmount(planAmount.toString());
    }
  }, [open, planAmount]);

  const { writeContractAsync: approveToken, isPending } = useWriteContract();
  const { writeContractAsync: writeContractDirect } = useWriteContract();

  // Check current allowance
  const { data: currentAllowance } = useReadContract({
    address: USDC_ADDRESS as `0x${string}`,
    abi: USDC_ABI,
    functionName: "allowance",
    args: [address as `0x${string}`, DCA_EXECUTOR_ADDRESS as `0x${string}`],
    query: {
      enabled: !!address,
    },
  });

  // Function to check allowance with retry mechanism
  const checkAllowanceWithRetry = async (
    expectedAmount: bigint,
    maxRetries = 5
  ): Promise<boolean> => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const allowance = await publicClient.readContract({
          address: USDC_ADDRESS as `0x${string}`,
          abi: USDC_ABI,
          functionName: "allowance",
          args: [
            address as `0x${string}`,
            DCA_EXECUTOR_ADDRESS as `0x${string}`,
          ],
        });

        console.log(
          `Allowance check attempt ${
            i + 1
          }: ${allowance.toString()}, Expected: ${expectedAmount.toString()}`
        );

        if (allowance >= expectedAmount) {
          console.log("Allowance confirmed:", allowance.toString());
          return true;
        }

        if (i < maxRetries - 1) {
          console.log(
            `Allowance not yet updated, waiting 2 seconds... (${
              i + 1
            }/${maxRetries})`
          );
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`Error checking allowance (attempt ${i + 1}):`, error);
        if (i < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }
    return false;
  };

  const handleApprove = async () => {
    if (!address) return;

    try {
      setIsLoading(true);
      const approvalAmountInWei = BigInt(Number(amount) * 1000000);
      const planAmountInWei = BigInt((planAmount ?? Number(amount)) * 1000000);

      // Check if we have plan data from SetFrequencyPopup (new plan creation)
      const isCreatingNewPlan =
        !hasActivePlan &&
        planAmount !== undefined &&
        tokenOutAddress !== undefined;

      // If user already has an active plan OR no plan data, only approve more USDC
      if (hasActivePlan || !isCreatingNewPlan) {
        setApprovalStatus("Approving USDC...");
        const hash = await approveToken({
          address: USDC_ADDRESS as `0x${string}`,
          abi: USDC_ABI,
          functionName: "approve",
          args: [DCA_EXECUTOR_ADDRESS as `0x${string}`, approvalAmountInWei],
        });
        setApprovalStatus("Waiting for approval confirmation...");
        await waitForTransactionReceipt(publicClient, { hash });
        setApprovalStatus("Approval confirmed!");
        toast.success(`Approved ${amount} USDC successfully!`);
        onApprove(Number(amount));
        return;
      }

      // New plan creation with EIP-5792 batching
      console.log("Creating new plan with batching...");

      // Preflight: may reactivate plan DB-side and skip on-chain create
      const preResp = await fetch("/api/plan/createPlan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: address,
          tokenOutAddress,
          recipient: address,
          amountIn: Number(planAmountInWei),
          frequency: frequencySeconds,
        }),
      });
      const preJson = await preResp.json();
      if (!preJson.success) {
        throw new Error(preJson.error || "Failed to prepare plan");
      }

      if (preJson.txRequired === false) {
        // Plan exists and was reactivated. Only approve more USDC.
        setApprovalStatus("Approving USDC for reactivated plan...");
        const hash = await approveToken({
          address: USDC_ADDRESS as `0x${string}`,
          abi: USDC_ABI,
          functionName: "approve",
          args: [DCA_EXECUTOR_ADDRESS as `0x${string}`, approvalAmountInWei],
        });
        await waitForTransactionReceipt(publicClient, { hash });
        setApprovalStatus("Reactivated & approved!");
        toast.success(`Plan reactivated and approved ${amount} USDC!`);
        onApprove(Number(amount));
        return;
      }

      setApprovalStatus("Creating plan & approving USDC...");

      const approveData = encodeFunctionData({
        abi: USDC_ABI,
        functionName: "approve",
        args: [DCA_EXECUTOR_ADDRESS as `0x${string}`, approvalAmountInWei],
      });
      const createPlanData = encodeFunctionData({
        abi: DCA_ABI.abi,
        functionName: "createPlan",
        args: [tokenOutAddress, address as `0x${string}`],
      });
      console.log("naya naya EIP");

      try {
        const { id } = await sendCalls(wagmiConfig, {
          calls: [
            { to: USDC_ADDRESS, data: approveData },
            { to: DCA_EXECUTOR_ADDRESS, data: createPlanData, value: 0n },
          ],
        });

        // Wait for batched calls to complete
        const status = await waitForCallsStatus(wagmiConfig, { id });
        if (status.status !== "success") {
          throw new Error(`Batched call status: ${status.status}`);
        }

        setApprovalStatus("Finalizing plan...");
        // Create plan in DB (finalize=true)
        const finalResp = await fetch("/api/plan/createPlan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userAddress: address,
            tokenOutAddress,
            recipient: address,
            amountIn: Number(planAmountInWei),
            frequency: frequencySeconds,
            finalize: true,
          }),
        });
        const finalJson = await finalResp.json();
        if (!finalJson.success) {
          throw new Error(finalJson.error || "Failed to create plan in DB");
        }

        // Optionally execute initial investment (best-effort)
        const createdPlanHash = finalJson.data?.planHash as string | undefined;
        if (createdPlanHash) {
          try {
            const invest = await executeInitialInvestment(createdPlanHash);
            if (!invest.success) {
              console.warn("Initial investment failed:", invest.error);
            }
          } catch (e) {
            console.warn("Initial investment error:", e);
          }
        }

        setApprovalStatus("Plan created & USDC approved!");
        toast.success(`Plan created and approved ${amount} USDC!`);
        onApprove(Number(amount));
      } catch (batchErr) {
        console.warn(
          "Batching unavailable or failed, falling back to sequential txs:",
          batchErr
        );

        // Fallback: createPlan tx then approve tx sequentially
        try {
          setApprovalStatus("Creating plan...");
          const hash1 = await writeContractDirect({
            address: DCA_EXECUTOR_ADDRESS as `0x${string}`,
            abi: DCA_ABI.abi,
            functionName: "createPlan",
            args: [tokenOutAddress, address as `0x${string}`],
          });
          await waitForTransactionReceipt(publicClient, { hash: hash1 });

          setApprovalStatus("Approving USDC...");
          const hash2 = await approveToken({
            address: USDC_ADDRESS as `0x${string}`,
            abi: USDC_ABI,
            functionName: "approve",
            args: [DCA_EXECUTOR_ADDRESS as `0x${string}`, approvalAmountInWei],
          });
          await waitForTransactionReceipt(publicClient, { hash: hash2 });

          // Finalize DB
          setApprovalStatus("Finalizing plan...");
          const finalResp = await fetch("/api/plan/createPlan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userAddress: address,
              tokenOutAddress,
              recipient: address,
              amountIn: Number(planAmountInWei),
              frequency: frequencySeconds,
              finalize: true,
            }),
          });
          const finalJson = await finalResp.json();
          if (!finalJson.success) {
            throw new Error(finalJson.error || "Failed to create plan in DB");
          }

          // Execute initial investment (best-effort)
          const createdPlanHash = finalJson.data?.planHash as string | undefined;
          if (createdPlanHash) {
            try {
              setApprovalStatus("Executing initial investment...");
              const invest = await executeInitialInvestment(createdPlanHash);
              if (!invest.success) {
                console.warn("Initial investment failed:", invest.error);
              }
            } catch (e) {
              console.warn("Initial investment error:", e);
            }
          }

          setApprovalStatus("Plan created & USDC approved!");
          toast.success(`Plan created and approved ${amount} USDC!`);
          onApprove(Number(amount));
        } catch (seqErr) {
          // Check if user cancelled the transaction
          if (seqErr && typeof seqErr === "object" && "message" in seqErr) {
            const errorMessage = (seqErr as { message: string }).message.toLowerCase();
            if (errorMessage.includes("user rejected") || errorMessage.includes("user denied") || errorMessage.includes("user cancelled")) {
              toast.error("Transaction cancelled");
              setApprovalStatus("Transaction cancelled");
              return;
            }
          }

          // Only log non-user-rejection errors
          console.error("Sequential fallback failed:", seqErr);
          setApprovalStatus("Action failed. Please try again.");
          toast.error("Failed to create plan. Please try again.");
        }
      }
    } catch (error) {
      // Check if user cancelled the transaction
      if (error && typeof error === "object" && "message" in error) {
        const errorMessage = (error as { message: string }).message.toLowerCase();
        if (errorMessage.includes("user rejected") || errorMessage.includes("user denied") || errorMessage.includes("user cancelled")) {
          toast.error("Transaction cancelled");
          setApprovalStatus("Transaction cancelled");
          return;
        }
      }

      // Only log non-user-rejection errors
      console.error("Error approving USDC:", error);
      setApprovalStatus("Approval failed. Please try again.");
      toast.error("Failed to approve USDC. Please try again.");
    } finally {
      setIsLoading(false);
      // Clear status after a delay
      setTimeout(() => setApprovalStatus(""), 1000);
    }
  };

  const popupContent = (
    <>
      <div className="flex justify-between items-center mb-6">
        <span className="text-2xl font-semibold">Approve {token}</span>
        <button
          className="text-gray-400 hover:text-white text-2xl transition-colors"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="mb-6">
        <label className="block text-gray-400 mb-2 text-sm">Amount</label>
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
      {currentAllowance !== undefined && (
        <div className="mb-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg text-blue-300 text-sm">
          Current allowance:{" "}
          {currentAllowance === 0n ? "0" : Number(currentAllowance) / 1000000}{" "}
          USDC
          {planAmount && currentAllowance > 0n && (
            <div className="mt-2 text-xs text-blue-200">
              💡 You already have some allowance. You can extend it to ${amount}{" "}
              for more flexibility.
            </div>
          )}
        </div>
      )}
      {approvalStatus && (
        <div className="mb-4 p-3 bg-orange-900/20 border border-orange-500/30 rounded-lg text-orange-300 text-sm">
          {approvalStatus}
        </div>
      )}
      <div className="mb-6 p-4 bg-[#2A2A2A] rounded-lg text-gray-300 text-sm leading-relaxed">
        Set a spending limit for your DCA investments. When the limit is
        reached, you can easily top it up or revoke access anytime for complete
        control over your automated purchases.
      </div>
      <Button
        className="bg-orange-500 hover:bg-orange-600 text-black text-lg font-semibold py-3 rounded-xl w-full disabled:bg-gray-600 disabled:text-gray-400"
        onClick={handleApprove}
        disabled={isLoading || isPending || amount === ""}
      >
        {(() => {
          const isCreatingNewPlan =
            !hasActivePlan &&
            planAmount !== undefined &&
            tokenOutAddress !== undefined;

          if (isLoading || isPending) {
            return isCreatingNewPlan
              ? "Creating & Approving..."
              : "Approving...";
          }

          if (isCreatingNewPlan) {
            return "Create & Approve";
          }

          return `Approve ${amount} ${token}`;
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
