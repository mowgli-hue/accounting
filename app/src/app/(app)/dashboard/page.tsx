"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { subscribeTransactions, subscribeLoans } from "@/lib/firebase/firestore";
import { formatCurrency, getCurrentMonth } from "@/lib/utils";
import { getCategoryIcon, getCategoryLabel } from "@/lib/constants";
import { TrendingUp, TrendingDown, Wallet, AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { Transaction, Loan } from "@/types";

export default function DashboardPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub1 = subscribeTransactions(user.uid, setTransactions);
    const unsub2 = subscribeLoans(user.uid, setLoans);
    return () => { unsub1(); unsub2(); };
  }, [user]);

  const currentMonth = getCurrentMonth();
  const monthTxns = transactions.filter((t) => {
    const d = t.date.toDate();
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return m === currentMonth;
  });

  const totalIncome = monthTxns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = monthTxns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const balance = totalIncome - totalExpense;

  const activeLoans = loans.filter((l) => l.status === "active" || l.status === "overdue");
  const overdueLoans = loans.filter((l) => l.status === "overdue");
  const totalLent = activeLoans.filter((l) => l.direction === "lent").reduce((s, l) => s + l.outstandingBalance, 0);
  const totalBorrowed = activeLoans.filter((l) => l.direction === "borrowed").reduce((s, l) => s + l.outstandingBalance, 0);

  const recentTxns = transactions.slice(0, 5);

  // Spending by category this month
  const catSpending = new Map<string, number>();
  monthTxns.filter((t) => t.type === "expense").forEach((t) => {
    catSpending.set(t.category, (catSpending.get(t.category) || 0) + t.amount);
  });
  const topCategories = [...catSpending.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <TrendingUp className="text-green-600" size={20} />
            </div>
            <span className="text-sm font-medium text-gray-500">Income</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
          <p className="text-xs text-gray-400 mt-1">This month</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
              <TrendingDown className="text-red-500" size={20} />
            </div>
            <span className="text-sm font-medium text-gray-500">Expenses</span>
          </div>
          <p className="text-2xl font-bold text-red-500">{formatCurrency(totalExpense)}</p>
          <p className="text-xs text-gray-400 mt-1">This month</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Wallet className="text-indigo-600" size={20} />
            </div>
            <span className="text-sm font-medium text-gray-500">Net Balance</span>
          </div>
          <p className={`text-2xl font-bold ${balance >= 0 ? "text-indigo-600" : "text-red-500"}`}>
            {formatCurrency(balance)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Income - Expenses</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <AlertTriangle className="text-amber-500" size={20} />
            </div>
            <span className="text-sm font-medium text-gray-500">Active Loans</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{activeLoans.length}</p>
          {overdueLoans.length > 0 && (
            <p className="text-xs text-red-500 font-semibold mt-1">{overdueLoans.length} overdue!</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lending & Borrowing Summary */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Lending & Borrowing</h2>
            <Link href="/borrowing" className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">You lent (others owe you)</span>
              <span className="font-bold text-red-600">{formatCurrency(totalLent)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">You borrowed (you owe)</span>
              <span className="font-bold text-green-600">{formatCurrency(totalBorrowed)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Net position</span>
              <span className={`font-bold ${totalLent - totalBorrowed >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(totalLent - totalBorrowed)}
              </span>
            </div>
          </div>
          {overdueLoans.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm font-semibold text-red-700">
                {overdueLoans.length} overdue loan{overdueLoans.length > 1 ? "s" : ""} need attention!
              </p>
            </div>
          )}
        </div>

        {/* Top Spending Categories */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Top Spending</h2>
            <Link href="/budgets" className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
              Budgets <ArrowRight size={14} />
            </Link>
          </div>
          {topCategories.length === 0 ? (
            <p className="text-gray-400 text-sm py-8 text-center">No expenses this month yet.</p>
          ) : (
            <div className="space-y-3">
              {topCategories.map(([cat, amount]) => (
                <div key={cat} className="flex items-center gap-3">
                  <span className="text-xl">{getCategoryIcon(cat)}</span>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-700">{getCategoryLabel(cat)}</span>
                      <span className="text-sm font-bold text-gray-900">{formatCurrency(amount)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
                      <div
                        className="bg-indigo-500 h-2 rounded-full"
                        style={{ width: `${Math.min(100, (amount / totalExpense) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Recent Transactions</h2>
            <Link href="/transactions" className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {recentTxns.length === 0 ? (
            <p className="text-gray-400 text-sm py-8 text-center">No transactions yet. Add your first one!</p>
          ) : (
            <div className="space-y-2">
              {recentTxns.map((t) => (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition">
                  <span className="text-xl">{getCategoryIcon(t.category)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{t.description}</p>
                    <p className="text-xs text-gray-400">{getCategoryLabel(t.category)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${t.type === "income" ? "text-green-600" : "text-red-500"}`}>
                      {t.type === "income" ? "+" : "-"}{formatCurrency(t.amount)}
                    </p>
                    <p className="text-xs text-gray-400">{t.date.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
