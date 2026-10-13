import "server-only";
import type { PurchaseFieldsProps } from "@/components/admin/PurchaseFields";
import { can, type AdminUser } from "@/lib/admin/auth";
import { getDisplay } from "@/lib/admin/display";
import { purchaseValues } from "@/lib/admin/finance";
import {
  auctionOptions, bodyTypeOptions, categoryOptions, countryOptions, currencyOptions, expenseTypeOptions, featureNames,
  makeOptions,
} from "@/lib/admin/lookups";

/** Select options and feature name suggestions for <StockForm>. */
export async function stockFormOptions() {
  const [makes, bodyTypes, categories, countries, currencies, featureSuggestions] = await Promise.all([
    makeOptions(),
    bodyTypeOptions(),
    categoryOptions(),
    countryOptions(),
    currencyOptions(),
    featureNames(),
  ]);
  return { options: { makes, bodyTypes, categories, countries, currencies }, featureSuggestions };
}

/** The "Purchase & costs" card for users with finance.view, else undefined. */
export async function financeFormProps(
  user: AdminUser,
  stockId: number | null,
  sale: PurchaseFieldsProps["sale"],
): Promise<PurchaseFieldsProps | undefined> {
  if (!can(user, "finance.view")) return undefined;
  const [values, auctions, expenseTypes, display] = await Promise.all([
    purchaseValues(stockId),
    auctionOptions(),
    expenseTypeOptions(),
    getDisplay(),
  ]);
  return { canEdit: can(user, "finance.manage"), values, auctions, expenseTypes, sale, display };
}
