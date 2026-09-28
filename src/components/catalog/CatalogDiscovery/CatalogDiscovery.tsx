"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { hasUnscopedDiscoveryQuery, type PublicDiscoveryQuery } from "@/server/catalog/schemas";
import type { CatalogDiscoveryOptions, CatalogDiscoveryResult } from "@/server/catalog/services";
import styles from "./CatalogDiscovery.module.css";

type Props = { action: string; options: CatalogDiscoveryOptions; query: PublicDiscoveryQuery; resultCount: number; scope?: CatalogDiscoveryResult["scope"] };

export function CatalogDiscovery({ action, options, query, resultCount, scope = {} }: Props) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (detailsRef.current && detailsRef.current.open && !detailsRef.current.contains(event.target as Node)) {
        detailsRef.current.open = false;
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const active = [
    ["Search", query.q],
    ["Audience", !scope.audience ? query.audience : undefined],
    ["Brand", !scope.brandSlug ? query.brand : undefined],
    ["Family", query.family],
    ["Collection", !scope.collectionSlug ? query.collection : undefined],
    ["Sort", query.sort !== "name-asc" ? query.sort : undefined]
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <section className={styles.discovery} aria-label="Catalog discovery">
      <form action={action} method="get" className={styles.form}>
        <label className={styles.search}>
          <span className={styles.srOnly}>Search fragrances</span>
          <input id="fragrance-search" name="q" type="search" defaultValue={query.q} maxLength={80} placeholder="Search fragrances by name or brand..." />
        </label>
        <details ref={detailsRef} className={styles.filters}>
          <summary>Filters</summary>
          <div className={styles.filterFields}>
            <label>
              Audience
              <select name="audience" defaultValue={query.audience ?? ""}>
                <option value="">All audiences</option>
                <option value="women">Women</option>
                <option value="men">Men</option>
                <option value="unisex">Unisex</option>
              </select>
            </label>
            <label>
              Brand
              <select name="brand" defaultValue={query.brand ?? ""}>
                <option value="">All brands</option>
                {options.brands.map((brand) => (
                  <option key={brand.slug} value={brand.slug}>{brand.name}</option>
                ))}
              </select>
            </label>
            <label>
              Fragrance family
              <select name="family" defaultValue={query.family ?? ""}>
                <option value="">All families</option>
                {options.families.map((family) => (
                  <option key={family} value={family}>{family}</option>
                ))}
              </select>
            </label>
            <label>
              Collection
              <select name="collection" defaultValue={query.collection ?? ""}>
                <option value="">All collections</option>
                {options.collections.map((collection) => (
                  <option key={collection.slug} value={collection.slug}>{collection.name}</option>
                ))}
              </select>
            </label>
            <div className={styles.filterActions}>
              <button type="submit" className={styles.applyBtn}>Apply Filters</button>
              <Link className={styles.clear} href={action}>Clear all</Link>
            </div>
          </div>
        </details>
        <label className={styles.sort}>
          <span className={styles.srOnly}>Sort</span>
          <select
            name="sort"
            defaultValue={query.sort ?? "name-asc"}
            onChange={(e) => {
              const form = e.currentTarget.form;
              if (form) {
                if (typeof form.requestSubmit === "function") {
                  form.requestSubmit();
                } else {
                  form.submit();
                }
              }
            }}
          >
            <option value="name-asc">Sort: Name A–Z</option>
            <option value="name-desc">Sort: Name Z–A</option>
            <option value="price-asc">Sort: Price Low to High</option>
            <option value="price-desc">Sort: Price High to Low</option>
          </select>
        </label>
      </form>
      <p className={styles.status}>{resultCount} {resultCount === 1 ? "fragrance" : "fragrances"} found</p>
      {hasUnscopedDiscoveryQuery(query, scope) && active.length > 0 && (
        <p className={styles.active}>Active: {active.map(([label, value]) => `${label}: ${value}`).join(" · ")}</p>
      )}
    </section>
  );
}
