/** In-browser port of server/app/permissions.py (sector-first access model, BRD §7). */

export interface User {
  id: string
  name: string
  title: string
  role: string
  sector: string
}

export const isEnterpriseAdmin = (user: User) => user.role === "enterprise_admin"

export function contentClause(user: User, alias = "c", idExpr?: string): [string, unknown[]] {
  const id = idExpr ?? `${alias}.id`
  // Archived content is hidden from everyone, Enterprise Admins included (see permissions.py).
  if (isEnterpriseAdmin(user)) return [`${alias}.approval_status != 'archived'`, []]
  return [
    `(${alias}.approval_status != 'archived' AND (${alias}.sector = ? OR (${alias}.is_restricted = 0 AND ${alias}.approval_status = 'approved' AND ` +
      `(${alias}.visibility = 'enterprise' OR (${alias}.visibility = 'shared' AND EXISTS ` +
      `(SELECT 1 FROM content_shares cs WHERE cs.content_id = ${id} AND cs.sector = ?))))))`,
    [user.sector, user.sector],
  ]
}

export function opportunityClause(user: User, facetAlias = "f"): [string, unknown[]] {
  if (isEnterpriseAdmin(user)) return ["1 = 1", []]
  return [`(${facetAlias}.is_restricted = 0 OR ${facetAlias}.sector = ?)`, [user.sector]]
}

export const canEdit = (user: User, item: { sector: string }) => isEnterpriseAdmin(user) || item.sector === user.sector

export const canApprove = (user: User, sector: string | null | undefined) =>
  isEnterpriseAdmin(user) || (user.role === "sector_admin" && user.sector === sector)
