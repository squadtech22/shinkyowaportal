import Link from "next/link";
import WebLayout from "@/components/WebLayout";
import { HomeVehicleCard } from "@/components/VehicleCards";
import { homeSections } from "@/lib/stock";

export const metadata = { title: "Japanese Used Car Exporter" };

const SECTIONS = [
  { key: "New Arrival", label: "New Arrivals", href: "/filter?category=new arrival" },
  { key: "Discounted", label: "Discounted", href: "/filter?category=discounted" },
  { key: "Commercial", label: "Commercial", href: "/filter?category=commercial" },
  { key: "All", label: "All Vehicle", href: "/filter?category=all" },
] as const;

export default async function Home() {
  const data = await homeSections();
  return (
    <WebLayout css="home" sidebar slider>
      {SECTIONS.map((s) => (
        <HomeSection key={s.key} label={s.label} href={s.href}>
          {data[s.key].map((item) => (
            <HomeVehicleCard key={item.id} data={item} />
          ))}
        </HomeSection>
      ))}
    </WebLayout>
  );
}

function HomeSection({ label, href, children }: { label: string; href: string; children: React.ReactNode }) {
  return (
    <>
      <div className="tabs flex section-header">
        <div className="option">
          <p>{label}</p>
        </div>
        <Link href={href} className="mobile-view-all">View All</Link>
      </div>
      <div className="budget-vehicle mobile-carousel">
        {children}
        <Link href={href} className="desktop-view-all">
          <button>View All</button>
        </Link>
      </div>
    </>
  );
}
