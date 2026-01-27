import {
  Baby,
  Gavel,
  HeartHandshake,
  LandPlot,
  Landmark,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ServiceId =
  | "property-dispute"
  | "investment-compliance"
  | "nri-adoption"
  | "parental-abduction"
  | "marriage-desertion"
  | "will-probate"
  | "succession-certificate";

export interface LegalService {
  id: ServiceId;
  label: string;
  summary: string;
  highlights: string[];
  turnaround: string;
  complianceNote: string;
  color: string;
}

export const serviceIconMap: Record<ServiceId, LucideIcon> = {
  "property-dispute": LandPlot,
  "investment-compliance": Landmark,
  "nri-adoption": Baby,
  "parental-abduction": ShieldCheck,
  "marriage-desertion": HeartHandshake,
  "will-probate": ScrollText,
  "succession-certificate": Gavel,
};

export const legalServices: LegalService[] = [
  {
    id: "property-dispute",
    label: "Property Dispute Resolution",
    summary:
      "On-ground litigation and mediation support for ancestral property, tenant disputes, and illegal encroachments in India.",
    highlights: [
      "Title search + encumbrance check",
      "Land survey coordination",
      "On-call litigation strategist",
    ],
    turnaround: "45-90 days",
    complianceNote: "Handled under Transfer of Property Act & state mutation rules.",
    color: "#10b981",
  },
  {
    id: "investment-compliance",
    label: "Investments & FEMA Compliance",
    summary:
      "Guidance for real-estate purchases, repatriation, and FEMA/FCNR reporting to keep cross-border assets compliant.",
    highlights: [
      "Banking/FEMA advisory",
      "Tax-ready document kit",
      "Repatriation playbooks",
    ],
    turnaround: "30-45 days",
    complianceNote: "FEMA, RBI Master Circulars & Double Taxation rules.",
    color: "#0ea5e9",
  },
  {
    id: "nri-adoption",
    label: "Adoption for NRIs",
    summary:
      "CARINGS dossier prep, home-study partner coordination, and Hague-compliant filings for NRIs.",
    highlights: [
      "Document attestation",
      "Home study partners",
      "Embassy liaison",
    ],
    turnaround: "60-120 days",
    complianceNote: "Hague Convention + CARA CARINGS regulations.",
    color: "#a855f7",
  },
  {
    id: "parental-abduction",
    label: "Inter-Parental Abduction",
    summary:
      "Rapid response desk coordinating MEA, embassies, and child custody motions when a parent wrongfully retains a child in India.",
    highlights: [
      "Blue corner notices",
      "High Court habeas filings",
      "MEACell escalation",
    ],
    turnaround: "72-hour triage",
    complianceNote: "Guardians & Wards Act, immigration travel restrictions.",
    color: "#f43f5e",
  },
  {
    id: "marriage-desertion",
    label: "NRI Marriage & Desertion",
    summary:
      "Support for spouse abandonment, 498A complaints, and overseas divorce recognition strategies.",
    highlights: [
      "Evidence locker",
      "FIR filing desk",
      "Mutual consent playbooks",
    ],
    turnaround: "21-day escalation",
    complianceNote: "Indian Penal Code, PWDVA, & Private International Law opinions.",
    color: "#f59e0b",
  },
  {
    id: "will-probate",
    label: "Will Drafting & Probate",
    summary:
      "Digitally orchestrated drafting, attestation, and probate filings with city civil courts across India.",
    highlights: [
      "Bilingual drafts",
      "Video witnessing",
      "Probate liaison",
    ],
    turnaround: "15-30 days",
    complianceNote: "Indian Succession Act + state court procedures.",
    color: "#6366f1",
  },
  {
    id: "succession-certificate",
    label: "Succession Certificate",
    summary:
      "Fast-track petitions for legal heirs to access bank accounts, demat holdings, and insurance pay-outs.",
    highlights: [
      "Asset discovery",
      "Affidavit drafting",
      "Probate court tracking",
    ],
    turnaround: "35-60 days",
    complianceNote: "Civil Procedure Code & Succession Certificate norms.",
    color: "#d946ef",
  },
];

export const assurancePoints = [
  "Platform-fixed fee conversations – never negotiate directly with a lawyer.",
  "Realtime assignment updates mirror the Uber-style dispatch logic.",
  "Bank-partnered escrow ensures 60/40 milestone based release.",
  "Document vault is AES-256 encrypted with role-based redaction.",
];

export const caseManagers = [
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

export const practitionerBench = [
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
