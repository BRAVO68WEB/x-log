"use client";

import { useQuery } from "react-query";

interface InstanceSettings {
  instance_name: string;
  instance_description: string | null;
  instance_domain: string;
}

export function Footer() {
  const { data: settings } = useQuery<InstanceSettings>(
    "instanceSettings",
    async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed to load settings");
      return res.json();
    },
    { staleTime: 5 * 60 * 1000 }
  );

  return (
    <footer className="border-t border-light-highlight-med dark:border-dark-highlight-med bg-light-surface dark:bg-dark-surface mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-light-muted dark:text-dark-muted">
          <div className="flex flex-col items-center sm:items-start gap-1">
            {settings?.instance_name && (
              <span className="font-medium text-light-text dark:text-dark-text">
                {settings.instance_name}
              </span>
            )}
            {settings?.instance_description && (
              <span>{settings.instance_description}</span>
            )}
            {settings?.instance_domain && (
              <span className="text-xs">{settings.instance_domain}</span>
            )}
          </div>
          <div>
            <a
              href="https://github.com/BRAVO68WEB/x-log"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-light-pine dark:hover:text-dark-foam transition-colors"
            >
              Powered by x-log
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
