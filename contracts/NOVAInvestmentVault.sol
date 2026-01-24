// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title NOVAInvestmentVault
 * @notice Yield-generating vault for NOVA token staking
 * @dev Implements ERC4626-like interface for transparent yield distribution
 * 
 * TRANSPARENCY:
 * - APY is calculated and displayed in real-time
 * - All deposits and withdrawals are logged
 * - Reward rates are publicly visible
 * - No hidden fees or slippage
 */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract NOVAInvestmentVault is ERC20, ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    // ============================================
    // STATE VARIABLES
    // ============================================
    
    /// @notice The staked token (e.g., NOVA or stablecoin)
    IERC20 public immutable stakingToken;
    
    /// @notice Reward token (can be same as staking token)
    IERC20 public rewardToken;
    
    /// @notice Reward rate per second per token staked (scaled by 1e18)
    uint256 public rewardRate;
    
    /// @notice Last update timestamp
    uint256 public lastUpdateTime;
    
    /// @notice Reward per token stored
    uint256 public rewardPerTokenStored;
    
    /// @notice User reward per token paid
    mapping(address => uint256) public userRewardPerTokenPaid;
    
    /// @notice User pending rewards
    mapping(address => uint256) public rewards;
    
    /// @notice Lock periods (in seconds)
    uint256 public constant LOCK_30_DAYS = 30 days;
    uint256 public constant LOCK_90_DAYS = 90 days;
    uint256 public constant LOCK_180_DAYS = 180 days;
    uint256 public constant LOCK_365_DAYS = 365 days;
    
    /// @notice Lock period bonus multipliers (basis points, 10000 = 1x)
    mapping(uint256 => uint256) public lockBonusMultiplier;
    
    /// @notice User lock end times
    mapping(address => uint256) public userLockEndTime;
    
    /// @notice User chosen lock period
    mapping(address => uint256) public userLockPeriod;
    
    /// @notice Total value locked
    uint256 public totalValueLocked;
    
    /// @notice Minimum deposit amount
    uint256 public minDeposit;
    
    /// @notice Early withdrawal penalty (basis points)
    uint256 public earlyWithdrawalPenalty = 1000; // 10%

    // ============================================
    // EVENTS
    // ============================================
    
    event Deposited(
        address indexed user,
        uint256 amount,
        uint256 shares,
        uint256 lockPeriod,
        uint256 lockEndTime
    );
    
    event Withdrawn(
        address indexed user,
        uint256 shares,
        uint256 amount,
        uint256 penalty,
        bool earlyWithdrawal
    );
    
    event RewardPaid(address indexed user, uint256 reward);
    event RewardRateUpdated(uint256 oldRate, uint256 newRate);
    event LockBonusUpdated(uint256 lockPeriod, uint256 multiplier);

    // ============================================
    // CONSTRUCTOR
    // ============================================
    
    constructor(
        address _stakingToken,
        address _rewardToken,
        uint256 _rewardRate,
        uint256 _minDeposit
    ) ERC20("NOVA Vault Shares", "nvNOVA") Ownable(msg.sender) {
        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);
        rewardRate = _rewardRate;
        minDeposit = _minDeposit;
        lastUpdateTime = block.timestamp;
        
        // Set default lock bonuses
        lockBonusMultiplier[LOCK_30_DAYS] = 10000;   // 1x (no bonus)
        lockBonusMultiplier[LOCK_90_DAYS] = 12000;   // 1.2x
        lockBonusMultiplier[LOCK_180_DAYS] = 15000;  // 1.5x
        lockBonusMultiplier[LOCK_365_DAYS] = 20000;  // 2x
    }

    // ============================================
    // MODIFIERS
    // ============================================
    
    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = block.timestamp;
        
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    // ============================================
    // MAIN FUNCTIONS
    // ============================================
    
    /**
     * @notice Deposit tokens into the vault
     * @param amount Amount to deposit
     * @param lockPeriod Lock period in seconds (0 for flexible)
     * @return shares Amount of vault shares received
     * 
     * WHAT HAPPENS:
     * 1. Your tokens are transferred to this vault
     * 2. You receive vault shares representing your stake
     * 3. You start earning rewards immediately
     * 4. If locked, you get bonus rewards but can't withdraw early without penalty
     */
    function deposit(
        uint256 amount,
        uint256 lockPeriod
    ) external nonReentrant whenNotPaused updateReward(msg.sender) returns (uint256 shares) {
        require(amount >= minDeposit, "Below minimum deposit");
        require(
            lockPeriod == 0 || 
            lockPeriod == LOCK_30_DAYS || 
            lockPeriod == LOCK_90_DAYS || 
            lockPeriod == LOCK_180_DAYS || 
            lockPeriod == LOCK_365_DAYS,
            "Invalid lock period"
        );
        
        // Calculate shares (1:1 for simplicity, could use exchange rate)
        shares = amount;
        
        // Transfer tokens from user
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        
        // Mint vault shares
        _mint(msg.sender, shares);
        
        // Update lock if applicable
        if (lockPeriod > 0) {
            uint256 newLockEnd = block.timestamp + lockPeriod;
            
            // Only extend lock, never shorten
            if (newLockEnd > userLockEndTime[msg.sender]) {
                userLockEndTime[msg.sender] = newLockEnd;
                userLockPeriod[msg.sender] = lockPeriod;
            }
        }
        
        totalValueLocked += amount;
        
        emit Deposited(msg.sender, amount, shares, lockPeriod, userLockEndTime[msg.sender]);
        
        return shares;
    }
    
    /**
     * @notice Withdraw tokens from the vault
     * @param shares Amount of shares to redeem
     * @return amount Amount of tokens received
     * 
     * WHAT HAPPENS:
     * 1. Your vault shares are burned
     * 2. You receive your staked tokens back
     * 3. If withdrawing early (before lock ends), a penalty is applied
     * 4. Any pending rewards are also claimed
     */
    function withdraw(
        uint256 shares
    ) external nonReentrant updateReward(msg.sender) returns (uint256 amount) {
        require(shares > 0, "Cannot withdraw 0");
        require(balanceOf(msg.sender) >= shares, "Insufficient shares");
        
        // Calculate underlying amount
        amount = shares; // 1:1 for simplicity
        
        bool isEarlyWithdrawal = block.timestamp < userLockEndTime[msg.sender];
        uint256 penalty = 0;
        
        if (isEarlyWithdrawal && userLockEndTime[msg.sender] > 0) {
            penalty = (amount * earlyWithdrawalPenalty) / 10000;
            amount -= penalty;
            
            // Send penalty to vault (redistributed to other stakers)
            // Or could be burned/sent to treasury
        }
        
        // Burn shares
        _burn(msg.sender, shares);
        
        // Transfer tokens
        stakingToken.safeTransfer(msg.sender, amount);
        
        // Also claim rewards
        _claimReward(msg.sender);
        
        totalValueLocked -= (amount + penalty);
        
        emit Withdrawn(msg.sender, shares, amount, penalty, isEarlyWithdrawal);
        
        return amount;
    }
    
    /**
     * @notice Claim pending rewards
     */
    function claimReward() external nonReentrant updateReward(msg.sender) {
        _claimReward(msg.sender);
    }
    
    function _claimReward(address account) internal {
        uint256 reward = rewards[account];
        if (reward > 0) {
            rewards[account] = 0;
            rewardToken.safeTransfer(account, reward);
            emit RewardPaid(account, reward);
        }
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================
    
    /**
     * @notice Calculate current reward per token
     */
    function rewardPerToken() public view returns (uint256) {
        if (totalSupply() == 0) {
            return rewardPerTokenStored;
        }
        
        return rewardPerTokenStored + (
            (block.timestamp - lastUpdateTime) * rewardRate * 1e18 / totalSupply()
        );
    }
    
    /**
     * @notice Calculate earned rewards for an account
     */
    function earned(address account) public view returns (uint256) {
        uint256 baseEarned = (
            balanceOf(account) * (rewardPerToken() - userRewardPerTokenPaid[account]) / 1e18
        ) + rewards[account];
        
        // Apply lock bonus if applicable
        uint256 lockPeriod = userLockPeriod[account];
        if (lockPeriod > 0 && lockBonusMultiplier[lockPeriod] > 10000) {
            baseEarned = baseEarned * lockBonusMultiplier[lockPeriod] / 10000;
        }
        
        return baseEarned;
    }
    
    /**
     * @notice Get user's stake info (for transparency)
     */
    function getUserInfo(address user) external view returns (
        uint256 stakedAmount,
        uint256 sharesBalance,
        uint256 pendingRewards,
        uint256 lockEndTime,
        uint256 lockPeriod,
        uint256 bonusMultiplier,
        uint256 effectiveAPY
    ) {
        stakedAmount = balanceOf(user);
        sharesBalance = balanceOf(user);
        pendingRewards = earned(user);
        lockEndTime = userLockEndTime[user];
        lockPeriod = userLockPeriod[user];
        bonusMultiplier = lockPeriod > 0 ? lockBonusMultiplier[lockPeriod] : 10000;
        
        // Calculate effective APY (simplified)
        if (totalSupply() > 0) {
            uint256 yearlyReward = rewardRate * 365 days;
            effectiveAPY = yearlyReward * bonusMultiplier * 10000 / totalSupply() / 10000;
        }
    }
    
    /**
     * @notice Get vault statistics
     */
    function getVaultStats() external view returns (
        uint256 _totalValueLocked,
        uint256 _totalShares,
        uint256 _rewardRate,
        uint256 _baseAPY,
        uint256 _availableRewards
    ) {
        _totalValueLocked = totalValueLocked;
        _totalShares = totalSupply();
        _rewardRate = rewardRate;
        
        if (totalSupply() > 0) {
            _baseAPY = rewardRate * 365 days * 10000 / totalSupply();
        }
        
        _availableRewards = rewardToken.balanceOf(address(this));
    }

    // ============================================
    // ADMIN FUNCTIONS
    // ============================================
    
    function setRewardRate(uint256 newRate) external onlyOwner updateReward(address(0)) {
        emit RewardRateUpdated(rewardRate, newRate);
        rewardRate = newRate;
    }
    
    function setLockBonus(uint256 lockPeriod, uint256 multiplier) external onlyOwner {
        require(multiplier >= 10000, "Multiplier must be >= 1x");
        lockBonusMultiplier[lockPeriod] = multiplier;
        emit LockBonusUpdated(lockPeriod, multiplier);
    }
    
    function setMinDeposit(uint256 newMin) external onlyOwner {
        minDeposit = newMin;
    }
    
    function setEarlyWithdrawalPenalty(uint256 newPenalty) external onlyOwner {
        require(newPenalty <= 2000, "Penalty too high"); // Max 20%
        earlyWithdrawalPenalty = newPenalty;
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @notice Add rewards to the vault
     */
    function notifyRewardAmount(uint256 amount) external onlyOwner updateReward(address(0)) {
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
    }
}
