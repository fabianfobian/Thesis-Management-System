import { Suspense } from "react";
import HeaderNav from "./HeaderNav";

export default function HeaderNavWrapper() {
  return (
    <Suspense fallback={<div className="h-6 w-32 bg-pac-navyLight animate-pulse rounded" />}>
      <HeaderNav />
    </Suspense>
  );
}