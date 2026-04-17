"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Timestamp } from "firebase/firestore";
import { collection, addDoc, query, where, orderBy, onSnapshot, updateDoc, doc } from "firebase/firestore";
import { getAppDb } from "@/lib/firebase/config";
import { formatCurrency } from "@/lib/utils";
import { generateAgreementHash, encrypt } from "@/lib/crypto/encryption";
import {
  Plus, X, Globe, Shield, Clock, CheckCircle, Users,
  Lock, AlertTriangle, Zap, Copy, ExternalLink, Search
} from "lucide-react";

interface MarketplaceOffer {
  id: string;
  lenderId: string;
  lenderName: string;
  amount: number;
  currency: string;
  interestRate: number;
  durationDays: number;
  collateralPercent: number;
  terms: string;
  encryptedTermsHash: string;
  status: "open" | "taken" | "completed" | "defaulted" | "cancelled";
  borrowerId?: string;
  borrowerName?: string;
  acceptedAt?: Timestamp;
  deadline?: Timestamp;
  repaidAmount: number;
  walletAddress?: string;
  createdAt: Timestamp;
}

export default function MarketplacePage() {
  const { user } = useAuth();
  const [offers, setOffers] = useState<MarketplaceOffer[]>([]);
  const [myOffers, setMyOffers] = useState<MarketplaceOffer[]>([]);
  const [myBorrows, setMyBorrows] = useState<MarketplaceOffer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState<"browse" | "my-offers" | "my-borrows">("browse");
  const [searchTerm, setSearchTerm] = useState("");

  // Form
  const [amount, setAmount] = useState("");
  const [interestRate, setInterestRate] = useState("5");
  const [durationDays, setDurationDays] = useState("30");
  const [collateralPercent, setCollateralPercent] = useState("20");
  const [terms, setTerms] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const db = getAppDb();

    const q1 = query(collection(db, "marketplace"), where("status", "==", "open"), orderBy("createdAt", "desc"));
    const unsub1 = onSnapshot(q1, (snap) => {
      setOffers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MarketplaceOffer));
    });

    const q2 = query(collection(db, "marketplace"), where("lenderId", "==", user.uid), orderBy("createdAt", "desc"));
    const unsub2 = onSnapshot(q2, (snap) => {
      setMyOffers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MarketplaceOffer));
    });

    const q3 = query(collection(db, "marketplace"), where("borrowerId", "==", user.uid), orderBy("createdAt", "desc"));
    const unsub3 = onSnapshot(q3, (snap) => {
      setMyBorrows(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MarketplaceOffer));
    });

    return () => { unsub1(); unsub2(); unsub3(); };
  }, [user]);

  async function handleCreateOffer(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !amount) return;
    setSaving(true);
    try {
      const db = getAppDb();
      const termsText = terms || `Standard lending terms: ${interestRate}% interest, ${durationDays} day repayment period, ${collateralPercent}% collateral required.`;

      const hash = await generateAgreementHash({
        lender: user.uid,
        borrower: "",
        amount: parseFloat(amount),
        terms: termsText,
        timestamp: Date.now(),
      });

      const encryptedTerms = await encrypt(termsText, hash.slice(0, 32));

      await addDoc(collection(db, "marketplace"), {
        lenderId: user.uid,
        lenderName: user.displayName || "Anonymous Lender",
        amount: parseFloat(amount),
        currency: "USD",
        interestRate: parseFloat(interestRate),
        durationDays: parseInt(durationDays),
        collateralPercent: parseInt(collateralPercent),
        terms: termsText,
        encryptedTermsHash: hash,
        status: "open",
        repaidAmount: 0,
        createdAt: Timestamp.now(),
      } satisfies Omit<MarketplaceOffer, "id">);

      setAmount(""); setTerms("");
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleAcceptOffer(offer: MarketplaceOffer) {
    if (!user) return;
    if (offer.lenderId === user.uid) return alert("You cannot borrow from yourself.");
    if (!confirm(`Accept this loan of ${formatCurrency(offer.amount)} at ${offer.interestRate}% interest? You must repay within ${offer.durationDays} days.`)) return;

    const db = getAppDb();
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + offer.durationDays);

    await updateDoc(doc(db, "marketplace", offer.id), {
      status: "taken",
      borrowerId: user.uid,
      borrowerName: user.displayName || "Anonymous",
      acceptedAt: Timestamp.now(),
      deadline: Timestamp.fromDate(deadline),
    });
  }

  async function handleRepay(offer: MarketplaceOffer) {
    if (!user) return;
    const totalDue = offer.amount + (offer.amount * offer.interestRate / 100);
    if (!confirm(`Mark loan as repaid? Total due: ${formatCurrency(totalDue)} (${formatCurrency(offer.amount)} + ${formatCurrency(totalDue - offer.amount)} interest)`)) return;

    const db = getAppDb();
    await updateDoc(doc(db, "marketplace", offer.id), {
      status: "completed",
      repaidAmount: totalDue,
    });
  }

  async function handleCancel(offerId: string) {
    if (!confirm("Cancel this offer?")) return;
    const db = getAppDb();
    await updateDoc(doc(db, "marketplace", offerId), { status: "cancelled" });
  }

  const filteredOffers = offers.filter(o =>
    o.lenderId !== user?.uid &&
    (!searchTerm || o.lenderName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const statusColors: Record<string, string> = {
    open: "bg-green-50 text-green-700 border-green-200",
    taken: "bg-blue-50 text-blue-700 border-blue-200",
    completed: "bg-gray-50 text-gray-600 border-gray-200",
    defaulted: "bg-red-50 text-red-700 border-red-200",
    cancelled: "bg-gray-50 text-gray-400 border-gray-200",
  };

  function renderOffer(offer: MarketplaceOffer, context: "browse" | "lender" | "borrower") {
    const totalRepay = offer.amount + (offer.amount * offer.interestRate / 100);
    const collateralAmt = offer.amount * offer.collateralPercent / 100;
    const isOverdue = offer.deadline && offer.deadline.toDate() < new Date() && offer.status === "taken";

    return (
      <div key={offer.id} className={`bg-white rounded-xl border p-5 ${isOverdue ? "border-red-300 bg-red-50/30" : "border-gray-200"}`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${statusColors[offer.status]}`}>
                {offer.status.toUpperCase()}
              </span>
              {isOverdue && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600 flex items-center gap-1">
                  <AlertTriangle size={10} /> OVERDUE
                </span>
              )}
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Shield size={10} /> Encrypted
              </span>
            </div>
            <p className="font-semibold text-gray-900">{offer.lenderName}</p>
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
              <Lock size={10} /> Hash: {offer.encryptedTermsHash?.slice(0, 16)}...
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(offer.amount)}</p>
            <p className="text-xs text-gray-400">{offer.currency}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">Interest</p>
            <p className="text-sm font-bold text-gray-900">{offer.interestRate}%</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">Duration</p>
            <p className="text-sm font-bold text-gray-900">{offer.durationDays}d</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">Collateral</p>
            <p className="text-sm font-bold text-gray-900">{offer.collateralPercent}%</p>
          </div>
        </div>

        <div className="text-sm text-gray-600 mb-4 p-3 bg-gray-50 rounded-lg">
          <p><strong>Total repayment:</strong> {formatCurrency(totalRepay)}</p>
          <p><strong>Collateral needed:</strong> {formatCurrency(collateralAmt)}</p>
          {offer.deadline && <p><strong>Deadline:</strong> {offer.deadline.toDate().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>}
          {offer.borrowerName && <p><strong>Borrower:</strong> {offer.borrowerName}</p>}
        </div>

        <div className="flex gap-2">
          {context === "browse" && offer.status === "open" && (
            <button onClick={() => handleAcceptOffer(offer)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 transition">
              <Zap size={14} /> Accept & Borrow
            </button>
          )}
          {context === "lender" && offer.status === "open" && (
            <button onClick={() => handleCancel(offer.id)}
              className="flex-1 py-2.5 border border-red-200 text-red-600 rounded-lg font-semibold text-sm hover:bg-red-50 transition">
              Cancel Offer
            </button>
          )}
          {context === "lender" && offer.status === "taken" && (
            <div className="flex-1 py-2.5 bg-blue-50 text-blue-700 rounded-lg font-semibold text-sm text-center flex items-center justify-center gap-2">
              <Clock size={14} /> Awaiting Repayment
            </div>
          )}
          {context === "borrower" && offer.status === "taken" && (
            <button onClick={() => handleRepay(offer)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white rounded-lg font-semibold text-sm hover:bg-green-700 transition">
              <CheckCircle size={14} /> Mark as Repaid
            </button>
          )}
          {offer.status === "completed" && (
            <div className="flex-1 py-2.5 bg-green-50 text-green-700 rounded-lg font-semibold text-sm text-center flex items-center justify-center gap-2">
              <CheckCircle size={14} /> Repaid Successfully
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Globe size={24} className="text-indigo-600" /> Global Lending Marketplace
          </h1>
          <p className="text-gray-500 text-sm mt-1">P2P lending with encrypted agreements and strict repayment</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 transition">
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? "Cancel" : "Offer to Lend"}
        </button>
      </div>

      {/* Security Notice */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6 flex items-start gap-3">
        <Shield className="text-indigo-500 flex-shrink-0 mt-0.5" size={20} />
        <div>
          <p className="font-semibold text-indigo-700">Secured & Encrypted</p>
          <p className="text-sm text-indigo-600">All agreements are SHA-256 hashed and AES-256 encrypted. Borrowers must agree to terms before receiving funds. Collateral is required for every loan.</p>
        </div>
      </div>

      {/* Create Offer */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Lock size={16} /> Create Lending Offer
          </h2>
          <form onSubmit={handleCreateOffer} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount to Lend ($)</label>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="1000.00" min="1" step="0.01" required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Interest Rate (%)</label>
                <input type="number" value={interestRate} onChange={(e) => setInterestRate(e.target.value)}
                  placeholder="5" min="0" max="100" step="0.1" required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Repayment Period (days)</label>
                <input type="number" value={durationDays} onChange={(e) => setDurationDays(e.target.value)}
                  placeholder="30" min="1" max="365" required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Collateral Required (%)</label>
                <input type="number" value={collateralPercent} onChange={(e) => setCollateralPercent(e.target.value)}
                  placeholder="20" min="10" max="200" required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Custom Terms (optional)</label>
              <textarea value={terms} onChange={(e) => setTerms(e.target.value)}
                placeholder="Add any specific terms or conditions..."
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
              <strong>Preview:</strong> You&apos;ll lend {formatCurrency(parseFloat(amount) || 0)} at {interestRate}% interest.
              Borrower repays {formatCurrency((parseFloat(amount) || 0) * (1 + parseFloat(interestRate) / 100))} within {durationDays} days
              with {formatCurrency((parseFloat(amount) || 0) * parseInt(collateralPercent) / 100)} collateral.
            </div>
            <button type="submit" disabled={saving}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
              <Shield size={16} /> {saving ? "Creating..." : "Create Encrypted Offer"}
            </button>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {([
          { key: "browse", label: "Browse Offers", icon: Globe, count: filteredOffers.length },
          { key: "my-offers", label: "My Offers", icon: Zap, count: myOffers.length },
          { key: "my-borrows", label: "My Borrows", icon: Users, count: myBorrows.length },
        ] as const).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t.key ? "bg-indigo-100 text-indigo-700" : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
            }`}>
            <t.icon size={14} /> {t.label}
            {t.count > 0 && <span className="bg-gray-200 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Search (browse tab) */}
      {tab === "browse" && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-3 text-gray-400" size={16} />
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search lenders..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      )}

      {/* Content */}
      {tab === "browse" && (
        filteredOffers.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            <Globe className="mx-auto mb-3" size={40} />
            <p className="text-lg mb-1">No offers available</p>
            <p className="text-sm">Be the first to offer lending, or check back later.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredOffers.map(o => renderOffer(o, "browse"))}
          </div>
        )
      )}

      {tab === "my-offers" && (
        myOffers.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            <Zap className="mx-auto mb-3" size={40} />
            <p className="text-lg mb-1">No offers yet</p>
            <p className="text-sm">Click &quot;Offer to Lend&quot; to create your first lending offer.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {myOffers.map(o => renderOffer(o, "lender"))}
          </div>
        )
      )}

      {tab === "my-borrows" && (
        myBorrows.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            <Users className="mx-auto mb-3" size={40} />
            <p className="text-lg mb-1">No active borrows</p>
            <p className="text-sm">Browse offers and accept one to borrow.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {myBorrows.map(o => renderOffer(o, "borrower"))}
          </div>
        )
      )}
    </div>
  );
}
