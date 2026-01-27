import prisma from "./db";
import type { CaseRecord, CaseStage, ClientProfile, VaultDocument, VideoReservation } from "./types";
import { findUserByEmail } from "@/server/users";

let caseSchemaChecked = false;

const ensureCaseSchema = async () => {
  if (caseSchemaChecked) return;
  const columns = (await prisma.$queryRaw<{ name: string }[]>`
    PRAGMA table_info('Case')
  `) as Array<{ name: string }>;
  const names = new Set(columns.map((col: { name: string }) => col.name));
  const migrations: Array<{ name: string; sql: string }> = [
    {
      name: "paymentStatus",
      sql: "ALTER TABLE \"Case\" ADD COLUMN paymentStatus TEXT NOT NULL DEFAULT 'pending'",
    },
    { name: "caseDetails", sql: "ALTER TABLE \"Case\" ADD COLUMN caseDetails TEXT" },
    { name: "caseSummary", sql: "ALTER TABLE \"Case\" ADD COLUMN caseSummary TEXT" },
    { name: "caseManagerMeta", sql: "ALTER TABLE \"Case\" ADD COLUMN caseManagerMeta TEXT" },
    { name: "practitionerMeta", sql: "ALTER TABLE \"Case\" ADD COLUMN practitionerMeta TEXT" },
  ];

  for (const migration of migrations) {
    if (!names.has(migration.name)) {
      await prisma.$executeRawUnsafe(migration.sql);
    }
  }

  caseSchemaChecked = true;
};

const parseJson = <T,>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

type CaseRow = {
  id: string;
  serviceId: string;
  stage: string;
  platformFeePaid: number;
  paymentStatus: string;
  caseDetails: string | null;
  caseSummary: string | null;
  caseManagerMeta: string | null;
  practitionerMeta: string | null;
  caseManagerId: string | null;
  practitionerId: string | null;
  videoSlot: string | null;
  videoLink: string | null;
  documentCount: number;
  escrowMilestones: string;
  timeline: string;
  fullName: string;
  email: string;
  country: string;
};

const mapCaseRecord = (record: CaseRow): CaseRecord => ({
  id: record.id,
  user: {
    fullName: record.fullName,
    email: record.email,
    country: record.country,
  },
  serviceId: record.serviceId,
  stage: record.stage as CaseStage,
  platformFeePaid: Boolean(record.platformFeePaid),
  paymentStatus: (record.paymentStatus as CaseRecord["paymentStatus"]) ?? "pending",
  caseDetails: record.caseDetails ?? undefined,
  caseSummary: record.caseSummary ?? undefined,
  caseManagerInfo: record.caseManagerMeta
    ? parseJson(record.caseManagerMeta, undefined as CaseRecord["caseManagerInfo"] | undefined)
    : undefined,
  practitionerInfo: record.practitionerMeta
    ? parseJson(record.practitionerMeta, undefined as CaseRecord["practitionerInfo"] | undefined)
    : undefined,
  caseManagerId: record.caseManagerId ?? undefined,
  practitionerId: record.practitionerId ?? undefined,
  videoSlot: record.videoSlot ?? undefined,
  videoLink: record.videoLink ?? undefined,
  documentCount: record.documentCount,
  escrowMilestones: parseJson(record.escrowMilestones, []),
  timeline: parseJson(record.timeline, []),
});

export const listCases = async () => {
  const records = await prisma.$queryRaw<CaseRow[]>`
    SELECT c.id, c.serviceId, c.stage, c.platformFeePaid, c.paymentStatus, c.caseDetails, c.caseSummary,
           c.caseManagerMeta, c.practitionerMeta, c.caseManagerId, c.practitionerId, c.videoSlot, c.videoLink,
           c.documentCount, c.escrowMilestones, c.timeline,
           u.fullName, u.email, u.country
    FROM "Case" c
    JOIN User u ON u.id = c.userId
    ORDER BY c.updatedAt DESC
  `;
  return records.map(mapCaseRecord);
};

export const getCase = async (id: string) => {
  const records = await prisma.$queryRaw<CaseRow[]>`
    SELECT c.id, c.serviceId, c.stage, c.platformFeePaid, c.paymentStatus, c.caseDetails, c.caseSummary,
           c.caseManagerMeta, c.practitionerMeta, c.caseManagerId, c.practitionerId, c.videoSlot, c.videoLink,
           c.documentCount, c.escrowMilestones, c.timeline,
           u.fullName, u.email, u.country
    FROM "Case" c
    JOIN User u ON u.id = c.userId
    WHERE c.id = ${id}
    LIMIT 1
  `;
  return records[0] ? mapCaseRecord(records[0]) : undefined;
};

export async function createCase(params: {
  user: ClientProfile;
  serviceId: string;
  stage: CaseStage;
  platformFeePaid: boolean;
  paymentStatus?: CaseRecord["paymentStatus"];
  caseDetails?: string;
  timeline: CaseRecord["timeline"];
  escrowMilestones: CaseRecord["escrowMilestones"];
}) {
  await ensureCaseSchema();
  const existing = await findUserByEmail(params.user.email);
  if (!existing) {
    throw new Error("User account not found. Please sign up before creating a case.");
  }

  await prisma.$executeRaw`
    UPDATE User
    SET fullName = ${params.user.fullName}, country = ${params.user.country}
    WHERE email = ${params.user.email}
  `;

  const id = `CASE-${Date.now()}`;
  try {
    await prisma.$executeRaw`
      INSERT INTO "Case" (id, userId, serviceId, stage, platformFeePaid, paymentStatus, caseDetails,
        documentCount, escrowMilestones, timeline, createdAt, updatedAt)
      VALUES (
        ${id},
        ${existing.id},
        ${params.serviceId},
        ${params.stage},
        ${params.platformFeePaid ? 1 : 0},
        ${params.paymentStatus ?? "pending"},
        ${params.caseDetails ?? null},
        0,
        ${JSON.stringify(params.escrowMilestones)},
        ${JSON.stringify(params.timeline)},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `;
  } catch (error: any) {
    const message = String(error?.message ?? "");
    if (message.includes("paymentStatus") || message.includes("caseDetails")) {
      caseSchemaChecked = false;
      await ensureCaseSchema();
      await prisma.$executeRaw`
        INSERT INTO "Case" (id, userId, serviceId, stage, platformFeePaid, paymentStatus, caseDetails,
          documentCount, escrowMilestones, timeline, createdAt, updatedAt)
        VALUES (
          ${id},
          ${existing.id},
          ${params.serviceId},
          ${params.stage},
          ${params.platformFeePaid ? 1 : 0},
          ${params.paymentStatus ?? "pending"},
          ${params.caseDetails ?? null},
          0,
          ${JSON.stringify(params.escrowMilestones)},
          ${JSON.stringify(params.timeline)},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `;
    } else {
      throw error;
    }
  }
  const record = await getCase(id);
  if (!record) {
    throw new Error("Failed to create case.");
  }
  return record;
}

export async function updateCase(id: string, updates: Partial<CaseRecord>) {
  await ensureCaseSchema();
  await prisma.case.update({
    where: { id },
    data: {
      serviceId: updates.serviceId,
      stage: updates.stage,
      platformFeePaid: updates.platformFeePaid,
      caseManagerId: updates.caseManagerId,
      practitionerId: updates.practitionerId,
      videoSlot: updates.videoSlot,
      videoLink: updates.videoLink,
      documentCount: updates.documentCount,
      escrowMilestones:
        updates.escrowMilestones !== undefined
          ? JSON.stringify(updates.escrowMilestones)
          : undefined,
      timeline:
        updates.timeline !== undefined ? JSON.stringify(updates.timeline) : undefined,
    },
  });

  if (
    updates.paymentStatus !== undefined ||
    updates.caseDetails !== undefined ||
    updates.caseSummary !== undefined ||
    updates.caseManagerInfo !== undefined ||
    updates.practitionerInfo !== undefined
  ) {
    await prisma.$executeRaw`
      UPDATE "Case"
      SET paymentStatus = COALESCE(${updates.paymentStatus ?? null}, paymentStatus),
          caseDetails = COALESCE(${updates.caseDetails ?? null}, caseDetails),
          caseSummary = COALESCE(${updates.caseSummary ?? null}, caseSummary),
          caseManagerMeta = COALESCE(${updates.caseManagerInfo ? JSON.stringify(updates.caseManagerInfo) : null}, caseManagerMeta),
          practitionerMeta = COALESCE(${updates.practitionerInfo ? JSON.stringify(updates.practitionerInfo) : null}, practitionerMeta)
      WHERE id = ${id}
    `;
  }

  const record = await getCase(id);
  if (!record) {
    throw new Error(`Case ${id} not found`);
  }
  return record;
}

export async function logTimelineEntry(
  caseId: string,
  entry: CaseRecord["timeline"][number]
) {
  const record = await prisma.case.findUnique({ where: { id: caseId } });
  if (!record) throw new Error(`Case ${caseId} not found`);
  const timeline = [...parseJson(record.timeline, [] as CaseRecord["timeline"]), entry];
  const updated = await prisma.case.update({
    where: { id: caseId },
    data: { timeline: JSON.stringify(timeline) },
  });
  const refreshed = await getCase(updated.id);
  if (!refreshed) {
    throw new Error(`Case ${caseId} not found`);
  }
  return refreshed;
}

export async function recordVideo(caseId: string, scheduledAt: string): Promise<{
  reservation: VideoReservation;
  caseRecord: CaseRecord;
}> {
  const reservation = await prisma.videoReservation.create({
    data: {
      caseId,
      scheduledAt,
      link: `https://meet.nri-law-buddy.com/${caseId}/${Date.now()}`,
    },
  });

  const record = await prisma.case.update({
    where: { id: caseId },
    data: {
      videoSlot: scheduledAt,
      stage: "video-scheduled",
      videoLink: reservation.link,
    },
  });
  const caseRecord = await getCase(record.id);
  if (!caseRecord) {
    throw new Error(`Case ${caseId} not found`);
  }

  return {
    reservation: {
      id: reservation.id,
      caseId: reservation.caseId,
      scheduledAt: reservation.scheduledAt,
      link: reservation.link,
    },
    caseRecord,
  };
}

export async function addDocument(
  caseId: string,
  doc: Omit<VaultDocument, "id" | "caseId" | "uploadedAt">
) {
  const record = await prisma.vaultDocument.create({
    data: {
      caseId,
      name: doc.name,
      type: doc.type,
      status: doc.status,
      summary: doc.summary,
    },
  });

  const caseRecord = await prisma.case.findUnique({ where: { id: caseId } });
  if (caseRecord) {
    await prisma.case.update({
      where: { id: caseId },
      data: {
        documentCount: caseRecord.documentCount + 1,
        stage: "documents",
      },
    });
  }

  return {
    id: record.id,
    caseId: record.caseId,
    name: record.name,
    type: record.type,
    status: record.status as VaultDocument["status"],
    summary: record.summary,
    uploadedAt: record.uploadedAt.toISOString(),
  } satisfies VaultDocument;
}

export const listDocuments = async (caseId: string) => {
  const records = await prisma.vaultDocument.findMany({
    where: { caseId },
    orderBy: { uploadedAt: "desc" },
  });
  return records.map((doc: (typeof records)[number]) => ({
    id: doc.id,
    caseId: doc.caseId,
    name: doc.name,
    type: doc.type,
    status: doc.status as VaultDocument["status"],
    summary: doc.summary,
    uploadedAt: doc.uploadedAt.toISOString(),
  }));
};

export const advanceEscrow = async (caseId: string) => {
  const record = await prisma.case.findUnique({ where: { id: caseId } });
  if (!record) throw new Error(`Case ${caseId} not found`);
  const milestones = parseJson(record.escrowMilestones, [] as CaseRecord["escrowMilestones"]);
  const nextIndex = milestones.findIndex((milestone) => !milestone.unlocked);
  if (nextIndex === -1) {
    const refreshed = await getCase(record.id);
    if (!refreshed) {
      throw new Error(`Case ${caseId} not found`);
    }
    return refreshed;
  }
  const updatedMilestones = milestones.map((milestone, index) =>
    index === nextIndex ? { ...milestone, unlocked: true } : milestone
  );
  const updated = await prisma.case.update({
    where: { id: caseId },
    data: {
      escrowMilestones: JSON.stringify(updatedMilestones),
      stage: nextIndex >= updatedMilestones.length - 1 ? "escrow" : record.stage,
    },
  });
  const refreshed = await getCase(updated.id);
  if (!refreshed) {
    throw new Error(`Case ${caseId} not found`);
  }
  return refreshed;
};
