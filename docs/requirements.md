# NRI Law Buddy – Requirements Brief

## Stakeholders & Roles
- **NRI Client** – logs into the platform, chooses a legal service, uploads documents, tracks progress, joins video calls.
- **Case Manager** – auto-assigned once a service is selected; reviews intake, collects fees, assigns legal practitioner, keeps user updated.
- **Legal Practitioner / Lawyer** – receives assigned cases, reviews summarized dossier, schedules video calls via in-app tool, updates milestones.
- **Platform Admin / Operations** – manages service catalogue, practitioner network, escrow releases, and compliance.

## Core Services Offered
1. Property Dispute Resolution (India-specific)
2. Properties & Investments Compliance for NRIs
3. Adoption by NRIs & Foreign Citizens
4. Inter-parental Abduction Support
5. NRI Marriages & Desertion Relief
6. Will Drafting & Probate
7. Succession Certificate Procurement

## Functional Requirements
- **Authentication**: Secure client login (support for future SSO/MFA). Session handling and role-based UI.
- **Service Selection Flow**: Modern UI grid/cards to browse the seven core offerings; selection triggers intake form.
- **Platform Fee Capture**: Flat $50 platform fee charged before case manager assignment (payment intent + receipt tracking).
- **Case Assignment Workflow**:
  - Auto-generate case record with unique ID.
  - Assign case manager (round-robin or rules-based) immediately after fee capture.
  - Case manager dashboard to view pipeline and status updates.
- **Practitioner Network Matching**:
  - Case manager selects/auto-assigns legal practitioner.
  - Practitioner notified, sees summarized case brief, and can accept/decline.
- **Video Consultation Scheduling**: Embedded video call module (WebRTC provider placeholder) with calendar integration and reminders.
- **Fee & Escrow Handling**:
  - Inform clients that fee negotiations happen through platform only.
  - Once scope agreed, create escrow with Indian Bank partner; platform authorized for 60% release upon court filing milestone, remainder on court movement confirmation.
- **Document Vault**:
  - Secure upload, classification, and storage of user documents.
  - Automatic extraction/summarization for lawyer portal.
  - Access controls ensure practitioners see only assigned case content.
- **Notifications & Guidance**:
  - In-app alerts + email summaries for each milestone (fee paid, manager assigned, lawyer assigned, video scheduled, escrow status).
  - Consent banner reminding users not to discuss pricing outside platform.

## Non-Functional Requirements
- Scalable, component-based front-end using modern UI kit.
- Responsive design optimized for desktop/tablet, accessible color contrast & semantics.
- Audit trail & compliance-ready logging for financial/legal transactions.
- Localization-ready copy (initially English).
- Extensible architecture for future integrations (payment gateways, document OCR, video APIs).

## Initial Release Scope (MVP)
- Front-end prototype with mocked data/state for:
  - Auth gate (placeholder login form).
  - Service catalogue selection.
  - Fee payment confirmation modal.
  - Case manager + practitioner assignment timeline.
  - Video consultation scheduling interface (mock scheduling component).
  - Document vault viewer & upload placeholder.
  - Escrow status tracker with milestone progress bar.
- Support files: README, architecture notes, component tests, and lint-ready project setup.
