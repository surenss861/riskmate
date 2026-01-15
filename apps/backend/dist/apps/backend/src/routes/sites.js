"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sitesRouter = void 0;
const express_1 = __importDefault(require("express"));
const supabaseClient_1 = require("../lib/supabaseClient");
const auth_1 = require("../middleware/auth");
const audit_1 = require("../middleware/audit");
const errorResponse_1 = require("../utils/errorResponse");
exports.sitesRouter = express_1.default.Router();
// GET /api/sites
// Returns all sites for the organization
exports.sitesRouter.get("/", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    const requestId = authReq.requestId || 'unknown';
    try {
        const { organization_id } = authReq.user;
        const { data, error } = await supabaseClient_1.supabase
            .from("sites")
            .select("*")
            .eq("organization_id", organization_id)
            .eq("archived", false)
            .order("name", { ascending: true });
        if (error)
            throw error;
        res.json({ data: data || [] });
    }
    catch (err) {
        console.error("Sites fetch failed:", err);
        const { response: errorResponse, errorId } = (0, errorResponse_1.createErrorResponse)({
            message: "Failed to fetch sites",
            internalMessage: err?.message || String(err),
            code: "SITES_FETCH_FAILED",
            requestId,
            statusCode: 500,
        });
        res.setHeader('X-Error-ID', errorId);
        res.status(500).json(errorResponse);
    }
});
// POST /api/sites
// Creates a new site
exports.sitesRouter.post("/", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    const requestId = authReq.requestId || 'unknown';
    try {
        const { organization_id, id: userId } = authReq.user;
        const { name, address, city, state, postal_code, contact_name, contact_email, contact_phone } = req.body;
        if (!name) {
            const { response: errorResponse, errorId } = (0, errorResponse_1.createErrorResponse)({
                message: "Site name is required",
                internalMessage: "Site creation attempted without name",
                code: "VALIDATION_ERROR",
                requestId,
                statusCode: 400,
            });
            res.setHeader('X-Error-ID', errorId);
            return res.status(400).json(errorResponse);
        }
        const { data, error } = await supabaseClient_1.supabase
            .from("sites")
            .insert({
            organization_id,
            name,
            address,
            city,
            state,
            postal_code,
            contact_name,
            contact_email,
            contact_phone,
            created_by: userId,
        })
            .select()
            .single();
        if (error)
            throw error;
        await (0, audit_1.recordAuditLog)({
            organizationId: organization_id,
            actorId: userId,
            eventName: "site.created",
            targetType: "site",
            targetId: data.id,
            metadata: { site_name: name },
        });
        res.json({ data });
    }
    catch (err) {
        console.error("Site creation failed:", err);
        const { response: errorResponse, errorId } = (0, errorResponse_1.createErrorResponse)({
            message: "Failed to create site",
            internalMessage: err?.message || String(err),
            code: "SITE_CREATION_FAILED",
            requestId,
            statusCode: 500,
        });
        res.setHeader('X-Error-ID', errorId);
        res.status(500).json(errorResponse);
    }
});
//# sourceMappingURL=sites.js.map