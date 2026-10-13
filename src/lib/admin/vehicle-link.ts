import { can, type AdminUser } from "./auth";

/**
 * Where a vehicle's name links to in the admin: its editor when the user may
 * edit it (stock.manage, or stock.add for their own hidden vehicles), else its
 * website page when it is listed there, else nowhere (null) — a hidden
 * vehicle has no website page. Needs `is_listed` and `created_by` on the row.
 */
export function vehicleHref(user: AdminUser, car: Record<string, unknown>) {
  const listed = Number(car.is_listed) === 1;
  if (can(user, "stock.manage")) return `/admin/stock/${car.id}`;
  if (can(user, "stock.add") && !listed && Number(car.created_by) === user.id) return `/admin/stock/${car.id}`;
  return listed ? `/vehicle-info/${car.id}` : null;
}
