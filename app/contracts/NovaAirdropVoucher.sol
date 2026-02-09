// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract NovaAirdropVoucher is EIP712, Ownable2Step, ReentrancyGuard {
  using SafeERC20 for IERC20;

  IERC20 public immutable novaToken;

  address public signer;          // backend signer address
  uint64 public endTimestamp;     // claim window end
  mapping(bytes32 => bool) public usedClaimId;

  bytes32 private constant CLAIM_TYPEHASH =
    keccak256("Claim(address wallet,uint256 amount,bytes32 claimId,uint256 deadline)");

  event SignerUpdated(address indexed signer);
  event EndUpdated(uint64 indexed endTimestamp);
  event Claimed(address indexed wallet, uint256 amount, bytes32 indexed claimId);

  error Ended();
  error AlreadyUsed();
  error Expired();
  error BadSig();

  constructor(
    address _novaToken,
    address _signer,
    uint64 _endTimestamp
  ) EIP712("NovaAirdrop", "1") {
    require(_novaToken != address(0), "ZERO_TOKEN");
    require(_signer != address(0), "ZERO_SIGNER");
    require(_endTimestamp != 0, "BAD_END");

    novaToken = IERC20(_novaToken);
    signer = _signer;
    endTimestamp = _endTimestamp;
  }

  function setSigner(address s) external onlyOwner {
    require(s != address(0), "ZERO_SIGNER");
    signer = s;
    emit SignerUpdated(s);
  }

  function setEndTimestamp(uint64 ts) external onlyOwner {
    endTimestamp = ts;
    emit EndUpdated(ts);
  }

  function claim(
    uint256 amount,
    bytes32 claimId,
    uint256 deadline,
    bytes calldata signature
  ) external nonReentrant {
    if (block.timestamp >= endTimestamp) revert Ended();
    if (usedClaimId[claimId]) revert AlreadyUsed();
    if (block.timestamp > deadline) revert Expired();

    bytes32 structHash = keccak256(abi.encode(
      CLAIM_TYPEHASH,
      msg.sender,
      amount,
      claimId,
      deadline
    ));

    bytes32 digest = _hashTypedDataV4(structHash);
    address recovered = ECDSA.recover(digest, signature);
    if (recovered != signer) revert BadSig();

    usedClaimId[claimId] = true;
    novaToken.safeTransfer(msg.sender, amount);

    emit Claimed(msg.sender, amount, claimId);
  }

  /// Withdraw leftovers only after end
  function withdrawUnclaimed(address to, uint256 amount) external onlyOwner {
    require(block.timestamp >= endTimestamp, "NOT_ENDED");
    novaToken.safeTransfer(to, amount);
  }
}
