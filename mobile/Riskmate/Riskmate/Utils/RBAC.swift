import Foundation

/// RBAC: Role-Based Access Control for Riskmate (Web + iOS).
/// Permissions are derived from the current user's role string (from entitlements or team API).
///
/// Roles: Member = do the work | Safety Lead = validate | Executive = visibility + exports
///        Admin = configure + manage | Owner = god mode
struct RBAC {
    let role: String

    init(role: String?) {
        self.role = (role ?? "member").lowercased()
    }

    // MARK: - Operations

    /// Can upload evidence, complete controls, create/edit jobs (field execution).
    var canUploadEvidence: Bool {
        switch role {
        case "owner", "admin", "safety_lead", "member": return true
        case "executive": return false
        default: return true
        }
    }

    /// Can trigger export (PDF / proof pack) for a job. All roles that can view can trigger per spec.
    var canExport: Bool { true }

    /// Can export ledger (audit trail JSON/CSV). Member cannot; Safety Lead+ can (scoped or org-wide).
    var canExportLedger: Bool {
        switch role {
        case "member": return false
        case "safety_lead", "executive", "admin", "owner": return true
        default: return false
        }
    }

    /// Can approve readiness / mark "insurance-ready".
    var canApproveReadiness: Bool {
        switch role {
        case "owner", "admin", "safety_lead": return true
        case "member", "executive": return false
        default: return false
        }
    }

    /// Can delete jobs (soft or hard). Backend enforces owner for hard-delete.
    var canDeleteJobs: Bool {
        switch role {
        case "owner", "admin": return true
        default: return false
        }
    }

    // MARK: - Team

    /// Can see the invite form (owner/admin/safety_lead). Safety Lead can invite member only.
    var canInvite: Bool {
        switch role {
        case "owner", "admin", "safety_lead": return true
        case "executive", "member": return false
        default: return false
        }
    }

    /// Can invite a specific role. Owner → any; Admin → member, safety_lead, executive; Safety Lead → member only.
    func canInviteRole(_ target: TeamRole) -> Bool {
        switch role {
        case "owner": return true
        case "admin": return target != .owner
        case "safety_lead": return target == .member
        default: return false
        }
    }

    /// Roles the current user can invite (for role picker).
    var inviteableRoles: [TeamRole] {
        switch role {
        case "owner": return TeamRole.allCases
        case "admin": return [.member, .safetyLead, .executive]
        case "safety_lead": return [.member]
        default: return []
        }
    }

    /// Can remove/deactivate teammates (owner/admin only).
    var canRemoveMember: Bool {
        role == "owner" || role == "admin"
    }

    /// Can change other users' roles (admin/owner only; only owner can set owner).
    var canChangeRoles: Bool {
        role == "owner" || role == "admin"
    }

    /// Can manage billing (owner only).
    var canManageBilling: Bool {
        role == "owner"
    }

    /// Can view org settings (read-only for executive/safety_lead; edit for admin/owner).
    var canViewOrgSettings: Bool {
        switch role {
        case "owner", "admin", "executive", "safety_lead": return true
        case "member": return false
        default: return false
        }
    }

    /// Is read-only for operations (Executive: view + export only).
    var isOperationsReadOnly: Bool {
        role == "executive"
    }
}
