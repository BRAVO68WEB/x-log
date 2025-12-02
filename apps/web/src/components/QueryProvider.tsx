"use client";

import { QueryClient, QueryClientProvider } from "react-query";
import type { QueryClientProviderProps } from "react-query";
import * as React from "react";
import { useState } from "react";

export function QueryProvider({ children }: { children?: QueryClientProviderProps["children"] }) {
  const [client] = useState(() => new QueryClient());
  return <QueryClientProvider client={client}>{children as QueryClientProviderProps["children"]}</QueryClientProvider>;
}
