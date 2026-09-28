import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./Story.module.css";

export function Story() {
  return (
    <section className={styles.section} id="story" aria-labelledby="story-title">
      {/* =====================================================================
          DESKTOP MASTER ARTWORK (Unified Liquid Gold Canvas)
          ===================================================================== */}
      <div className={styles.desktopCanvas}>
        <svg
          className={styles.svgArt}
          viewBox="0 0 1440 560"
          preserveAspectRatio="xMidYMid meet"
          xmlns="http://www.w3.org/2000/svg"
          xmlnsXlink="http://www.w3.org/1999/xlink"
          aria-hidden="true"
        >
          <defs>
            {/* Silk background gradient */}
            <linearGradient id="athar-silk" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ede0ce" />
              <stop offset="28%" stopColor="#f7eee2" />
              <stop offset="55%" stopColor="#eedec9" />
              <stop offset="85%" stopColor="#f6ecde" />
              <stop offset="100%" stopColor="#e3cfb4" />
            </linearGradient>

            {/* 3D Liquid Gold Gradient */}
            <linearGradient id="athar-liquid-gold" x1="0%" y1="0%" x2="100%" y2="80%">
              <stop offset="0%" stopColor="#ab7b2c" />
              <stop offset="18%" stopColor="#ffd885" />
              <stop offset="38%" stopColor="#cf9f4d" />
              <stop offset="62%" stopColor="#fff3cd" />
              <stop offset="82%" stopColor="#b88836" />
              <stop offset="100%" stopColor="#dfb768" />
            </linearGradient>

            {/* Subtle inner highlight */}
            <linearGradient id="gold-inner-glint" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#dfba71" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.6" />
            </linearGradient>

            {/* Ambient luxury drop shadow */}
            <filter id="athar-depth-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="16" stdDeviation="22" floodColor="#35200c" floodOpacity="0.22" />
            </filter>

            <filter id="ribbon-glow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="10" stdDeviation="16" floodColor="#422509" floodOpacity="0.12" />
            </filter>

            {/* Left Frame: Organic droplet curve */}
            <clipPath id="left-organic-clip">
              <path d="M 235 60 C 335 52, 420 130, 430 240 C 440 350, 375 465, 275 490 C 165 515, 90 445, 75 330 C 60 210, 130 70, 235 60 Z" />
            </clipPath>

            {/* Right Frame: Curved wave framing the perfume bottle */}
            <clipPath id="right-organic-clip">
              <path d="M 1440 15 C 1310 15, 1120 60, 1035 165 C 960 255, 985 360, 1105 415 C 1225 465, 1370 440, 1440 480 L 1440 15 Z" />
            </clipPath>
          </defs>

          {/* Flowing background silk canvas */}
          <path
            d="M 0 30 C 280 5, 540 50, 820 20 C 1100 -10, 1310 30, 1440 10 L 1440 535 C 1280 515, 1020 558, 760 528 C 480 498, 220 555, 0 525 Z"
            fill="url(#athar-silk)"
            filter="url(#ribbon-glow)"
          />

          {/* Decorative sweeping liquid gold ribbon wave */}
          <path
            d="M -20 440 C 180 480, 360 510, 520 450 C 680 395, 780 415, 940 490 C 1090 560, 1260 540, 1460 470"
            fill="none"
            stroke="url(#athar-liquid-gold)"
            strokeWidth="3.5"
            strokeLinecap="round"
            opacity="0.75"
          />
          <path
            d="M 0 500 C 260 530, 520 480, 740 495 C 980 510, 1200 575, 1450 500"
            fill="none"
            stroke="url(#athar-liquid-gold)"
            strokeWidth="1.5"
            opacity="0.4"
          />

          {/* ===============================================================
              LEFT ELEMENT: Radiant Floral Portrait in Organic Liquid Gold Rim
              =============================================================== */}
          <g filter="url(#athar-depth-shadow)">
            <g clipPath="url(#left-organic-clip)">
              <image
                href="/images/home/story-woman.jpg"
                xlinkHref="/images/home/story-woman.jpg"
                x="55"
                y="45"
                width="395"
                height="465"
                preserveAspectRatio="xMidYMid slice"
              />
            </g>
            {/* Metallic Liquid Gold Outer Bezel */}
            <path
              d="M 235 60 C 335 52, 420 130, 430 240 C 440 350, 375 465, 275 490 C 165 515, 90 445, 75 330 C 60 210, 130 70, 235 60 Z"
              fill="none"
              stroke="url(#athar-liquid-gold)"
              strokeWidth="5"
            />
            {/* Inner Glint Stroke */}
            <path
              d="M 235 60 C 335 52, 420 130, 430 240 C 440 350, 375 465, 275 490 C 165 515, 90 445, 75 330 C 60 210, 130 70, 235 60 Z"
              fill="none"
              stroke="url(#gold-inner-glint)"
              strokeWidth="1.5"
            />
          </g>

          {/* ===============================================================
              RIGHT ELEMENT: ATHAR Bespoke Perfume Bottle in Liquid Gold Wave
              =============================================================== */}
          <g filter="url(#athar-depth-shadow)">
            <g clipPath="url(#right-organic-clip)">
              <image
                href="/images/home/story-perfume.jpg"
                xlinkHref="/images/home/story-perfume.jpg"
                x="940"
                y="5"
                width="510"
                height="480"
                preserveAspectRatio="xMidYMid slice"
              />
            </g>
            {/* Metallic Liquid Gold Outer Bezel */}
            <path
              d="M 1440 15 C 1310 15, 1120 60, 1035 165 C 960 255, 985 360, 1105 415 C 1225 465, 1370 440, 1440 480"
              fill="none"
              stroke="url(#athar-liquid-gold)"
              strokeWidth="5"
            />
            {/* Inner Glint Stroke */}
            <path
              d="M 1440 15 C 1310 15, 1120 60, 1035 165 C 960 255, 985 360, 1105 415 C 1225 465, 1370 440, 1440 480"
              fill="none"
              stroke="url(#gold-inner-glint)"
              strokeWidth="1.5"
            />
          </g>
        </svg>

        {/* Center Typography (Clean, spacious, zero collision) */}
        <div className={styles.centerNarrative}>
          <span className={styles.eyebrow}>Our Story</span>
          <h2 className={styles.title} id="story-title">
            MORE THAN A PERFUME,
            <span className={styles.titleLine}>IT IS A FEELING</span>
          </h2>
          <div className={styles.ctaWrapper}>
            <Link className={styles.ctaButton} href="/story">
              <span>Discover Our Story</span>
              <span className={styles.ctaArrow} aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        {/* 4 Luxury Pillars (Horizontal Golden Emblems on bottom right) */}
        <div className={styles.desktopPillarsBar} aria-label="ATHAR Brand Pillars">
          <PillarEmblem icon="leaf" title="Authentic" subtitle="Brands" />
          <PillarEmblem icon="gem" title="Curated" subtitle="Selection" />
          <PillarEmblem icon="truck" title="Fast & Secure" subtitle="Delivery" />
          <PillarEmblem icon="heart" title="A More" subtitle="Beautiful You" />
        </div>
      </div>

      {/* =====================================================================
          MOBILE & TABLET EDITORIAL FLOW (≤ 768px)
          ===================================================================== */}
      <div className={styles.mobileFlow}>
        <div className={styles.mobilePortraitCard}>
          <div className={styles.mobileImageFrame}>
            <svg
              viewBox="0 0 400 450"
              className={styles.mobileSvgFrame}
              preserveAspectRatio="xMidYMid meet"
              aria-hidden="true"
            >
              <defs>
                <clipPath id="mobile-organic-clip">
                  <path d="M 200 40 C 310 35, 380 115, 375 225 C 370 335, 305 425, 195 420 C 85 415, 25 330, 30 220 C 35 110, 90 45, 200 40 Z" />
                </clipPath>
              </defs>
              <g clipPath="url(#mobile-organic-clip)">
                <image
                  href="/images/home/story-woman.jpg"
                  xlinkHref="/images/home/story-woman.jpg"
                  x="0"
                  y="0"
                  width="400"
                  height="450"
                  preserveAspectRatio="xMidYMid slice"
                />
              </g>
              <path
                d="M 200 40 C 310 35, 380 115, 375 225 C 370 335, 305 425, 195 420 C 85 415, 25 330, 30 220 C 35 110, 90 45, 200 40 Z"
                fill="none"
                stroke="url(#athar-liquid-gold)"
                strokeWidth="4"
              />
            </svg>
          </div>
        </div>

        <div className={styles.mobileNarrative}>
          <span className={styles.eyebrow}>Our Story</span>
          <h2 className={styles.title}>
            MORE THAN A PERFUME,
            <span className={styles.titleLine}>IT IS A FEELING</span>
          </h2>
          <div className={styles.ctaWrapper}>
            <Link className={styles.ctaButton} href="/story">
              <span>Discover Our Story</span>
              <span className={styles.ctaArrow} aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        {/* Perfume Bottle Card on Mobile */}
        <div className={styles.mobilePerfumeCard}>
          <div className={styles.mobileImageFrame}>
            <svg
              viewBox="0 0 400 320"
              className={styles.mobileSvgFrame}
              preserveAspectRatio="xMidYMid meet"
              aria-hidden="true"
            >
              <defs>
                <clipPath id="mobile-perfume-clip">
                  <path d="M 30 160 C 30 60, 110 30, 200 30 C 290 30, 370 60, 370 160 C 370 260, 290 290, 200 290 C 110 290, 30 260, 30 160 Z" />
                </clipPath>
              </defs>
              <g clipPath="url(#mobile-perfume-clip)">
                <image
                  href="/images/home/story-perfume.jpg"
                  xlinkHref="/images/home/story-perfume.jpg"
                  x="0"
                  y="0"
                  width="400"
                  height="320"
                  preserveAspectRatio="xMidYMid slice"
                />
              </g>
              <path
                d="M 30 160 C 30 60, 110 30, 200 30 C 290 30, 370 60, 370 160 C 370 260, 290 290, 200 290 C 110 290, 30 260, 30 160 Z"
                fill="none"
                stroke="url(#athar-liquid-gold)"
                strokeWidth="3.5"
              />
            </svg>
          </div>
        </div>

        <div className={styles.mobilePillarsGrid}>
          <PillarEmblem icon="leaf" title="Authentic" subtitle="Brands" />
          <PillarEmblem icon="gem" title="Curated" subtitle="Selection" />
          <PillarEmblem icon="truck" title="Fast & Secure" subtitle="Delivery" />
          <PillarEmblem icon="heart" title="A More" subtitle="Beautiful You" />
        </div>
      </div>
    </section>
  );
}

function PillarEmblem({
  icon,
  title,
  subtitle,
}: {
  icon: "leaf" | "gem" | "truck" | "heart";
  title: string;
  subtitle: string;
}) {
  const paths: Record<string, ReactNode> = {
    leaf: (
      <path d="M12 2C6.5 2 2 6.5 2 12c0 3.5 2 6.5 5 8 .5-4.5 3-8 8-10M12 2c3.5 3 5 7 5 11 0 4-3 7-7 8M12 2c1 5 0 9-3 12" />
    ),
    gem: (
      <>
        <polygon points="12 2 21 8.5 17 21 7 21 3 8.5 12 2" />
        <line x1="3" y1="8.5" x2="21" y2="8.5" />
        <polyline points="12 2 17 8.5 12 21 7 8.5 12 2" />
      </>
    ),
    truck: (
      <>
        <rect x="1" y="4" width="14" height="12" rx="1" />
        <polygon points="15 8 19 8 22 11 22 16 15 16 15 8" />
        <circle cx="5.5" cy="18.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
      </>
    ),
    heart: (
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    ),
  };

  return (
    <div className={styles.pillarEmblem}>
      <div className={styles.emblemIconCircle}>
        <svg aria-hidden="true" viewBox="0 0 24 24" className={styles.emblemSvg}>
          {paths[icon]}
        </svg>
      </div>
      <div className={styles.emblemText}>
        <span className={styles.emblemTitle}>{title}</span>
        <span className={styles.emblemSubtitle}>{subtitle}</span>
      </div>
    </div>
  );
}
