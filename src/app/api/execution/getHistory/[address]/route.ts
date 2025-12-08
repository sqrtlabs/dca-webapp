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
    const tokenFilter = searchParams.get("token");
    const dateFilter = searchParams.get("date");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    console.log("Fetching execution history for address:", address, "page:", page, "date:", dateFilter);

    // Validate address
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { success: false, error: "Invalid wallet address provided" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Get all executions for user's plans
    const whereClause: {
      plan: { userWallet: string };
      tokenOutAddress?: string;
      executedAt?: { gte: Date; lte: Date };
    } = {
      plan: {
        userWallet: address.toLowerCase(),
      },
    };

    // Add token filter if provided
    if (tokenFilter) {
      whereClause.tokenOutAddress = tokenFilter.toLowerCase();
    }

    // Add date filter if provided
    if (dateFilter) {
      const startOfDay = new Date(dateFilter);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(dateFilter);
      endOfDay.setUTCHours(23, 59, 59, 999);

      whereClause.executedAt = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    // Get total count for pagination
    const totalCount = await prisma.dCAExecution.count({
      where: whereClause,
    });

    const executions = await prisma.dCAExecution.findMany({
      where: whereClause,
      include: {
        tokenOut: true,
        plan: {
          include: {
            tokenOut: true,
          },
        },
      },
      orderBy: {
        executedAt: "desc",
      },
      skip,
      take: limit,
    });

    // Get all unique tokens for filtering
    const uniqueTokens = await prisma.dCAExecution.findMany({
      where: {
        plan: {
          userWallet: address.toLowerCase(),
        },
      },
      distinct: ["tokenOutAddress"],
      select: {
        tokenOutAddress: true,
        tokenOut: {
          select: {
            address: true,
            symbol: true,
            name: true,
            image: true,
            decimals: true,
          },
        },
      },
    });

    // Get ALL executions for activity grid (not paginated)
    const allExecutions = await prisma.dCAExecution.findMany({
      where: {
        plan: {
          userWallet: address.toLowerCase(),
        },
      },
      select: {
        executedAt: true,
      },
    });

    // Group executions by date for the activity grid
    const executionsByDate: Record<string, number> = {};
    allExecutions.forEach((exec) => {
      const date = exec.executedAt.toISOString().split("T")[0];
      executionsByDate[date] = (executionsByDate[date] || 0) + 1;
    });

    // Calculate stats (from all executions, not just current page)
    const allExecutionsWithAmounts = await prisma.dCAExecution.findMany({
      where: whereClause,
      select: {
        amountIn: true,
      },
    });

    const totalExecutions = totalCount;
    const totalInvested = allExecutionsWithAmounts.reduce(
      (sum, exec) => sum + parseFloat(exec.amountIn.toString()),
      0
    );

    // USDC has 6 decimals
    const USDC_DECIMALS = 6;

    const response = {
      success: true,
      data: {
        executions: executions.map((exec) => {
          const tokenDecimals = parseInt(exec.tokenOut.decimals.toString());
          return {
            txHash: exec.txHash,
            planHash: exec.planHash,
            token: {
              address: exec.tokenOut.address,
              symbol: exec.tokenOut.symbol,
              name: exec.tokenOut.name,
              image: exec.tokenOut.image,
              decimals: tokenDecimals,
            },
            // Convert USDC amount (6 decimals)
            amountIn: parseFloat(exec.amountIn.toString()) / Math.pow(10, USDC_DECIMALS),
            // Convert token amount (variable decimals)
            amountOut: parseFloat(exec.amountOut.toString()) / Math.pow(10, tokenDecimals),
            feeAmount: parseFloat(exec.feeAmount.toString()) / Math.pow(10, USDC_DECIMALS),
            executedAt: exec.executedAt.toISOString(),
          };
        }),
        executionsByDate,
        tokens: uniqueTokens.map((t) => ({
          address: t.tokenOut.address,
          symbol: t.tokenOut.symbol,
          name: t.tokenOut.name,
          image: t.tokenOut.image,
        })),
        stats: {
          totalExecutions,
          totalInvested: totalInvested / Math.pow(10, USDC_DECIMALS),
        },
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasMore: skip + executions.length < totalCount,
        },
      },
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Error in getHistory API:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
