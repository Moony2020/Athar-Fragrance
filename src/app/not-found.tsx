import Link from "next/link";
import { Footer } from "@/components/layout/Footer/Footer";
import { Header } from "@/components/layout/Header/Header";
import { Container } from "@/components/ui/Container/Container";

export default function NotFound() {
  return <><Header /><main><Container><section style={{ minHeight: "60vh", paddingBlock: "12rem 6rem" }} aria-labelledby="not-found-title"><p>ATHAR</p><h1 id="not-found-title">This page is not available.</h1><p>The requested catalog destination could not be found.</p><Link href="/shop">Browse the catalog</Link></section></Container></main><Footer /></>;
}
