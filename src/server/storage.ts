import prisma from "./db";
import type {
  CaseRecord,
  CaseStage,
  CaseStatus,
  ClientProfile,
  StageStatus,
  VaultDocument,
  VideoReservation,
} from "./types";
import { findUserByEmail } from "@/server/users";
import {
  normalizeCaseStatus,
  normalizeStageStatus,
  validateCaseTransition,
  validateStageTransition,
} from "@/core/stateMachine";

let caseSchemaChecked = false;

export const ensureCaseSchema = async () => {
  if (caseSchemaChecked) return;
  const columns = (await prisma.$queryRaw<{ name: string }[]>`
    PRAGMA table_info('Case')
  `) as Array<{ name: string }>;
  const names = new Set(columns.map((col: { name: string }) => col.name));
  const migrations: Array<{ name: string; sql: string }> = [
    {
      name: "caseStatus",
      sql: `ALTER TABLE "Case" ADD COLUMN caseStatus TEXT NOT NULL DEFAULT 'SUBMITTED'
            CHECK (caseStatus IN ('SUBMITTED','UNDER_REVIEW','AWAITING_CLIENT_APPROVAL','PAYMENT_PENDING','IN_PROGRESS','CLOSED'))`,
    },
    {
      name: "stageStatus",
      sql: `ALTER TABLE "Case" ADD COLUMN stageStatus TEXT NOT NULL DEFAULT 'PENDING'
            CHECK (stageStatus IN ('PENDING','AWAITING_PAYMENT','PAYMENT_SUBMITTED','PAID','IN_PROGRESS','COMPLETE'))`,
    },
    {
      name: "paymentStatus",
      sql: "ALTER TABLE \"Case\" ADD COLUMN paymentStatus TEXT NOT NULL DEFAULT 'pending'",
    },
    { name: "caseDetails", sql: "ALTER TABLE \"Case\" ADD COLUMN caseDetails TEXT" },
    { name: "caseSummary", sql: "ALTER TABLE \"Case\" ADD COLUMN caseSummary TEXT" },
    { name: "caseManagerMeta", sql: "ALTER TABLE \"Case\" ADD COLUMN caseManagerMeta TEXT" },
    { name: "practitionerMeta", sql: "ALTER TABLE \"Case\" ADD COLUMN practitionerMeta TEXT" },
    { name: "bankInstructions", sql: "ALTER TABLE \"Case\" ADD COLUMN bankInstructions TEXT" },
    { name: "paymentPlan", sql: "ALTER TABLE \"Case\" ADD COLUMN paymentPlan TEXT" },
    { name: "paymentProofs", sql: "ALTER TABLE \"Case\" ADD COLUMN paymentProofs TEXT" },
    { name: "terms", sql: "ALTER TABLE \"Case\" ADD COLUMN terms TEXT" },
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
  caseStatus: string | null;
  stageStatus: string | null;
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
  bankInstructions: string | null;
  paymentPlan: string | null;
  paymentProofs: string | null;
  terms: string | null;
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
  caseStatus: normalizeCaseStatus(record.caseStatus as CaseStatus),
  stageStatus: normalizeStageStatus(record.stageStatus as StageStatus),
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
  bankInstructions: record.bankInstructions ?? undefined,
  paymentPlan: record.paymentPlan ?? undefined,
  paymentProofs: parseJson(record.paymentProofs, [] as CaseRecord["paymentProofs"]),
  terms: record.terms ?? undefined,
});

export const listCases = async () => {
  await ensureCaseSchema();
  const records = await prisma.$queryRaw<CaseRow[]>`
    SELECT c.id, c.serviceId, c.stage, c.caseStatus, c.stageStatus, c.platformFeePaid, c.paymentStatus, c.caseDetails, c.caseSummary,
           c.caseManagerMeta, c.practitionerMeta, c.caseManagerId, c.practitionerId, c.videoSlot, c.videoLink,
           c.documentCount, c.escrowMilestones, c.timeline, c.bankInstructions, c.paymentPlan, c.paymentProofs, c.terms,
           u.fullName, u.email, u.country
    FROM "Case" c
    JOIN User u ON u.id = c.userId
    ORDER BY c.updatedAt DESC
  `;
  console.log("[debug][storage.listCases] rows", records.length);
  return records.map(mapCaseRecord);
};

export const getCase = async (id: string) => {
  await ensureCaseSchema();
  const records = await prisma.$queryRaw<CaseRow[]>`
    SELECT c.id, c.serviceId, c.stage, c.caseStatus, c.stageStatus, c.platformFeePaid, c.paymentStatus, c.caseDetails, c.caseSummary,
           c.caseManagerMeta, c.practitionerMeta, c.caseManagerId, c.practitionerId, c.videoSlot, c.videoLink,
           c.documentCount, c.escrowMilestones, c.timeline, c.bankInstructions, c.paymentPlan, c.paymentProofs, c.terms,
           u.fullName, u.email, u.country
    FROM "Case" c
    JOIN User u ON u.id = c.userId
    WHERE c.id = ${id}
    LIMIT 1
  `;
  console.log("[debug][storage.getCase] id", id, "found", Boolean(records[0]));
  return records[0] ? mapCaseRecord(records[0]) : undefined;
};

export async function createCase(params: {
  user: ClientProfile;
  serviceId: string;
  stage: CaseStage;
  caseStatus?: CaseStatus;
  stageStatus?: StageStatus;
  platformFeePaid: boolean;
  paymentStatus?: CaseRecord["paymentStatus"];
  caseDetails?: string;
  timeline: CaseRecord["timeline"];
  escrowMilestones: CaseRecord["escrowMilestones"];
  bankInstructions?: string;
  paymentPlan?: string;
  terms?: string;
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
  const caseStatus = normalizeCaseStatus((params.caseStatus as CaseStatus) ?? "SUBMITTED");
  const stageStatus = normalizeStageStatus((params.stageStatus as StageStatus) ?? "PENDING");
  try {
    await prisma.$executeRaw`
      INSERT INTO "Case" (id, userId, serviceId, stage, caseStatus, stageStatus, platformFeePaid, paymentStatus, caseDetails,
        documentCount, escrowMilestones, timeline, bankInstructions, paymentPlan, terms, createdAt, updatedAt)
      VALUES (
        ${id},
        ${existing.id},
        ${params.serviceId},
        ${params.stage},
        ${caseStatus},
        ${stageStatus},
        ${params.platformFeePaid ? 1 : 0},
        ${params.paymentStatus ?? "pending"},
        ${params.caseDetails ?? null},
        0,
        ${JSON.stringify(params.escrowMilestones)},
        ${JSON.stringify(params.timeline)},
        ${params.bankInstructions ?? null},
        ${params.paymentPlan ?? null},
        ${params.terms ?? null},
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
        INSERT INTO "Case" (id, userId, serviceId, stage, caseStatus, stageStatus, platformFeePaid, paymentStatus, caseDetails,
          documentCount, escrowMilestones, timeline, bankInstructions, paymentPlan, terms, createdAt, updatedAt)
        VALUES (
          ${id},
          ${existing.id},
          ${params.serviceId},
          ${params.stage},
          ${caseStatus},
          ${stageStatus},
          ${params.platformFeePaid ? 1 : 0},
          ${params.paymentStatus ?? "pending"},
          ${params.caseDetails ?? null},
          0,
          ${JSON.stringify(params.escrowMilestones)},
          ${JSON.stringify(params.timeline)},
          ${params.bankInstructions ?? null},
          ${params.paymentPlan ?? null},
          ${params.terms ?? null},
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
  const current = await prisma.case.findUnique({ where: { id } });
  if (!current) {
    throw new Error(`Case ${id} not found`);
  }

  let targetCaseStatus = updates.caseStatus;
  let targetStageStatus = updates.stageStatus;

  const currentCaseStatus = normalizeCaseStatus(
    (current as any).caseStatus as CaseStatus | undefined
  );
  const currentStageStatus = normalizeStageStatus(
    (current as any).stageStatus as StageStatus | undefined
  );

  if (!targetCaseStatus && updates.paymentStatus === "approved") {
    targetCaseStatus = "IN_PROGRESS";
  }
  if (!targetStageStatus && updates.paymentStatus === "approved") {
    targetStageStatus = "PAID";
  }

  const nextCaseStatus = normalizeCaseStatus(
    (targetCaseStatus as CaseStatus | undefined) ?? currentCaseStatus
  );
  const nextStageStatus = normalizeStageStatus(
    (targetStageStatus as StageStatus | undefined) ?? currentStageStatus
  );

  validateCaseTransition(currentCaseStatus, nextCaseStatus);
  validateStageTransition(currentStageStatus, nextStageStatus);

  await prisma.case.update({
    where: { id },
    data: {
      serviceId: updates.serviceId,
      stage: updates.stage,
      caseStatus: nextCaseStatus,
      stageStatus: nextStageStatus,
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
      paymentStatus: updates.paymentStatus,
      caseDetails: updates.caseDetails,
      caseSummary: updates.caseSummary,
      caseManagerMeta: updates.caseManagerInfo
        ? JSON.stringify(updates.caseManagerInfo)
        : undefined,
      practitionerMeta: updates.practitionerInfo
        ? JSON.stringify(updates.practitionerInfo)
        : undefined,
      bankInstructions: updates.bankInstructions,
      paymentPlan: updates.paymentPlan,
      paymentProofs:
        updates.paymentProofs !== undefined
          ? JSON.stringify(updates.paymentProofs)
          : undefined,
      terms: updates.terms,
    },
  });

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
