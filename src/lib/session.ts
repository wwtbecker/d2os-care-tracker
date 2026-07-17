import { redirect } from "next/navigation";
import { auth } from "@/auth";

export interface SessionMember {
  id: string;
  role: "admin" | "csm";
  name: string;
  email: string;
}

/**
 * Page-level guard. Redirects to /login when unauthenticated and to
 * /no-access when the Okta identity is not on the active team roster.
 */
export async function requireMember(): Promise<SessionMember> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.memberId || !session.user.role) redirect("/no-access");
  return {
    id: session.user.memberId,
    role: session.user.role,
    name: session.user.name ?? session.user.email ?? "Unknown",
    email: session.user.email ?? "",
  };
}

export async function requireAdmin(): Promise<SessionMember> {
  const member = await requireMember();
  if (member.role !== "admin") redirect("/");
  return member;
}

/**
 * API-route guard. Returns the member, or null after the caller should have
 * short-circuited with the provided response.
 */
export async function requireMemberApi(): Promise<
  { member: SessionMember; response: null } | { member: null; response: Response }
> {
  const session = await auth();
  if (!session?.user) {
    return { member: null, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!session.user.memberId || !session.user.role) {
    return { member: null, response: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return {
    member: {
      id: session.user.memberId,
      role: session.user.role,
      name: session.user.name ?? session.user.email ?? "Unknown",
      email: session.user.email ?? "",
    },
    response: null,
  };
}
