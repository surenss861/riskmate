import React from "react";
export interface EmailLayoutProps {
    title: string;
    intro: string;
    children: React.ReactNode;
    ctaLabel?: string;
    ctaUrl?: string;
    managePreferencesUrl?: string;
}
export declare function EmailLayout({ title, intro, children, ctaLabel, ctaUrl, managePreferencesUrl, }: EmailLayoutProps): React.JSX.Element;
//# sourceMappingURL=EmailLayout.d.ts.map