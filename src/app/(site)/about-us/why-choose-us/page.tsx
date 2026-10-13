import { Fragment } from "react";
import WebLayout from "@/components/WebLayout";

export const metadata = { title: "Why Choose Us" };

const REASONS: [string, string][] = [
  ["24/7 Customer Support:", "Shinkyowa Japan provides 24/7 customer support system specially designed for our prestigious clients to answer any kind of queries as soon as possible. So that our clients can have better experience."],
  ["Regularly Updated Stock:", "Our customers can browse through regularly updated stock of shinkyowa international. Where hundreds of vehicles in a very good condition are waiting for them. The stock is updated every week so that clients can get their desired vehicle."],
  ["Guaranteed Lowest Prices:", "Shinkyowa Japan continually doing its best to provide you the best at very a friendly cost. We brought mint condition vehicles for 100% customer satisfaction."],
  ["Thoroughly Inspected Vehicle:", "Shinkyowa’s vehicles are thoroughly inspected by various inspection bodies and our trained certified mechanics. We ensure that once the vehicle reaches the customer it is ready to hit the road."],
  ["Well Located Shipyards:", "Shinkyowa Japan’s well located shipyards are helping swift transfer of vehicles and reduce the shipment of all over japan."],
  ["Fast and Safe Delivery:", "Our association with the best shipping companies make safe and timely delivery of your vehicle. Our clients can keep themselves updated about the status of their shipment by the time it reaches its destination."],
];

export default function WhyChooseUs() {
  return (
    <WebLayout css="why-choose-us" sidebar informationPage>
      <h2>Why Shinkyowa?</h2>
      <p>
        The most trust worthy company. Shinkyowa japan is the leading brand in export business for new and used
        vehicles for more than 3 decades. A well reputed entity among dealers and users across the globe.
      </p>
      {REASONS.map(([title, text]) => (
        <Fragment key={title}>
          <h3>{title}</h3>
          <p>{text}</p>
        </Fragment>
      ))}
    </WebLayout>
  );
}
