import MainSidebar from "./MainSidebar";
import SecondSidebar from "./SecondSidebar";
import HomeSlider from "./HomeSlider";
import PageStyles, { type PageCss } from "./PageStyles";
import { modelsByMake, sidebarData, vehiclesOfTheDay } from "@/lib/stock";

// Port of resources/views/web/layouts/app.blade.php minus the header/footer,
// which live in the root layout. The flags reproduce its Request::path() checks.
export default async function WebLayout({
  css,
  sidebar,
  slider = false,
  informationPage = false,
  mainSidebar = true,
  query,
  children,
}: {
  css: PageCss;
  sidebar: boolean;
  slider?: boolean;
  informationPage?: boolean;
  mainSidebar?: boolean;
  /** Current make/model from the URL, preselected in the sidebar search. */
  query?: { make?: string; model?: string };
  children: React.ReactNode;
}) {
  const [tiles, models, vehicleOfDay] = await Promise.all([
    mainSidebar ? sidebarData() : null,
    mainSidebar ? modelsByMake() : null,
    sidebar ? vehiclesOfTheDay() : null,
  ]);
  return (
    <>
      <PageStyles page={css} />
      {slider && <HomeSlider />}
      <div className={`content ${informationPage ? "information-page" : ""}`}>
        {tiles && models && (
          <MainSidebar
            key={JSON.stringify(query)}
            makes={tiles.makes}
            types={tiles.types}
            countries={tiles.countries}
            modelsByMake={models}
            currentMake={query?.make}
            currentModel={query?.model}
          />
        )}
        <div className="pageContent flex" style={{ gap: 10 }}>
          <div className={`sub-content ${sidebar ? "content-divide" : ""}`}>{children}</div>
          {vehicleOfDay && <SecondSidebar vehicleOfDay={vehicleOfDay} />}
        </div>
      </div>
    </>
  );
}
