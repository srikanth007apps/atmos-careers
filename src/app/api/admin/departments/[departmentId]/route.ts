import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/server/auth";
import { handleRouteError, HttpError, readJson } from "@/lib/server/http";
import { updateDepartment } from "@/lib/server/repos/departments";
import { departmentUpdateSchema } from "@/lib/validation/admin";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ departmentId: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    await requireAdminApi(req);
    const patch = departmentUpdateSchema.parse(await readJson(req));
    const department = await updateDepartment((await params).departmentId, patch);
    return NextResponse.json({ ok: true, department });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Hard deletion is intentionally not supported – jobs reference departments by ID. */
export async function DELETE(req: Request) {
  try {
    await requireAdminApi(req);
    throw new HttpError(405, "Departments cannot be deleted because jobs reference them. Deactivate the department instead.");
  } catch (err) {
    return handleRouteError(err);
  }
}
