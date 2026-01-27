import { NextResponse } from "next/server";

import prisma from "@/server/db";

const managers = [
  {
    id: "cm-shreya",
    name: "Shreya Kapur",
    timezone: "IST (+5:30)",
    specialization: "Property & FEMA",
    weeklyLoad: 6,
  },
  {
    id: "cm-ravi",
    name: "Ravi Menon",
    timezone: "EST (-5)",
    specialization: "Family Law",
    weeklyLoad: 4,
  },
  {
    id: "cm-ananya",
    name: "Ananya Iyer",
    timezone: "GMT (+0)",
    specialization: "Inheritance",
    weeklyLoad: 5,
  },
];

const practitioners = [
  {
    id: "lp-desai",
    name: "Adv. Meera Desai",
    bar: "Bombay High Court",
    focus: "Property litigation",
  },
  {
    id: "lp-saxena",
    name: "Adv. Karan Saxena",
    bar: "Delhi High Court",
    focus: "Family & international custody",
  },
  {
    id: "lp-fernandez",
    name: "Adv. Leena Fernandez",
    bar: "Madras High Court",
    focus: "Inheritance & probate",
  },
];

export async function POST() {
  for (const manager of managers) {
    await prisma.$executeRaw`
      INSERT INTO CaseManager (id, name, timezone, specialization, weeklyLoad)
      VALUES (${manager.id}, ${manager.name}, ${manager.timezone}, ${manager.specialization}, ${manager.weeklyLoad})
      ON CONFLICT(id) DO UPDATE SET
        name = ${manager.name},
        timezone = ${manager.timezone},
        specialization = ${manager.specialization},
        weeklyLoad = ${manager.weeklyLoad}
    `;
  }

  for (const practitioner of practitioners) {
    await prisma.$executeRaw`
      INSERT INTO Practitioner (id, name, bar, focus)
      VALUES (${practitioner.id}, ${practitioner.name}, ${practitioner.bar}, ${practitioner.focus})
      ON CONFLICT(id) DO UPDATE SET
        name = ${practitioner.name},
        bar = ${practitioner.bar},
        focus = ${practitioner.focus}
    `;
  }

  return NextResponse.json({ managers: managers.length, practitioners: practitioners.length });
}
