"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "@/contexts/auth-context";
import { subscribeContacts, addContact, deleteContact, subscribeLoans } from "@/lib/firebase/firestore";
import { formatCurrency } from "@/lib/utils";
import { Plus, Trash2, X, User, ChevronRight } from "lucide-react";
import type { Contact, Loan } from "@/types";

export default function ContactsPage() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub1 = subscribeContacts(user.uid, setContacts);
    const unsub2 = subscribeLoans(user.uid, setLoans);
    return () => { unsub1(); unsub2(); };
  }, [user]);

  function getContactBalance(contactId: string) {
    const contactLoans = loans.filter((l) => l.contactId === contactId && l.status !== "paid");
    const lent = contactLoans.filter((l) => l.direction === "lent").reduce((s, l) => s + l.outstandingBalance, 0);
    const borrowed = contactLoans.filter((l) => l.direction === "borrowed").reduce((s, l) => s + l.outstandingBalance, 0);
    return { lent, borrowed, net: lent - borrowed, activeLoans: contactLoans.length };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { alert("Not signed in. Please refresh and log in again."); return; }
    if (!name.trim()) { alert("Please enter a name."); return; }
    setSaving(true);
    try {
      const data: Omit<Contact, "id"> = {
        userId: user.uid,
        name: name.trim(),
        createdAt: Timestamp.now(),
      };
      if (email.trim()) data.email = email.trim();
      if (phone.trim()) data.phone = phone.trim();
      await addContact(data);
      setName(""); setEmail(""); setPhone("");
      setShowForm(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert("Could not save contact: " + msg);
      console.error("addContact error:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, contactName: string) {
    const bal = getContactBalance(id);
    if (bal.activeLoans > 0) {
      alert(`Cannot delete "${contactName}" - they have ${bal.activeLoans} active loan(s). Clear loans first.`);
      return;
    }
    if (confirm(`Delete contact "${contactName}"?`)) {
      await deleteContact(id);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-gray-500 text-sm mt-1">{contacts.length} contact{contacts.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 transition">
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? "Cancel" : "Add Contact"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="John Doe"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 234 567 890"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <button type="submit" disabled={saving}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50">
              {saving ? "Adding..." : "Add Contact"}
            </button>
          </form>
        </div>
      )}

      {contacts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <User className="mx-auto mb-3" size={40} />
          <p className="text-lg mb-1">No contacts yet</p>
          <p className="text-sm">Add people you lend to or borrow from.</p>
        </div>
      ) : (
        <>
          {(() => {
            const totals = contacts.reduce(
              (acc, c) => {
                const b = getContactBalance(c.id);
                acc.lent += b.lent;
                acc.borrowed += b.borrowed;
                return acc;
              },
              { lent: 0, borrowed: 0 }
            );
            const net = totals.lent - totals.borrowed;
            if (totals.lent === 0 && totals.borrowed === 0) return null;
            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Everyone owes you</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.lent)}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">You owe everyone</p>
                  <p className="text-2xl font-bold text-red-500">{formatCurrency(totals.borrowed)}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Net position</p>
                  <p className={`text-2xl font-bold ${net >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {net >= 0 ? "+" : ""}{formatCurrency(net)}
                  </p>
                </div>
              </div>
            );
          })()}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {contacts
              .sort((a, b) => {
                const ba = getContactBalance(a.id);
                const bb = getContactBalance(b.id);
                return Math.abs(bb.net) - Math.abs(ba.net);
              })
              .map((c) => {
                const bal = getContactBalance(c.id);
                return (
                  <div key={c.id} className="bg-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all group relative">
                    <Link href={`/contacts/${c.id}`} className="block p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                            {c.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 group-hover:text-indigo-600 transition">
                              {c.name}
                            </p>
                            {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
                            {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
                          </div>
                        </div>
                        <ChevronRight className="text-gray-300 group-hover:text-indigo-500 transition" size={18} />
                      </div>

                      {bal.activeLoans > 0 ? (
                        <div className={`rounded-lg p-3 ${bal.net > 0 ? "bg-green-50" : bal.net < 0 ? "bg-red-50" : "bg-gray-50"}`}>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                            {bal.net > 0 ? `${c.name} owes you` : bal.net < 0 ? `You owe ${c.name}` : "Even"}
                          </p>
                          <p className={`text-2xl font-bold ${bal.net > 0 ? "text-green-600" : bal.net < 0 ? "text-red-500" : "text-gray-600"}`}>
                            {formatCurrency(Math.abs(bal.net))}
                          </p>
                          <div className="flex gap-3 mt-2 text-xs">
                            {bal.lent > 0 && (
                              <span className="text-gray-500">
                                Lent: <strong className="text-gray-700">{formatCurrency(bal.lent)}</strong>
                              </span>
                            )}
                            {bal.borrowed > 0 && (
                              <span className="text-gray-500">
                                Borrowed: <strong className="text-gray-700">{formatCurrency(bal.borrowed)}</strong>
                              </span>
                            )}
                            <span className="text-gray-400 ml-auto">
                              {bal.activeLoans} active
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 pt-2 border-t border-gray-100">
                          No active loans · Click to view history
                        </p>
                      )}
                    </Link>
                    <button
                      onClick={() => handleDelete(c.id, c.name)}
                      className="absolute top-3 right-10 text-gray-300 hover:text-red-500 transition p-1"
                      title="Delete contact"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
          </div>
        </>
      )}
    </div>
  );
}
