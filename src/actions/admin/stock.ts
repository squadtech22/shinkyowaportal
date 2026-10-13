"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { db } from "@/lib/db";
import { formReader, runAction, type ActionState } from "@/lib/admin/actions";
import { authorize, authorizeAny, can, NotAllowedError } from "@/lib/admin/auth";
import { setFlash } from "@/lib/admin/flash";
import { FUELS, TRANSMISSIONS } from "@/lib/admin/lookups";
import { DOCUMENT_KEYS } from "@/lib/documents";
import { isVehicleStatus, STATUS_INFO, VEHICLE_STATUSES } from "@/lib/vehicle-status";
import { deleteUpload, filesFrom, saveUpload, stockUploadUrl } from "@/lib/uploads";

const UPLOAD_PREFIX = "/uploads/";

/** Deletes a photo file if it was uploaded through the admin panel. */
const removePhoto = (url: string | null | undefined) =>
  url?.startsWith(UPLOAD_PREFIX) ? deleteUpload(url.slice(UPLOAD_PREFIX.length), "stock") : Promise.resolve();

function parseImages(text: string | null): string[] {
  try {
    const v = JSON.parse(text ?? "[]");
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

type Purchase = {
  auctionId: number | null;
  lotNo: string | null;
  purchaseDate: string | null;
  depositPercent: number | null;
  exchangeRate: number | null;
  boughtPrice: number;
  notes: string | null;
  expenses: [number, number][];
};

/** Purchase & costs fields of the stock form (see PurchaseFields). */
async function readPurchase(f: ReturnType<typeof formReader>): Promise<Purchase> {
  const [types] = await db.query<RowDataPacket[]>("SELECT id FROM expense_types");
  const rateText = f.raw("exchange_rate").replace(/[,\s]/g, "");
  let exchangeRate: number | null = null;
  if (rateText) {
    if (/^\d{1,7}(\.\d{1,3})?$/.test(rateText) && Number(rateText) > 0) exchangeRate = Number(rateText);
    else f.errors.exchange_rate = "Enter a rate like 150 or 150.25";
  }
  return {
    auctionId: f.id("auction_id"),
    lotNo: f.optional("lot_no", 50),
    purchaseDate: f.date("purchase_date", { label: "Purchase date" }),
    depositPercent: f.int("deposit_percent", { min: 0, max: 100, label: "Deposit" }),
    exchangeRate,
    boughtPrice: f.int("bought_price", { min: 0, label: "Bought price" }) ?? 0,
    notes: f.optional("notes", 500),
    expenses: types
      .map((t): [number, number] => [Number(t.id), f.int(`expense_${t.id}`, { min: 0, label: "Amount" }) ?? 0])
      .filter(([, amount]) => amount > 0),
  };
}

/** Saves the purchase row and expense lines; an all-blank purchase is removed. */
async function savePurchase(connection: PoolConnection, stockId: number, p: Purchase) {
  const empty =
    !p.auctionId && !p.lotNo && !p.purchaseDate && p.depositPercent === null && !p.exchangeRate &&
    !p.boughtPrice && !p.notes && !p.expenses.length;
  await connection.query("DELETE FROM stock_expenses WHERE stock_id = ?", [stockId]);
  if (empty) {
    await connection.query("DELETE FROM stock_purchases WHERE stock_id = ?", [stockId]);
    return;
  }
  await connection.query(
    `INSERT INTO stock_purchases (stock_id, auction_id, lot_no, purchase_date, deposit_percent, exchange_rate,
       bought_price, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE auction_id = VALUES(auction_id), lot_no = VALUES(lot_no),
       purchase_date = VALUES(purchase_date), deposit_percent = VALUES(deposit_percent),
       exchange_rate = VALUES(exchange_rate), bought_price = VALUES(bought_price), notes = VALUES(notes),
       updated_at = NOW()`,
    [stockId, p.auctionId, p.lotNo, p.purchaseDate, p.depositPercent, p.exchangeRate, p.boughtPrice, p.notes],
  );
  if (p.expenses.length) {
    await connection.query(
      "INSERT INTO stock_expenses (stock_id, expense_type_id, amount, created_at, updated_at) VALUES ?",
      [p.expenses.map(([typeId, amount]) => [stockId, typeId, amount, new Date(), new Date()])],
    );
  }
}

export async function saveStock(id: number | null, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorizeAny("stock.manage", "stock.add");
    // With only stock.add: vehicles are always hidden from the website, and
    // only their own hidden vehicles can be edited.
    const canPublish = can(user, "stock.manage");
    if (id && !canPublish) {
      const [rows] = await db.query<RowDataPacket[]>(
        "SELECT id FROM stocks WHERE id = ? AND created_by = ? AND is_listed = 0", [id, user.id],
      );
      if (!rows.length) throw new NotAllowedError();
    }
    const f = formReader(form);
    // Hidden vehicles (bought for a customer) only need the vehicle card.
    const listed = canPublish && f.checked("is_listed");
    // All Vehicles uses no category; every listed vehicle appears in that listing.
    const allVehicles = f.raw("category_id") === "all";
    const hasSalesStatus = canPublish && form.has("sales_status");
    const salesStatus = hasSalesStatus ? f.oneOf("sales_status", ["automatic", ...VEHICLE_STATUSES] as const, "Sales status") : "automatic";
    const statusOverride = salesStatus === "automatic" ? null : salesStatus;
    const data = {
      sid: f.int("sid", { required: true, min: 1, label: "Stock number" }),
      makeId: f.id("make_id", { required: true, label: "Make" }),
      model: f.text("model", { required: true, max: 100, label: "Model" }),
      year: f.int("year", { required: true, min: 1950, max: new Date().getFullYear() + 1, label: "Year" }),
      chassis: f.text("chassis", { required: true, max: 255, label: "Chassis" }),
      bodyTypeId: f.id("body_type_id", { required: listed, label: "Body type" }),
      fuel: f.oneOf("fuel", FUELS, "Fuel"),
      transmission: f.oneOf("transmission", TRANSMISSIONS, "Transmission"),
      mileage: f.int("mileage", { required: listed, min: 0, label: "Mileage" }),
      engine: f.int("engine", { required: listed, min: 0, label: "Engine" }),
      doors: f.int("doors", { required: listed, min: 0, max: 9, label: "Doors" }),
      color: f.optional("color", 255),
      categoryId: allVehicles ? null : f.id("category_id", { required: listed, label: "Website section" }),
      countryId: f.id("country_id"),
      currencyId: f.id("currency_id", { required: true, label: "Currency" }),
      fob: f.int("fob", { required: listed, min: 0, label: "FOB price" }),
    };
    if (data.categoryId) {
      const [categories] = await db.query<RowDataPacket[]>("SELECT id FROM categories WHERE id = ?", [data.categoryId]);
      if (!categories.length) f.errors.category_id = "Choose a valid website section";
    }
    // Features typed as name / value rows; blank rows are skipped.
    const featureValues = form.getAll("feature_value").map((v) => String(v).trim());
    const features = form
      .getAll("feature_name")
      .map((n, i) => ({ name: String(n).trim().slice(0, 60), value: (featureValues[i] ?? "").slice(0, 120) }))
      .filter((feature) => feature.name || feature.value);
    if (features.some((feature) => !feature.name)) f.errors.features = "Give every feature a name";
    if (features.length > 60) f.errors.features = "At most 60 features";
    const purchase = form.get("finance") === "1" && can(user, "finance.manage") ? await readPurchase(f) : null;
    f.done();

    // Photos: optional new main photo, extra gallery uploads, removals.
    const [mainFile] = filesFrom(form, "thumbnail");
    const galleryFiles = filesFrom(form, "images");
    const requestedRemovals = new Set(form.getAll("remove_image").map(String));
    const saved: string[] = [];
    let obsolete: string[] = [];
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      let existing: { thumbnail: string | null; images: string[] } = { thumbnail: null, images: [] };
      if (id) {
        const [rows] = await connection.query<RowDataPacket[]>(
          "SELECT thumbnail, images FROM stocks WHERE id = ? FOR UPDATE", [id],
        );
        if (!rows[0]) throw new Error("Vehicle not found");
        existing = { thumbnail: rows[0].thumbnail, images: parseImages(rows[0].images) };
      }
      const existingPhotos = [existing.thumbnail, ...existing.images].filter((url): url is string => Boolean(url));
      // A submitted removal must belong to this vehicle.
      const remove = new Set(existingPhotos.filter((url) => requestedRemovals.has(url)));
      const upload = async (file: File) => {
        const stored = await saveUpload(file, "stock");
        saved.push(stored);
        return stockUploadUrl(stored);
      };
      const newMain = mainFile ? await upload(mainFile) : null;
      const added: string[] = [];
      for (const file of galleryFiles) added.push(await upload(file));
      const images = [...existing.images.filter((url) => !remove.has(url)), ...added];
      let thumbnail = newMain ?? (existing.thumbnail && !remove.has(existing.thumbnail) ? existing.thumbnail : null);
      if (!thumbnail && images.length) thumbnail = images.shift()!;
      const kept = new Set([thumbnail, ...images]);
      obsolete = [...new Set(existingPhotos.filter((url) => !kept.has(url)))];

      const values = [
        String(data.sid), thumbnail, JSON.stringify(images), data.chassis, data.makeId, data.model, String(data.year),
        data.fob ?? 0, data.currencyId, String(data.mileage ?? 0), String(data.doors ?? 0), data.transmission,
        data.bodyTypeId, data.fuel, data.categoryId, data.countryId, data.engine ?? 0, data.color, JSON.stringify(features),
        listed ? 1 : 0,
      ];
      if (id) {
        await connection.query(
          `UPDATE stocks SET sid = ?, thumbnail = ?, images = ?, chassis = ?, make_id = ?, model = ?, year = ?, fob = ?,
             currency_id = ?, mileage = ?, doors = ?, transmission = ?, body_type_id = ?, fuel = ?, category_id = ?,
             country_id = ?, engine = ?, color = ?, features = ?, is_listed = ?,
             status_override = IF(?, ?, status_override), updated_at = NOW()
           WHERE id = ?`,
          [...values, hasSalesStatus ? 1 : 0, statusOverride, id],
        );
        if (purchase) await savePurchase(connection, id, purchase);
      } else {
        const [res] = await connection.query<ResultSetHeader>(
          `INSERT INTO stocks (sid, thumbnail, images, chassis, make_id, model, year, fob, currency_id, mileage, doors,
             transmission, body_type_id, fuel, category_id, country_id, engine, color, features, is_listed, status_override,
             created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [...values, statusOverride, user.id],
        );
        if (purchase) await savePurchase(connection, res.insertId, purchase);
      }
      await connection.commit();
    } catch (err) {
      await connection.rollback().catch(() => {});
      await Promise.all(saved.map((stored) => deleteUpload(stored, "stock")));
      throw err;
    } finally {
      connection.release();
    }
    // Only remove this vehicle's unused photos after its changes have committed.
    await Promise.all(obsolete.map(removePhoto));
    await setFlash(id ? "Vehicle updated" : listed
      ? "Vehicle added — it is now live on the website"
      : canPublish
        ? "Vehicle added (hidden from the website)"
        : "Vehicle added to stock — a manager can show it on the website");
    revalidatePath("/", "layout");
    revalidatePath("/admin", "layout");
    redirect("/admin/stock");
  });
}

/** Sets the sales label without changing reservations, money or shipment records. */
export async function updateStockStatus(stockId: number, statusString: string): Promise<ActionState> {
  return runAction(async () => {
    await authorize("stock.manage");
    if (!Number.isSafeInteger(stockId) || stockId < 1) return { error: "Choose a valid vehicle." };
    if (statusString !== "automatic" && !isVehicleStatus(statusString)) return { error: "Choose a valid sales status." };
    const statusOverride = statusString === "automatic" ? null : statusString;
    const [[stock]] = await db.query<RowDataPacket[]>("SELECT id FROM stocks WHERE id = ?", [stockId]);
    if (!stock) return { error: "Vehicle not found." };
    const [updated] = await db.query<ResultSetHeader>(
      "UPDATE stocks SET status_override = ?, updated_at = NOW() WHERE id = ?", [statusOverride, stockId],
    );
    if (!updated.affectedRows) return { error: "Vehicle not found." };
    const message = statusOverride
      ? `Sales status updated to ${STATUS_INFO[statusOverride].label}.`
      : "Sales status now follows the automatic lifecycle.";
    await setFlash(message);
    revalidatePath("/admin", "layout");
    revalidatePath("/", "layout");
    return { ok: true, message };
  });
}

export async function deleteStock(id: number): Promise<ActionState> {
  return runAction(async () => {
    await authorize("stock.manage");
    const connection = await db.getConnection();
    let car: RowDataPacket;
    let documentFiles: string[] = [];
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT thumbnail, images, customer_account_id FROM stocks WHERE id = ? FOR UPDATE", [id],
      );
      if (!rows[0]) {
        await connection.rollback();
        return { error: "Vehicle not found." };
      }
      car = rows[0];
      if (car.customer_account_id) {
        await connection.rollback();
        return { error: "This vehicle is reserved for a customer. Release the reservation first." };
      }
      const [documentRows] = await connection.query<RowDataPacket[]>(
        `SELECT ${DOCUMENT_KEYS.join(", ")} FROM documents WHERE stock_id = ? FOR UPDATE`, [id],
      );
      if (documentRows[0]) {
        documentFiles = [...new Set(DOCUMENT_KEYS.map((key) => documentRows[0][key])
          .filter((stored): stored is string => typeof stored === "string" && Boolean(stored)))];
      }
      await connection.query("DELETE FROM stocks WHERE id = ?", [id]);
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
    await removePhoto(car.thumbnail);
    for (const url of parseImages(car.images)) await removePhoto(url);
    await Promise.all(documentFiles.map((stored) => deleteUpload(stored, "documents")));
    await setFlash("Vehicle deleted");
    revalidatePath("/", "layout");
    redirect("/admin/stock");
  });
}
