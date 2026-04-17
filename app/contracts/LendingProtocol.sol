// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title FinTrack Lending Protocol
 * @notice P2P lending with escrow, deadlines, and on-chain enforcement.
 *         Lenders deposit funds into the contract. Borrowers accept offers
 *         and must repay before the deadline or face collateral forfeiture.
 */
contract LendingProtocol {
    enum LoanStatus { Open, Active, Repaid, Defaulted, Cancelled }

    struct LoanOffer {
        address lender;
        uint256 amount;
        uint256 interestBps;       // basis points (100 = 1%)
        uint256 durationSeconds;
        uint256 collateralRequired; // collateral borrower must lock
        string  encryptedTerms;    // IPFS hash or encrypted terms blob
        LoanStatus status;
        address borrower;
        uint256 startedAt;
        uint256 deadline;
        uint256 repaidAmount;
        uint256 createdAt;
    }

    uint256 public nextOfferId;
    mapping(uint256 => LoanOffer) public offers;
    mapping(address => uint256[]) public lenderOffers;
    mapping(address => uint256[]) public borrowerLoans;
    mapping(address => uint256) public reputation; // successful repayments

    uint256 public constant LATE_PENALTY_BPS = 500; // 5% penalty for default
    uint256 public constant MIN_COLLATERAL_PCT = 10; // minimum 10% collateral

    event OfferCreated(uint256 indexed offerId, address indexed lender, uint256 amount, uint256 interestBps, uint256 durationSeconds);
    event LoanAccepted(uint256 indexed offerId, address indexed borrower, uint256 deadline);
    event LoanRepaid(uint256 indexed offerId, address indexed borrower, uint256 totalPaid);
    event LoanDefaulted(uint256 indexed offerId, address indexed borrower, uint256 collateralSeized);
    event OfferCancelled(uint256 indexed offerId);

    modifier onlyLender(uint256 _id) {
        require(msg.sender == offers[_id].lender, "Not the lender");
        _;
    }

    // ── Lender: Create an offer ──
    function createOffer(
        uint256 _interestBps,
        uint256 _durationSeconds,
        uint256 _collateralRequired,
        string calldata _encryptedTerms
    ) external payable returns (uint256) {
        require(msg.value > 0, "Must deposit lending amount");
        require(_durationSeconds >= 1 days, "Min duration is 1 day");
        require(_collateralRequired >= (msg.value * MIN_COLLATERAL_PCT) / 100, "Collateral too low");

        uint256 id = nextOfferId++;
        offers[id] = LoanOffer({
            lender: msg.sender,
            amount: msg.value,
            interestBps: _interestBps,
            durationSeconds: _durationSeconds,
            collateralRequired: _collateralRequired,
            encryptedTerms: _encryptedTerms,
            status: LoanStatus.Open,
            borrower: address(0),
            startedAt: 0,
            deadline: 0,
            repaidAmount: 0,
            createdAt: block.timestamp
        });
        lenderOffers[msg.sender].push(id);

        emit OfferCreated(id, msg.sender, msg.value, _interestBps, _durationSeconds);
        return id;
    }

    // ── Borrower: Accept an offer ──
    function acceptOffer(uint256 _id) external payable {
        LoanOffer storage offer = offers[_id];
        require(offer.status == LoanStatus.Open, "Offer not available");
        require(msg.sender != offer.lender, "Cannot borrow from yourself");
        require(msg.value >= offer.collateralRequired, "Insufficient collateral");

        offer.status = LoanStatus.Active;
        offer.borrower = msg.sender;
        offer.startedAt = block.timestamp;
        offer.deadline = block.timestamp + offer.durationSeconds;
        borrowerLoans[msg.sender].push(_id);

        // Transfer the loan amount to the borrower
        (bool sent, ) = payable(msg.sender).call{value: offer.amount}("");
        require(sent, "Transfer failed");

        emit LoanAccepted(_id, msg.sender, offer.deadline);
    }

    // ── Borrower: Repay the loan ──
    function repay(uint256 _id) external payable {
        LoanOffer storage offer = offers[_id];
        require(offer.status == LoanStatus.Active, "Loan not active");
        require(msg.sender == offer.borrower, "Not the borrower");

        uint256 totalDue = offer.amount + ((offer.amount * offer.interestBps) / 10000);
        require(msg.value >= totalDue, "Insufficient repayment");

        offer.status = LoanStatus.Repaid;
        offer.repaidAmount = msg.value;
        reputation[msg.sender]++;

        // Return collateral to borrower
        uint256 collateralReturn = offer.collateralRequired;

        // Send repayment to lender
        (bool sentToLender, ) = payable(offer.lender).call{value: totalDue}("");
        require(sentToLender, "Lender payment failed");

        // Return collateral to borrower
        (bool sentCollateral, ) = payable(offer.borrower).call{value: collateralReturn}("");
        require(sentCollateral, "Collateral return failed");

        // Refund any excess
        uint256 excess = msg.value - totalDue;
        if (excess > 0) {
            (bool sentExcess, ) = payable(msg.sender).call{value: excess}("");
            require(sentExcess, "Excess refund failed");
        }

        emit LoanRepaid(_id, msg.sender, totalDue);
    }

    // ── Lender: Claim collateral after deadline ──
    function claimDefault(uint256 _id) external onlyLender(_id) {
        LoanOffer storage offer = offers[_id];
        require(offer.status == LoanStatus.Active, "Loan not active");
        require(block.timestamp > offer.deadline, "Deadline not passed");

        offer.status = LoanStatus.Defaulted;

        // Lender gets the collateral as penalty
        uint256 collateral = offer.collateralRequired;
        (bool sent, ) = payable(offer.lender).call{value: collateral}("");
        require(sent, "Collateral transfer failed");

        emit LoanDefaulted(_id, offer.borrower, collateral);
    }

    // ── Lender: Cancel open offer ──
    function cancelOffer(uint256 _id) external onlyLender(_id) {
        LoanOffer storage offer = offers[_id];
        require(offer.status == LoanStatus.Open, "Cannot cancel active loan");

        offer.status = LoanStatus.Cancelled;

        // Refund the deposited amount
        (bool sent, ) = payable(offer.lender).call{value: offer.amount}("");
        require(sent, "Refund failed");

        emit OfferCancelled(_id);
    }

    // ── View helpers ──
    function getRepaymentAmount(uint256 _id) external view returns (uint256) {
        LoanOffer storage offer = offers[_id];
        return offer.amount + ((offer.amount * offer.interestBps) / 10000);
    }

    function getTimeRemaining(uint256 _id) external view returns (int256) {
        LoanOffer storage offer = offers[_id];
        if (offer.status != LoanStatus.Active) return 0;
        return int256(offer.deadline) - int256(block.timestamp);
    }

    function isOverdue(uint256 _id) external view returns (bool) {
        LoanOffer storage offer = offers[_id];
        return offer.status == LoanStatus.Active && block.timestamp > offer.deadline;
    }

    function getLenderOffers(address _lender) external view returns (uint256[] memory) {
        return lenderOffers[_lender];
    }

    function getBorrowerLoans(address _borrower) external view returns (uint256[] memory) {
        return borrowerLoans[_borrower];
    }

    function getOfferCount() external view returns (uint256) {
        return nextOfferId;
    }
}
