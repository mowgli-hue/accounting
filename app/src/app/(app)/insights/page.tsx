"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { subscribeTransactions, subscribeBudgets, subscribeLoans } from "@/lib/firebase/firestore";
import { formatCurrency, getCurrentMonth } from "@/lib/utils";
import { getCategoryLabel } from "@/lib/constants";
import { Sparkles, TrendingDown, TrendingUp, AlertTriangle, Lightbulb, RefreshCw } from "lucide-react";
import type { Transaction, Budget, Loan } from "@/types";

interface Insight {
  type: "warning" | "tip" | "positive" | "alert";
  title: string;
  body: string;
}

export default function InsightsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [aiInsights, setAiInsights] = useState<string>("");
  const [loadingAI, setLoadingAI] = useState(false);

  const currentMonth = getCurrentMonth();

  useEffect(() => {
    if (!user) return;
    const unsub1 = subscribeTransactions(user.uid, setTransactions);
    const unsub2 = subscribeBudgets(user.uid, currentMonth, setBudgets);
    const unsub3 = subscribeLoans(user.uid, setLoans);
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [user, currentMonth]);

  // Generate local insights (no AI needed)
  const monthTxns = transactions.filter((t) => {
    const d = t.date.toDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === currentMonth;
  });

  const totalIncome = monthTxns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = monthTxns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  const insights: Insight[] = [];

  // Spending vs income
  if (totalExpense > totalIncome && totalIncome > 0) {
    insights.push({
      type: "warning",
      title: "Spending exceeds income",
      body: `You've spent ${formatCurrency(totalExpense)} but only earned ${formatCurrency(totalIncome)} this month. You're ${formatCurrency(totalExpense - totalIncome)} in the red.`,
    });
  } else if (totalIncome > 0 && totalExpense / totalIncome < 0.5) {
    insights.push({
      type: "positive",
      title: "Great savings rate!",
      body: `You're spending less than 50% of your income. You've saved ${formatCurrency(totalIncome - totalExpense)} this month.`,
    });
  }

  // Over-budget categories
  budgets.forEach((b) => {
    const spent = monthTxns.filter((t) => t.type === "expense" && t.category === b.category).reduce((s, t) => s + t.amount, 0);
    if (spent > b.monthlyLimit) {
      insights.push({
        type: "alert",
        title: `${getCategoryLabel(b.category)} over budget`,
        body: `You've spent ${formatCurrency(spent)} on ${getCategoryLabel(b.category)}, which is ${formatCurrency(spent - b.monthlyLimit)} over your ${formatCurrency(b.monthlyLimit)} limit.`,
      });
    } else if (spent > b.monthlyLimit * 0.8) {
      insights.push({
        type: "warning",
        title: `${getCategoryLabel(b.category)} nearing limit`,
        body: `You've used ${Math.round((spent / b.monthlyLimit) * 100)}% of your ${getCategoryLabel(b.category)} budget. ${formatCurrency(b.monthlyLimit - spent)} remaining.`,
      });
    }
  });

  // Overdue loans
  const overdueLoans = loans.filter((l) => l.status === "overdue" || (l.dueDate && l.dueDate.toDate() < new Date() && l.status === "active"));
  if (overdueLoans.length > 0) {
    const totalOverdue = overdueLoans.reduce((s, l) => s + l.outstandingBalance, 0);
    insights.push({
      type: "alert",
      title: `${overdueLoans.length} overdue loan${overdueLoans.length > 1 ? "s" : ""}`,
      body: `You have ${formatCurrency(totalOverdue)} in overdue loans. This needs immediate attention.`,
    });
  }

  // Top spending
  const catSpending = new Map<string, number>();
  monthTxns.filter((t) => t.type === "expense").forEach((t) => {
    catSpending.set(t.category, (catSpending.get(t.category) || 0) + t.amount);
  });
  const topCat = [...catSpending.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topCat && totalExpense > 0) {
    const pct = Math.round((topCat[1] / totalExpense) * 100);
    if (pct > 40) {
      insights.push({
        type: "tip",
        title: `${getCategoryLabel(topCat[0])} dominates spending`,
        body: `${pct}% of your expenses (${formatCurrency(topCat[1])}) go to ${getCategoryLabel(topCat[0])}. Consider if there's room to optimize.`,
      });
    }
  }

  if (insights.length === 0 && transactions.length > 0) {
    insights.push({
      type: "positive",
      title: "Everything looks good!",
      body: "Your finances are on track. Keep up the good work.",
    });
  }

  async function generateAIInsights() {
    setLoadingAI(true);
    try {
      const res = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalIncome,
          totalExpense,
          categories: Object.fromEntries(catSpending),
          budgets: budgets.map((b) => ({ category: b.category, limit: b.monthlyLimit })),
          activeLoans: loans.filter((l) => l.status !== "paid").length,
          overdueLoans: overdueLoans.length,
        }),
      });
      const data = await res.json();
      setAiInsights(data.insights || "Could not generate insights. Make sure ANTHROPIC_API_KEY is set.");
    } catch {
      setAiInsights("AI insights require the ANTHROPIC_API_KEY environment variable to be set.");
    } finally {
      setLoadingAI(false);
    }
  }

  const iconMap = {
    warning: { icon: TrendingDown, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
    alert: { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
    positive: { icon: TrendingUp, color: "text-green-600", bg: "bg-green-50", border: "border-green-200" },
    tip: { icon: Lightbulb, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Insights</h1>
          <p className="text-gray-500 text-sm mt-1">Smart analysis of your finances</p>
        </div>
        <button onClick={generateAIInsights} disabled={loadingAI}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold text-sm hover:from-indigo-700 hover:to-purple-700 transition disabled:opacity-50">
          {loadingAI ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {loadingAI ? "Analyzing..." : "AI Analysis"}
        </button>
      </div>

      {/* Local Insights */}
      {transactions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <Sparkles className="mx-auto mb-3" size={40} />
          <p className="text-lg mb-1">No data yet</p>
          <p className="text-sm">Add some transactions to see insights about your spending.</p>
        </div>
      ) : (
        <div className="space-y-4 mb-8">
          {insights.map((insight, i) => {
            const style = iconMap[insight.type];
            return (
              <div key={i} className={`${style.bg} border ${style.border} rounded-xl p-5 flex items-start gap-4`}>
                <style.icon className={`${style.color} flex-shrink-0 mt-0.5`} size={20} />
                <div>
                  <p className={`font-semibold ${style.color}`}>{insight.title}</p>
                  <p className="text-sm text-gray-700 mt-1">{insight.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* AI Insights */}
      {aiInsights && (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="text-indigo-600" size={18} />
            <h2 className="font-bold text-indigo-900">AI Analysis</h2>
          </div>
          <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{aiInsights}</div>
        </div>
      )}
    </div>
  );
}
