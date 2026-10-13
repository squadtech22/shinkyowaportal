import WebLayout from "@/components/WebLayout";
import { getInfoRows } from "@/lib/settings";

export const metadata = { title: "Sales and Banking Details" };

const TERMS = [
  "We make fast delivery of your vehicle and make sure that it is delivery on the promised delivery date.",
  "Customer will be informed before any change in order.",
  "All vehicles are available on first come first serve basis.",
  "You must be 18 years old or over to buy a vehicle from us. People underage are not eligible to buy any vehicle.",
  "Customer have to pay the decided initial payment within the next 48 hours after the deal is done otherwise Shinkyowa int. will be allowed to sell that vehicle to anyone else.",
  "If a payment reaches us late than 48hrs and the vehicle is sold to another customer, we will provide you a similar vehicle with same specifications.",
  "If more than one people are willing to buy a same vehicle, the vehicle will be sold to the one who pays first for that.",
  "Brand new vehicles that are allowed to export from japan have to legally undergo a Registration Cancellation Process after which they may appear to be used vehicles in documents, but they are to be considered as Brand New Cars.",
  "If a vehicle’s accessory is not mentioned in the specification of the vehicle on the website then Shinkyowa Int. is not responsible for its functioning and condition, as it may not be functioning properly.",
  "All kind of vehicles sold under the term “Used as it is where it is basis” are intended to be sold as they are and no reconditioning is included in sales contract.",
  "The Terms and conditions of sales comply with the Japanese laws, and conform to rules and regulations pertaining automobile trading. As such enactment, validity, interpretation, and execution of these Terms and Conditions are subject to the Japanese automobile export/trading laws, rules and regulations only.",
  "Should any dispute between buyer and the company occur with regards to the service, and any contacts concluded through the service, the parties concerned agree to attempt to settle any such disputed through dialogue in most sincere manner.",
  "In case, if the disputes failed to be resolved through dialogue between the concerned parties, the Maebashi District Court holds original and exclusive jurisdiction over resolution of the dispute.",
  "A certain percentage discount is offered on bulk purchase. The % varies according to the number of units purchased, the greater the number of units purchased the higher the % discount.",
  "Shinkyowa int. is not responsible for any damage that occurs during and after it reaches port.",
  "Payments should be made through Telegraphic Transfer to our Bank Account.",
  "No vehicle will be shipped until full payment is received and amount is cleared before shipment.",
];

const TERMS_AFTER = [
  "Buyer and consignee Name and addresses have to be confirmed so mail or fax them to us to make sure that all the shipping documents are correctly prepared before shipment",
  "Any user or visitor who Enquiries for a Vehicle/ Tractor/ Machinery from our website, live chat support to our regular newsletter subscription list. Users can unsubscribed from our subscription list by clicking on the unsubscribed button which is available at the bottom of our newsletter.",
  "Customer Arrangement will only proceed if we have minimum deposit of $1000 for FOB of vehicle up to $10,000 and 20% of FOB amount if FOB of vehicle is more than $10,000/.",
  "After Arrangement of vehicle, necessary payment for shipment (i.e. 50% or 100%) must be complete within 7 days of vehicle purchased, if there any delays than penalty will be imposed based on detailed Shinkyowa int. penalty policy",
  "If payment on 50%, then remaining 50% must be complete within 7 days of bill of landing copy. If there any delays then penalty will be imposed on detailed Shinkyowa int. penalty policy",
  "If payment made in any other currency other than US Dollar, All exchange rate difference will borne by customer.",
  "The consignee shall bear all the Bank Charges and expenses. USD 25 to be deposited on top of invoice amount for bank service charges in Japan.",
  "You will have to cover the transfer charges if you purchase vehicles through PayPal.",
  "Shinkyowa int. company reserves right to update the terms and conditions at any time without prior notice.",
];

const DOCUMENTS = ["Bill of lading", "Invoice", "Export Certification", "Other required documents in your local custom"];

export default async function BankDetails() {
  // Bank table rows: info_rows where section = "bank_details".
  const [bank, intermediary] = await Promise.all([getInfoRows("bank_details"), getInfoRows("intermediary_bank")]);
  return (
    <WebLayout css="bank-details" sidebar informationPage>
      <h1>Sales and Terms </h1>
      <ul>
        {TERMS.map((t) => (
          <li key={t}>{t}</li>
        ))}
        <li>
          Once the payment is received the following documentation, necessary to clear the vehicle at the destination
          port, will be sent to you via mail or courier after the vessel has been shipped.
          <ol>
            {DOCUMENTS.map((d, i) => (
              <li key={d}>
                <span>{i + 1}. </span>
                {d}
              </li>
            ))}
          </ol>
        </li>
        {TERMS_AFTER.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <h1>Banking Details</h1>
      <p>
        Shinkyowa Japan aims to provide the most feasible payment options to its customers all across the globe for
        smooth business transactions. Our objective has always been to facilitate customers with the simplest payment
        methods. They can conveniently transfer funds to our bank account through the bank details offered at their
        aid.
      </p>
      <table>
        <tbody>
          {bank.map(([th, td]) => (
            <tr key={th}>
              <th>{th}</th>
              <td>{td}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {intermediary.length > 0 && (
        <>
          <h2>Intermediary Bank Details</h2>
          <p>For international transfers (TT), your bank may send the payment through this intermediary bank.</p>
          <table>
            <tbody>
              {intermediary.map(([th, td]) => (
                <tr key={th}>
                  <th>{th}</th>
                  <td>{td}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </WebLayout>
  );
}
