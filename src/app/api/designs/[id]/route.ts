import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { balloonDesigns } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const design = await db
      .select()
      .from(balloonDesigns)
      .where(eq(balloonDesigns.id, id))
      .limit(1);

    if (!design || design.length === 0) {
      return NextResponse.json({ error: "Design not found" }, { status: 404 });
    }

    return NextResponse.json({ design: design[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updateData: any = {
      updated_at: new Date(),
    };

    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.balloons !== undefined) {
      updateData.balloons = body.balloons;
      updateData.balloonCount = body.balloons.length;
    }
    if (body.bubbles !== undefined) {
      updateData.bubbles = body.bubbles;
      updateData.bubbleCount = body.bubbles.length;
    }
    if (body.steps !== undefined) updateData.steps = body.steps;
    if (body.annotations !== undefined) updateData.annotations = body.annotations;
    if (body.thumbnailData !== undefined) updateData.thumbnailData = body.thumbnailData;
    if (body.complexity !== undefined) updateData.complexity = body.complexity;

    await db
      .update(balloonDesigns)
      .set(updateData)
      .where(eq(balloonDesigns.id, id));

    return NextResponse.json({ success: true, updatedId: id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.delete(balloonDesigns).where(eq(balloonDesigns.id, id));
    return NextResponse.json({ success: true, deletedId: id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
