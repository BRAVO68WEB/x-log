"use client";

import { useState } from "react";
import { Button } from "./Button";
import { Input, Textarea } from "./Input";
import { useMutation } from "react-query";

interface OnboardingData {
  instance_name: string;
  instance_description?: string;
  instance_domain: string;
  admin_username: string;
  admin_password: string;
  admin_email?: string;
  open_registrations: boolean;
  smtp_url?: string;
}

export function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Partial<OnboardingData>>({
    open_registrations: false,
  });

  const updateData = <K extends keyof OnboardingData>(field: K, value: OnboardingData[K]) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const mutation = useMutation(async () => {
    const res = await fetch(`/api/onboarding/complete`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Failed to complete onboarding" }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }, {
    onSuccess: () => {
      window.location.href = "/";
    },
    onError: (error) => {
      console.error("Onboarding error:", error);
      alert(`Failed to complete onboarding: ${error instanceof Error ? error.message : "Unknown error"}`);
    },
    onSettled: () => setLoading(false),
  });

  const handleSubmit = async () => {
    setLoading(true);
    mutation.mutate();
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-2 text-gray-900">Welcome to x-log</h1>
        <p className="text-gray-600">Let’s set up your instance</p>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {[1, 2, 3, 4, 5, 6].map((s) => (
            <div
              key={s}
              className={`flex-1 h-2 mx-1 rounded ${
                s <= step ? "bg-blue-600" : "bg-gray-200"
              }`}
            />
          ))}
        </div>
        <p className="text-sm text-gray-500 text-center">
          Step {step} of 6
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-8 border border-gray-200">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-4">Instance Settings</h2>
            <Input
              label="Instance Name"
              value={data.instance_name || ""}
              onChange={(e) => updateData("instance_name", e.target.value)}
              placeholder="My x-log"
              required
            />
            <Textarea
              label="Instance Description"
              value={data.instance_description || ""}
              onChange={(e) => updateData("instance_description", e.target.value)}
              placeholder="A federated blog..."
              rows={3}
            />
            <Input
              label="Instance Domain"
              value={data.instance_domain || ""}
              onChange={(e) => updateData("instance_domain", e.target.value)}
              placeholder="example.com"
              required
            />
            <div className="flex gap-4 pt-4">
              <Button onClick={() => setStep(2)} className="ml-auto">
                Next
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-4">Admin Account</h2>
            <Input
              label="Username"
              value={data.admin_username || ""}
              onChange={(e) => updateData("admin_username", e.target.value)}
              placeholder="admin"
              required
            />
            <Input
              label="Password"
              type="password"
              value={data.admin_password || ""}
              onChange={(e) => updateData("admin_password", e.target.value)}
              placeholder="••••••••"
              required
            />
            <Input
              label="Email (optional)"
              type="email"
              value={data.admin_email || ""}
              onChange={(e) => updateData("admin_email", e.target.value)}
              placeholder="admin@example.com"
            />
            <div className="flex gap-4 pt-4">
              <Button variant="secondary" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={() => setStep(3)} className="ml-auto">
                Next
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-4">Registration Settings</h2>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={data.open_registrations || false}
                onChange={(e) => updateData("open_registrations", e.target.checked)}
                className="w-4 h-4"
              />
              <span>Allow open registrations</span>
            </label>
            <div className="flex gap-4 pt-4">
              <Button variant="secondary" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button onClick={() => setStep(4)} className="ml-auto">
                Next
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-4">SMTP Configuration (Optional)</h2>
            <Input
              label="SMTP URL"
              value={data.smtp_url || ""}
              onChange={(e) => updateData("smtp_url", e.target.value)}
              placeholder="smtp://user:pass@smtp.example.com:587"
            />
            <p className="text-sm text-gray-500">
              You can skip this and configure it later in settings.
            </p>
            <div className="flex gap-4 pt-4">
              <Button variant="secondary" onClick={() => setStep(3)}>
                Back
              </Button>
              <Button onClick={() => setStep(5)} className="ml-auto">
                Next
              </Button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-4">Review</h2>
            <div className="space-y-2 text-sm">
              <p><strong>Instance Name:</strong> {data.instance_name}</p>
              <p><strong>Domain:</strong> {data.instance_domain}</p>
              <p><strong>Admin Username:</strong> {data.admin_username}</p>
              <p><strong>Open Registrations:</strong> {data.open_registrations ? "Yes" : "No"}</p>
            </div>
            <div className="flex gap-4 pt-4">
              <Button variant="secondary" onClick={() => setStep(4)}>
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={loading} className="ml-auto">
                {loading ? "Setting up..." : "Complete Setup"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
