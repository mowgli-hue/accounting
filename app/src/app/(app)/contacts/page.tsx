"use client";

import { useEffect, useState } from "react";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "@/contexts/auth-context";
import { subscribeContacts, addContact, deleteContact, subscribeLoans } from "@/lib/firebase/firestore";
import { formatCurrency } from "@/lib/utils";
import { Plus, Trash2, X, User } from "lucide-react";
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
    if (!user || !name.trim()) return;
    setSaving(true);
    try {
      await addContact({
        userId: user.uid,
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        createdAt: Timestamp.now(),
      });
      setName(""); setEmail(""); setPhone("");
      setShowForm(false);
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {contacts.map((c) => {
            const bal = getContactBalance(c.id);
            return (
              <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                      {c.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{c.name}</p>
                      {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
                      {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(c.id, c.name)}
                    className="text-gray-300 hover:text-red-500 transition">
                    <Trash2 size={16} />
                  </button>
                </div>
                {bal.activeLoans > 0 ? (
                  <div className="space-y-1.5 pt-3 border-t border-gray-100">
                    {bal.lent > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">They owe you</span>
                        <span className="font-bold text-green-600">{formatCurrency(bal.lent)}</span>
                      </div>
                    )}
                    {bal.borrowed > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">You owe them</span>
                        <span className="font-bold text-red-500">{formatCurrency(bal.borrowed)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm pt-1 border-t border-gray-50">
                      <span className="text-gray-500 font-medium">Net</span>
                      <span className={`font-bold ${bal.net >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {bal.net >= 0 ? "They owe " : "You owe "}{formatCurrency(Math.abs(bal.net))}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 pt-3 border-t border-gray-100">No active loans</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
