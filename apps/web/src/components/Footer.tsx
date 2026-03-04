"use client";

import { useQuery } from "react-query";
import { Separator } from "@/components/ui/separator";

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
    <footer className="mt-auto">
      <Separator />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex flex-col items-center sm:items-start gap-1">
            {settings?.instance_name && (
              <span className="font-heading font-medium text-foreground">
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
              className="hover:text-primary transition-colors"
            >
              Powered by x-log
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
