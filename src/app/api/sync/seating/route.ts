import { NextResponse } from "next/server";
import { syncRosterFromSheets } from "@/server/sync-seating";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      groupId?: string;
      sheet?: string;
    };

    const result = await syncRosterFromSheets({
      onlyGroupId: body.groupId,
      onlySheet: body.sheet,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
