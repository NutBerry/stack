pragma solidity ^0.5.2;


contract GatedComputing {
  function () external {
    assembly {
      function maybePatch (opcode, memOff) -> off {
        function writeByte (a, b) -> c {
          mstore8(a, b)
          c := add(a, 1)
        }

        switch opcode
        // ADDRESS
        case 0x30 {
          // PUSH1
          memOff := writeByte(memOff, 0x60)
          // 0xaa
          memOff := writeByte(memOff, 0xaa)
          // SLOAD
          memOff := writeByte(memOff, 0x54)
        }
        // ORIGIN
        case 0x32 {
          // PUSH1
          memOff := writeByte(memOff, 0x60)
          // 0xcc
          memOff := writeByte(memOff, 0xcc)
          // SLOAD
          memOff := writeByte(memOff, 0x54)
        }
        // CALLER
        case 0x33 {
          // PUSH1
          memOff := writeByte(memOff, 0x60)
          // 0xcc
          memOff := writeByte(memOff, 0xcc)
          // SLOAD
          memOff := writeByte(memOff, 0x54)
        }
        // EXTCODESIZE
        case 0x3b {
          // JUMPDEST
          memOff := writeByte(memOff, 0x5b)
        }
        // LOG0
        case 0xa0 {
          // POP
          memOff := writeByte(memOff, 0x50)
          memOff := writeByte(memOff, 0x50)
        }
        // LOG1
        case 0xa1 {
          // POP
          memOff := writeByte(memOff, 0x50)
          memOff := writeByte(memOff, 0x50)
          memOff := writeByte(memOff, 0x50)
        }
        // LOG2
        case 0xa2 {
          // POP
          memOff := writeByte(memOff, 0x50)
          memOff := writeByte(memOff, 0x50)
          memOff := writeByte(memOff, 0x50)
          memOff := writeByte(memOff, 0x50)
        }
        // LOG3
        case 0xa3 {
          // POP
          memOff := writeByte(memOff, 0x50)
          memOff := writeByte(memOff, 0x50)
          memOff := writeByte(memOff, 0x50)
          memOff := writeByte(memOff, 0x50)
          memOff := writeByte(memOff, 0x50)
        }
        // LOG4
        case 0xa4 {
          // POP
          memOff := writeByte(memOff, 0x50)
          memOff := writeByte(memOff, 0x50)
          memOff := writeByte(memOff, 0x50)
          memOff := writeByte(memOff, 0x50)
          memOff := writeByte(memOff, 0x50)
          memOff := writeByte(memOff, 0x50)
        }
        // CALL
        case 0xf1 {
          // POP - gas
          memOff := writeByte(memOff, 0x50)
          // PUSH1
          memOff := writeByte(memOff, 0x60)
          // 0xbb
          memOff := writeByte(memOff, 0xbb)
          // SSTORE - (0xbb, a)
          memOff := writeByte(memOff, 0x55)
          // CALLER
          memOff := writeByte(memOff, 0x33)
          // GAS
          memOff := writeByte(memOff, 0x5a)
          // CALLCODE
          memOff := writeByte(memOff, 0xf2)
        }
        // STATICCALL
        case 0xfa {
          // SWAP1
          memOff := writeByte(memOff, 0x90)
          // DUP1
          memOff := writeByte(memOff, 0x80)
          // PUSH1 10
          memOff := writeByte(memOff, 0x60)
          memOff := writeByte(memOff, 10)
          // LT 10 <ADDR>
          memOff := writeByte(memOff, 0x10)
          // PUSH1 <offset>
          memOff := writeByte(memOff, 0x60)
          // <offset>
          memOff := writeByte(memOff, 10)
          // PC
          memOff := writeByte(memOff, 0x58)
          // ADD
          memOff := writeByte(memOff, 0x01)
          // JUMPI
          memOff := writeByte(memOff, 0x57)
          // SWAP1 - reverse first operation
          memOff := writeByte(memOff, 0x90)
          // STATICCALL
          memOff := writeByte(memOff, 0xfa)
          // PUSH 1
          memOff := writeByte(memOff, 0x60)
          // <offset>
          memOff := writeByte(memOff, 13)
          // PC
          memOff := writeByte(memOff, 0x58)
          // ADD
          memOff := writeByte(memOff, 0x01)
          // JUMP
          memOff := writeByte(memOff, 0x56)

          // JUMPDEST
          memOff := writeByte(memOff, 0x5b)
          // SWAP1 - reverse first operation
          memOff := writeByte(memOff, 0x90)
          // POP - gas
          memOff := writeByte(memOff, 0x50)
          // PUSH1
          memOff := writeByte(memOff, 0x60)
          // 0xbb
          memOff := writeByte(memOff, 0xbb)
          // SSTORE - (0xbb, a)
          memOff := writeByte(memOff, 0x55)
          // 0 - CALLVALUE
          memOff := writeByte(memOff, 0x34)
          // CALLER
          memOff := writeByte(memOff, 0x33)
          // GAS
          memOff := writeByte(memOff, 0x5a)
          // CALLCODE
          memOff := writeByte(memOff, 0xf2)
          // JUMPDEST
          memOff := writeByte(memOff, 0x5b)
        }
        // CODESIZE
        case 0x38 {
          // PUSH1
          memOff := writeByte(memOff, 0x60)
          // 0xaa
          memOff := writeByte(memOff, 0xaa)
          // SLOAD
          memOff := writeByte(memOff, 0x54)
          // EXTCODESIZE
          memOff := writeByte(memOff, 0x3b)
        }
        // CODECOPY
        case 0x39 {
          // PUSH1
          memOff := writeByte(memOff, 0x60)
          // 0xaa
          memOff := writeByte(memOff, 0xaa)
          // SLOAD
          memOff := writeByte(memOff, 0x54)
          // EXTCODECOPY
          memOff := writeByte(memOff, 0x3c)
        }
        default {
          let op := 0xfe
          if and(shl(opcode, 1), 0x640a0000000000000000001fffffffffffffffff0fcf00006bfd00013fff0fff) {
            op := opcode
          }
          memOff := writeByte(memOff, op)
        }

        off := memOff
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
          mstore8(offset, 0x60)
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
          mstore8(add(offset, 1), 0x60)
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
