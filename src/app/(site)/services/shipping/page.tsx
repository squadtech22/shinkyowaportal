import WebLayout from "@/components/WebLayout";

export const metadata = { title: "Shipping Service" };

export default function Shipping() {
  return (
    <WebLayout css="shipping" sidebar informationPage>
      <h1>Shipping Service</h1>
      <p>
        Shinkyowa Japan ensures trouble free car delivery to its customers. Once your car is purchased we get it
        delivered to the major port of your country in the least possible time. Our shipping services can be availed
        whichever part of the world you reside in.
      </p>
      <p>
        Moreover our customer service agents are always there to advice you regarding the rules, efficient shipping
        procedures, prices and carriers. We will stay by your side till you vehicle is delivered to your port safely
        and keep you updated about the status while your vehicle is in trasit.
      </p>
      <p>
        Now, there are two kinds of shipping methods available we will guide you in detail about the difference
        between both of them to make it easy for you which one to choose.
      </p>
      <ul>
        <li>Roro Method</li>
        <li>Container Method</li>
      </ul>

      <h2>Roro Method</h2>
      <p>
        The most secure and affordable means of shipment is RORO method. We drive vehicles to the RORO vessels and
        secure it to the auto decks. Rest assured that RORO shipment are carried on specially designed vessels which
        have built in ramps and water proof zones for complete vehicle protection.
      </p>
      <h2>Shipping by Container method</h2>
      <p>
        Container shipping method is ideal for high priced luxury cars. We will assign our professional to handle your
        shipment and your car will be loaded into a safe shipping container and inside the container it is tied up
        with straps to ensure the safety and stop the vehicle to move during transport. By this your vehicle will be
        also protected from water damage and winds.
      </p>
      <p>Our Shipyards are located at the following locations:</p>
      <ul>
        <li>Yokohama</li>
        <li>Osaka</li>
        <li>Hakata</li>
        <li>Kobe</li>
      </ul>
    </WebLayout>
  );
}
