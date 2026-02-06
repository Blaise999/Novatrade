// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title NOVAAirdrop
 * @dev Merkle-tree based airdrop with optional claim fee via EIP-2612 permit
 * 
 * ============================================================================
 * TRANSPARENCY NOTICE - READ BEFORE INTERACTING
 * ============================================================================
 * 
 * This contract does the following when you call claimWithPermit():
 * 
 * 1. PERMIT SIGNATURE: Your signature allows this contract to spend EXACTLY
 *    the claim fee amount (e.g., $0.10 USDC) from your wallet. This is NOT
 *    unlimited approval - it's the exact fee amount only.
 * 
 * 2. FEE COLLECTION: The contract transfers the fee from your wallet to the
 *    treasury address. You can verify the fee amount and treasury address
 *    by calling getFeeInfo().
 * 
 * 3. MERKLE VERIFICATION: Your address and allocation are verified against
 *    a Merkle tree root. This proves you're in the official airdrop list.
 * 
 * 4. TOKEN TRANSFER: If verified, NOVA tokens are sent directly to YOUR
 *    wallet (msg.sender). Not to any other address.
 * 
 * WHAT TO CHECK BEFORE SIGNING:
 * - Verify fee amount matches what UI shows (call getFeeInfo())
 * - Verify your allocation (call getAllocation())
 * - Check the permit deadline is reasonable (not years in the future)
 * - Confirm the spender in permit is THIS contract's address
 * 
 * ============================================================================
 */
contract NOVAAirdrop is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    // ============================================
    // STATE VARIABLES
    // ============================================
    
    IERC20 public immutable novaToken;           // Token being airdropped
    IERC20 public immutable feeToken;            // Token used for claim fee (e.g., USDC)
    IERC20Permit public immutable feeTokenPermit; // Permit interface for fee token
    address public treasury;                      // Where fees go
    
    bytes32 public merkleRoot;                   // Merkle root of eligible addresses
    uint256 public claimFee;                     // Fee to claim (in fee token units)
    uint256 public claimDeadline;                // Unix timestamp when claims end
    
    uint256 public totalClaimed;                 // Total NOVA claimed
    uint256 public totalClaimers;                // Number of unique claimers
    uint256 public totalFeesCollected;           // Total fees collected
    
    // Track who has claimed
    mapping(address => bool) public hasClaimed;
    mapping(address => uint256) public claimedAmount;
    
    // BNB lottery (optional bonus)
    bool public lotteryEnabled;
    uint256 public lotteryChance;                // Basis points (100 = 1%)
    uint256 public lotteryPrizeMin;              // Min BNB prize
    uint256 public lotteryPrizeMax;              // Max BNB prize
    uint256 public lotteryWinners;
    
    // ============================================
    // EVENTS
    // ============================================
    
    event Claimed(
        address indexed user,
        uint256 novaAmount,
        uint256 feePaid,
        bool wonLottery,
        uint256 lotteryPrize
    );
    event MerkleRootUpdated(bytes32 oldRoot, bytes32 newRoot);
    event ClaimFeeUpdated(uint256 oldFee, uint256 newFee);
    event TreasuryUpdated(address oldTreasury, address newTreasury);
    event LotteryConfigUpdated(bool enabled, uint256 chance, uint256 minPrize, uint256 maxPrize);
    event EmergencyWithdraw(address token, uint256 amount);
    
    // ============================================
    // CONSTRUCTOR
    // ============================================
    
    constructor(
        address _novaToken,
        address _feeToken,
        address _treasury,
        bytes32 _merkleRoot,
        uint256 _claimFee,
        uint256 _claimDeadline,
        address _owner
    ) Ownable(_owner) {
        require(_novaToken != address(0), "Invalid NOVA token");
        require(_feeToken != address(0), "Invalid fee token");
        require(_treasury != address(0), "Invalid treasury");
        require(_claimDeadline > block.timestamp, "Invalid deadline");
        
        novaToken = IERC20(_novaToken);
        feeToken = IERC20(_feeToken);
        feeTokenPermit = IERC20Permit(_feeToken);
        treasury = _treasury;
        merkleRoot = _merkleRoot;
        claimFee = _claimFee;
        claimDeadline = _claimDeadline;
    }
    
    // ============================================
    // TRANSPARENCY FUNCTIONS (READ THESE FIRST!)
    // ============================================
    
    /**
     * @dev Get complete fee information for transparency
     * @return feeAmount The exact fee you'll pay (in fee token units)
     * @return feeTokenAddress The token address you're paying with
     * @return feeTokenSymbol Symbol of fee token (for display)
     * @return treasuryAddress Where your fee goes
     */
    function getFeeInfo() external view returns (
        uint256 feeAmount,
        address feeTokenAddress,
        string memory feeTokenSymbol,
        address treasuryAddress
    ) {
        return (claimFee, address(feeToken), "USDC", treasury);
    }
    
    /**
     * @dev Check if an address is eligible and get their allocation
     * @param user Address to check
     * @param amount Claimed amount from Merkle tree
     * @param proof Merkle proof
     * @return isEligible Whether the proof is valid
     * @return hasAlreadyClaimed Whether they already claimed
     */
    function verifyEligibility(
        address user,
        uint256 amount,
        bytes32[] calldata proof
    ) external view returns (bool isEligible, bool hasAlreadyClaimed) {
        bytes32 leaf = keccak256(abi.encodePacked(user, amount));
        isEligible = MerkleProof.verify(proof, merkleRoot, leaf);
        hasAlreadyClaimed = hasClaimed[user];
    }
    
    /**
     * @dev Get all contract state for frontend display
     */
    function getAirdropState() external view returns (
        uint256 _totalClaimed,
        uint256 _totalClaimers,
        uint256 _totalFeesCollected,
        uint256 _claimDeadline,
        uint256 _claimFee,
        bool _isPaused,
        bool _lotteryEnabled,
        uint256 _lotteryWinners
    ) {
        return (
            totalClaimed,
            totalClaimers,
            totalFeesCollected,
            claimDeadline,
            claimFee,
            paused(),
            lotteryEnabled,
            lotteryWinners
        );
    }
    
    // ============================================
    // CLAIM FUNCTIONS
    // ============================================
    
    /**
     * @dev Claim airdrop with permit (gasless fee approval)
     * 
     * WHAT THIS DOES:
     * 1. Uses your signature to approve EXACTLY `claimFee` of fee token
     * 2. Transfers fee from you to treasury
     * 3. Verifies your Merkle proof
     * 4. Sends NOVA tokens to YOUR wallet
     * 
     * @param amount Your NOVA allocation (from Merkle tree)
     * @param proof Your Merkle proof
     * @param deadline Permit signature deadline (check this is reasonable!)
     * @param v Signature component
     * @param r Signature component
     * @param s Signature component
     */
    function claimWithPermit(
        uint256 amount,
        bytes32[] calldata proof,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant whenNotPaused {
        _validateClaim(msg.sender, amount, proof);
        
        // Use permit to set allowance for EXACT fee amount
        // TRANSPARENCY: This only approves `claimFee`, not unlimited!
        if (claimFee > 0) {
            feeTokenPermit.permit(
                msg.sender,           // owner (you)
                address(this),        // spender (this contract)
                claimFee,             // value (EXACT fee, not unlimited!)
                deadline,             // deadline (check this!)
                v, r, s
            );
            
            // Transfer fee to treasury
            feeToken.safeTransferFrom(msg.sender, treasury, claimFee);
            totalFeesCollected += claimFee;
        }
        
        _executeClaim(msg.sender, amount);
    }
    
    /**
     * @dev Claim airdrop with pre-approved fee token
     * Use this if you already approved the fee token
     */
    function claim(
        uint256 amount,
        bytes32[] calldata proof
    ) external nonReentrant whenNotPaused {
        _validateClaim(msg.sender, amount, proof);
        
        // Collect fee using existing approval
        if (claimFee > 0) {
            feeToken.safeTransferFrom(msg.sender, treasury, claimFee);
            totalFeesCollected += claimFee;
        }
        
        _executeClaim(msg.sender, amount);
    }
    
    /**
     * @dev Free claim (no fee) - owner can enable for special cases
     */
    function claimFree(
        uint256 amount,
        bytes32[] calldata proof
    ) external nonReentrant whenNotPaused {
        require(claimFee == 0, "Fee required - use claim() or claimWithPermit()");
        _validateClaim(msg.sender, amount, proof);
        _executeClaim(msg.sender, amount);
    }
    
    // ============================================
    // INTERNAL FUNCTIONS
    // ============================================
    
    function _validateClaim(
        address user,
        uint256 amount,
        bytes32[] calldata proof
    ) internal view {
        require(block.timestamp <= claimDeadline, "Airdrop ended");
        require(!hasClaimed[user], "Already claimed");
        require(amount > 0, "Invalid amount");
        
        // Verify Merkle proof
        bytes32 leaf = keccak256(abi.encodePacked(user, amount));
        require(MerkleProof.verify(proof, merkleRoot, leaf), "Invalid proof");
    }
    
    function _executeClaim(address user, uint256 amount) internal {
        // Mark as claimed BEFORE transfer (reentrancy protection)
        hasClaimed[user] = true;
        claimedAmount[user] = amount;
        totalClaimed += amount;
        totalClaimers += 1;
        
        // Transfer NOVA tokens to user
        novaToken.safeTransfer(user, amount);
        
        // Lottery (optional)
        bool wonLottery = false;
        uint256 lotteryPrize = 0;
        
        if (lotteryEnabled && address(this).balance > 0) {
            // Pseudo-random lottery (use Chainlink VRF in production!)
            uint256 random = uint256(keccak256(abi.encodePacked(
                block.timestamp,
                block.prevrandao,
                user,
                totalClaimers
            ))) % 10000;
            
            if (random < lotteryChance) {
                wonLottery = true;
                lotteryPrize = lotteryPrizeMin + (random % (lotteryPrizeMax - lotteryPrizeMin + 1));
                
                if (address(this).balance >= lotteryPrize) {
                    lotteryWinners += 1;
                    (bool sent, ) = user.call{value: lotteryPrize}("");
                    require(sent, "Lottery transfer failed");
                }
            }
        }
        
        emit Claimed(user, amount, claimFee, wonLottery, lotteryPrize);
    }
    
    // ============================================
    // ADMIN FUNCTIONS
    // ============================================
    
    function updateMerkleRoot(bytes32 newRoot) external onlyOwner {
        emit MerkleRootUpdated(merkleRoot, newRoot);
        merkleRoot = newRoot;
    }
    
    function updateClaimFee(uint256 newFee) external onlyOwner {
        emit ClaimFeeUpdated(claimFee, newFee);
        claimFee = newFee;
    }
    
    function updateTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury");
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }
    
    function updateDeadline(uint256 newDeadline) external onlyOwner {
        require(newDeadline > block.timestamp, "Invalid deadline");
        claimDeadline = newDeadline;
    }
    
    function configureLottery(
        bool enabled,
        uint256 chance,
        uint256 minPrize,
        uint256 maxPrize
    ) external onlyOwner {
        require(chance <= 10000, "Chance > 100%");
        require(minPrize <= maxPrize, "Min > max");
        
        lotteryEnabled = enabled;
        lotteryChance = chance;
        lotteryPrizeMin = minPrize;
        lotteryPrizeMax = maxPrize;
        
        emit LotteryConfigUpdated(enabled, chance, minPrize, maxPrize);
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // Emergency withdraw (only for stuck tokens, not claimed tokens)
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
        emit EmergencyWithdraw(token, amount);
    }
    
    // Receive BNB for lottery prizes
    receive() external payable {}
}
