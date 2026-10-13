import Drawer from "./Drawer";
import { PageHeader } from "./ui";

/**
 * Wraps an add/edit form either as a full page (with PageHeader) or in the
 * right-side drawer, so one editor component serves both the route's page and
 * its intercepted @drawer route.
 */
export default function EditorFrame({
  inDrawer,
  title,
  description,
  actions,
  back,
  children,
}: {
  inDrawer?: boolean;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back: { href: string; label: string };
  children: React.ReactNode;
}) {
  if (inDrawer) {
    return (
      <Drawer title={title} description={description} actions={actions}>
        {children}
      </Drawer>
    );
  }
  return (
    <>
      <PageHeader title={title} description={description} actions={actions} back={back} />
      {children}
    </>
  );
}
