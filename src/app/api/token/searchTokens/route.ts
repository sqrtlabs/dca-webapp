import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ success: true, data: [] });
    }

    const searchTerm = query.trim().toLowerCase();

    // Search in database for tokens by name, symbol, or address
    // Get all tokens and filter in memory for better compatibility
    const allTokens = await prisma.token.findMany({
      select: {
        address: true,
        symbol: true,
        name: true,
        image: true,
      },
    });

    // Filter tokens by search term (case-insensitive)
    const tokens = allTokens
      .filter((token) => {
        const nameMatch = token.name.toLowerCase().includes(searchTerm);
        const symbolMatch = token.symbol.toLowerCase().includes(searchTerm);
        const addressMatch = token.address.toLowerCase().includes(searchTerm);
        return nameMatch || symbolMatch || addressMatch;
      })
      .sort((a, b) => {
        // Sort by symbol first, then name
        if (a.symbol < b.symbol) return -1;
        if (a.symbol > b.symbol) return 1;
        if (a.name < b.name) return -1;
        if (a.name > b.name) return 1;
        return 0;
      })
      .slice(0, 10);

    return NextResponse.json({ success: true, data: tokens });
  } catch (error) {
    console.error("Error searching tokens:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
