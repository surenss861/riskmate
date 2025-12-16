"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STRIPE_PLAN_MAP = void 0;
exports.limitsFor = limitsFor;
function limitsFor(plan) {
    switch (plan) {
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
    'prod_TOfxlypTNXZNhB': 'starter', // Starter – $29/mo
    'prod_TOfx6fhO40IMoF': 'pro', // Pro – $59/mo
    'prod_TOfy8NLmOTOaYl': 'business', // Business – $129/mo
};
//# sourceMappingURL=planRules.js.map