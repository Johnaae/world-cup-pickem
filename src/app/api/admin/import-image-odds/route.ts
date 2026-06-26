import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractOddsFromImages } from "@/lib/ai/extractImageOdds";
import {
  extractionToPreviewRows,
  normalizeExtraction,
} from "@/lib/ai/normalizeExtracted";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_IMAGES,
} from "@/lib/ai/types";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const formData = await request.formData();
    const matchId = formData.get("matchId");
    if (typeof matchId !== "string" || !matchId) {
      return NextResponse.json({ error: "matchId required" }, { status: 400 });
    }

    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    const bookmakerPreference =
      typeof formData.get("bookmakerPreference") === "string"
        ? (formData.get("bookmakerPreference") as string)
        : undefined;
    const saveForAudit = formData.get("saveForAudit") === "true";

    const files = formData.getAll("images").filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      return NextResponse.json({ error: "At least one image required" }, { status: 400 });
    }
    if (files.length > MAX_IMAGES) {
      return NextResponse.json({ error: `Maximum ${MAX_IMAGES} images allowed` }, { status: 400 });
    }

    const images: { mimeType: string; base64: string; fileName: string; buffer: Buffer }[] = [];
    for (const file of files) {
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        return NextResponse.json(
          { error: "Only JPG, PNG, and WEBP images are allowed" },
          { status: 400 }
        );
      }
      if (file.size > MAX_IMAGE_BYTES) {
        return NextResponse.json(
          { error: "Each image must be 10MB or less" },
          { status: 400 }
        );
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      images.push({
        mimeType: file.type,
        base64: buffer.toString("base64"),
        fileName: file.name,
        buffer,
      });
    }

    const { raw, model } = await extractOddsFromImages({
      images: images.map(({ mimeType, base64 }) => ({ mimeType, base64 })),
      match: { teamA: match.teamA, teamB: match.teamB },
      bookmakerPreference,
    });

    const extraction = normalizeExtraction(raw, match, bookmakerPreference);
    const preview = extractionToPreviewRows(extraction);

    if (saveForAudit) {
      for (const img of images) {
        await prisma.oddsImportAudit.create({
          data: {
            matchId,
            mimeType: img.mimeType,
            fileName: img.fileName,
            imageData: img.buffer,
            bookmaker: bookmakerPreference ?? extraction.markets[0]?.bookmaker ?? null,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      matchId,
      extraction,
      preview,
      warnings: extraction.warnings,
      confidence: extraction.confidence,
      model,
      message: "AI extraction complete. Review before importing.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to extract odds from image";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
