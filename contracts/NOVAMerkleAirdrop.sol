// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title NOVAMerkleAirdrop
 * @notice Secure airdrop contract with Merkle proof verification and optional fee via EIP-2612 permit
 * @dev This contract allows users to claim airdrop tokens by proving their allocation via Merkle proof.
 *      A small fee can be collected via permit (gasless approval) to cover operational costs.
 * 
 * TRANSPARENCY NOTE:
 * - Users pay a small fee (in feeToken) to claim
 * - The fee amount is publicly visible and immutable after deployment
 * - Merkle root ensures only eligible addresses can claim their exact allocation
 * - All claims are logged on-chain for full auditability
 */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract NOVAMerkleAirdrop is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    // ============================================
    // STATE VARIABLES
    // ============================================
    
    /// @notice The token being distributed (NOVA)
    IERC20 public immutable airdropToken;
    
    /// @notice The token used to pay the claim fee (e.g., USDC)
    IERC20 public immutable feeToken;
    
    /// @notice Permit interface for feeToken
    IERC20Permit public immutable feeTokenPermit;
    
    /// @notice Treasury address where fees are sent
    address public treasury;
    
    /// @notice Merkle root for verifying claims
    bytes32 public merkleRoot;
    
    /// @notice Fee required to claim (in feeToken's smallest unit)
    uint256 public claimFee;
    
    /// @notice Airdrop end timestamp
    uint256 public airdropEndTime;
    
    /// @notice Total tokens claimed so far
    uint256 public totalClaimed;
    
    /// @notice Total fees collected
    uint256 public totalFeesCollected;
    
    /// @notice Mapping of address => claimed status
    mapping(address => bool) public hasClaimed;
    
    /// @notice Mapping of address => claimed amount (for transparency)
    mapping(address => uint256) public claimedAmount;

    // ============================================
    // EVENTS
    // ============================================
    
    event Claimed(
        address indexed claimant,
        uint256 amount,
        uint256 feePaid,
        bytes32[] proof
    );
    
    event MerkleRootUpdated(bytes32 oldRoot, bytes32 newRoot);
    event ClaimFeeUpdated(uint256 oldFee, uint256 newFee);
    event TreasuryUpdated(address oldTreasury, address newTreasury);
    event AirdropEndTimeUpdated(uint256 oldTime, uint256 newTime);
    event EmergencyWithdraw(address token, uint256 amount);

    // ============================================
    // ERRORS
    // ============================================
    
    error AlreadyClaimed();
    error InvalidProof();
    error AirdropEnded();
    error AirdropNotEnded();
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientBalance();

    // ============================================
    // CONSTRUCTOR
    // ============================================
    
    /**
     * @param _airdropToken Address of the token to distribute (NOVA)
     * @param _feeToken Address of the fee token (must support EIP-2612 permit)
     * @param _treasury Address where fees are sent
     * @param _merkleRoot Initial Merkle root for verifying claims
     * @param _claimFee Fee required to claim (in feeToken units, e.g., 100000 for $0.10 USDC)
     * @param _airdropDuration Duration in seconds until airdrop ends
     */
    constructor(
        address _airdropToken,
        address _feeToken,
        address _treasury,
        bytes32 _merkleRoot,
        uint256 _claimFee,
        uint256 _airdropDuration
    ) Ownable(msg.sender) {
        if (_airdropToken == address(0)) revert ZeroAddress();
        if (_feeToken == address(0)) revert ZeroAddress();
        if (_treasury == address(0)) revert ZeroAddress();
        
        airdropToken = IERC20(_airdropToken);
        feeToken = IERC20(_feeToken);
        feeTokenPermit = IERC20Permit(_feeToken);
        treasury = _treasury;
        merkleRoot = _merkleRoot;
        claimFee = _claimFee;
        airdropEndTime = block.timestamp + _airdropDuration;
    }

    // ============================================
    // MAIN CLAIM FUNCTION (WITH PERMIT)
    // ============================================
    
    /**
     * @notice Claim airdrop tokens using a Merkle proof and permit signature for fee payment
     * @dev This function:
     *      1. Verifies the caller hasn't claimed
     *      2. Verifies the Merkle proof
     *      3. Uses permit to approve fee payment (gasless approval)
     *      4. Transfers fee to treasury
     *      5. Transfers airdrop tokens to claimant
     * 
     * WHAT THE USER IS SIGNING:
     * - A permit allowing this contract to spend exactly `claimFee` of their feeToken
     * - The permit expires at `deadline` and is single-use (nonce increments)
     * 
     * @param amount The amount of airdrop tokens the user is entitled to
     * @param merkleProof The Merkle proof verifying the user's allocation
     * @param deadline Permit deadline timestamp
     * @param v Permit signature v component
     * @param r Permit signature r component
     * @param s Permit signature s component
     */
    function claimWithPermit(
        uint256 amount,
        bytes32[] calldata merkleProof,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant whenNotPaused {
        _validateClaim(amount, merkleProof);
        
        // Use permit to set allowance for exactly the claim fee
        // TRANSPARENCY: User is approving exactly `claimFee`, not unlimited
        if (claimFee > 0) {
            feeTokenPermit.permit(
                msg.sender,
                address(this),
                claimFee,
                deadline,
                v, r, s
            );
            
            // Transfer fee to treasury
            feeToken.safeTransferFrom(msg.sender, treasury, claimFee);
            totalFeesCollected += claimFee;
        }
        
        _executeClaim(msg.sender, amount, merkleProof);
    }
    
    /**
     * @notice Claim airdrop tokens using traditional approval (if permit not supported)
     * @dev Requires prior approval of feeToken to this contract
     */
    function claimWithApproval(
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external nonReentrant whenNotPaused {
        _validateClaim(amount, merkleProof);
        
        if (claimFee > 0) {
            feeToken.safeTransferFrom(msg.sender, treasury, claimFee);
            totalFeesCollected += claimFee;
        }
        
        _executeClaim(msg.sender, amount, merkleProof);
    }
    
    /**
     * @notice Claim without fee (for whitelisted addresses or fee-free periods)
     * @dev Only works if claimFee is set to 0
     */
    function claimFree(
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external nonReentrant whenNotPaused {
        if (claimFee > 0) revert("Fee required - use claimWithPermit");
        _validateClaim(amount, merkleProof);
        _executeClaim(msg.sender, amount, merkleProof);
    }

    // ============================================
    // INTERNAL FUNCTIONS
    // ============================================
    
    function _validateClaim(uint256 amount, bytes32[] calldata merkleProof) internal view {
        if (block.timestamp > airdropEndTime) revert AirdropEnded();
        if (hasClaimed[msg.sender]) revert AlreadyClaimed();
        if (amount == 0) revert ZeroAmount();
        
        // Verify Merkle proof
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        if (!MerkleProof.verify(merkleProof, merkleRoot, leaf)) {
            revert InvalidProof();
        }
        
        // Check contract has enough tokens
        if (airdropToken.balanceOf(address(this)) < amount) {
            revert InsufficientBalance();
        }
    }
    
    function _executeClaim(
        address claimant,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) internal {
        hasClaimed[claimant] = true;
        claimedAmount[claimant] = amount;
        totalClaimed += amount;
        
        airdropToken.safeTransfer(claimant, amount);
        
        emit Claimed(claimant, amount, claimFee, merkleProof);
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================
    
    /**
     * @notice Check if an address can claim and verify their allocation
     * @param account Address to check
     * @param amount Expected allocation amount
     * @param merkleProof Merkle proof for the allocation
     * @return eligible True if the address can claim
     * @return reason Human-readable status
     */
    function canClaim(
        address account,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external view returns (bool eligible, string memory reason) {
        if (block.timestamp > airdropEndTime) {
            return (false, "Airdrop has ended");
        }
        if (hasClaimed[account]) {
            return (false, "Already claimed");
        }
        
        bytes32 leaf = keccak256(abi.encodePacked(account, amount));
        if (!MerkleProof.verify(merkleProof, merkleRoot, leaf)) {
            return (false, "Invalid proof - not eligible or wrong amount");
        }
        
        if (airdropToken.balanceOf(address(this)) < amount) {
            return (false, "Insufficient tokens in contract");
        }
        
        return (true, "Eligible to claim");
    }
    
    /**
     * @notice Get airdrop statistics
     */
    function getStats() external view returns (
        uint256 _totalClaimed,
        uint256 _totalFeesCollected,
        uint256 _remainingTokens,
        uint256 _timeRemaining,
        bool _isActive
    ) {
        _totalClaimed = totalClaimed;
        _totalFeesCollected = totalFeesCollected;
        _remainingTokens = airdropToken.balanceOf(address(this));
        _timeRemaining = block.timestamp < airdropEndTime ? airdropEndTime - block.timestamp : 0;
        _isActive = block.timestamp <= airdropEndTime && !paused();
    }

    // ============================================
    // ADMIN FUNCTIONS
    // ============================================
    
    function updateMerkleRoot(bytes32 _newRoot) external onlyOwner {
        emit MerkleRootUpdated(merkleRoot, _newRoot);
        merkleRoot = _newRoot;
    }
    
    function updateClaimFee(uint256 _newFee) external onlyOwner {
        emit ClaimFeeUpdated(claimFee, _newFee);
        claimFee = _newFee;
    }
    
    function updateTreasury(address _newTreasury) external onlyOwner {
        if (_newTreasury == address(0)) revert ZeroAddress();
        emit TreasuryUpdated(treasury, _newTreasury);
        treasury = _newTreasury;
    }
    
    function extendAirdrop(uint256 _newEndTime) external onlyOwner {
        if (_newEndTime <= airdropEndTime) revert("Can only extend");
        emit AirdropEndTimeUpdated(airdropEndTime, _newEndTime);
        airdropEndTime = _newEndTime;
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @notice Withdraw unclaimed tokens after airdrop ends
     * @dev Can only be called after airdrop end time
     */
    function withdrawUnclaimed() external onlyOwner {
        if (block.timestamp <= airdropEndTime) revert AirdropNotEnded();
        
        uint256 remaining = airdropToken.balanceOf(address(this));
        if (remaining > 0) {
            airdropToken.safeTransfer(treasury, remaining);
            emit EmergencyWithdraw(address(airdropToken), remaining);
        }
    }
    
    /**
     * @notice Emergency withdraw any stuck tokens
     * @dev Only for emergencies - use withdrawUnclaimed for normal operations
     */
    function emergencyWithdraw(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(token).safeTransfer(treasury, balance);
            emit EmergencyWithdraw(token, balance);
        }
    }
}
