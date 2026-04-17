"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { subscribeAgreements } from "@/lib/firebase/firestore";
import { formatCurrency, formatDate } from "@/lib/utils";
import { FileText, CheckCircle, Clock, XCircle, Copy, Send, ExternalLink } from "lucide-react";
import type { Agreement } from "@/types";

export default function AgreementsPage() {
  const { user } = useAuth();
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeAgreements(user.uid, setAgreements);
  }, [user]);

  function getAgreementLink(id: string) {
    return `${window.location.origin}/agree/${id}`;
  }

  async function copyLink(id: string) {
    await navigator.clipboard.writeText(getAgreementLink(id));
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  function shareViaWhatsApp(agreement: Agreement) {
    const link = getAgreementLink(agreement.id);
    const msg = `Hi ${agreement.borrowerName}, I've created a loan agreement for ${formatCurrency(agreement.amount)}. Please review and sign it here: ${link}`;
    window.open(`https://wa.me/${agreement.borrowerPhone?.replace(/\D/g, "") || ""}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  function shareViaEmail(agreement: Agreement) {
    const link = getAgreementLink(agreement.id);
    const subject = `Loan Agreement - ${formatCurrency(agreement.amount)}`;
    const body = `Hi ${agreement.borrowerName},\n\nI've created a loan agreement for ${formatCurrency(agreement.amount)}.\n\nPlease review the terms and sign it here:\n${link}\n\nThank you.`;
    window.open(`mailto:${agreement.borrowerEmail || ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank");
  }

  const statusConfig = {
    pending: { icon: Clock, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", label: "Pending Signature" },
    signed: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-50", border: "border-green-200", label: "Signed" },
    declined: { icon: XCircle, color: "text-red-600", bg: "bg-red-50", border: "border-red-200", label: "Declined" },
    expired: { icon: XCircle, color: "text-gray-500", bg: "bg-gray-50", border: "border-gray-200", label: "Expired" },
  };

  const pending = agreements.filter((a) => a.status === "pending");
  const signed = agreements.filter((a) => a.status === "signed");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agreements</h1>
          <p className="text-gray-500 text-sm mt-1">
            {pending.length} pending &middot; {signed.length} signed &middot; {agreements.length} total
          </p>
        </div>
      </div>

      {/* Pending Agreements Alert */}
      {pending.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <Clock className="text-amber-500 flex-shrink-0" size={20} />
          <div>
            <p className="font-semibold text-amber-700">{pending.length} agreement{pending.length > 1 ? "s" : ""} awaiting signature</p>
            <p className="text-sm text-amber-600">Share the agreement link with the borrower so they can sign.</p>
          </div>
        </div>
      )}

      {/* Agreement List */}
      {agreements.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <FileText className="mx-auto mb-3" size={40} />
          <p className="text-lg mb-1">No agreements yet</p>
          <p className="text-sm">When you create a loan with an agreement, it will show here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {agreements.map((a) => {
            const status = statusConfig[a.status];
            return (
              <div key={a.id} className={`bg-white rounded-xl border ${a.status === "pending" ? "border-amber-200" : "border-gray-200"} p-5`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${status.bg} ${status.color} ${status.border} border`}>
                        <status.icon size={12} /> {status.label}
                      </span>
                    </div>
                    <p className="font-semibold text-gray-900 text-lg">{a.borrowerName}</p>
                    <p className="text-sm text-gray-500">{a.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(a.amount)}</p>
                    {a.dueDate && (
                      <p className="text-xs text-gray-400 mt-1">Due: {formatDate(a.dueDate)}</p>
                    )}
                  </div>
                </div>

                {/* Signed Info */}
                {a.status === "signed" && a.signedAt && (
                  <div className="bg-green-50 rounded-lg p-3 mb-3 text-sm">
                    <p className="text-green-700">
                      <strong>{a.signedByName}</strong> signed on {formatDate(a.signedAt)}
                    </p>
                    {a.signatureNote && (
                      <p className="text-green-600 mt-1">Note: {a.signatureNote}</p>
                    )}
                  </div>
                )}

                {/* Share Actions (for pending) */}
                {a.status === "pending" && (
                  <div className="border-t border-gray-100 pt-3 mt-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Share Agreement Link</p>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => copyLink(a.id)}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition">
                        <Copy size={14} />
                        {copied === a.id ? "Copied!" : "Copy Link"}
                      </button>
                      {a.borrowerPhone && (
                        <button onClick={() => shareViaWhatsApp(a)}
                          className="flex items-center gap-2 px-3 py-2 bg-green-100 hover:bg-green-200 rounded-lg text-sm font-medium text-green-700 transition">
                          <Send size={14} /> WhatsApp
                        </button>
                      )}
                      {a.borrowerEmail && (
                        <button onClick={() => shareViaEmail(a)}
                          className="flex items-center gap-2 px-3 py-2 bg-blue-100 hover:bg-blue-200 rounded-lg text-sm font-medium text-blue-700 transition">
                          <Send size={14} /> Email
                        </button>
                      )}
                      <a href={getAgreementLink(a.id)} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 bg-indigo-100 hover:bg-indigo-200 rounded-lg text-sm font-medium text-indigo-700 transition">
                        <ExternalLink size={14} /> Preview
                      </a>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
                  <span>Created: {formatDate(a.createdAt)}</span>
                  <span>ID: {a.id.slice(0, 8)}...</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
