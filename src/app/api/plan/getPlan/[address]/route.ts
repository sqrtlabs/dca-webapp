import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const revalidate = 0;
import { prisma } from "~/lib/prisma";

export async function GET(
  req: Request,
  context: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await context.params;
    const { searchParams } = new URL(req.url);
    const tokenAddress = searchParams.get("tokenAddress");

    console.log("Fetching plan for address:", address, "token:", tokenAddress);

    // Validate address
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { success: false, error: "Invalid wallet address provided" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Validate token address if provided
    if (tokenAddress && !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
      return NextResponse.json(
        { success: false, error: "Invalid token address provided" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Check if user exists, if not create them
    let user = await prisma.user.findUnique({
      where: { wallet: address.toLowerCase() },
    });

    if (!user) {
      // Auto-create user for web app
      try {
        user = await prisma.user.create({
          data: {
            wallet: address.toLowerCase(),
          },
        });
        console.log("Auto-created user for wallet:", address);
      } catch (error) {
        console.error("Error creating user:", error);
        // Continue anyway - we can still check for plans
      }
    }

    // Build query based on parameters
    const whereClause: {
      userWallet: string;
      tokenOutAddress?: string;
    } = {
      userWallet: address.toLowerCase(),
    };

    if (tokenAddress) {
      whereClause.tokenOutAddress = tokenAddress.toLowerCase();
    }

    // Get token data first (required even if no plans exist)
    let tokenData = null;
    if (tokenAddress) {
      tokenData = await prisma.token.findUnique({
        where: { address: tokenAddress.toLowerCase() },
      });

      if (!tokenData) {
        return NextResponse.json(
          { success: false, error: "Token not found" },
          { status: 404, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    // Get user's plan(s)
    const plans = await prisma.dCAPlan.findMany({
      where: whereClause,
      include: {
        tokenOut: true,
        executions: {
          orderBy: {
            executedAt: "desc",
          },
        },
      },
    });

    // If token address provided, return single token data with plans
    if (tokenAddress && tokenData) {
      // Calculate investment stats for this token
      const USDC_DECIMALS = 6;
      let totalInvestedValue = 0;
      let totalTokensReceived = 0;

      if (plans.length > 0) {
        const allExecutions = plans[0].executions;
        totalInvestedValue = allExecutions.reduce(
          (sum, exec) => sum + parseFloat(exec.amountIn.toString()) / Math.pow(10, USDC_DECIMALS),
          0
        );
        totalTokensReceived = allExecutions.reduce(
          (sum, exec) => sum + parseFloat(exec.amountOut.toString()) / Math.pow(10, parseInt(tokenData.decimals.toString())),
          0
        );
      }

      const currentPrice = tokenData.price ? parseFloat(tokenData.price.toString()) : 0;
      const currentValue = totalTokensReceived * currentPrice;
      const percentChange = totalInvestedValue > 0 ? ((currentValue - totalInvestedValue) / totalInvestedValue) * 100 : 0;

      const response = {
        success: true,
        data: {
          address: tokenData.address,
          symbol: tokenData.symbol,
          name: tokenData.name,
          decimals: tokenData.decimals.toString(),
          about: tokenData.about,
          image: tokenData.image,
          isWrapped: tokenData.isWrapped,
          wrappedName: tokenData.wrappedName,
          wrappedSymbol: tokenData.wrappedSymbol,
          originalAddress: tokenData.originalAddress,
          price: tokenData.price ? tokenData.price.toString() : null,
          fdv: tokenData.fdv ? tokenData.fdv.toString() : null,
          marketcap: tokenData.marketcap ? tokenData.marketcap.toString() : null,
          price1yAgo: tokenData.price1yAgo ? tokenData.price1yAgo.toString() : null,
          hasActivePlan: plans.length > 0 && plans.some(p => p.active),
          plansOut: plans.map((plan) => ({
            id: plan.planHash,
            planId: 0,
            userId: plan.userWallet,
            tokenInId: "usdc",
            tokenOutId: plan.tokenOutAddress,
            recipient: plan.recipient,
            amountIn: parseFloat(plan.amountIn.toString()).toString(),
            approvalAmount: "0",
            frequency: plan.frequency,
            lastExecutedAt: plan.lastExecutedAt,
            active: plan.active,
            createdAt: plan.createdAt.toISOString(),
          })),
          totalInvestedValue,
          currentValue,
          percentChange,
          currentPrice,
          fdvUsd: tokenData.fdv ? parseFloat(tokenData.fdv.toString()) : 0,
          marketCapUsd: tokenData.marketcap ? parseFloat(tokenData.marketcap.toString()) : 0,
          volume24h: tokenData.volume24h ? parseFloat(tokenData.volume24h.toString()) : 0,
          totalSupply: tokenData.totalSupply ? parseFloat(tokenData.totalSupply.toString()) : 0,
        },
      };

      return NextResponse.json(response, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    // If no token address, return all plans (old behavior)
    if (plans.length === 0) {
      return NextResponse.json(
        { success: false, error: "No plans found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Return the plan(s) with execution history
    const response = {
      success: true,
      data: plans.map((plan) => ({
        planHash: plan.planHash,
        userWallet: plan.userWallet,
        tokenOut: {
          address: plan.tokenOut.address,
          symbol: plan.tokenOut.symbol,
          name: plan.tokenOut.name,
          decimals: plan.tokenOut.decimals.toString(),
          image: plan.tokenOut.image,
          price: plan.tokenOut.price
            ? parseFloat(plan.tokenOut.price.toString())
            : null,
        },
        recipient: plan.recipient,
        amountIn: parseFloat(plan.amountIn.toString()),
        frequency: plan.frequency,
        lastExecutedAt: plan.lastExecutedAt,
        active: plan.active,
        createdAt: plan.createdAt.toISOString(),
        executions: plan.executions.map((exec) => ({
          txHash: exec.txHash,
          amountIn: parseFloat(exec.amountIn.toString()),
          amountOut: parseFloat(exec.amountOut.toString()),
          feeAmount: parseFloat(exec.feeAmount.toString()),
          executedAt: exec.executedAt.toISOString(),
        })),
      })),
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Error in getPlan API:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
