"use client";

import { startTransition, useActionState } from "react";
import { sendInquiry, type InquiryState } from "@/actions/inquiry";
import type { Country } from "@/lib/data";

export default function InquiryForm({
  stockId,
  countries,
  alreadySentMessage,
}: {
  stockId: number;
  countries: Country[];
  /** Set when this visitor already sent an inquiry for the vehicle. */
  alreadySentMessage?: string;
}) {
  const [state, action, pending] = useActionState<InquiryState, FormData>(sendInquiry, null);
  const done = state?.ok === true || Boolean(alreadySentMessage);

  return (
    <div className="action">
      {state && <div className={state.ok ? "success" : "inquiryCompletionMsg"}>{state.message}</div>}
      {!state && alreadySentMessage && <div className="inquiryCompletionMsg">{alreadySentMessage}</div>}
      {/* onSubmit rather than action={...}: a form action resets the inputs,
          which would wipe them when validation fails. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          startTransition(() => action(data));
        }}
      >
        <div className="destination">
          <h3>Step 1: Select Vehicle Destination</h3>
          <select name="country_id" id="destination" defaultValue="" required disabled={done}>
            <option value="" disabled>Select Destination</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="destination">
          <h3>Step 2: Vehicle Enquiry Form</h3>
          <p>Enter your details below to send your enquiry for this vehicle</p>
          <input type="text" name="stock_id" id="stock_id" placeholder="Stock Id" hidden defaultValue={stockId} />
          <input type="text" name="name" id="full_name" placeholder="Full Name" maxLength={120} required disabled={done} />
          <input type="email" name="email" id="email" placeholder="Email Address" maxLength={150} required disabled={done} />
          <input type="tel" name="phone" id="phone_no" placeholder="Phone No" maxLength={15} required disabled={done} />
          <input type="text" name="country" id="country" placeholder="Country" maxLength={30} required disabled={done} />
          <textarea
            name="message"
            id="comment"
            cols={30}
            rows={10}
            placeholder="Enter Comment or any other details you want to provide"
            maxLength={2000}
            required
            disabled={done}
          ></textarea>
        </div>
        <div className="destination">
          <button disabled={done || pending}>Send Enquiry</button>
        </div>
      </form>
    </div>
  );
}
