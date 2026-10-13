import { readFileSync } from "node:fs";
import path from "node:path";

// The Laravel layout pushed one stylesheet per page (@push('css')) followed by
// page-responsive.css. Those sheets contradict each other (.sub-content .item,
// .swiper heights, table layouts), so each must only exist while its page is
// on screen. They are inlined as <style> elements that mount and unmount with
// the page, keeping the original cascade order.
const cache = new Map<string, string>();

function css(name: string) {
  let text = cache.get(name);
  if (text === undefined) {
    text = readFileSync(path.join(process.cwd(), "public", "css", `${name}.css`), "utf8");
    cache.set(name, text);
  }
  return text;
}

export type PageCss =
  | "home" | "stock" | "vehicle-info" | "shipping" | "company-profile" | "why-choose-us" | "bank-details";

export default function PageStyles({ page }: { page: PageCss }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css(page) }} />
      <style dangerouslySetInnerHTML={{ __html: css("page-responsive") }} />
    </>
  );
}
