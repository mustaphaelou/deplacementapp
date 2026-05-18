import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { TravelRequestPdf } from "@/components/pdf/travel-request-pdf"
import ReactPDF from "@react-pdf/renderer"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return new NextResponse("Non authentifie", { status: 401 })
  }

  const { id } = await params

  const travelRequest = await prisma.travelRequest.findUnique({
    where: { id },
    include: {
      requester: { select: { id: true, name: true, email: true } },
      manager: { select: { id: true, name: true } },
      approvals: {
        include: {
          approver: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (!travelRequest) {
    return new NextResponse("Demande introuvable", { status: 404 })
  }

  const role = session.user.role as string
  if (role === "EMPLOYEE" && travelRequest.requesterId !== session.user.id) {
    return new NextResponse("Acces non autorise", { status: 403 })
  }

  const buffer = await ReactPDF.renderToBuffer(
    <TravelRequestPdf request={travelRequest} />
  )

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="deplacement-${travelRequest.destination.replace(/[^a-zA-Z0-9]/g, "_")}.pdf"`,
    },
  })
}
