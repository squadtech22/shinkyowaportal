"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { SidebarEntry } from "@/lib/data";

// On phones the Laravel layout collapsed each list to three items plus a
// "See More" tile and dropped the "(count)" suffix (see responsive.css).
function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1007px)");
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return mobile;
}

function GridList({ entries, mobile, alt = "" }: { entries: SidebarEntry[]; mobile: boolean; alt?: string }) {
  const [expanded, setExpanded] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const collapsible = mobile && entries.length > 4;
  const visible = collapsible && !expanded ? entries.slice(0, 3) : entries;

  return (
    <ul ref={listRef}>
      {visible.map((e) => (
        <li key={e.name}>
          <Link href={e.href}>
            <img src={e.img} loading="lazy" alt={alt} />
            <span>{mobile ? e.name : `${e.name}(${e.count})`}</span>
          </Link>
        </li>
      ))}
      {collapsible && (
        <li className="mobile-more-btn">
          <a
            href="#"
            onClick={(ev) => {
              ev.preventDefault();
              if (expanded) listRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
              setExpanded(!expanded);
            }}
          >
            <div className="more-icon">
              <i className="bx bx-dots-horizontal-rounded"></i>
            </div>
            <span className="more-text">{expanded ? "See Less" : "See More"}</span>
          </a>
        </li>
      )}
    </ul>
  );
}

export default function MainSidebar({
  makes,
  types,
  countries,
  modelsByMake,
  currentMake,
  currentModel,
}: {
  makes: SidebarEntry[];
  types: SidebarEntry[];
  countries: SidebarEntry[];
  modelsByMake: Record<string, string[]>;
  currentMake?: string;
  currentModel?: string;
}) {
  const mobile = useIsMobile();
  const makeNames = makes.map((m) => m.name).sort();
  const initialMake = makeNames.find((m) => m.toLowerCase() === currentMake?.toLowerCase()) ?? "";
  const [make, setMake] = useState(initialMake);
  const models = make ? modelsByMake[make] ?? [] : [];

  return (
    <aside className="main-sidebar">
      <div className="search">
        <h2 className="heading">Search</h2>
        <form action="/filter" method="GET">
          <div className="item">
            <label htmlFor="make">Make:</label>
            <select name="make" id="make" value={make} onChange={(e) => setMake(e.target.value)}>
              <option value="">Select Make</option>
              {makeNames.map((m) => (
                <option key={m} value={m}>{m.toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div className="item">
            <label htmlFor="model">Model:</label>
            <select
              name="model"
              id="model"
              key={make}
              defaultValue={make === initialMake ? models.find((m) => m.toLowerCase() === currentModel?.toLowerCase()) ?? "" : ""}
            >
              <option value="">Select Model</option>
              {models.map((m) => (
                <option key={m} value={m}>{m.toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div className="item">
            <label htmlFor="stock">Stock:</label>
            <input type="text" name="stock" id="stock" placeholder="Stock No" />
          </div>
          <button>Search</button>
        </form>
      </div>
      <div className="make">
        <h2 className="heading">Search By Make</h2>
        <GridList entries={makes} mobile={mobile} />
      </div>
      <div className="type">
        <h2 className="heading">Search By Type</h2>
        <GridList entries={types} mobile={mobile} />
      </div>
      <div className="region">
        <h2 className="heading">Search By Country</h2>
        <GridList entries={countries} mobile={mobile} alt="country" />
      </div>
    </aside>
  );
}
