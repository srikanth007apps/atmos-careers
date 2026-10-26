import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/server/auth";
import { handleRouteError, readJson } from "@/lib/server/http";
import { createDepartment, listDepartments } from "@/lib/server/repos/departments";
import { departmentSchema } from "@/lib/validation/admin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    await requireAdminApi(req);
    return NextResponse.json({ ok: true, departments: await listDepartments() });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdminApi(req);
    const { name } = departmentSchema.parse(await readJson(req));
    return NextResponse.json({ ok: true, department: await createDepartment(name) }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
