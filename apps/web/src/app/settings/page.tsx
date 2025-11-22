"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Input, Textarea } from "@/components/Input";

export default function SettingsPage() {
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    instance_name: "",
    instance_description: "",
    open_registrations: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    // TODO: Implement settings update API
    setTimeout(() => {
      alert("Settings saved (not yet implemented)");
      setSaving(false);
    }, 1000);
  };

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-gray-900">Instance Settings</h1>
        <div className="bg-white rounded-lg shadow-md p-8 border border-gray-200">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Instance Name"
              value={settings.instance_name}
              onChange={(e) =>
                setSettings({ ...settings, instance_name: e.target.value })
              }
            />
            <Textarea
              label="Instance Description"
              value={settings.instance_description}
              onChange={(e) =>
                setSettings({ ...settings, instance_description: e.target.value })
              }
              rows={4}
            />
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.open_registrations}
                onChange={(e) =>
                  setSettings({ ...settings, open_registrations: e.target.checked })
                }
                className="w-4 h-4"
              />
              <span>Allow open registrations</span>
            </label>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

