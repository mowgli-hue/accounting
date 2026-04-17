import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ insights: "AI insights are not configured. Add ANTHROPIC_API_KEY to your environment variables." });
  }

  try {
    const data = await req.json();
    const client = new Anthropic({ apiKey });

    const prompt = `You are a personal finance advisor. Analyze this user's financial data for the current month and give practical, specific advice. Be concise and actionable.

Financial Summary:
- Total Income: $${data.totalIncome?.toFixed(2) || "0.00"}
- Total Expenses: $${data.totalExpense?.toFixed(2) || "0.00"}
- Net: $${((data.totalIncome || 0) - (data.totalExpense || 0)).toFixed(2)}

Spending by Category:
${Object.entries(data.categories || {}).map(([cat, amt]) => `- ${cat}: $${(amt as number).toFixed(2)}`).join("\n") || "No expenses recorded"}

Budget Limits:
${(data.budgets || []).map((b: { category: string; limit: number }) => `- ${b.category}: $${b.limit.toFixed(2)}/month`).join("\n") || "No budgets set"}

Active Loans: ${data.activeLoans || 0}
Overdue Loans: ${data.overdueLoans || 0}

Give 3-5 specific insights and recommendations. Include: spending patterns, budget optimization suggestions, and loan management advice if applicable. Keep each point to 1-2 sentences.`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    return NextResponse.json({ insights: textBlock?.text || "No insights generated." });
  } catch (error) {
    console.error("AI insights error:", error);
    return NextResponse.json({ insights: "Failed to generate AI insights. Please try again later." });
  }
}
