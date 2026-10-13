export const SHIPMENT_STATUSES = ["upcoming", "at_sea", "arrived"] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  upcoming: "Loading",
  at_sea: "At sea",
  arrived: "Arrived",
};

export const isShipmentStatus = (value: unknown): value is ShipmentStatus =>
  (SHIPMENT_STATUSES as readonly unknown[]).includes(value);
