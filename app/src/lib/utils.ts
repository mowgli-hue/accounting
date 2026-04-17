import { type ClassValue, clsx } from "clsx";
import { Timestamp } from "firebase/firestore";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Timestamp | Date | string): string {
  const d = date instanceof Timestamp ? date.toDate() : new Date(date);
  return d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function getCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function toInputDate(date?: Timestamp | Date): string {
  const d = date instanceof Timestamp ? date.toDate() : date || new Date();
  return d.toISOString().split("T")[0];
}

export function daysUntil(date: Timestamp): number {
  const now = new Date();
  const target = date.toDate();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
