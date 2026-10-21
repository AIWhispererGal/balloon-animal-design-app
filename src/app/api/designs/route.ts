import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { balloonDesigns } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { PRESET_DESIGNS } from "@/lib/balloonPresets";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const complexity = searchParams.get("complexity");

    // Always upsert the built-in presets so stored rows stay in sync with the
    // current preset definitions (poses, corrected bubble sequences, steps).
    const presetsToSeed = [
      PRESET_DESIGNS.dog.beginner,
      PRESET_DESIGNS.dog.intermediate,
      PRESET_DESIGNS.dog.advanced,
      PRESET_DESIGNS.sword.beginner,
      PRESET_DESIGNS.sword.intermediate,
      PRESET_DESIGNS.sword.advanced,
      PRESET_DESIGNS.flower.beginner,
      PRESET_DESIGNS.flower.intermediate,
      PRESET_DESIGNS.flower.advanced,
    ];

    for (const p of presetsToSeed) {
      const row = {
        id: p.id,
        title: p.title,
        description: p.description,
        category: p.category,
        sourceType: "preset",
        complexity: p.complexity,
        bubbleCount: p.bubbles.length,
        balloonCount: p.balloons.length,
        balloons: p.balloons as any,
        bubbles: p.bubbles as any,
        steps: p.steps as any,
        annotations: (p.annotations || []) as any,
        isPreset: true,
      };
      await db
        .insert(balloonDesigns)
        .values(row)
        .onConflictDoUpdate({ target: balloonDesigns.id, set: row });
    }

    const designs = await db
      .select()
      .from(balloonDesigns)
      .orderBy(desc(balloonDesigns.createdAt))
      .limit(50);
    return NextResponse.json({ designs });
  } catch (error: any) {
    console.error("Error fetching designs:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch designs" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      title,
      description,
      category,
      complexity,
      balloons,
      bubbles,
      steps,
      annotations,
      thumbnailData,
      sourceType,
      sourcePrompt,
    } = body;

    const designId = id || `design-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const newDesign = {
      id: designId,
      title: title || "Custom Balloon Design",
      description: description || "Custom user-created sculpture",
      category: category || "custom",
      sourceType: sourceType || "scratch",
      sourcePrompt: sourcePrompt || null,
      complexity: complexity || "beginner",
      bubbleCount: bubbles ? bubbles.length : 0,
      balloonCount: balloons ? balloons.length : 1,
      balloons: balloons || [],
      bubbles: bubbles || [],
      steps: steps || [],
      annotations: annotations || [],
      thumbnailData: thumbnailData || null,
      isPreset: false,
    };

    await db
      .insert(balloonDesigns)
      .values(newDesign as any)
      .onConflictDoUpdate({ target: balloonDesigns.id, set: newDesign as any });

    return NextResponse.json({ success: true, design: newDesign });
  } catch (error: any) {
    console.error("Error saving design:", error);
    return NextResponse.json({ error: error.message || "Failed to save design" }, { status: 500 });
  }
}
