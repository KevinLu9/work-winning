"""Sector-first access model (BRD §7). Every query that returns content or opportunities
must include one of these clauses.

Content is visible when the viewer is an Enterprise Admin, or it originates in the viewer's
sector, or it is approved, carries no restricted flags, and is either Enterprise-wide or
Shared with the viewer's sector.
"""


def is_enterprise_admin(user) -> bool:
    return user["role"] == "enterprise_admin"


def content_clause(user, alias="c", id_expr=None):
    id_expr = id_expr or f"{alias}.id"
    if is_enterprise_admin(user):
        return "1 = 1", []
    sql = (
        f"({alias}.sector = ? OR ({alias}.is_restricted = 0 AND {alias}.approval_status = 'approved' AND "
        f"({alias}.visibility = 'enterprise' OR ({alias}.visibility = 'shared' AND EXISTS "
        f"(SELECT 1 FROM content_shares cs WHERE cs.content_id = {id_expr} AND cs.sector = ?)))))"
    )
    return sql, [user["sector"], user["sector"]]


def opportunity_clause(user, facet_alias="f"):
    """Salesforce Visibility_Classification__c = Restricted limits an opportunity to its Division."""
    if is_enterprise_admin(user):
        return "1 = 1", []
    return f"({facet_alias}.is_restricted = 0 OR {facet_alias}.sector = ?)", [user["sector"]]


def can_edit(user, item) -> bool:
    return is_enterprise_admin(user) or item["sector"] == user["sector"]


def can_approve(user, sector) -> bool:
    return is_enterprise_admin(user) or (user["role"] == "sector_admin" and user["sector"] == sector)
