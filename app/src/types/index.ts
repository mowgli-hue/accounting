import { Timestamp } from "firebase/firestore";

export interface User {
  id: string;
  email: string;
  displayName: string;
  currency: string;
  createdAt: Timestamp;
}

export interface Transaction {
  id: string;
  userId: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string;
  date: Timestamp;
  contactId?: string;
  loanId?: string;
  createdAt: Timestamp;
}

export interface Budget {
  id: string;
  userId: string;
  category: string;
  monthlyLimit: number;
  month: string;
  createdAt: Timestamp;
}

export interface Contact {
  id: string;
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  linkedUserId?: string;
  createdAt: Timestamp;
}

export interface Loan {
  id: string;
  userId: string;
  contactId: string;
  contactName: string;
  direction: "lent" | "borrowed";
  principalAmount: number;
  outstandingBalance: number;
  currency: string;
  description: string;
  dateIssued: Timestamp;
  dueDate?: Timestamp;
  status: "active" | "paid" | "overdue";
  agreementId?: string;
  agreementStatus?: "pending" | "signed" | "declined";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Agreement {
  id: string;
  loanId: string;
  lenderUserId: string;
  lenderName: string;
  borrowerName: string;
  borrowerEmail?: string;
  borrowerPhone?: string;
  amount: number;
  currency: string;
  description: string;
  terms: string;
  dateIssued: Timestamp;
  dueDate?: Timestamp;
  status: "pending" | "signed" | "declined" | "expired";
  signedAt?: Timestamp;
  signedByName?: string;
  signedByIP?: string;
  signatureNote?: string;
  reminders: AgreementReminder[];
  createdAt: Timestamp;
}

export interface AgreementReminder {
  sentAt: Timestamp;
  type: "initial" | "7day" | "3day" | "1day" | "overdue" | "manual";
}

export interface LoanPayment {
  id: string;
  loanId: string;
  userId: string;
  amount: number;
  date: Timestamp;
  note?: string;
  createdAt: Timestamp;
}

export interface AIInsight {
  id: string;
  userId: string;
  type: "spending_pattern" | "budget_suggestion" | "anomaly" | "savings_tip";
  title: string;
  body: string;
  generatedAt: Timestamp;
  expiresAt: Timestamp;
}
