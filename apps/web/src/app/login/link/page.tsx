import React, { Suspense } from "react";
import OIDCLinkClient from "./Client";

export default function OIDCLinkPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OIDCLinkClient />
    </Suspense>
  );
}
