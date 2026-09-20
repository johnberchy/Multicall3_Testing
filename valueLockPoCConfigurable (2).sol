// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import "./Multicall3.sol";

/// @dev IMPORTANT (Arc-specific): on Circle's Arc network, USDC is the native
///      gas asset. It has two interfaces onto the SAME underlying balance:
///        - native interface (msg.value, address.balance, .call{value:x}()) : 18 decimals
///        - ERC-20 interface (USDC.balanceOf, at 0x3600000000000000000000000000000000000000) : 6 decimals
///      There is no wrapper contract - both interfaces read/move the same funds.
///      This file exclusively uses the NATIVE interface (value/.balance), exactly
///      like it would on Ethereum - "1 ether" here means 10**18 native units,
///      which on Arc is exactly 1 USDC. No unit conversion is needed in Solidity.
///
///      The risk is NOT in this contract's logic - it's in how someone verifies
///      the result off-chain. Checking the ERC-20 balanceOf() (6 decimals) instead
///      of the native balance (18 decimals) can floor-truncate small trapped
///      amounts to zero, making a real, nonzero, trapped balance look like nothing
///      happened. Always verify with native balance reads for this class of bug.

/// @notice Contract with NO receive/fallback - any plain value transfer to it reverts.
contract Rejector {
    // intentionally empty
}

/// @notice Contract that accepts native value transfers normally.
contract Accepter {
    event Received(uint256 amount);
    receive() external payable {
        emit Received(msg.value);
    }
}

/// @notice Drives the scenario. Amounts are passed in at call time.
///         All amounts are NATIVE units (18 decimals). On Arc, that means
///         a value of 10**16 is 0.01 USDC, exactly as "0.01 ether" reads in Solidity.
contract ValueLockPoCConfigurable {
    Multicall3 public mc3;
    Rejector public rejector;
    Accepter public accepter;

    constructor(address _mc3) {
        mc3 = Multicall3(_mc3);
        rejector = new Rejector();
        accepter = new Accepter();
    }

    /// @param failingAmount    native units sent to the rejecting contract (allowFailure=true)
    /// @param succeedingAmount native units sent to the accepting contract (allowFailure=false)
    /// @dev msg.value MUST equal failingAmount + succeedingAmount exactly,
    ///      or Multicall3's internal "value mismatch" check reverts the whole tx.
    function run(uint256 failingAmount, uint256 succeedingAmount) external payable {
        require(msg.value == failingAmount + succeedingAmount, "PoC: msg.value must equal failingAmount + succeedingAmount");

        Multicall3.Call3Value[] memory calls = new Multicall3.Call3Value[](2);

        calls[0] = Multicall3.Call3Value({
            target: address(rejector),
            allowFailure: true,
            value: failingAmount,
            callData: ""
        });

        calls[1] = Multicall3.Call3Value({
            target: address(accepter),
            allowFailure: false,
            value: succeedingAmount,
            callData: ""
        });

        mc3.aggregate3Value{value: msg.value}(calls);
    }

    /// @notice Reads Multicall3's NATIVE balance directly (18 decimals; on Arc this is USDC).
    /// @dev Deliberately provided so verifiers don't reach for USDC.balanceOf() (6 decimals)
    ///      by default, since that view can truncate small trapped amounts to zero.
    ///      This always reflects the true trapped amount, however small.
    function multicall3NativeBalance() external view returns (uint256) {
        return address(mc3).balance;
    }
}
