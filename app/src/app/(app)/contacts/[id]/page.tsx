"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import {
  subscribeContacts, subscribeLoans, subscribeTransactions,
  subscribeLoanPayments, addLoanPayment
} from "@/lib/firebase/firestore";
import { formatCurrency, formatDate, daysUntil } from "@/lib/utils";
import { getCategoryIcon, getCategoryLabel } from "@/lib/constants";
import {
  ArrowLeft, Mail, Phone, TrendingUp, TrendingDown, Wallet,
  AlertTriangle, CheckCircle, Clock, CreditCard, X
} from "lucide-react";
import { Timestamp } from "firebase/firestore";
import type { Contact, Loan, Transaction, LoanPayment } from "@/types";

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { user } = useAuth();

  const [contact, setContact] = useState<Contact | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payments, setPayments] = useState<Record<string, LoanPayment[]>>({});
  const [payingLoan, setPayingLoan] = useState<Loan | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    const unsub1 = subscribeContacts(user.uid, (list) => {
      setContact(list.find((c) => c.id === id) || null);
    });
    const unsub2 = subscribeLoans(user.uid, (list) => {
      setLoans(list.filter((l) => l.contactId === id));
    });
    const unsub3 = subscribeTransactions(user.uid, (list) => {
      setTransactions(list.filter((t) => t.contactId === id));
    });
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [user, id]);

  useEffect(() => {
    const unsubs: (() => void)[] = [];
    loans.forEach((loan) => {
      const unsub = subscribeLoanPayments(loan.id, (list) => {
        setPayments((prev) => ({ ...prev, [loan.id]: list }));
      });
      unsubs.push(unsub);
    });
    return () => unsubs.forEach((u) => u());
  }, [loans]);

  if (!contact) {
    return (
      <div className="text-center py-20 text-gray-400">
        {user ? "Loading contact..." : "Please sign in"}
      </div>
    );
  }

  const activeLoans = loans.filter((l) => l.status !== "paid");
  const paidLoans = loans.filter((l) => l.status === "paid");

  const totalLent = activeLoans
    .filter((l) => l.direction === "lent")
    .reduce((s, l) => s + l.outstandingBalance, 0);
  const totalBorrowed = activeLoans
    .filter((l) => l.direction === "borrowed")
    .reduce((s, l) => s + l.outstandingBalance, 0);

  const historicLent = loans
    .filter((l) => l.direction === "lent")
    .reduce((s, l) => s + l.principalAmount, 0);
  const historicBorrowed = loans
    .filter((l) => l.direction === "borrowed")
    .reduce((s, l) => s + l.principalAmount, 0);
  const totalReceived = loans
    .filter((l) => l.direction === "lent")
    .reduce((s, l) => s + (l.principalAmount - l.outstandingBalance), 0);
  const totalPaidBack = loans
    .filter((l) => l.direction === "borrowed")
    .reduce((s, l) => s + (l.principalAmount - l.outstandingBalance), 0);

  const netBalance = totalLent - totalBorrowed;

  async function handlePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !payingLoan || !payAmount) return;
    setSaving(true);
    try {
      await addLoanPayment(
        {
          loanId: payingLoan.id,
          userId: user.uid,
          amount: parseFloat(payAmount),
          date: Timestamp.now(),
          note: payNote,
          createdAt: Timestamp.now(),
        },
        payingLoan
      );
      setPayingLoan(null);
      setPayAmount("");
      setPayNote("");
    } finally {
      setSaving(false);
    }
  }

  const initials = contact.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  const overdueLoans = activeLoans.filter((l) =>
    l.status === "overdue" || (l.dueDate && daysUntil(l.dueDate) < 0)
  );

  return (
    <div>
      <button
        onClick={() => router.push("/contacts")}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4 text-sm"
      >
        <ArrowLeft size={16} /> Back to Contacts
      </button>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-sm">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-2xl font-bold">
            {initials}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{contact.name}</h1>
            <div className="flex flex-wrap gap-4 mt-1 text-sm text-gray-500">
              {contact.email && (
                <span className="flex items-center gap-1"><Mail size={14} /> {contact.email}</span>
              )}
              {contact.phone && (
                <span className="flex items-center gap-1"><Phone size={14} /> {contact.phone}</span>
              )}
            </div>
          </div>
        </div>

        {netBalance !== 0 && (
          <div className={`rounded-xl p-4 border-2 ${netBalance > 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
              {netBalance > 0 ? `${contact.name} owes you` : `You owe ${contact.name}`}
            </p>
            <p className={`text-3xl font-bold ${netBalance > 0 ? "text-green-600" : "text-red-500"}`}>
              {formatCurrency(Math.abs(netBalance))}
            </p>
          </div>
        )}
        {netBalance === 0 && loans.length > 0 && (
          <div className="rounded-xl p-4 border-2 bg-gray-50 border-gray-200 text-center">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Balance</p>
            <p className="text-3xl font-bold text-gray-600">All settled</p>
          </div>
        )}
      </div>

      {overdueLoans.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <AlertTriangle className="text-red-500 flex-shrink-0" size={20} />
          <div>
            <p className="font-semibold text-red-700">
              {overdueLoans.length} overdue loan{overdueLoans.length > 1 ? "s" : ""}
            </p>
            <p className="text-sm text-red-600">
              Total overdue: {formatCurrency(overdueLoans.reduce((s, l) => s + l.outstandingBalance, 0))}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <TrendingUp className="text-red-500" size={16} />
            </div>
            <span className="text-xs font-medium text-gray-500">Total Lent</span>
          </div>
          <p className="text-xl font-bold text-red-500">{formatCurrency(historicLent)}</p>
          <p className="text-xs text-gray-400 mt-0.5">All time</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <TrendingDown className="text-green-600" size={16} />
            </div>
            <span className="text-xs font-medium text-gray-500">You Received</span>
          </div>
          <p className="text-xl font-bold text-green-600">{formatCurrency(totalReceived)}</p>
          <p className="text-xs text-gray-400 mt-0.5">Paid back to you</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <TrendingDown className="text-green-600" size={16} />
            </div>
            <span className="text-xs font-medium text-gray-500">Total Borrowed</span>
          </div>
          <p className="text-xl font-bold text-green-600">{formatCurrency(historicBorrowed)}</p>
          <p className="text-xs text-gray-400 mt-0.5">From this person</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <TrendingUp className="text-red-500" size={16} />
            </div>
            <span className="text-xs font-medium text-gray-500">You Paid Back</span>
          </div>
          <p className="text-xl font-bold text-red-500">{formatCurrency(totalPaidBack)}</p>
          <p className="text-xs text-gray-400 mt-0.5">To this person</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Wallet size={18} /> Active Loans
          </h2>
          <Link
            href="/borrowing"
            className="text-sm text-indigo-600 hover:underline"
          >
            + New loan
          </Link>
        </div>
        {activeLoans.length === 0 ? (
          <p className="text-gray-400 text-sm py-6 text-center">No active loans with this person.</p>
        ) : (
          <div className="space-y-3">
            {activeLoans.map((loan) => {
              const pct = loan.principalAmount > 0
                ? ((loan.principalAmount - loan.outstandingBalance) / loan.principalAmount) * 100
                : 0;
              const isOverdue = loan.status === "overdue" || (loan.dueDate && daysUntil(loan.dueDate) < 0);
              const days = loan.dueDate ? daysUntil(loan.dueDate) : null;
              const loanPayments = payments[loan.id] || [];

              return (
                <div
                  key={loan.id}
                  className={`rounded-xl p-4 border ${isOverdue ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${loan.direction === "lent" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                          {loan.direction === "lent" ? "LENT" : "BORROWED"}
                        </span>
                        {isOverdue ? (
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-500 text-white flex items-center gap-1">
                            <AlertTriangle size={10} /> OVERDUE
                          </span>
                        ) : days !== null && days <= 7 && days >= 0 ? (
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700 flex items-center gap-1">
                            <Clock size={10} /> Due in {days}d
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-gray-700">{loan.description}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Issued: {formatDate(loan.dateIssued)}
                        {loan.dueDate && <> · Due: {formatDate(loan.dueDate)}</>}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">{formatCurrency(loan.outstandingBalance)}</p>
                      <p className="text-xs text-gray-400">of {formatCurrency(loan.principalAmount)}</p>
                    </div>
                  </div>

                  <div className="w-full bg-white rounded-full h-2 mb-3">
                    <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>

                  {loanPayments.length > 0 && (
                    <details className="mb-3">
                      <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                        {loanPayments.length} payment{loanPayments.length !== 1 ? "s" : ""} recorded
                      </summary>
                      <div className="mt-2 space-y-1">
                        {loanPayments.map((p) => (
                          <div key={p.id} className="flex justify-between text-xs bg-white rounded p-2">
                            <span className="text-gray-600">{formatDate(p.date)} {p.note && `· ${p.note}`}</span>
                            <span className="font-semibold text-green-600">{formatCurrency(p.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  <button
                    onClick={() => setPayingLoan(loan)}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-white border border-indigo-200 text-indigo-600 rounded-lg font-semibold text-sm hover:bg-indigo-50 transition"
                  >
                    <CreditCard size={14} /> Record Payment
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {transactions.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Related Transactions</h2>
          <div className="space-y-2">
            {transactions.slice(0, 10).map((t) => (
              <div key={t.id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50">
                <span className="text-xl">{getCategoryIcon(t.category)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{t.description}</p>
                  <p className="text-xs text-gray-400">{getCategoryLabel(t.category)} · {formatDate(t.date)}</p>
                </div>
                <span className={`text-sm font-bold ${t.type === "income" ? "text-green-600" : "text-red-500"}`}>
                  {t.type === "income" ? "+" : "-"}{formatCurrency(t.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {paidLoans.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CheckCircle size={18} className="text-green-500" /> Completed Loans
          </h2>
          <div className="space-y-2">
            {paidLoans.map((loan) => (
              <div key={loan.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {loan.direction === "lent" ? "Lent" : "Borrowed"} · {loan.description}
                  </p>
                  <p className="text-xs text-gray-500">Fully paid · {formatDate(loan.dateIssued)}</p>
                </div>
                <span className="font-bold text-green-700">{formatCurrency(loan.principalAmount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {payingLoan && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-lg text-gray-900">Record Payment</h2>
              <button onClick={() => setPayingLoan(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Outstanding: <strong>{formatCurrency(payingLoan.outstandingBalance)}</strong>
            </p>
            <form onSubmit={handlePayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input
                  type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="0.00" min="0.01" max={payingLoan.outstandingBalance} step="0.01" required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setPayAmount(String(payingLoan.outstandingBalance))}
                  className="text-xs text-indigo-600 mt-1 hover:underline"
                >
                  Pay full amount
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
                <input
                  type="text" value={payNote} onChange={(e) => setPayNote(e.target.value)}
                  placeholder="Payment note"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                type="submit" disabled={saving}
                className="w-full py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50"
              >
                {saving ? "..." : "Record Payment"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
