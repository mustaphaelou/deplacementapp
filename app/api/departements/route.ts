import { NextResponse } from "next/server";
import { listDepartements } from "@/lib/departement/queries";
import { handleServiceError } from "@/lib/errors";

export async function GET() {
  try {
    const departements = await listDepartements();
    return NextResponse.json(departements);
  } catch (e) {
    return handleServiceError(e);
  }
}
