// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title NOVAYieldVault
 * @author NOVATrADE Team
 * @notice ERC-4626 compliant yield vault with transparent operation
 * 
 * ============================================================================
 * 🔍 COMPLETE TRANSPARENCY - HOW THIS VAULT WORKS
 * ============================================================================
 * 
 * This is a yield-bearing vault that follows the ERC-4626 standard. Here's
 * exactly what happens when you interact with it:
 * 
 * DEPOSIT:
 * 1. You approve/permit the vault to spend your tokens
 * 2. Vault takes your tokens and gives you vault shares
 * 3. Your shares represent your proportion of the total vault
 * 4. As the vault earns yield, your shares become worth more
 * 
 * WITHDRAW:
 * 1. You burn your vault shares
 * 2. Vault calculates how many tokens your shares are worth
 * 3. You receive tokens = your shares × (total assets / total shares)
 * 4. Includes any yield earned since deposit
 * 
 * YIELD SOURCES (Transparent!):
 * - Lending to verified protocols
 * - Liquidity provision rewards
 * - Protocol incentives
 * - All strategy addresses are public and verifiable
 * 
 * NO HIDDEN FEES:
 * - Entry fee: 0% (we don't charge for deposits)
 * - Exit fee: Configurable, max 1%, currently shown in exitFeeBps
 * - Management fee: Configurable, max 2% annual, accrued per block
 * - All fees are on-chain and verifiable
 * 
 * ============================================================================
 */
contract NOVAYieldVault is ERC4626, ERC20Permit, Ownable, Pausable, ReentrancyGuard {
    
    // ============================================
    // CONSTANTS
    // ============================================
    
    uint256 public constant MAX_EXIT_FEE_BPS = 100;      // Max 1% exit fee
    uint256 public constant MAX_MGMT_FEE_BPS = 200;     // Max 2% annual management fee
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    
    // ============================================
    // STATE VARIABLES (All publicly readable!)
    // ============================================
    
    // Fees
    uint256 public exitFeeBps;           // Exit fee in basis points
    uint256 public managementFeeBps;     // Annual management fee in basis points
    address public feeRecipient;         // Where fees go
    
    // Yield tracking
    uint256 public lastFeeAccrualTime;   // Last time management fee was taken
    uint256 public totalFeesCollected;   // Total fees ever collected
    
    // Deposit limits (for user protection)
    uint256 public minDeposit;           // Minimum deposit amount
    uint256 public maxDeposit;           // Maximum deposit per user
    uint256 public totalDepositCap;      // Maximum total deposits
    
    // User tracking
    mapping(address => uint256) public userDeposits;       // Track per-user deposits
    mapping(address => uint256) public userDepositTime;    // When user first deposited
    
    // Strategy tracking (transparent!)
    address[] public activeStrategies;                     // Where funds are deployed
    mapping(address => uint256) public strategyAllocations; // % allocated to each
    
    // ============================================
    // EVENTS
    // ============================================
    
    event FeesAccrued(uint256 amount, uint256 timestamp);
    event ExitFeeCollected(address indexed user, uint256 amount);
    event StrategyAdded(address indexed strategy, string name);
    event StrategyRemoved(address indexed strategy);
    event FeesUpdated(uint256 exitFeeBps, uint256 managementFeeBps);
    
    // ============================================
    // CONSTRUCTOR
    // ============================================
    
    constructor(
        IERC20 _asset,
        string memory _name,
        string memory _symbol,
        address _feeRecipient,
        address _owner
    ) 
        ERC4626(_asset)
        ERC20(_name, _symbol)
        ERC20Permit(_name)
        Ownable(_owner)
    {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        
        feeRecipient = _feeRecipient;
        exitFeeBps = 50;           // 0.5% exit fee default
        managementFeeBps = 100;    // 1% annual management fee default
        lastFeeAccrualTime = block.timestamp;
        
        minDeposit = 1e6;          // $1 minimum (for 6 decimal stablecoins)
        maxDeposit = 1e12;         // $1M maximum per user
        totalDepositCap = 1e14;    // $100M total cap
    }
    
    // ============================================
    // 🔍 TRANSPARENCY FUNCTIONS
    // ============================================
    
    /**
     * @notice Get complete vault information for transparency
     */
    function getVaultInfo() external view returns (
        uint256 _totalAssets,
        uint256 _totalSupply,
        uint256 _sharePrice,
        uint256 _exitFeeBps,
        uint256 _managementFeeBps,
        uint256 _pendingFees,
        address _feeRecipient,
        uint256 _depositorCount
    ) {
        _totalAssets = totalAssets();
        _totalSupply = totalSupply();
        _sharePrice = _totalSupply > 0 ? (_totalAssets * 1e18) / _totalSupply : 1e18;
        _exitFeeBps = exitFeeBps;
        _managementFeeBps = managementFeeBps;
        _pendingFees = _calculatePendingManagementFee();
        _feeRecipient = feeRecipient;
        _depositorCount = 0; // Would need enumerable mapping to track
    }
    
    /**
     * @notice Preview what you'll receive for a deposit (transparent!)
     */
    function previewDepositDetailed(uint256 assets) external view returns (
        uint256 shares,
        uint256 currentSharePrice,
        uint256 yourOwnershipPercent,
        string memory explanation
    ) {
        shares = previewDeposit(assets);
        currentSharePrice = totalSupply() > 0 
            ? (totalAssets() * 1e18) / totalSupply() 
            : 1e18;
        yourOwnershipPercent = totalSupply() > 0 
            ? (shares * 10000) / (totalSupply() + shares)
            : 10000;
        explanation = string(abi.encodePacked(
            "You deposit ", _uint2str(assets), " tokens and receive ",
            _uint2str(shares), " vault shares. No entry fee is charged."
        ));
    }
    
    /**
     * @notice Preview what you'll receive for a withdrawal (transparent!)
     */
    function previewWithdrawDetailed(uint256 shares) external view returns (
        uint256 grossAssets,
        uint256 exitFee,
        uint256 netAssets,
        string memory explanation
    ) {
        grossAssets = previewRedeem(shares);
        exitFee = (grossAssets * exitFeeBps) / BPS_DENOMINATOR;
        netAssets = grossAssets - exitFee;
        explanation = string(abi.encodePacked(
            "Your ", _uint2str(shares), " shares are worth ", _uint2str(grossAssets),
            " tokens. Exit fee of ", _uint2str(exitFee), " (", _uint2str(exitFeeBps),
            " bps) is deducted. You receive ", _uint2str(netAssets), " tokens."
        ));
    }
    
    /**
     * @notice Get all active strategies (where your money goes)
     */
    function getStrategies() external view returns (
        address[] memory strategies,
        uint256[] memory allocations,
        string memory explanation
    ) {
        strategies = activeStrategies;
        allocations = new uint256[](strategies.length);
        
        for (uint256 i = 0; i < strategies.length; i++) {
            allocations[i] = strategyAllocations[strategies[i]];
        }
        
        explanation = "These are the protocols where vault funds are deployed. All addresses are public and can be verified on-chain.";
    }
    
    /**
     * @notice Calculate user's current position value
     */
    function getUserPosition(address user) external view returns (
        uint256 shares,
        uint256 currentValue,
        uint256 depositedValue,
        int256 profitLoss,
        uint256 depositTime
    ) {
        shares = balanceOf(user);
        currentValue = previewRedeem(shares);
        depositedValue = userDeposits[user];
        profitLoss = int256(currentValue) - int256(depositedValue);
        depositTime = userDepositTime[user];
    }
    
    // ============================================
    // DEPOSIT FUNCTIONS
    // ============================================
    
    /**
     * @notice Deposit assets and receive shares
     * @dev Overrides ERC4626 to add tracking and limits
     */
    function deposit(
        uint256 assets,
        address receiver
    ) public virtual override nonReentrant whenNotPaused returns (uint256 shares) {
        // Accrue management fees first
        _accrueManagementFee();
        
        // Check limits
        require(assets >= minDeposit, "Below minimum deposit");
        require(userDeposits[receiver] + assets <= maxDeposit, "Exceeds user deposit limit");
        require(totalAssets() + assets <= totalDepositCap, "Exceeds total deposit cap");
        
        // Do the deposit
        shares = super.deposit(assets, receiver);
        
        // Track user deposit
        if (userDepositTime[receiver] == 0) {
            userDepositTime[receiver] = block.timestamp;
        }
        userDeposits[receiver] += assets;
        
        return shares;
    }
    
    /**
     * @notice Mint exact shares by depositing assets
     */
    function mint(
        uint256 shares,
        address receiver
    ) public virtual override nonReentrant whenNotPaused returns (uint256 assets) {
        _accrueManagementFee();
        
        assets = previewMint(shares);
        require(assets >= minDeposit, "Below minimum deposit");
        require(userDeposits[receiver] + assets <= maxDeposit, "Exceeds user deposit limit");
        require(totalAssets() + assets <= totalDepositCap, "Exceeds total deposit cap");
        
        assets = super.mint(shares, receiver);
        
        if (userDepositTime[receiver] == 0) {
            userDepositTime[receiver] = block.timestamp;
        }
        userDeposits[receiver] += assets;
        
        return assets;
    }
    
    // ============================================
    // WITHDRAW FUNCTIONS
    // ============================================
    
    /**
     * @notice Withdraw assets by burning shares
     * @dev Includes exit fee (transparently!)
     */
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public virtual override nonReentrant returns (uint256 shares) {
        _accrueManagementFee();
        
        // Calculate shares needed (accounting for exit fee)
        uint256 grossAssets = (assets * BPS_DENOMINATOR) / (BPS_DENOMINATOR - exitFeeBps);
        shares = previewWithdraw(grossAssets);
        
        // Check allowance if not owner
        if (msg.sender != owner) {
            uint256 allowed = allowance(owner, msg.sender);
            if (allowed != type(uint256).max) {
                require(allowed >= shares, "Insufficient allowance");
                _approve(owner, msg.sender, allowed - shares);
            }
        }
        
        // Burn shares
        _burn(owner, shares);
        
        // Calculate and collect exit fee
        uint256 fee = (grossAssets * exitFeeBps) / BPS_DENOMINATOR;
        uint256 netAssets = grossAssets - fee;
        
        // Transfer
        IERC20(asset()).transfer(receiver, netAssets);
        if (fee > 0) {
            IERC20(asset()).transfer(feeRecipient, fee);
            totalFeesCollected += fee;
            emit ExitFeeCollected(owner, fee);
        }
        
        // Update tracking
        if (balanceOf(owner) == 0) {
            userDeposits[owner] = 0;
            userDepositTime[owner] = 0;
        }
        
        return shares;
    }
    
    /**
     * @notice Redeem shares for assets
     */
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public virtual override nonReentrant returns (uint256 assets) {
        _accrueManagementFee();
        
        // Check allowance
        if (msg.sender != owner) {
            uint256 allowed = allowance(owner, msg.sender);
            if (allowed != type(uint256).max) {
                require(allowed >= shares, "Insufficient allowance");
                _approve(owner, msg.sender, allowed - shares);
            }
        }
        
        // Calculate assets
        assets = previewRedeem(shares);
        
        // Burn shares
        _burn(owner, shares);
        
        // Calculate exit fee
        uint256 fee = (assets * exitFeeBps) / BPS_DENOMINATOR;
        uint256 netAssets = assets - fee;
        
        // Transfer
        IERC20(asset()).transfer(receiver, netAssets);
        if (fee > 0) {
            IERC20(asset()).transfer(feeRecipient, fee);
            totalFeesCollected += fee;
            emit ExitFeeCollected(owner, fee);
        }
        
        // Update tracking
        if (balanceOf(owner) == 0) {
            userDeposits[owner] = 0;
            userDepositTime[owner] = 0;
        }
        
        return netAssets;
    }
    
    // ============================================
    // FEE FUNCTIONS
    // ============================================
    
    function _calculatePendingManagementFee() internal view returns (uint256) {
        uint256 timePassed = block.timestamp - lastFeeAccrualTime;
        uint256 annualFee = (totalAssets() * managementFeeBps) / BPS_DENOMINATOR;
        return (annualFee * timePassed) / SECONDS_PER_YEAR;
    }
    
    function _accrueManagementFee() internal {
        uint256 fee = _calculatePendingManagementFee();
        if (fee > 0 && totalSupply() > 0) {
            // Mint shares to fee recipient (dilutes other holders proportionally)
            uint256 feeShares = (fee * totalSupply()) / totalAssets();
            if (feeShares > 0) {
                _mint(feeRecipient, feeShares);
                totalFeesCollected += fee;
                emit FeesAccrued(fee, block.timestamp);
            }
        }
        lastFeeAccrualTime = block.timestamp;
    }
    
    // ============================================
    // ADMIN FUNCTIONS
    // ============================================
    
    function updateFees(uint256 _exitFeeBps, uint256 _managementFeeBps) external onlyOwner {
        require(_exitFeeBps <= MAX_EXIT_FEE_BPS, "Exit fee too high");
        require(_managementFeeBps <= MAX_MGMT_FEE_BPS, "Management fee too high");
        
        _accrueManagementFee(); // Accrue with old rate first
        
        exitFeeBps = _exitFeeBps;
        managementFeeBps = _managementFeeBps;
        
        emit FeesUpdated(_exitFeeBps, _managementFeeBps);
    }
    
    function updateLimits(
        uint256 _minDeposit,
        uint256 _maxDeposit,
        uint256 _totalDepositCap
    ) external onlyOwner {
        minDeposit = _minDeposit;
        maxDeposit = _maxDeposit;
        totalDepositCap = _totalDepositCap;
    }
    
    function addStrategy(address strategy, string calldata name) external onlyOwner {
        require(strategy != address(0), "Invalid strategy");
        activeStrategies.push(strategy);
        emit StrategyAdded(strategy, name);
    }
    
    function removeStrategy(address strategy) external onlyOwner {
        for (uint256 i = 0; i < activeStrategies.length; i++) {
            if (activeStrategies[i] == strategy) {
                activeStrategies[i] = activeStrategies[activeStrategies.length - 1];
                activeStrategies.pop();
                strategyAllocations[strategy] = 0;
                emit StrategyRemoved(strategy);
                break;
            }
        }
    }
    
    function updateFeeRecipient(address _feeRecipient) external onlyOwner {
        require(_feeRecipient != address(0), "Invalid recipient");
        feeRecipient = _feeRecipient;
    }
    
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
    
    // ============================================
    // VIEW OVERRIDES (for proper ERC4626)
    // ============================================
    
    function maxDeposit(address) public view virtual override returns (uint256) {
        if (paused()) return 0;
        uint256 remaining = totalDepositCap > totalAssets() 
            ? totalDepositCap - totalAssets() 
            : 0;
        return remaining > maxDeposit ? maxDeposit : remaining;
    }
    
    function maxMint(address receiver) public view virtual override returns (uint256) {
        return previewDeposit(maxDeposit(receiver));
    }
    
    // ============================================
    // HELPER FUNCTIONS
    // ============================================
    
    function _uint2str(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
