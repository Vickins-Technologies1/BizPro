import React from "react";

type MoreDrawerContextValue = {
  openMore: () => void;
};

const MoreDrawerContext = React.createContext<MoreDrawerContextValue | null>(null);

export function MoreDrawerProvider({ children, openMore }: { children: React.ReactNode; openMore: () => void }) {
  return <MoreDrawerContext.Provider value={{ openMore }}>{children}</MoreDrawerContext.Provider>;
}

export function useMoreDrawer() {
  const context = React.useContext(MoreDrawerContext);
  return context ?? { openMore: () => undefined };
}
