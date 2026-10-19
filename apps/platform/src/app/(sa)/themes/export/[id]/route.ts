import { NextResponse, type NextRequest } from "next/server";
import { canPlatform, listTemplatesForStaff, templateToFile } from "@biztrackbd/core";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** A template as a .json file, for staff who can see templates. The file can be edited and uploaded again. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!canPlatform(s.user.role, "plans", "view")) return new NextResponse("Not allowed", { status: 403 });
  const { id } = await ctx.params;
  const t = (await listTemplatesForStaff(s.actor)).find((x) => x.id === id);
  if (!t) return new NextResponse("No such template", { status: 404 });
  return new NextResponse(templateToFile(t), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${t.id}.template.json"`,
      "Cache-Control": "no-store",
    },
  });
}
