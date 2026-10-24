import type { Part, PartPrice } from '@/types'

/** True when the currency key is an ISO code (USD, EUR...) rather than a bare symbol. */
export function hasExplicitCurrency(price: Pick<PartPrice, 'currencyKey'>): boolean {
  return /^[A-Z]{3}$/.test(price.currencyKey)
}

/** The price as it should be displayed: exactly the page's amount text plus the currency it was listed in. */
export function formatPrice(price: PartPrice): string {
  return hasExplicitCurrency(price) ? `${price.raw} ${price.currencyKey}` : `${price.currencyKey}${price.raw}`
}

/** Short explanation shown beside a price. Prices are never converted or estimated. */
export function priceCaveat(price: PartPrice): string {
  return hasExplicitCurrency(price)
    ? 'Listed price read from the source page. Not converted, verified or guaranteed current.'
    : `Listed price read from the source page. The page does not state a currency, so “${price.currencyKey}” is shown as printed. Not converted, verified or guaranteed current.`
}

export function priced(parts: Part[]): Part[] {
  return parts.filter((part) => part.price !== undefined)
}

/** Distinct currency keys among priced parts, sorted. */
export function currencyKeys(parts: Part[]): string[] {
  return Array.from(new Set(priced(parts).map((part) => part.price!.currencyKey))).sort()
}
