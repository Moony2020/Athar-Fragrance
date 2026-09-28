import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";
import { Footer } from "@/components/layout/Footer/Footer";
import { Header } from "@/components/layout/Header/Header";

async function RequestAwareHeader() {
  await connection();

  return <Header />;
}

export function CatalogShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <RequestAwareHeader />
      </Suspense>
      <main>{children}</main>
      <Footer />
    </>
  );
}
