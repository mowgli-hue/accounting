"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getAgreement, updateAgreement } from "@/lib/firebase/firestore";
import { Timestamp } from "firebase/firestore";
import { updateLoan } from "@/lib/firebase/firestore";
import { CheckCircle, XCircle, Clock, FileText, Shield } from "lucide-react";
import type { Agreement } from "@/types";

export default function AgreementPage() {
  const params = useParams();
  const id = params.id as string;
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [signName, setSignName] = useState("");
  const [signNote, setSignNote] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [done, setDone] = useState<"signed" | "declined" | null>(null);

  useEffect(() => {
    if (!id) return;
    getAgreement(id).then((a) => {
      setAgreement(a);
      setLoading(false);
    });
  }, [id]);

  async function handleSign() {
    if (!agreement || !signName.trim() || !agreed) return;
    setSigning(true);
    try {
      await updateAgreement(agreement.id, {
        status: "signed",
        signedAt: Timestamp.now(),
        signedByName: signName.trim(),
        signatureNote: signNote.trim() || undefined,
      });
      await updateLoan(agreement.loanId, {
        agreementStatus: "signed",
      });
      setDone("signed");
    } catch (err) {
      alert("Error signing agreement: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setSigning(false);
    }
  }

  async function handleDecline() {
    if (!agreement) return;
    if (!confirm("Are you sure you want to decline this agreement?")) return;
    setSigning(true);
    try {
      await updateAgreement(agreement.id, { status: "declined" });
      await updateLoan(agreement.loanId, { agreementStatus: "declined" });
      setDone("declined");
    } finally {
      setSigning(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-400">Loading agreement...</div>
      </div>
    );
  }

  if (!agreement) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <XCircle className="mx-auto text-red-400 mb-4" size={48} />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Agreement Not Found</h1>
          <p className="text-gray-500">This agreement link is invalid or has been removed.</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          {done === "signed" ? (
            <>
              <CheckCircle className="mx-auto text-green-500 mb-4" size={56} />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Agreement Signed!</h1>
              <p className="text-gray-500">You have agreed to pay back <strong className="text-gray-900">${agreement.amount.toFixed(2)}</strong> to <strong className="text-gray-900">{agreement.lenderName || "the lender"}</strong>.</p>
              {agreement.dueDate && (
                <p className="text-sm text-gray-400 mt-3">Due by: {agreement.dueDate.toDate().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
              )}
              <div className="mt-6 p-4 bg-green-50 rounded-xl text-sm text-green-700">
                <Shield className="inline mr-2" size={16} />
                This agreement is digitally recorded and timestamped. Both parties have access to this record.
              </div>
            </>
          ) : (
            <>
              <XCircle className="mx-auto text-red-400 mb-4" size={56} />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Agreement Declined</h1>
              <p className="text-gray-500">You have declined this agreement. The lender has been notified.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  if (agreement.status === "signed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <CheckCircle className="mx-auto text-green-500 mb-4" size={48} />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Already Signed</h1>
          <p className="text-gray-500">This agreement was signed by <strong>{agreement.signedByName}</strong> on {agreement.signedAt?.toDate().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.</p>
        </div>
      </div>
    );
  }

  if (agreement.status === "declined" || agreement.status === "expired") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <XCircle className="mx-auto text-gray-400 mb-4" size={48} />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Agreement {agreement.status === "declined" ? "Declined" : "Expired"}</h1>
          <p className="text-gray-500">This agreement is no longer active.</p>
        </div>
      </div>
    );
  }

  const formattedDueDate = agreement.dueDate
    ? agreement.dueDate.toDate().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-full text-sm font-semibold mb-4">
            <Clock size={16} /> Awaiting Your Signature
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Loan Agreement</h1>
        </div>

        {/* Agreement Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Top Bar */}
          <div className="bg-indigo-600 p-5 text-white text-center">
            <p className="text-sm opacity-80">Amount to be repaid</p>
            <p className="text-4xl font-bold mt-1">${agreement.amount.toFixed(2)}</p>
            <p className="text-sm opacity-80 mt-1">{agreement.currency}</p>
          </div>

          {/* Details */}
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">From (Lender)</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">{agreement.lenderName || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">To (Borrower)</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">{agreement.borrowerName}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Date Issued</p>
                <p className="text-sm text-gray-700 mt-1">{agreement.dateIssued.toDate().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Due Date</p>
                <p className={`text-sm mt-1 ${formattedDueDate ? "text-red-600 font-semibold" : "text-gray-400"}`}>
                  {formattedDueDate || "No due date set"}
                </p>
              </div>
            </div>

            {agreement.description && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Description</p>
                <p className="text-sm text-gray-700 mt-1">{agreement.description}</p>
              </div>
            )}

            {/* Terms */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="text-gray-500" size={16} />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Terms & Conditions</p>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{agreement.terms}</p>
            </div>

            {/* Signing Form */}
            <div className="border-t border-gray-200 pt-5 space-y-4">
              <h3 className="font-semibold text-gray-900">Sign This Agreement</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Full Name *</label>
                <input
                  type="text"
                  value={signName}
                  onChange={(e) => setSignName(e.target.value)}
                  placeholder="Enter your full legal name"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
                <input
                  type="text"
                  value={signNote}
                  onChange={(e) => setSignNote(e.target.value)}
                  placeholder="Any comments..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-1 w-4 h-4 text-indigo-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">
                  I, <strong>{signName || "[your name]"}</strong>, acknowledge that I have received <strong>${agreement.amount.toFixed(2)}</strong> and agree to repay this amount
                  {formattedDueDate ? <> by <strong>{formattedDueDate}</strong></> : ""} according to the terms stated above.
                </span>
              </label>

              <div className="flex gap-3">
                <button
                  onClick={handleDecline}
                  disabled={signing}
                  className="flex-1 py-3 border-2 border-red-200 text-red-600 rounded-xl font-semibold hover:bg-red-50 transition disabled:opacity-50"
                >
                  Decline
                </button>
                <button
                  onClick={handleSign}
                  disabled={signing || !signName.trim() || !agreed}
                  className="flex-1 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {signing ? "Signing..." : "I Agree & Sign"}
                </button>
              </div>

              <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
                <Shield size={12} /> This agreement is digitally recorded and timestamped
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
