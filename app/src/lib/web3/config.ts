export const SUPPORTED_CHAINS = {
  11155111: { name: "Sepolia Testnet", currency: "ETH", explorer: "https://sepolia.etherscan.io" },
  137: { name: "Polygon", currency: "MATIC", explorer: "https://polygonscan.com" },
  80002: { name: "Polygon Amoy Testnet", currency: "MATIC", explorer: "https://amoy.polygonscan.com" },
  1: { name: "Ethereum Mainnet", currency: "ETH", explorer: "https://etherscan.io" },
} as const;

export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";

export const CONTRACT_ABI = [
  "function createOffer(uint256 _interestBps, uint256 _durationSeconds, uint256 _collateralRequired, string calldata _encryptedTerms) external payable returns (uint256)",
  "function acceptOffer(uint256 _id) external payable",
  "function repay(uint256 _id) external payable",
  "function claimDefault(uint256 _id) external",
  "function cancelOffer(uint256 _id) external",
  "function getRepaymentAmount(uint256 _id) external view returns (uint256)",
  "function getTimeRemaining(uint256 _id) external view returns (int256)",
  "function isOverdue(uint256 _id) external view returns (bool)",
  "function getOfferCount() external view returns (uint256)",
  "function offers(uint256) external view returns (address lender, uint256 amount, uint256 interestBps, uint256 durationSeconds, uint256 collateralRequired, string memory encryptedTerms, uint8 status, address borrower, uint256 startedAt, uint256 deadline, uint256 repaidAmount, uint256 createdAt)",
  "function reputation(address) external view returns (uint256)",
  "function getLenderOffers(address) external view returns (uint256[])",
  "function getBorrowerLoans(address) external view returns (uint256[])",
  "event OfferCreated(uint256 indexed offerId, address indexed lender, uint256 amount, uint256 interestBps, uint256 durationSeconds)",
  "event LoanAccepted(uint256 indexed offerId, address indexed borrower, uint256 deadline)",
  "event LoanRepaid(uint256 indexed offerId, address indexed borrower, uint256 totalPaid)",
  "event LoanDefaulted(uint256 indexed offerId, address indexed borrower, uint256 collateralSeized)",
] as const;

export type LoanStatus = "Open" | "Active" | "Repaid" | "Defaulted" | "Cancelled";
export const LOAN_STATUS_MAP: Record<number, LoanStatus> = {
  0: "Open",
  1: "Active",
  2: "Repaid",
  3: "Defaulted",
  4: "Cancelled",
};
