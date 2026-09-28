"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Header.module.css";

const navigationItems = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/shop" },
  { label: "Collections", href: "/shop" },
  { label: "Our Story", href: "/story" },
];

export function HeaderNavigation() {
  const pathname = usePathname();
  return <nav className={styles.navigation} aria-label="Main navigation">
    {navigationItems.map((item) => {
      const active = item.label === "Home" 
        ? pathname === "/" 
        : item.label === "Shop" 
        ? pathname.startsWith("/shop") || pathname.startsWith("/products") 
        : item.label === "Collections" 
        ? pathname.startsWith("/collections") 
        : item.label === "Our Story"
        ? pathname.startsWith("/story")
        : false;
      return <Link aria-current={active ? "page" : undefined} className={active ? styles.activeLink : styles.navigationLink} href={item.href} key={item.label}>{item.label}</Link>;
    })}
  </nav>;
}
