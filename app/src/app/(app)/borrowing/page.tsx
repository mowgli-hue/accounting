"use client";

import { useEffect, useState } from "react";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "@/contexts/auth-context";
import { subscribeLoans, subscribeContacts, addLoanPayment, createLoanWithAgreement } from "@/lib/firebase/firestore";
import { formatCurrency, formatDate, daysUntil } from "@/lib/utils";
import { Plus, X, AlertTriangle, CheckCircle, Clock, CreditCard, FileText, Copy, Send } from "lucide-react";
import type { Loan, Contact } from "@/types";

export default function BorrowingPage() {
  const { user } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [payingLoan, setPayingLoan] = useState<Loan | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "overdue" | "paid">("all");

  // Form state
  const [contactId, setContactId] = useState("");
  const [direction, setDirection] = useState<"lent" | "borrowed">("lent");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dateIssued, setDateIssued] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [createAgreement, setCreateAgreement] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newAgreementLink, setNewAgreementLink] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsub1 = subscribeLoans(user.uid, setLoans);
    const unsub2 = subscribeContacts(user.uid, setContacts);
    return () => { unsub1(); unsub2(); };
  }, [user]);

  async function handleCreateLoan(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !contactId || !amount) return;
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return;
    setSaving(true);
    try {
      const loanData = {
        userId: user.uid,
        contactId,
        contactName: contact.name,
        direction,
        principalAmount: parseFloat(amount),
        outstandingBalance: parseFloat(amount),
        currency: "USD",
        description: description || `${direction === "lent" ? "Lent to" : "Borrowed from"} ${contact.name}`,
        dateIssued: Timestamp.fromDate(new Date(dateIssued + "T12:00:00")),
        dueDate: dueDate ? Timestamp.fromDate(new Date(dueDate + "T23:59:59")) : undefined as unknown as Timestamp,
        status: "active" as const,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      if (createAgreement && direction === "lent") {
        const terms = `1. ${contact.name} ("Borrower") acknowledges receiving $${parseFloat(amount).toFixed(2)} from ${user.displayName || "the Lender"} ("Lender").\n2. Borrower agrees to repay the full amount${dueDate ? ` by ${new Date(dueDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` : ""}.\n3. Both parties agree this is a binding commitment.\n4. Partial payments are accepted and will be tracked.\n5. This agreement is digitally recorded and timestamped.`;

        const result = await createLoanWithAgreement(
          loanData,
          terms,
          contact.email,
          contact.phone,
        );

        // Update the agreement with lender name
        const { updateAgreement } = await import("@/lib/firebase/firestore");
        await updateAgreement(result.agreementId, {
          lenderName: user.displayName || user.email || "Lender",
        });

        setNewAgreementLink(`${window.location.origin}/agree/${result.agreementId}`);
      } else {
        const { addLoan } = await import("@/lib/firebase/firestore");
        await addLoan(loanData);
      }

      setAmount(""); setDescription(""); setContactId(""); setDueDate("");
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

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

  const filtered = filter === "all" ? loans : loans.filter((l) => l.status === filter);
  const totalLent = loans.filter((l) => l.status !== "paid" && l.direction === "lent").reduce((s, l) => s + l.outstandingBalance, 0);
  const totalBorrowed = loans.filter((l) => l.status !== "paid" && l.direction === "borrowed").reduce((s, l) => s + l.outstandingBalance, 0);
  const overdueCount = loans.filter((l) => l.status === "overdue").length;

  function getLoanStatusInfo(loan: Loan) {
    if (loan.status === "paid") return { icon: CheckCircle, color: "text-green-600", bg: "bg-green-50", label: "Paid" };
    if (loan.status === "overdue") return { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", label: "Overdue" };
    if (loan.dueDate) {
      const days = daysUntil(loan.dueDate);
      if (days < 0) return { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", label: `${Math.abs(days)}d overdue` };
      if (days <= 7) return { icon: Clock, color: "text-amber-600", bg: "bg-amber-50", label: `Due in ${days}d` };
    }
    return { icon: Clock, color: "text-blue-600", bg: "bg-blue-50", label: "Active" };
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Borrow & Lend</h1>
          <p className="text-gray-500 text-sm mt-1">Track money owed and owing</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 transition"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? "Cancel" : "New Loan"}
        </button>
      </div>

      {/* Overdue Warning */}
      {overdueCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <AlertTriangle className="text-red-500 flex-shrink-0" size={20} />
          <div>
            <p className="font-semibold text-red-700">{overdueCount} overdue loan{overdueCount > 1 ? "s" : ""}!</p>
            <p className="text-sm text-red-600">These loans have passed their due date and need immediate attention.</p>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Others owe you</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(totalLent)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">You owe others</p>
          <p className="text-2xl font-bold text-red-500 mt-1">{formatCurrency(totalBorrowed)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Net position</p>
          <p className={`text-2xl font-bold mt-1 ${totalLent - totalBorrowed >= 0 ? "text-green-600" : "text-red-500"}`}>
            {formatCurrency(totalLent - totalBorrowed)}
          </p>
        </div>
      </div>

      {/* New Loan Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Create New Loan</h2>
          {contacts.length === 0 ? (
            <p className="text-gray-500 text-sm">You need to <a href="/contacts" className="text-indigo-600 underline">add contacts</a> first before creating a loan.</p>
          ) : (
            <form onSubmit={handleCreateLoan} className="space-y-4">
              <div className="flex gap-2">
                <button type="button" onClick={() => setDirection("lent")}
                  className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition ${direction === "lent" ? "bg-green-100 text-green-700 border-2 border-green-300" : "bg-gray-100 text-gray-600"}`}>
                  I Lent (gave money)
                </button>
                <button type="button" onClick={() => setDirection("borrowed")}
                  className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition ${direction === "borrowed" ? "bg-red-100 text-red-700 border-2 border-red-300" : "bg-gray-100 text-gray-600"}`}>
                  I Borrowed (received)
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Person</label>
                  <select value={contactId} onChange={(e) => setContactId(e.target.value)} required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select person</option>
                    {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" min="0" step="0.01" required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date Issued</label>
                  <input type="date" value={dateIssued} onChange={(e) => setDateIssued(e.target.value)} required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date (optional)</label>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was it for?"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              {direction === "lent" && (
                <label className="flex items-center gap-3 p-3 bg-indigo-50 rounded-lg cursor-pointer border border-indigo-200">
                  <input type="checkbox" checked={createAgreement} onChange={(e) => setCreateAgreement(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded" />
                  <div>
                    <span className="text-sm font-semibold text-indigo-700 flex items-center gap-1">
                      <FileText size={14} /> Create Digital Agreement
                    </span>
                    <span className="text-xs text-indigo-500 block">Borrower must sign and agree to pay back. Sends a link they can sign.</span>
                  </div>
                </label>
              )}
              <button type="submit" disabled={saving}
                className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50">
                {saving ? "Creating..." : direction === "lent" && createAgreement ? "Create Loan & Agreement" : "Create Loan"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Agreement Created Modal */}
      {newAgreementLink && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <div className="text-center mb-4">
              <CheckCircle className="mx-auto text-green-500 mb-3" size={48} />
              <h2 className="font-bold text-lg text-gray-900">Loan & Agreement Created!</h2>
              <p className="text-sm text-gray-500 mt-1">Share this link with the borrower so they can sign the agreement.</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-xs text-gray-400 mb-1 font-semibold">AGREEMENT LINK</p>
              <p className="text-sm text-indigo-600 break-all font-mono">{newAgreementLink}</p>
            </div>
            <div className="flex gap-2 mb-4">
              <button onClick={() => { navigator.clipboard.writeText(newAgreementLink); }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-semibold text-gray-700 transition">
                <Copy size={14} /> Copy Link
              </button>
              <button onClick={() => { window.open(`https://wa.me/?text=${encodeURIComponent("Please review and sign this loan agreement: " + newAgreementLink)}`, "_blank"); }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-100 hover:bg-green-200 rounded-lg text-sm font-semibold text-green-700 transition">
                <Send size={14} /> WhatsApp
              </button>
            </div>
            <button onClick={() => setNewAgreementLink(null)}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition">
              Done
            </button>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {payingLoan && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h2 className="font-bold text-lg text-gray-900 mb-1">Record Payment</h2>
            <p className="text-sm text-gray-500 mb-4">
              {payingLoan.direction === "lent" ? `${payingLoan.contactName} paying you back` : `You paying ${payingLoan.contactName}`}
              &nbsp;&middot; Outstanding: <strong>{formatCurrency(payingLoan.outstandingBalance)}</strong>
            </p>
            <form onSubmit={handlePayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="0.00" min="0.01" max={payingLoan.outstandingBalance} step="0.01" required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                <button type="button" onClick={() => setPayAmount(String(payingLoan.outstandingBalance))}
                  className="text-xs text-indigo-600 mt-1 hover:underline">Pay full amount</button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
                <input type="text" value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Payment note"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setPayingLoan(null)}
                  className="flex-1 py-2.5 border border-gray-300 rounded-lg font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50">
                  {saving ? "..." : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {(["all", "active", "overdue", "paid"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filter === f ? "bg-indigo-100 text-indigo-700" : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === "overdue" && overdueCount > 0 && <span className="ml-1 text-red-500">({overdueCount})</span>}
          </button>
        ))}
      </div>

      {/* Loan Cards */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <p className="text-lg mb-1">No loans yet</p>
          <p className="text-sm">Create a loan to start tracking who owes what.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((loan) => {
            const info = getLoanStatusInfo(loan);
            const pct = loan.principalAmount > 0 ? ((loan.principalAmount - loan.outstandingBalance) / loan.principalAmount) * 100 : 0;
            return (
              <div key={loan.id} className={`bg-white rounded-xl border border-gray-200 p-5 ${loan.status === "overdue" ? "border-red-300 bg-red-50/30" : ""}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-bold ${loan.direction === "lent" ? "text-green-600" : "text-red-500"}`}>
                        {loan.direction === "lent" ? "LENT" : "BORROWED"}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${info.bg} ${info.color}`}>
                        <info.icon size={12} /> {info.label}
                      </span>
                      {loan.agreementId && (
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                          loan.agreementStatus === "signed" ? "bg-green-50 text-green-600" :
                          loan.agreementStatus === "declined" ? "bg-red-50 text-red-600" :
                          "bg-amber-50 text-amber-600"
                        }`}>
                          <FileText size={10} />
                          {loan.agreementStatus === "signed" ? "Signed" :
                           loan.agreementStatus === "declined" ? "Declined" : "Awaiting Signature"}
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-gray-900">{loan.contactName}</p>
                    <p className="text-sm text-gray-500">{loan.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-gray-900">{formatCurrency(loan.outstandingBalance)}</p>
                    <p className="text-xs text-gray-400">of {formatCurrency(loan.principalAmount)}</p>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
                  <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-400">
                    Issued: {formatDate(loan.dateIssued)}
                    {loan.dueDate && <> &middot; Due: {formatDate(loan.dueDate)}</>}
                  </div>
                  {loan.status !== "paid" && (
                    <button onClick={() => setPayingLoan(loan)}
                      className="flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition">
                      <CreditCard size={14} /> Record Payment
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
