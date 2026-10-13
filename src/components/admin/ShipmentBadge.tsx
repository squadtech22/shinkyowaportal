import { Anchor, PackageCheck, Ship } from "lucide-react";
import { Badge } from "./ui";
import { SHIPMENT_STATUS_LABELS as LABELS, type ShipmentStatus } from "@/lib/shipment-status";

const STATUS = {
  upcoming: { label: LABELS.upcoming, tone: "blue", icon: Anchor },
  at_sea: { label: LABELS.at_sea, tone: "amber", icon: Ship },
  arrived: { label: LABELS.arrived, tone: "green", icon: PackageCheck },
} as const;

export default function ShipmentBadge({ status }: { status: ShipmentStatus }) {
  const s = STATUS[status];
  return (
    <Badge tone={s.tone}>
      <s.icon className="size-3" /> {s.label}
    </Badge>
  );
}
