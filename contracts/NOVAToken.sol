// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title NOVAToken
 * @dev NOVA Token with EIP-2612 permit functionality for gasless approvals
 * 
 * TRANSPARENCY NOTES:
 * - This token supports EIP-2612 permits (gasless approvals)
 * - Permits allow users to approve spending via signature instead of transaction
 * - This saves gas but users should verify the spender and amount before signing
 * - Max supply is capped at 1 billion tokens
 */
contract NOVAToken is ERC20, ERC20Permit, ERC20Burnable, Ownable {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18; // 1 billion tokens
    
    // Track minters (airdrop contract, staking rewards, etc.)
    mapping(address => bool) public authorizedMinters;
    
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    
    constructor(
        address initialOwner
    ) ERC20("NOVATrADE Token", "NOVA") ERC20Permit("NOVATrADE Token") Ownable(initialOwner) {
        // Mint initial supply to owner (for liquidity, team, etc.)
        // 100M tokens = 10% of max supply
        _mint(initialOwner, 100_000_000 * 10**18);
    }
    
    /**
     * @dev Add an authorized minter (e.g., airdrop contract)
     */
    function addMinter(address minter) external onlyOwner {
        require(minter != address(0), "Invalid minter address");
        authorizedMinters[minter] = true;
        emit MinterAdded(minter);
    }
    
    /**
     * @dev Remove an authorized minter
     */
    function removeMinter(address minter) external onlyOwner {
        authorizedMinters[minter] = false;
        emit MinterRemoved(minter);
    }
    
    /**
     * @dev Mint new tokens (only by authorized minters or owner)
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external {
        require(authorizedMinters[msg.sender] || msg.sender == owner(), "Not authorized to mint");
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
    }
    
    /**
     * @dev Returns the domain separator used in permit signatures
     * Users can verify this matches expected values
     */
    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
    
    /**
     * @dev Override required by Solidity for ERC20Permit
     */
    function nonces(address owner) public view virtual override(ERC20Permit) returns (uint256) {
        return super.nonces(owner);
    }
}
