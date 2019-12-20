pragma solidity ^0.5.2;


contract GatedComputing {
  function () external {
    assembly {
      function maybePatch (opcode, memOff) -> off {
        off := add(memOff, 1)

        switch opcode
        // ADDRESS
        case 48 {
          // PUSH1
          mstore8(memOff, 96)
          // 0xaa
          mstore8(add(memOff, 1), 0xaa)
          // SLOAD
          mstore8(add(memOff, 2), 0x54)
          off := add(memOff, 3)
        }
        // ORIGIN
        case 50 {
          // PUSH1
          mstore8(memOff, 96)
          // 0xcc
          mstore8(add(memOff, 1), 0xcc)
          // SLOAD
          mstore8(add(memOff, 2), 0x54)
          off := add(memOff, 3)
        }
        // CALLER
        case 51 {
          // PUSH1
          mstore8(memOff, 96)
          // 0xcc
          mstore8(add(memOff, 1), 0xcc)
          // SLOAD
          mstore8(add(memOff, 2), 0x54)
          off := add(memOff, 3)
        }
        // EXTCODESIZE
        case 59 {
          // JUMPDEST
          mstore8(memOff, 0x5b)
        }
        // CALL
        case 241 {
          // TODO: allow specific precompiles and supported calls,
          // forward supported calls to caller
          // gas address value inOffset inSize outOffset outSize

          // POP - gas
          mstore8(memOff, 80)
          // PUSH1
          mstore8(add(memOff, 1), 96)
          // 0xbb
          mstore8(add(memOff, 2), 0xbb)
          // SSTORE - (0xbb, a)
          mstore8(add(memOff, 3), 85)
          // CALLER
          mstore8(add(memOff, 4), 51)
          // GAS
          mstore8(add(memOff, 5), 90)
          // CALLCODE
          mstore8(add(memOff, 6), 242)
          off := add(memOff, 7)
        }
        // STATICCALL
        case 250 {
          // POP - gas
          mstore8(memOff, 80)
          // PUSH1
          mstore8(add(memOff, 1), 96)
          // 0xbb
          mstore8(add(memOff, 2), 0xbb)
          // SSTORE - (0xbb, a)
          mstore8(add(memOff, 3), 85)
          // 0 - CALLVALUE
          mstore8(add(memOff, 4), 52)
          // CALLER
          mstore8(add(memOff, 5), 51)
          // GAS
          mstore8(add(memOff, 6), 90)
          // CALLCODE
          mstore8(add(memOff, 7), 242)
          off := add(memOff, 8)
        }
        default {
          let op := 254
          if and(shl(opcode, 1), 0x640a0000000000000000001fffffffffffffffff0fcf000068fd00013fff0fff) {
            op := opcode
          }
          mstore8(memOff, op)
        }
      }

      let offset := 8192
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
          // JUMP
          mstore8(add(offset, 2), 86)

          offset := add(offset, 3)
          skip := 1
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
          let val := or(shl(240, i), shl(224, sub(offset, 8192)))
          mstore(o, val)
          mstore(0, add(count, 1))

          mstore8(offset, opcode)
          offset := add(offset, 1)
          skip := 1
        }

        if iszero(skip) {
          offset := maybePatch(opcode, offset)
        }
      }

      // TODO: check boundaries
      let count := mload(0)
      if gt(count, 180) {
        revert(0, 0)
      }
      // we add size: (count * instructions) + 7
      let plusSize := add(mul(count, 15), 7)
      if gt(plusSize, 4000) {
        revert(0, 0)
      }
      let ptr := sub(8192, plusSize)
      let deployPtr := sub(ptr, 11)
      // 11 bytes - deploy code
      // PUSH1 11 CODESIZE SUB DUP1 PUSH1 11 MSIZE CODECOPY CALLDATASIZE RETURN
      mstore(deployPtr, 0x600b380380600b593936f3000000000000000000000000000000000000000000)
      // 7 bytes (with INVALID and JUMPDEST below)
      // PUSH2 00 00 JUMP JUMPDEST
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
        let newOffset := shr(240, shl(16, o))

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

        // SUB
        mstore8(ptr, 0x03)
        ptr := add(ptr, 1)

        // PUSH2
        mstore8(ptr, 0x61)
        ptr := add(ptr, 1)
        mstore8(ptr, shr(8, add(mul(x, 15) , 19)))
        ptr := add(ptr, 1)
        mstore8(ptr, add(mul(x, 15) , 19))
        ptr := add(ptr, 1)

        // JUMPI - skip if not equal
        mstore8(ptr, 0x57)
        ptr := add(ptr, 1)

        // POP - the original offset
        mstore8(ptr, 80)
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

        // JUMP
        mstore8(ptr, 0x56)
        ptr := add(ptr, 1)

        // JUMPDEST
        mstore8(ptr, 91)
        ptr := add(ptr, 1)
      }

      // the size of the deployed bytecode (offset - 8192) + plusSize, and +11 for the deploy code
      let codeSize := add(sub(offset, 8192), add(plusSize, 11))
      let addr := create(0, deployPtr, codeSize)
      mstore(0, addr)
      return(12, 20)
    }
  }
}
