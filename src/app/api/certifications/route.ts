import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const certifications = await prisma.certification.findMany({
    orderBy: { name: "asc" },
    include: {
      domains: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true, objective: true, sortOrder: true } },
      _count: { select: { domains: true } },
    },
  });

  const questionCounts = await prisma.question.groupBy({ by: ["domainId"], _count: { _all: true } });
  const counts = new Map(questionCounts.map((item) => [item.domainId, item._count._all]));

  return NextResponse.json(certifications.map((certification) => ({
    ...certification,
    questionCount: certification.domains.reduce((total, domain) => total + (counts.get(domain.id) ?? 0), 0),
  })));
}