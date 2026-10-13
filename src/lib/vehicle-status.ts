export const VEHICLE_STATUSES = ["available", "reserved", "shipped", "cleared"] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export const STATUS_INFO: Record<VehicleStatus, { label: string; tone: "green" | "amber" | "blue" | "slate" }> = {
  available: { label: "Available", tone: "green" },
  reserved: { label: "Reserved", tone: "amber" },
  shipped: { label: "Shipped", tone: "blue" },
  cleared: { label: "Cleared", tone: "slate" },
};

export const isVehicleStatus = (value: string): value is VehicleStatus =>
  (VEHICLE_STATUSES as readonly string[]).includes(value);
