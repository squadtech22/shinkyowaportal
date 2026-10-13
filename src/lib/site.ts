// Small helpers shared by client and server components.

// The "Contact Us" menu item and footer link open the contact dialog, which
// lives in <SiteOverlays>. A window event keeps them decoupled.
export const OPEN_CONTACT_EVENT = "shinkyowa:open-contact";

export function openContactDialog() {
  window.dispatchEvent(new Event(OPEN_CONTACT_EVENT));
}

export const formatNumber = (n: number) => n.toLocaleString("en-US");

export const stockNo = (sid: number) => `SKI-${String(sid).padStart(2, "0")}`;

export function decodeSegment(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** "+81 70-1524-1308" -> "tel:+817015241308" */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
