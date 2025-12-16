"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.legalRouter = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const supabaseClient_1 = require("../lib/supabaseClient");
const legal_1 = require("../utils/legal");
const audit_1 = require("../middleware/audit");
exports.legalRouter = express_1.default.Router();
exports.legalRouter.get("/version", auth_1.authenticate, async (_req, res) => {
    res.json({
        version: legal_1.LEGAL_VERSION,
        updated_at: legal_1.LEGAL_UPDATED_AT,
    });
});
exports.legalRouter.get("/status", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    res.json({
        accepted: authReq.user.legalAccepted,
        accepted_at: authReq.user.legalAcceptedAt ?? null,
        version: legal_1.LEGAL_VERSION,
    });
});
exports.legalRouter.post("/accept", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    try {
        const { id: userId, organization_id } = authReq.user;
        const ipAddress = (0, legal_1.getClientIp)(authReq.headers) || authReq.ip;
        const { data, error } = await supabaseClient_1.supabase
            .from("legal_acceptances")
            .upsert({
            user_id: userId,
            organization_id,
            version: legal_1.LEGAL_VERSION,
            ip_address: ipAddress ?? null,
        }, { onConflict: "user_id,version" })
            .select("accepted_at")
            .single();
        if (error) {
            throw error;
        }
        (0, audit_1.recordAuditLog)({
            organizationId: organization_id,
            actorId: userId,
            eventName: "legal.accepted",
            targetType: "legal",
            metadata: {
                version: legal_1.LEGAL_VERSION,
                ip_address: ipAddress ?? null,
            },
        });
        res.json({
            accepted: true,
            version: legal_1.LEGAL_VERSION,
            accepted_at: data?.accepted_at ?? new Date().toISOString(),
        });
    }
    catch (err) {
        console.error("Legal acceptance failed:", err);
        res.status(500).json({ message: "Failed to record legal acceptance" });
    }
});
//# sourceMappingURL=legal.js.map