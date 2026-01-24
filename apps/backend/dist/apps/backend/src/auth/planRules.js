"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STRIPE_PLAN_MAP = void 0;
exports.limitsFor = limitsFor;
function limitsFor(plan) {
    switch (plan) {
        case 'none':
            return {
                seats: 0,
                jobsMonthly: 0,
                features: [] // No plan: no features
            };
        case 'starter':
            return {
                seats: 1,
                jobsMonthly: 10,
                features: ['share_links']
            };
        case 'pro':
            return {
                seats: 5,
                jobsMonthly: null,
                features: ['branded_pdfs', 'share_links', 'notifications']
            };
        case 'business':
            return {
                seats: null,
                jobsMonthly: null,
                features: [
                    'branded_pdfs',
                    'share_links',
                    'notifications',
                    'analytics',
                    'permit_pack',
                    'audit_logs',
                    'priority_support'
                ]
            };
    }
}
exports.STRIPE_PLAN_MAP = {
    'prod_TpcwqnpnlA9keA': 'starter', // Starter
    'prod_TpcyAbLnS5VDz7': 'pro', // Pro
    'prod_TpczVi0pxfQhfH': 'business', // Business
};
//# sourceMappingURL=planRules.js.map