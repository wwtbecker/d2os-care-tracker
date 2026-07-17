/**
 * Synthetic seed data for local testing — FICTIONAL accounts only.
 *
 * Usage:
 *   npm run seed:dev            # clears previous seed data, then reseeds
 *   npm run seed:dev -- --clear # clears seed data only
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (read from .env.local
 * via node --env-file-if-exists, or from the shell environment).
 *
 * Everything this script creates is tagged with a `SEED-` Gainsight ID on
 * the account, so clearing is exact: escalations (and their comments,
 * touchpoints, notifications, and AI outputs, via FK cascade) hang off the
 * seeded accounts, and matching audit rows are removed explicitly.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Put them in .env.local or export them."
  );
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const clearOnly = process.argv.includes("--clear");

// ---------------------------------------------------------------------------
// Date helpers — everything is relative to "now" so a reseed always produces
// fresh overdue/onside cadences and a live-looking trend chart.
// ---------------------------------------------------------------------------
const DAY = 86_400_000;
const dateAgo = (days) => new Date(Date.now() - days * DAY).toISOString().slice(0, 10);
const dateAhead = (days) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10);
const tsAgo = (days, hour = 15) => {
  const d = new Date(Date.now() - days * DAY);
  d.setUTCHours(hour, (days * 7) % 60, 0, 0);
  return d.toISOString();
};

async function must(promise, context) {
  const { data, error } = await promise;
  if (error) {
    console.error(`${context}: ${error.message}`);
    process.exit(1);
  }
  return data;
}

// ---------------------------------------------------------------------------
// Clear previous seed data
// ---------------------------------------------------------------------------
async function clearSeedData() {
  const accounts = await must(
    db.from("accounts").select("id").like("gainsight_id", "SEED-%"),
    "Finding seeded accounts"
  );
  if (accounts.length === 0) {
    console.log("No previous seed data found.");
    return;
  }
  const accountIds = accounts.map((a) => a.id);

  const escalations = await must(
    db.from("escalations").select("id").in("account_id", accountIds),
    "Finding seeded escalations"
  );
  const escalationIds = escalations.map((e) => e.id);

  if (escalationIds.length > 0) {
    // audit_log has no FK cascade — clean explicitly.
    await must(
      db.from("audit_log").delete().in("escalation_id", escalationIds),
      "Clearing seeded audit rows"
    );
    // Comments, touchpoints, notifications, and ai_outputs cascade.
    await must(
      db.from("escalations").delete().in("id", escalationIds),
      "Clearing seeded escalations"
    );
  }
  await must(
    db.from("accounts").delete().in("id", accountIds),
    "Clearing seeded accounts"
  );
  console.log(
    `Cleared ${escalationIds.length} escalations across ${accountIds.length} seeded accounts.`
  );
}

// ---------------------------------------------------------------------------
// Fictional accounts (no real WWT clients)
// ---------------------------------------------------------------------------
const ACCOUNTS = [
  { name: "Meridian Health Partners", gainsight_id: "SEED-MHP-001", industry: "Healthcare" },
  { name: "Helix BioSciences", gainsight_id: "SEED-HBX-002", industry: "Life Sciences" },
  { name: "Blue Harbor Logistics", gainsight_id: "SEED-BHL-003", industry: "Transportation & Logistics" },
  { name: "Crestline Financial Group", gainsight_id: "SEED-CFG-004", industry: "Financial Services" },
  { name: "Ironvale Manufacturing", gainsight_id: "SEED-IVM-005", industry: "Manufacturing" },
  { name: "Solara Energy Systems", gainsight_id: "SEED-SES-006", industry: "Energy & Utilities" },
  { name: "Northgate Retail Co.", gainsight_id: "SEED-NRC-007", industry: "Retail" },
];

// ---------------------------------------------------------------------------
// Escalation specs. Owners are referenced by roster email; descriptions are
// intentionally messy (pasted-email fragments, ticket refs, half-sentences)
// so AI summarization and tier suggestion have realistic material.
// ---------------------------------------------------------------------------
const E = {
  elena: "elena.vitkin@wwt.com",
  will: "will.feil@wwt.com",
  jamell: "jamell.mixon@wwt.com",
  scott: "scott.moyer@wwt.com",
  chris: "chris.nickl@wwt.com",
  tara: "tara.maher@wwt.com",
};

const ESCALATIONS = [
  // ------------------------------------------------------------- Care 1 (5)
  {
    account: "Northgate Retail Co.",
    title: "Recurring questions on monthly ops report format",
    tier: "care_1",
    type: "risk_warning",
    status: "open",
    owner: E.tara,
    openedDaysAgo: 6,
    targetInDays: 20,
    description:
      "Store ops team keeps coming back on the monthly report — third email thread this quarter about the same thing. They want outage minutes broken out by region instead of by store banner, and honestly the template we inherited from the old engagement doesn't do either cleanly. Latest ask from Dana W. (their ops analyst): \"can we get this before the Oct planning cycle, leadership keeps asking why the numbers don't match what IT sends.\" Low urgency but it's becoming a credibility papercut. No SLA exposure. Need to decide whether we adjust the template ourselves or route through the reporting backlog.",
  },
  {
    account: "Crestline Financial Group",
    title: "Clarification on patch window policy for branch routers",
    tier: "care_1",
    type: null,
    status: "open",
    owner: E.scott,
    openedDaysAgo: 3,
    targetInDays: 12,
    description:
      "Their infra manager (R. Okafor) flagged confusion after the Sept maintenance notice — they thought branch router patching was quarterly, our runbook says monthly for critical CVEs. Nobody's wrong exactly, the SOW language is ambiguous (\"periodic remediation aligned to vendor guidance\"). He's asked for it in writing before their internal audit in November. Email-level, but if we fumble the answer it touches the audit finding from last year, which their CISO still brings up on every QBR.",
  },
  {
    account: "Ironvale Manufacturing",
    title: "License true-up questions ahead of renewal",
    tier: "care_1",
    type: null,
    status: "in_progress",
    owner: E.will,
    openedDaysAgo: 14,
    targetInDays: 7,
    description:
      "Procurement asked for a reconciliation of monitoring agent licenses vs. actual deployed count — their number says 2,340, our CMDB export says 2,712. Gap is probably the decommissioned Plant 4 line that never got cleaned up, plus ~150 VMs from the DR test in July that are still reporting in. Not a fire, but renewal is Dec 1 and they've hinted they'll shop it if the true-up feels sloppy. Sent them the raw export Tuesday; waiting on their asset team to cross-check. Follow up if nothing by Friday.",
    comments: [
      { author: E.will, daysAgo: 10, body: "Sent CMDB export to their procurement lead. Flagged the Plant 4 decommission as the likely source of the count gap." },
      { author: E.will, daysAgo: 4, body: "Their asset team confirmed Plant 4 hosts are stale. Remaining delta ~220 licenses, mostly the July DR clones. Drafting the true-up memo." },
    ],
  },
  {
    account: "Solara Energy Systems",
    title: "Documentation request — as-built diagrams for substation network refresh",
    tier: "care_1",
    type: null,
    status: "resolved",
    owner: E.jamell,
    openedDaysAgo: 30,
    targetInDays: -10,
    resolvedDaysAgo: 12,
    description:
      "NERC compliance folks needed the as-built topology diagrams for the six substations refreshed in phase 2 — the ones delivered at closeout were the design-phase versions, not as-built. Two sites had port assignments that changed during cutover and never made it back into the docs. They were polite about it but firm: needed before their internal compliance review. Coordinated with the delivery engineer to re-export from the source of truth and get signoff.",
    comments: [
      { author: E.jamell, daysAgo: 20, body: "Delivery team located the as-built versions for 4 of 6 sites. Remaining two (Cedar Ridge, Millbrook) need re-verification of port maps." },
      { author: E.jamell, daysAgo: 12, body: "All six as-built diagrams delivered and acknowledged by their compliance lead. Resolving.", status: "resolved" },
    ],
  },
  {
    account: "Blue Harbor Logistics",
    title: "Invoice line-item mismatch on August managed services bill",
    tier: "care_1",
    type: null,
    status: "archived",
    owner: E.tara,
    openedDaysAgo: 55,
    targetInDays: -40,
    resolvedDaysAgo: 38,
    archived: true,
    description:
      "AP flagged a $4,120 delta between the August invoice and the PO — turned out to be the emergency after-hours support from the Aug 9 outage billed under the wrong line item. Straightforward once finance traced it, but it took three emails and a call because their AP portal auto-rejected the corrected invoice. Resolved with a credit memo + rebill.",
  },

  // ------------------------------------------------------------- Care 2 (7)
  {
    account: "Meridian Health Partners",
    title: "Wireless drops in clinical areas — nurses reverting to workstations on wheels",
    tier: "care_2",
    type: "operational_problem",
    status: "in_progress",
    owner: E.will,
    openedDaysAgo: 18,
    targetInDays: 10,
    cadenceDays: 1,
    nextCadenceInDays: -2, // OVERDUE
    description:
      "Escalated out of normal support after ticket INC-448213 reopened for the 4th time. Clinical staff at the Riverside campus report intermittent wifi drops on the med-surg floors, mostly 6-8am and again around shift change. Their CMIO got involved after a nurse documented a delayed medication scan. RF survey from 2019 is stale — they've added telemetry devices, two nurse call upgrades, and a patient entertainment system on the same 5GHz space since then. Vendor TAC says firmware, our wireless SME suspects channel utilization + a misbehaving DFS radar detect on channels 52-64. Daily working sessions running. Customer exec sponsor (VP Clinical Informatics) wants a verbal update every morning until scan reliability is back over 99%.",
    comments: [
      { author: E.will, daysAgo: 15, body: "Working session #1: pulled controller logs, confirmed DFS events clustering on the med-surg APs between 05:40-06:20. Not firmware. Asked their facilities team about the new patient monitoring gateway installed in May." },
      { author: E.will, daysAgo: 9, body: "Facilities confirmed the monitoring gateway vendor set their bridge radios to auto channel. That's the interferer. Vendor call scheduled." },
      { author: E.elena, daysAgo: 8, body: "Flagging for possible Care 3 if the vendor drags — CMIO mentioned this at their steering committee. Keep daily cadence tight." },
    ],
    touchpoints: [
      { daysAgo: 4, notes: "Vendor agreed to static channel plan for the bridge radios; change window requested for this weekend. Nurse-reported drops down from ~12/day to 4/day.", actionItems: "- Confirm change window approval\n- Re-run partial RF survey on floors 3-4 after change", nextInDays: -2 },
      { daysAgo: 8, notes: "Joint call with monitoring gateway vendor. They acknowledged auto-channel behavior. Interim: moved our APs off channels 52-64.", actionItems: "- Vendor to propose static channel plan by Thursday", nextInDays: -6 },
    ],
    notifyCadenceDue: true,
  },
  {
    account: "Blue Harbor Logistics",
    title: "Warehouse scanner latency degrading pick rates at the Savannah DC",
    tier: "care_2",
    type: "operational_problem",
    status: "in_progress",
    owner: E.jamell,
    openedDaysAgo: 11,
    targetInDays: 5,
    cadenceDays: 2,
    nextCadenceInDays: -1, // OVERDUE
    description:
      "Ops director called Elena directly on this one (skipped the ticket queue, which tells you the mood). RF scanners in the Savannah distribution center are taking 3-6 seconds per scan confirm during peak waves vs. sub-second normally. Pick rate is down ~8% and they're heading into peak season staffing reviews. Their network team blames our managed WLAN, our monitoring shows the WLAN clean but the WMS app server (customer-managed, on-prem) is hitting swap during wave planning. Politically sticky: their app team and network team don't talk, and we're the only ones with visibility into both sides. Every-other-day working sessions with both their teams on one call — that alone is progress.",
    comments: [
      { author: E.jamell, daysAgo: 7, body: "Got both their teams on one bridge. Showed the packet captures: scan confirms leave the WLAN in <40ms, sit at the WMS server for 3+ seconds. Their app lead went quiet, then asked for the capture file." },
      { author: E.jamell, daysAgo: 3, body: "Their app team found the WMS DB stats job overlapping wave planning. Rescheduled it. Early numbers look better — confirming across tomorrow's peak wave before we call it." },
    ],
    touchpoints: [
      { daysAgo: 3, notes: "Working session: DB stats job rescheduled to 02:00. Watching tomorrow's 06:00 wave.", actionItems: "- Pull scan latency percentiles after 6am wave\n- Draft joint findings doc so this doesn't reopen as a WLAN complaint", nextInDays: -1 },
    ],
    notifyCadenceDue: true,
  },
  {
    account: "Helix BioSciences",
    title: "Lab instrument VLAN segmentation project stalled — compliance deadline at risk",
    tier: "care_2",
    type: "risk_warning",
    status: "open",
    owner: E.scott,
    openedDaysAgo: 9,
    targetInDays: 21,
    cadenceDays: 3,
    nextCadenceInDays: -4, // OVERDUE (stale — good test data)
    description:
      "Their QA/compliance team committed to segmenting lab instruments off the corporate network by end of quarter (FDA audit prep, follows a 483 observation last year — sensitive topic, do not put '483' in anything customer-facing without checking with their QA director first). Project is stalled: instrument vendors won't confirm which ports/protocols their analyzers need, and their lab managers won't approve maintenance windows during active studies. We're caught in the middle holding the network design. Three cadence sessions in and the port matrix is still 60% unknowns. Risk: if this slips past the quarter, their compliance team has told us it goes on the audit readiness report with our name in the blocker column.",
    comments: [
      { author: E.scott, daysAgo: 5, body: "Cadence #3: still blocked on vendor port matrices for the Beckman and Waters instruments. Proposed we packet-capture a representative instrument of each type instead of waiting. Their lab IT liked it; QA needs to approve capture on validated systems." },
    ],
    touchpoints: [
      { daysAgo: 5, notes: "Proposed passive capture approach to unblock the port matrix. QA approval pending — their SOP requires a change assessment even for passive taps on validated instrument networks.", actionItems: "- Scott: draft capture plan QA can review\n- Customer: QA decision by Friday\n- Escalate cadence to daily if no decision", nextInDays: -4 },
  ],
    notifyCadenceDue: true,
  },
  {
    account: "Crestline Financial Group",
    title: "Branch SD-WAN failover flaps during carrier maintenance windows",
    tier: "care_2",
    type: "operational_problem",
    status: "open",
    owner: E.tara,
    openedDaysAgo: 5,
    targetInDays: 14,
    cadenceDays: 2,
    nextCadenceInDays: 1, // on time
    description:
      "Twelve branches flapped between primary and LTE backup four times during last Tuesday's carrier maintenance, and each flap drops their teller platform sessions for ~90 seconds. Carrier says maintenance was announced (it was, buried in a portal nobody checks). The real issue is our failover thresholds are tuned for hard failures, not brownout-style packet loss during maintenance. Branch ops VP wants a plan before the next maintenance window on the 28th. Daily-ish cadence agreed; their network engineer joins, plus carrier account team every other session.",
    touchpoints: [
      { daysAgo: 1, notes: "Kickoff cadence session. Agreed test plan: adjust BFD timers + loss thresholds on 2 pilot branches, observe through the 28th maintenance window.", actionItems: "- Push pilot config Thursday night\n- Carrier to provide maintenance calendar API access", nextInDays: 1 },
    ],
  },
  {
    account: "Ironvale Manufacturing",
    title: "Plant floor switch failures — aging hardware, no spares on site",
    tier: "care_2",
    type: "risk_warning",
    status: "in_progress",
    owner: E.chris,
    openedDaysAgo: 24,
    targetInDays: 3,
    cadenceDays: 2,
    nextCadenceInDays: 2,
    description:
      "Second access switch failure on the stamping line in five weeks — both were the same end-of-sale model running in a hot cabinet that peaks at 47C in summer. Line was down 40 min waiting for a spare to be driven over from the Columbus depot. Plant manager's math: ~$18k/hr of downtime. They deferred the refresh two budget cycles in a row and now it's biting. We set up every-other-day checkpoints while we (a) stage spares on site, (b) fast-track a refresh quote for the 14 highest-risk closets, (c) get environmental sensors into the worst cabinets so we stop flying blind on heat.",
    comments: [
      { author: E.chris, daysAgo: 18, body: "Spares staged on site (2x replacement units in the plant IT room). Refresh quote in review with our inside team." },
      { author: E.chris, daysAgo: 6, body: "Refresh quote delivered. Plant manager pushing it up to their VP Ops with our failure-cost analysis attached. Cabinet sensors installed in 6 of 14 closets so far." },
    ],
    touchpoints: [
      { daysAgo: 2, notes: "Checkpoint: sensors now in 10/14 closets. Two cabinets already flagged >45C sustained. Customer re-prioritizing HVAC work order.", actionItems: "- Finish sensor rollout by next checkpoint\n- Chase VP Ops decision on refresh quote", nextInDays: 2 },
    ],
  },
  {
    account: "Meridian Health Partners",
    title: "Telehealth video quality complaints from rural clinic sites",
    tier: "care_2",
    type: null,
    status: "resolved",
    owner: E.will,
    openedDaysAgo: 45,
    targetInDays: -20,
    resolvedDaysAgo: 8,
    cadenceDays: 2,
    description:
      "Rural clinics (5 sites) reported choppy telehealth video, worst mid-afternoon. Turned out to be a stack of small things: QoS markings stripped by an intermediate provider, one site on a saturated 50Mbps circuit that was supposed to be upgraded last year, and the telehealth client defaulting to 1080p even on constrained links. Ran a 2-day cadence for three weeks with their telehealth program manager. All five sites now stable; program manager sent a genuinely nice email, worth quoting at the QBR.",
    comments: [
      { author: E.will, daysAgo: 30, body: "QoS remarking confirmed at the aggregation provider handoff. Ticket open with them; interim policy re-marks at our edge." },
      { author: E.will, daysAgo: 8, body: "All 5 sites green for two consecutive weeks. Circuit upgrade for Fairview clinic completed Monday. Resolving with customer signoff.", status: "resolved" },
    ],
    touchpoints: [
      { daysAgo: 16, notes: "4 of 5 sites stable. Fairview still constrained pending circuit upgrade (carrier committed date received).", actionItems: "- Monitor Fairview through upgrade\n- Draft closure summary for telehealth PM", nextInDays: 14 },
    ],
  },
  {
    account: "Northgate Retail Co.",
    title: "POS network segmentation gaps found in PCI pre-assessment",
    tier: "care_2",
    type: "risk_warning",
    status: "archived",
    owner: E.scott,
    openedDaysAgo: 80,
    targetInDays: -50,
    resolvedDaysAgo: 40,
    archived: true,
    cadenceDays: 1,
    description:
      "Their QSA's pre-assessment found 14 stores where the POS VLAN could reach the guest wifi management interface — legacy ACL drift from the 2022 store network template. Not a breach, but a finding that would have failed the ROC. Ran daily cadence for two weeks: template fix, rollout to 14 stores in 4 nights, validation scans, evidence package for the QSA. Closed before the formal assessment started. Post-mortem action (template drift detection) tracked separately in the improvement backlog.",
  },

  // ------------------------------------------------------------- Care 3 (6)
  {
    account: "Crestline Financial Group",
    title: "Core trading floor outage exposure — single-homed uplinks discovered during audit",
    tier: "care_3",
    type: "executive_visibility",
    status: "in_progress",
    owner: E.scott,
    openedDaysAgo: 12,
    targetInDays: 9,
    elevatedDaysAgo: 7,
    elevatedBy: E.elena,
    description:
      "This one has board visibility on their side. During the network audit we ran as part of the managed service onboarding, we found the trading floor distribution pair is effectively single-homed — the 'redundant' uplink was moved during a 2023 office buildout and both paths now ride the same riser and the same building entrance conduit. A conduit cut or riser fire takes the whole floor down. Their head of trading technology was told at the time the redundancy was preserved (it wasn't, contractor error, before our engagement). So now: (1) genuine operational risk, regulator-reportable if it caused an outage, (2) internal blame storm on their side, (3) they need a remediation plan with dates for their risk committee mtg on the 24th. We did not create this, but we found it, and how we handle the next three weeks defines the relationship. Diverse-path build requires landlord approval + a second building entrance — long-lead items. Interim mitigations (wireless backhaul, temporary fiber via parking structure) under evaluation.",
    comments: [
      { author: E.scott, daysAgo: 12, body: "Audit finding confirmed with fiber tracing — both uplinks share the east riser above floor 9 and the single Broad St entrance conduit. Photos and trace docs in the engagement folder." },
      { author: E.scott, daysAgo: 10, body: "Briefed their head of trading tech. Difficult call — the 2023 buildout claim came up immediately. Kept us on the facts: what exists today, what it would take to fix. He asked for a written risk statement he can take to the risk committee." },
      { author: E.elena, daysAgo: 7, body: "Elevating for executive visibility ahead of their risk committee on the 24th. We need our leadership aware before their CIO calls ours, not after.", status: "in_progress" },
      { author: E.scott, daysAgo: 5, body: "Risk statement delivered. Three remediation options priced: (A) diverse riser + second entrance, 14-18 wks, landlord dependency. (B) licensed wireless backhaul as interim, 3-4 wks. (C) temporary fiber via parking structure, 6 wks, right-of-way question. Recommending B now + A as permanent." },
      { author: E.elena, daysAgo: 2, body: "Their CIO called. Tone was good — they see us as the ones who caught it, not caused it. They want option B mobilized this month and A scoped formally. Keep the risk committee deck factual; their internal review of the 2023 contractor is not our lane." },
    ],
  },
  {
    account: "Helix BioSciences",
    title: "Repeated data center cooling alarms threatening GxP system availability",
    tier: "care_3",
    type: "executive_visibility",
    status: "open",
    owner: E.jamell,
    openedDaysAgo: 4,
    targetInDays: 17,
    description:
      "Three thermal alarms in their primary DC in ten days — CRAC unit 2 is failing and the room is running on N, not N+1. The DC hosts validated GxP systems (LIMS, chromatography data system); an availability event triggers deviation reports and potentially impacts batch release timelines. Their VP IT asked for this to be tracked at executive level on our side even though the CRAC repair itself is their facilities vendor's problem — what they want from us is (a) a workload migration plan if unit 2 dies before parts arrive (ETA 3 weeks, single-sourced compressor), (b) network readiness at the DR site, which we manage, and (c) someone senior on our side who already knows the story if this goes red on a weekend. NOT yet elevated to our exec chain — Elena wants one more datapoint on the parts ETA before pulling that lever. Flagged for executive reporting so it's on the weekly deck regardless.",
    execReporting: true,
    comments: [
      { author: E.jamell, daysAgo: 3, body: "DR site network validated for the three GxP workloads — VLANs, firewall rules, and storage replication links all green. Runbook for emergency migration drafted, needs their QA review since it touches validated systems." },
      { author: E.jamell, daysAgo: 1, body: "Facilities vendor now saying compressor ETA might improve to 10 days. Elena holding on formal elevation until Friday's ETA confirmation." },
    ],
  },
  {
    account: "Solara Energy Systems",
    title: "Grid ops center failover test failure — DR site did not take over cleanly",
    tier: "care_3",
    type: "executive_visibility",
    status: "in_progress",
    owner: E.chris,
    openedDaysAgo: 8,
    targetInDays: 12,
    description:
      "Quarterly DR test for the grid operations center failed: SCADA visualization came up at the DR site but operator consoles couldn't authenticate for 22 minutes (RADIUS dependency on a domain controller that hadn't replicated). In a real event that's 22 minutes of reduced grid visibility — their compliance team classifies that as reportable if it happens for real. CIO-level attention on their side; they've asked for a corrective action plan and a re-test within 30 days. Root cause split: replication topology (their AD team) + our failover runbook not validating auth before declaring the site ready. Owning our half loudly and helping them with theirs quietly.",
    execReporting: true,
    comments: [
      { author: E.chris, daysAgo: 6, body: "Joint RCA session done. Runbook gap acknowledged: our validation checklist tests app reachability, not end-to-end operator login. Adding synthetic auth transaction to the checklist." },
      { author: E.chris, daysAgo: 2, body: "Corrective action plan drafted: runbook v2 with auth validation, their AD team fixing replication ordering, re-test scheduled for the 19th. Sending to their compliance liaison for review." },
    ],
  },
  {
    account: "Meridian Health Partners",
    title: "EHR upgrade weekend — network readiness executive oversight",
    tier: "care_3",
    type: "executive_visibility",
    status: "open",
    owner: E.will,
    openedDaysAgo: 2,
    targetInDays: 25,
    description:
      "Their EHR major version upgrade is scheduled in four weeks (go-live weekend, all campuses). Last upgrade (2023, before our engagement) had a 6-hour registration outage traced to a firewall state table exhaustion nobody had load-tested. Their CIO explicitly asked for executive-level tracking on our side: network readiness testing, on-call staffing plan for the weekend, and a named escalation path that doesn't route through the general NOC queue. Opened at Care 3 for visibility rather than because anything is wrong — this is preventive executive tracking, elevation decision stays with Elena if risks materialize during readiness testing.",
    execReporting: true,
  },
  {
    account: "Blue Harbor Logistics",
    title: "Ransomware near-miss — segmentation and recovery gaps exposed",
    tier: "care_3",
    type: "executive_visibility",
    status: "resolved",
    owner: E.jamell,
    openedDaysAgo: 60,
    targetInDays: -30,
    resolvedDaysAgo: 15,
    elevatedDaysAgo: 55,
    elevatedBy: E.jamell,
    description:
      "Their SOC caught credential-stuffing activity that got as far as a jump host with flat access to the warehouse OT network before it was contained — no encryption event, but the post-incident review found the segmentation between corp IT and warehouse OT was policy-on-paper only. C-suite attention immediately. We ran the network remediation workstream: emergency segmentation rules within 72 hours, then a 6-week hardening program (OT VLAN isolation, jump host redesign, break-glass access procedure). Closed with a joint readout to their exec team. Their CISO used the phrase 'this is why we pay for the partnership' — capture that for the renewal narrative.",
    comments: [
      { author: E.jamell, daysAgo: 55, body: "Elevated same-day given C-suite attention on their side. Emergency ACLs isolating OT from the compromised segment deployed and verified." },
      { author: E.jamell, daysAgo: 40, body: "Hardening program week 2: jump host redesign approved, new bastion pattern deployed to staging. Weekly exec readout cadence continues." },
      { author: E.jamell, daysAgo: 15, body: "Final exec readout delivered. All 14 hardening actions closed or transitioned to steady-state ops. Resolving.", status: "resolved" },
    ],
  },
  {
    account: "Ironvale Manufacturing",
    title: "ERP migration network cutover failure — production order entry down 3 hours",
    tier: "care_3",
    type: "operational_problem",
    status: "archived",
    owner: E.chris,
    openedDaysAgo: 100,
    targetInDays: -85,
    resolvedDaysAgo: 70,
    archived: true,
    elevatedDaysAgo: 99,
    elevatedBy: E.elena,
    description:
      "During the ERP cloud migration cutover (their SI led, we owned network), the ExpressRoute path came up asymmetric — return traffic hairpinned through the old MPLS and their firewall dropped it as spoofed. Production order entry down ~3 hours across two plants on a Monday morning. Executive bridge stood up within 20 minutes; fix was a route advertisement correction, but the blast radius made it a Care 3 on arrival. Post-incident: we owned the route validation gap in the cutover plan, published a corrected runbook, and ran the lessons-learned with their SI. Relationship survived — largely because the exec bridge communication was honest about our share of it from hour one.",
  },
];

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------
async function seed() {
  const roster = await must(
    db.from("team_members").select("id,email,name,role"),
    "Loading team roster"
  );
  if (roster.length === 0) {
    console.error(
      "Team roster is empty — run supabase/migrations/0001_initial_schema.sql first."
    );
    process.exit(1);
  }
  const memberByEmail = (email) => {
    const m = roster.find((r) => r.email.toLowerCase() === email.toLowerCase());
    if (!m) {
      console.error(`Roster member ${email} not found — did the seed migration run?`);
      process.exit(1);
    }
    return m;
  };
  const admins = roster.filter((r) => r.role === "admin");

  // Accounts
  const accountRows = await must(
    db
      .from("accounts")
      .insert(
        ACCOUNTS.map((a) => ({
          ...a,
          source: "manual",
          notes: "Synthetic seed account for local testing — safe to delete.",
        }))
      )
      .select("id,name"),
    "Inserting accounts"
  );
  const accountByName = new Map(accountRows.map((a) => [a.name, a.id]));

  let commentCount = 0;
  let touchpointCount = 0;
  let notificationCount = 0;

  for (const spec of ESCALATIONS) {
    const owner = memberByEmail(spec.owner);
    const elevatedBy = spec.elevatedBy ? memberByEmail(spec.elevatedBy) : null;
    const isCare3 = spec.tier === "care_3";

    const escalation = await must(
      db
        .from("escalations")
        .insert({
          account_id: accountByName.get(spec.account),
          account_name: spec.account,
          title: spec.title,
          description: spec.description,
          tier_key: spec.tier,
          type_key: spec.type ?? null,
          status: spec.archived ? "archived" : spec.status,
          owner_id: owner.id,
          created_by: owner.id,
          opened_at: dateAgo(spec.openedDaysAgo),
          target_resolution_date:
            spec.targetInDays >= 0 ? dateAhead(spec.targetInDays) : dateAgo(-spec.targetInDays),
          resolved_at: spec.resolvedDaysAgo != null ? tsAgo(spec.resolvedDaysAgo) : null,
          // Archived ~14 days after resolution (mirrors the auto-archive job).
          archived_at: spec.archived
            ? tsAgo(Math.max(1, (spec.resolvedDaysAgo ?? 15) - 14))
            : null,
          executive_reporting: isCare3 || spec.execReporting === true,
          elevated_at: spec.elevatedDaysAgo != null ? tsAgo(spec.elevatedDaysAgo) : null,
          elevated_by: elevatedBy?.id ?? null,
          cadence_days: spec.cadenceDays ?? null,
          next_cadence_date:
            spec.nextCadenceInDays != null
              ? spec.nextCadenceInDays >= 0
                ? dateAhead(spec.nextCadenceInDays)
                : dateAgo(-spec.nextCadenceInDays)
              : null,
        })
        .select("id")
        .single(),
      `Inserting escalation "${spec.title}"`
    );

    // Audit: creation entry for every record.
    await must(
      db.from("audit_log").insert({
        actor_id: owner.id,
        action: "escalation.created",
        escalation_id: escalation.id,
        details: { tier: spec.tier, account: spec.account, seed: true },
        created_at: tsAgo(spec.openedDaysAgo, 14),
      }),
      "Inserting audit row"
    );

    for (const c of spec.comments ?? []) {
      const author = memberByEmail(c.author);
      await must(
        db.from("escalation_comments").insert({
          escalation_id: escalation.id,
          author_id: author.id,
          body: c.body,
          status_context: c.status ?? spec.status,
          created_at: tsAgo(c.daysAgo),
        }),
        "Inserting comment"
      );
      commentCount++;
    }

    for (const t of spec.touchpoints ?? []) {
      await must(
        db.from("cadence_touchpoints").insert({
          escalation_id: escalation.id,
          touchpoint_date: dateAgo(t.daysAgo),
          notes: t.notes,
          action_items: t.actionItems ?? null,
          next_cadence_date:
            t.nextInDays != null
              ? t.nextInDays >= 0
                ? dateAhead(t.nextInDays)
                : dateAgo(-t.nextInDays)
              : null,
          created_by: owner.id,
          created_at: tsAgo(t.daysAgo, 17),
        }),
        "Inserting touchpoint"
      );
      touchpointCount++;
    }

    if (spec.elevatedDaysAgo != null) {
      await must(
        db.from("audit_log").insert({
          actor_id: elevatedBy?.id ?? owner.id,
          action: "escalation.elevated",
          escalation_id: escalation.id,
          details: { seed: true, chain_enabled: false },
          created_at: tsAgo(spec.elevatedDaysAgo, 16),
        }),
        "Inserting elevation audit row"
      );
      for (const admin of admins) {
        if (admin.id === (elevatedBy?.id ?? owner.id)) continue;
        await must(
          db.from("notifications").insert({
            recipient_id: admin.id,
            escalation_id: escalation.id,
            kind: "elevation",
            title: `Care 3 elevated: ${spec.account}`,
            body: `${(elevatedBy ?? owner).name} elevated “${spec.title}” for leadership visibility.`,
            created_at: tsAgo(spec.elevatedDaysAgo, 16),
            read_at: spec.elevatedDaysAgo > 10 ? tsAgo(spec.elevatedDaysAgo - 1) : null,
          }),
          "Inserting elevation notification"
        );
        notificationCount++;
      }
    }

    if (spec.notifyCadenceDue) {
      await must(
        db.from("notifications").insert({
          recipient_id: owner.id,
          escalation_id: escalation.id,
          kind: "cadence_due",
          title: `Touchpoint due: ${spec.account}`,
          body: `Care 2 cadence touchpoint for “${spec.title}” is due.`,
        }),
        "Inserting cadence notification"
      );
      notificationCount++;
    }
  }

  console.log("Seed complete:");
  console.log(`  ${ACCOUNTS.length} fictional accounts`);
  console.log(`  ${ESCALATIONS.length} escalations (Care 1/2/3 mix, incl. overdue cadences, an elevated Care 3 with full history, resolved + archived records)`);
  console.log(`  ${commentCount} notes, ${touchpointCount} touchpoints, ${notificationCount} notifications`);
  console.log("\nRe-run `npm run seed:dev` any time to refresh; `npm run seed:dev -- --clear` to remove.");
}

// ---------------------------------------------------------------------------
await clearSeedData();
if (!clearOnly) await seed();
