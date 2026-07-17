import type { Escalation, TeamMember } from "./types";

export function isAdmin(member: Pick<TeamMember, "role">): boolean {
  return member.role === "admin";
}

/**
 * Edit/close rule: every active team member can VIEW every escalation;
 * only the assigned owner or an admin (Elena) can modify one.
 */
export function canEditEscalation(
  member: Pick<TeamMember, "id" | "role">,
  escalation: Pick<Escalation, "owner_id">
): boolean {
  return isAdmin(member) || escalation.owner_id === member.id;
}
