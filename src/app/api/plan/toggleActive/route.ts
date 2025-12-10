import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";

export async function POST(req: Request) {
  try {
    const { userAddress, tokenOutAddress, active } = await req.json();

    // Validation
    if (!userAddress || !tokenOutAddress || typeof active !== "boolean") {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: userAddress, tokenOutAddress, and active (boolean)",
        },
        { status: 400 }
      );
    }

    // Find user by wallet address
    const user = await prisma.user.findUnique({
      where: { wallet: userAddress.toLowerCase() },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const normalizedToken = tokenOutAddress.toLowerCase();

    // Find the plan (regardless of current active status), excluding deleted plans
    const plan = await prisma.dCAPlan.findFirst({
      where: {
        userWallet: user.wallet,
        tokenOutAddress: normalizedToken,
        deletedAt: null, // Exclude soft-deleted plans
      },
    });

    if (!plan) {
      return NextResponse.json(
        { success: false, error: "No plan found for this token" },
        { status: 404 }
      );
    }

    // Update the active status
    const updatedPlan = await prisma.dCAPlan.update({
      where: { planHash: plan.planHash },
      data: { active },
    });

    return NextResponse.json({
      success: true,
      message: `Plan ${active ? "activated" : "paused"} successfully`,
      planHash: updatedPlan.planHash,
      active: updatedPlan.active,
    });
  } catch (error) {
    console.error("Error toggling plan active status:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to toggle plan active status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
