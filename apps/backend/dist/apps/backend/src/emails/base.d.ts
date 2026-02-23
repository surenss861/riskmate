export interface EmailTemplate {
    subject: string;
    html: string;
    text: string;
}
/**
 * Build a per-recipient manage-preferences URL that does not require an active session.
 * Uses a signed token (userId + expiry) so recipients can unsubscribe or manage preferences with one click.
 * Set PREFERENCES_LINK_SECRET in env; if unset, returns the authenticated settings URL as fallback.
 */
export declare function getManagePreferencesUrl(userId: string): string;
export declare function e(value: unknown): string;
export declare function truncate(value: string, max?: number): string;
export declare function formatDate(value?: string | null): string;
export declare function layout(params: {
    title: string;
    intro: string;
    bodyHtml: string;
    ctaLabel?: string;
    ctaUrl?: string;
    /** Per-recipient one-click manage/unsubscribe URL (signed token); when set, used instead of authenticated settings. */
    managePreferencesUrl?: string;
}): string;
//# sourceMappingURL=base.d.ts.map