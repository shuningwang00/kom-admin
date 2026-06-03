"use client";

import { SWRConfig } from "swr";
import type { ReactNode } from "react";

export default function SWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        dedupingInterval: 30_000,
        focusThrottleInterval: 60_000,
      }}
    >
      {children}
    </SWRConfig>
  );
}
