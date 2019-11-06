pragma solidity ^0.5.2;


contract GatedComputing {
  function () external {
    assembly {
      function maybePatch (opcode, i, memOff) -> off {
        off := add(memOff, 1)
        // TODO: patch those
        // CALLVALUE - we can control it with the `call`
        // if eq(opcode, 52) {
        // }
        // ADDRESS
        if eq(opcode, 48) {
          // CALLVALUE
          mstore8(memOff, 52)
        }
        // ORIGIN
        if eq(opcode, 50) {
          // CALLVALUE
          mstore8(memOff, 52)
        }
        // CALLER
        if eq(opcode, 51) {
          // CALLVALUE
          mstore8(memOff, 52)
        }
        // EXTCODESIZE
        if eq(opcode, 59) {
          // GAS
          mstore8(memOff, 90)
        }
        // TODO: support those
        // LOG1
        if eq(opcode, 160) {
          // JUMPDEST
          mstore8(memOff, 91)
        }
        // LOG2
        if eq(opcode, 161) {
          mstore8(memOff, 91)
        }
        // LOG3
        if eq(opcode, 162) {
          mstore8(memOff, 91)
        }
        // LOG4
        if eq(opcode, 163) {
          mstore8(memOff, 91)
        }
        // CALL
        if eq(opcode, 241) {
          // CALLVALUE
          mstore8(memOff, 52)
        }
        // STATICCALL
        if eq(opcode, 250) {
          // CALLVALUE
          mstore8(memOff, 52)
        }

        // TODO: revert on
        // BALANCE
        if eq(opcode, 49) {
          mstore8(memOff, 254)
        }
        // CODESIZE
        if eq(opcode, 56) {
          mstore8(memOff, 254)
        }
        // CODECOPY
        if eq(opcode, 57) {
          mstore8(memOff, 254)
        }
        // GASPRICE
        if eq(opcode, 58) {
          mstore8(memOff, 254)
        }
        // EXTCODEDOPY
        if eq(opcode, 60) {
          mstore8(memOff, 254)
        }
        // EXTCODEHASH
        if eq(opcode, 63) {
          mstore8(memOff, 254)
        }
        // BLOCKHASH
        if eq(opcode, 64) {
          mstore8(memOff, 254)
        }
        // COINBASE
        if eq(opcode, 65) {
          mstore8(memOff, 254)
        }
        // TIMESTAMP
        if eq(opcode, 66) {
          mstore8(memOff, 254)
        }
        // NUMBER
        if eq(opcode, 67) {
          mstore8(memOff, 254)
        }
        // DIFFICULTY
        if eq(opcode, 68) {
          mstore8(memOff, 254)
        }
        // GASLIMIT
        if eq(opcode, 69) {
          mstore8(memOff, 254)
        }
        // SSLOAD
        if eq(opcode, 84) {
          mstore8(memOff, 254)
        }
        // SSTORE
        if eq(opcode, 85) {
          mstore8(memOff, 254)
        }
        // CREATE
        if eq(opcode, 240) {
          mstore8(memOff, 254)
        }
        // CALLCODE
        if eq(opcode, 242) {
          mstore8(memOff, 254)
        }
        // DELEGATECALL
        if eq(opcode, 244) {
          mstore8(memOff, 254)
        }
        // CREATE2
        if eq(opcode, 245) {
          mstore8(memOff, 254)
        }
        // SELFDESTRUCT
        if eq(opcode, 255) {
          mstore8(memOff, 254)
        }
      }

      let offset := 2048
      for { let i := 0 } lt(i, calldatasize()) { i := add(i, 1) } {
        let opcode := byte(returndatasize(), calldataload(i))
        let skip := 0

        // PUSH opcodes
        if and(gt(opcode, 95), lt(opcode, 128)) {
          let len := sub(opcode, 95)
          mstore8(offset, opcode)
          mstore(add(offset, 1), calldataload(add(i, 1)))
          i := add(i, len)
          offset := add(offset, len)
          offset := add(offset, 1)
          skip := 1
        }
        // JUMP
        if eq(opcode, 86) {
          // PUSH1
          mstore8(offset, 96)
          // trampoline
          mstore8(add(offset, 1), 4)
          offset := add(offset, 2)
        }
        // JUMPI
        if eq(opcode, 87) {
          // SWAP 1
          mstore8(offset, 144)
          // PUSH 1
          mstore8(add(offset, 1), 96)
          // 4
          mstore8(add(offset, 2), 4)
          // JUMPI
          mstore8(add(offset, 3), 87)
          // POP
          mstore8(add(offset, 4), 80)

          offset := add(offset, 5)
          skip := 1
        }
        // JUMPDEST
        if eq(opcode, 91) {
          let count := mload(0)
          let o := add(32, mul(count, 4))
          let val := or(shl(240, i), shl(224, sub(offset, 2048)))
          mstore(o, val)
          mstore(0, add(count, 1))

          // JUMPDEST
          mstore8(offset, opcode)
          // POP the stale value from our jump handler
          mstore8(add(offset, 1), 80)
          offset := add(offset, 2)
          skip := 1
        }

        if iszero(skip) {
          mstore8(offset, opcode)
          offset := maybePatch(opcode, i, offset)
        }
      }

      // TODO: check boundaries
      let count := mload(0)
      // we add size: count * instructions + 7
      let plusSize := add(mul(count, 9), 7)
      let ptr := sub(2048, plusSize)
      let deployPtr := sub(ptr, 11)
      // 11 bytes - deploy code
      // PUSH1 11 CODESIZE SUB DUP1 PUSH1 11 MSIZE CODECOPY CALLDATASIZE RETURN
      mstore(deployPtr, 0x600b380380600b593936f3000000000000000000000000000000000000000000)
      // 7 bytes (with INVALID and JUMPDEST below)
      // PUSH2 0000 JUMP JUMPDEST
      mstore(ptr, 0x610000565b000000000000000000000000000000000000000000000000000000)
      // fix destination of first jump (PUSH2 0000) above
      mstore8(add(ptr, 1), shr(8, sub(plusSize, 1)))
      mstore8(add(ptr, 2), sub(plusSize, 1))
      // add INVALID if we fall-through the jump handler
      mstore8(add(ptr, sub(plusSize, 2)), 0xfe)
      // JUMPDEST after the jump handler
      mstore8(add(ptr, sub(plusSize, 1)), 0x5b)

      ptr := add(ptr, 5)
      for { let x := 0 } lt(x, count) { x := add(x, 1) } {
        let o := mload(add(32, mul(x, 4)))
        let oldOffset := shr(240, o)
        let newOffset := and(shr(224, o), 0xffff)
        // DUP1
        mstore8(ptr, 0x80)
        ptr := add(ptr, 1)

        // PUSH2
        mstore8(ptr, 0x61)
        ptr := add(ptr, 1)
        // the old (original) offset
        mstore8(ptr, shr(8, oldOffset))
        ptr := add(ptr, 1)
        mstore8(ptr, oldOffset)
        ptr := add(ptr, 1)

        // EQ
        mstore8(ptr, 0x14)
        ptr := add(ptr, 1)

        // PUSH2
        mstore8(ptr, 0x61)
        ptr := add(ptr, 1)
        // the new offset
        let tmp := add(newOffset, plusSize)
        mstore8(ptr, shr(8, tmp))
        ptr := add(ptr, 1)
        mstore8(ptr, tmp)
        ptr := add(ptr, 1)

        // JUMPI
        mstore8(ptr, 0x57)
        ptr := add(ptr, 1)
      }

      // the size of the deployed bytecode (offset - 2048) + plusSize, and +11 for the deploy code
      let codeSize := add(sub(offset, 2048), add(plusSize, 11))
      let addr := create(0, deployPtr, codeSize)
      mstore(0, addr)
      return(12, 20)
    }
  }
}
