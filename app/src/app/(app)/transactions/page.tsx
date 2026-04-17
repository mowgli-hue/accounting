"use client";

import { useEffect, useState } from "react";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "@/contexts/auth-context";
import { subscribeTransactions, addTransaction, deleteTransaction } from "@/lib/firebase/firestore";
import { formatCurrency, formatDate, toInputDate } from "@/lib/utils";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, getCategoryIcon, getCategoryLabel } from "@/lib/constants";
import { Plus, Trash2, X } from "lucide-react";
import type { Transaction } from "@/types";

export default function TransactionsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");

  // Form state
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(toInputDate());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    return subscribeTransactions(user.uid, setTransactions);
  }, [user]);

  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !amount || !category) return;
    setSaving(true);
    try {
      await addTransaction({
        userId: user.uid,
        type,
        amount: parseFloat(amount),
        category,
        description: description || getCategoryLabel(category),
        date: Timestamp.fromDate(new Date(date + "T12:00:00")),
        createdAt: Timestamp.now(),
      });
      setAmount("");
      setCategory("");
      setDescription("");
      setDate(toInputDate());
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  const filtered = filter === "all" ? transactions : transactions.filter((t) => t.type === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="text-gray-500 text-sm mt-1">{transactions.length} total transactions</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 transition"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? "Cancel" : "Add Transaction"}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">New Transaction</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setType("expense"); setCategory(""); }}
                className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition ${type === "expense" ? "bg-red-100 text-red-700 border-2 border-red-300" : "bg-gray-100 text-gray-600"}`}
              >
                Expense
              </button>
              <button
                type="button"
                onClick={() => { setType("income"); setCategory(""); }}
                className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition ${type === "income" ? "bg-green-100 text-green-700 border-2 border-green-300" : "bg-gray-100 text-gray-600"}`}
              >
                Income
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{getCategoryIcon(c)} {getCategoryLabel(c)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What was it for?"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {saving ? "Saving..." : "Add Transaction"}
            </button>
          </form>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {(["all", "income", "expense"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === f ? "bg-indigo-100 text-indigo-700" : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
            }`}
          >
            {f === "all" ? "All" : f === "income" ? "Income" : "Expenses"}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-lg mb-1">No transactions yet</p>
            <p className="text-sm">Click &quot;Add Transaction&quot; to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((t) => (
              <div key={t.id} className="flex items-center gap-3 p-4 hover:bg-gray-50 transition">
                <span className="text-2xl">{getCategoryIcon(t.category)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{t.description}</p>
                  <p className="text-xs text-gray-400">{getCategoryLabel(t.category)} &middot; {formatDate(t.date)}</p>
                </div>
                <div className="text-right flex items-center gap-3">
                  <div>
                    <p className={`text-sm font-bold ${t.type === "income" ? "text-green-600" : "text-red-500"}`}>
                      {t.type === "income" ? "+" : "-"}{formatCurrency(t.amount)}
                    </p>
                  </div>
                  <button
                    onClick={() => { if (confirm("Delete this transaction?")) deleteTransaction(t.id); }}
                    className="text-gray-300 hover:text-red-500 transition p-1"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
