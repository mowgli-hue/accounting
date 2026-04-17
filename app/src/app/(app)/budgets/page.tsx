"use client";

import { useEffect, useState } from "react";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "@/contexts/auth-context";
import { subscribeBudgets, addBudget, deleteBudget, subscribeTransactions } from "@/lib/firebase/firestore";
import { formatCurrency, getCurrentMonth } from "@/lib/utils";
import { EXPENSE_CATEGORIES, getCategoryIcon, getCategoryLabel } from "@/lib/constants";
import { Plus, Trash2, X } from "lucide-react";
import type { Budget, Transaction } from "@/types";

export default function BudgetsPage() {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState("");
  const [saving, setSaving] = useState(false);

  const currentMonth = getCurrentMonth();
  const monthLabel = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  useEffect(() => {
    if (!user) return;
    const unsub1 = subscribeBudgets(user.uid, currentMonth, setBudgets);
    const unsub2 = subscribeTransactions(user.uid, setTransactions);
    return () => { unsub1(); unsub2(); };
  }, [user, currentMonth]);

  const monthTxns = transactions.filter((t) => {
    const d = t.date.toDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === currentMonth && t.type === "expense";
  });

  function getSpent(cat: string) {
    return monthTxns.filter((t) => t.category === cat).reduce((s, t) => s + t.amount, 0);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !category || !limit) return;
    setSaving(true);
    try {
      await addBudget({
        userId: user.uid,
        category,
        monthlyLimit: parseFloat(limit),
        month: currentMonth,
        createdAt: Timestamp.now(),
      });
      setCategory("");
      setLimit("");
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  const usedCategories = new Set(budgets.map((b) => b.category));
  const availableCategories = EXPENSE_CATEGORIES.filter((c) => !usedCategories.has(c));

  const totalBudget = budgets.reduce((s, b) => s + b.monthlyLimit, 0);
  const totalSpent = budgets.reduce((s, b) => s + getSpent(b.category), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Budget Planner</h1>
          <p className="text-gray-500 text-sm mt-1">{monthLabel}</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 transition"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? "Cancel" : "Add Budget"}
        </button>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Total Budget</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalBudget)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Spent</p>
          <p className="text-2xl font-bold text-red-500 mt-1">{formatCurrency(totalSpent)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Remaining</p>
          <p className={`text-2xl font-bold mt-1 ${totalBudget - totalSpent >= 0 ? "text-green-600" : "text-red-500"}`}>
            {formatCurrency(totalBudget - totalSpent)}
          </p>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select category</option>
                {availableCategories.map((c) => (
                  <option key={c} value={c}>{getCategoryIcon(c)} {getCategoryLabel(c)}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Limit</label>
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                placeholder="500.00"
                min="0"
                step="0.01"
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {saving ? "..." : "Add"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Budget Cards */}
      {budgets.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <p className="text-lg mb-1">No budgets set</p>
          <p className="text-sm">Set monthly limits for your spending categories.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {budgets.map((b) => {
            const spent = getSpent(b.category);
            const pct = b.monthlyLimit > 0 ? (spent / b.monthlyLimit) * 100 : 0;
            const color = pct > 100 ? "bg-red-500" : pct > 75 ? "bg-amber-500" : "bg-green-500";
            const textColor = pct > 100 ? "text-red-600" : pct > 75 ? "text-amber-600" : "text-green-600";

            return (
              <div key={b.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getCategoryIcon(b.category)}</span>
                    <div>
                      <p className="font-semibold text-gray-900">{getCategoryLabel(b.category)}</p>
                      <p className="text-xs text-gray-400">Limit: {formatCurrency(b.monthlyLimit)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { if (confirm("Delete this budget?")) deleteBudget(b.id); }}
                    className="text-gray-300 hover:text-red-500 transition"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 mb-2">
                  <div className={`${color} h-3 rounded-full transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                <div className="flex justify-between text-sm">
                  <span className={`font-bold ${textColor}`}>{formatCurrency(spent)} spent</span>
                  <span className="text-gray-400">{formatCurrency(Math.max(0, b.monthlyLimit - spent))} left</span>
                </div>
                {pct > 100 && (
                  <p className="text-xs text-red-500 font-semibold mt-2">Over budget by {formatCurrency(spent - b.monthlyLimit)}!</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
