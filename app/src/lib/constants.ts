export const CATEGORIES = [
  { value: "food", label: "Food & Dining", icon: "🍽️" },
  { value: "transport", label: "Transport", icon: "🚗" },
  { value: "rent", label: "Rent & Housing", icon: "🏠" },
  { value: "utilities", label: "Utilities", icon: "💡" },
  { value: "shopping", label: "Shopping", icon: "🛍️" },
  { value: "entertainment", label: "Entertainment", icon: "🎬" },
  { value: "health", label: "Health & Medical", icon: "🏥" },
  { value: "education", label: "Education", icon: "📚" },
  { value: "salary", label: "Salary", icon: "💰" },
  { value: "freelance", label: "Freelance", icon: "💻" },
  { value: "investment", label: "Investment", icon: "📈" },
  { value: "gift", label: "Gifts", icon: "🎁" },
  { value: "loan", label: "Loan", icon: "🤝" },
  { value: "other", label: "Other", icon: "📦" },
] as const;

export const INCOME_CATEGORIES = ["salary", "freelance", "investment", "gift", "other"];
export const EXPENSE_CATEGORIES = ["food", "transport", "rent", "utilities", "shopping", "entertainment", "health", "education", "other"];

export function getCategoryLabel(value: string): string {
  return CATEGORIES.find(c => c.value === value)?.label || value;
}

export function getCategoryIcon(value: string): string {
  return CATEGORIES.find(c => c.value === value)?.icon || "📦";
}
