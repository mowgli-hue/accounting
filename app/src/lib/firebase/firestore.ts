import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  Timestamp,
  writeBatch,
  getDoc,
  type Query,
  type DocumentData,
} from "firebase/firestore";
import { getAppDb } from "./config";
import type { Transaction, Budget, Contact, Loan, LoanPayment, Agreement } from "@/types";

function db() { return getAppDb(); }

function subscribe<T extends { id: string }>(
  q: Query<DocumentData>,
  callback: (items: T[]) => void,
  sort?: (a: T, b: T) => number,
) {
  return onSnapshot(
    q,
    (snap) => {
      let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as unknown as T);
      if (sort) items = items.sort(sort);
      callback(items);
    },
    (err) => {
      console.error("Firestore subscribe error:", err);
      alert("Could not load data: " + err.message + "\n\nIf you see 'permission-denied' — update your Firestore Security Rules to allow authenticated reads.");
    }
  );
}

function tsToMs(t: unknown): number {
  if (t && typeof t === "object" && "toMillis" in t && typeof (t as Timestamp).toMillis === "function") {
    return (t as Timestamp).toMillis();
  }
  return 0;
}

// ── Transactions ──
export function subscribeTransactions(
  userId: string,
  callback: (txns: Transaction[]) => void
) {
  const q = query(collection(db(), "transactions"), where("userId", "==", userId));
  return subscribe<Transaction>(q, callback, (a, b) => tsToMs(b.date) - tsToMs(a.date));
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
  return subscribe<Budget>(q, callback);
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
  const q = query(collection(db(), "contacts"), where("userId", "==", userId));
  return subscribe<Contact>(q, callback, (a, b) => a.name.localeCompare(b.name));
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
  const q = query(collection(db(), "loans"), where("userId", "==", userId));
  return subscribe<Loan>(q, callback, (a, b) => tsToMs(b.createdAt) - tsToMs(a.createdAt));
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
  const q = query(collection(db(), "loanPayments"), where("loanId", "==", loanId));
  return subscribe<LoanPayment>(q, callback, (a, b) => tsToMs(b.date) - tsToMs(a.date));
}

// ── Agreements ──
export async function createAgreement(data: Omit<Agreement, "id">) {
  const ref = await addDoc(collection(db(), "agreements"), data);
  return ref.id;
}

export async function getAgreement(id: string): Promise<Agreement | null> {
  const snap = await getDoc(doc(db(), "agreements", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Agreement;
}

export async function updateAgreement(id: string, data: Partial<Agreement>) {
  return updateDoc(doc(db(), "agreements", id), data);
}

export function subscribeAgreements(
  userId: string,
  callback: (agreements: Agreement[]) => void
) {
  const q = query(collection(db(), "agreements"), where("lenderUserId", "==", userId));
  return subscribe<Agreement>(q, callback, (a, b) => tsToMs(b.createdAt) - tsToMs(a.createdAt));
}

export async function createLoanWithAgreement(
  loanData: Omit<Loan, "id">,
  agreementTerms: string,
  borrowerEmail?: string,
  borrowerPhone?: string,
) {
  const loanRef = await addDoc(collection(db(), "loans"), loanData);

  const agreementData: Omit<Agreement, "id"> = {
    loanId: loanRef.id,
    lenderUserId: loanData.userId,
    lenderName: "",
    borrowerName: loanData.contactName,
    amount: loanData.principalAmount,
    currency: loanData.currency,
    description: loanData.description,
    terms: agreementTerms,
    dateIssued: loanData.dateIssued,
    status: "pending",
    reminders: [],
    createdAt: Timestamp.now(),
  };
  if (borrowerEmail) agreementData.borrowerEmail = borrowerEmail;
  if (borrowerPhone) agreementData.borrowerPhone = borrowerPhone;
  if (loanData.dueDate) agreementData.dueDate = loanData.dueDate;

  const agreementId = await createAgreement(agreementData);
  await updateDoc(doc(db(), "loans", loanRef.id), {
    agreementId,
    agreementStatus: "pending",
  });

  return { loanId: loanRef.id, agreementId };
}
