import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  writeBatch,
  getDocs,
} from "firebase/firestore";
import { getAppDb } from "./config";

function db() { return getAppDb(); }
import type { Transaction, Budget, Contact, Loan, LoanPayment } from "@/types";

// ── Transactions ──
export function subscribeTransactions(
  userId: string,
  callback: (txns: Transaction[]) => void
) {
  const q = query(
    collection(db(), "transactions"),
    where("userId", "==", userId),
    orderBy("date", "desc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Transaction));
  });
}

export async function addTransaction(data: Omit<Transaction, "id">) {
  return addDoc(collection(db(), "transactions"), data);
}

export async function deleteTransaction(id: string) {
  return deleteDoc(doc(db(), "transactions", id));
}

// ── Budgets ──
export function subscribeBudgets(
  userId: string,
  month: string,
  callback: (budgets: Budget[]) => void
) {
  const q = query(
    collection(db(), "budgets"),
    where("userId", "==", userId),
    where("month", "==", month)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Budget));
  });
}

export async function addBudget(data: Omit<Budget, "id">) {
  return addDoc(collection(db(), "budgets"), data);
}

export async function updateBudget(id: string, data: Partial<Budget>) {
  return updateDoc(doc(db(), "budgets", id), data);
}

export async function deleteBudget(id: string) {
  return deleteDoc(doc(db(), "budgets", id));
}

// ── Contacts ──
export function subscribeContacts(
  userId: string,
  callback: (contacts: Contact[]) => void
) {
  const q = query(
    collection(db(), "contacts"),
    where("userId", "==", userId),
    orderBy("name")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Contact));
  });
}

export async function addContact(data: Omit<Contact, "id">) {
  return addDoc(collection(db(), "contacts"), data);
}

export async function updateContact(id: string, data: Partial<Contact>) {
  return updateDoc(doc(db(), "contacts", id), data);
}

export async function deleteContact(id: string) {
  return deleteDoc(doc(db(), "contacts", id));
}

// ── Loans ──
export function subscribeLoans(
  userId: string,
  callback: (loans: Loan[]) => void
) {
  const q = query(
    collection(db(), "loans"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Loan));
  });
}

export async function addLoan(data: Omit<Loan, "id">) {
  return addDoc(collection(db(), "loans"), data);
}

export async function updateLoan(id: string, data: Partial<Loan>) {
  return updateDoc(doc(db(), "loans", id), { ...data, updatedAt: Timestamp.now() });
}

// ── Loan Payments ──
export async function addLoanPayment(payment: Omit<LoanPayment, "id">, loan: Loan) {
  const batch = writeBatch(db());
  const paymentRef = doc(collection(db(), "loanPayments"));
  batch.set(paymentRef, payment);

  const newBalance = loan.outstandingBalance - payment.amount;
  const loanUpdate: Partial<Loan> = {
    outstandingBalance: Math.max(0, newBalance),
    updatedAt: Timestamp.now(),
  };
  if (newBalance <= 0) loanUpdate.status = "paid";
  batch.update(doc(db(), "loans", loan.id), loanUpdate);

  await batch.commit();
}

export function subscribeLoanPayments(
  loanId: string,
  callback: (payments: LoanPayment[]) => void
) {
  const q = query(
    collection(db(), "loanPayments"),
    where("loanId", "==", loanId),
    orderBy("date", "desc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LoanPayment));
  });
}
