import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";

export async function POST(req: Request) {
  try {
    const { userAddress } = await req.json();

    // Validate userAddress
    if (!userAddress || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      return NextResponse.json(
        { success: false, error: "Invalid wallet address provided" },
        { status: 400 }
      );
    }

    // Log the web app visit
    const visit = await prisma.webAppVisit.create({
      data: {
        userAddress: userAddress.toLowerCase(),
      },
    });

    return NextResponse.json({
      success: true,
      data: visit,
    });
  } catch (error) {
    console.error("Error logging web app visit:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
