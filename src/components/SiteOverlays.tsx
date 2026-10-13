"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { sendContactMessage, type FormResult } from "@/actions/site";
import type { SiteSettings } from "@/lib/data";
import { OPEN_CONTACT_EVENT } from "@/lib/site";

// The shipping-delay notice shows once per visit: closing it is remembered in
// sessionStorage, which lasts until the browser tab is closed.
const NOTICE_KEY = "skw_notice_closed";
const noticeListeners = new Set<() => void>();
let noticeClosedFallback = false; // when storage is blocked (private mode...)

function noticeClosed() {
  try {
    return noticeClosedFallback || sessionStorage.getItem(NOTICE_KEY) === "1";
  } catch {
    return noticeClosedFallback;
  }
}

function closeNotice() {
  noticeClosedFallback = true;
  try {
    sessionStorage.setItem(NOTICE_KEY, "1");
  } catch {
    /* remembered in memory for this page only */
  }
  noticeListeners.forEach((l) => l());
}

const subscribeNotice = (listener: () => void) => {
  noticeListeners.add(listener);
  return () => noticeListeners.delete(listener);
};

// WhatsApp button, the "Contact Us" dialog and the shipping-delay notice that
// the Laravel layout rendered at the bottom of every page.
export default function SiteOverlays({ settings }: { settings: SiteSettings }) {
  const [contactOpen, setContactOpen] = useState(false);
  // Treated as closed on the server; the browser then shows it if not closed yet this visit.
  const closed = useSyncExternalStore(subscribeNotice, noticeClosed, () => true);
  const noticeOpen = settings.notice.enabled && !closed;
  const [contactResult, setContactResult] = useState<FormResult | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const open = () => {
      setContactResult(null);
      setContactOpen(true);
    };
    window.addEventListener(OPEN_CONTACT_EVENT, open);
    return () => window.removeEventListener(OPEN_CONTACT_EVENT, open);
  }, []);

  return (
    <>
      <a href={`https://wa.me/${settings.whatsappNumber}`} target="__blank">
        <button className="whatsapp">
          <i className="bx bxl-whatsapp"></i>
        </button>
      </a>
      <dialog id="contactDialog" open={contactOpen} onCancel={() => setContactOpen(false)} style={{ display: contactOpen ? "flex" : "none" }}>
        <div className="message">
          <button aria-label="Close contact form" onClick={() => setContactOpen(false)}>
            <i className="bx bx-x"></i>
          </button>
          <h3>Contact Us</h3>
          {contactResult && (
            <div className={contactResult.ok ? "success" : "inquiryCompletionMsg"} style={{ marginTop: 10, marginBottom: 0 }}>
              {contactResult.message}
            </div>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              setSending(true);
              try {
                const result = await sendContactMessage(new FormData(form));
                setContactResult(result);
                if (result.ok) form.reset();
              } catch {
                setContactResult({ ok: false, message: "Could not send your message. Please try again." });
              } finally {
                setSending(false);
              }
            }}
          >
            <label htmlFor="contact-name">Name:</label>
            <input type="text" name="name" id="contact-name" maxLength={120} required />
            <label htmlFor="contact-email">Email:</label>
            <input type="email" name="email" id="contact-email" maxLength={150} required />
            <label htmlFor="contact-message">Message:</label>
            <textarea name="message" id="contact-message" rows={10} maxLength={2000} required></textarea>
            <button disabled={sending}>Send</button>
          </form>
        </div>
      </dialog>
      {noticeOpen && (
        <div className="popup" id="popup" onClick={closeNotice}>
          <div className="message" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={closeNotice}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
            <h1>{settings.notice.title}</h1>
            <p>{settings.notice.body}</p>
          </div>
        </div>
      )}
    </>
  );
}
