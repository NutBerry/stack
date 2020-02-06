pragma solidity ^0.5.2;


contract GatedComputing {
  function () external {
    assembly {
      let ptr := 8192
      for { let i := 0 } lt(i, calldatasize()) { i := add(i, 1) } {
        let opcode := byte(returndatasize(), calldataload(i))
        let skip := 0

        // PUSH opcodes
        if and(gt(opcode, 95), lt(opcode, 128)) {
          let len := sub(opcode, 95)
          mstore8(ptr, opcode)
          ptr := add(ptr, 1)
          mstore(ptr, calldataload(add(i, 1)))
          i := add(i, len)
          ptr := add(ptr, len)
          skip := 1
        }
        // JUMP
        if eq(opcode, 0x56) {
          // PUSH1
          // trampoline
          // JUMP
          mstore(ptr, 0x6004560000000000000000000000000000000000000000000000000000000000)
          ptr := add(ptr, 3)

          skip := 1
        }
        // JUMPI
        if eq(opcode, 0x57) {
          // SWAP 1
          // PUSH 1
          // 4
          // JUMPI
          // POP
          mstore(ptr, 0x9060045750000000000000000000000000000000000000000000000000000000)
          ptr := add(ptr, 5)

          skip := 1
        }
        // JUMPDEST
        if eq(opcode, 0x5b) {
          let count := mload(0)
          let o := add(32, mul(count, 4))
          let val := or(shl(240, i), shl(224, sub(ptr, 8192)))
          mstore(o, val)
          mstore(0, add(count, 1))

          mstore8(ptr, opcode)
          ptr := add(ptr, 1)
          skip := 1
        }

        if iszero(skip) {
          switch opcode
          // ADDRESS
          case 0x30 {
            // PUSH1
            // 0xaa
            // SLOAD
            mstore(ptr, 0x60aa540000000000000000000000000000000000000000000000000000000000)
            ptr := add(ptr, 3)
          }
          // ORIGIN
          case 0x32 {
            // PUSH1
            // 0xcc
            // SLOAD
            mstore(ptr, 0x60cc540000000000000000000000000000000000000000000000000000000000)
            ptr := add(ptr, 3)
          }
          // CALLER
          case 0x33 {
            // PUSH1
            // 0xcc
            // SLOAD
            mstore(ptr, 0x60cc540000000000000000000000000000000000000000000000000000000000)
            ptr := add(ptr, 3)
          }
          // EXTCODESIZE
          case 0x3b {
            // JUMPDEST
            mstore8(ptr, 0x5b)
            ptr := add(ptr, 1)
          }
          // LOG0
          case 0xa0 {
            // POP
            mstore(ptr, 0x5050000000000000000000000000000000000000000000000000000000000000)
            ptr := add(ptr, 2)
          }
          // LOG1
          case 0xa1 {
            // POP
            mstore(ptr, 0x5050500000000000000000000000000000000000000000000000000000000000)
            ptr := add(ptr, 3)
          }
          // LOG2
          case 0xa2 {
            // POP
            mstore(ptr, 0x5050505000000000000000000000000000000000000000000000000000000000)
            ptr := add(ptr, 4)
          }
          // LOG3
          case 0xa3 {
            // POP
            mstore(ptr, 0x5050505050000000000000000000000000000000000000000000000000000000)
            ptr := add(ptr, 5)
          }
          // LOG4
          case 0xa4 {
            // POP
            mstore(ptr, 0x5050505050500000000000000000000000000000000000000000000000000000)
            ptr := add(ptr, 6)
          }
          // CALL
          case 0xf1 {
            // TODO
            // check function sig
            // call(g, a, v, in, insize, out, outsize)
            // POP - gas
            // PUSH1
            // 0xbb
            // SSTORE - (0xbb, a)
            // POP 0x50 - value
            // CALLVALUE 0x34
            // DUP2 0x81
            // MSTORE8 0x53
            // CALLVALUE
            // CALLER
            // GAS
            // CALLCODE
            mstore(ptr, 0x5060bb555034815334335af20000000000000000000000000000000000000000)
            ptr := add(ptr, 12)
          }
          // STATICCALL
          case 0xfa {
            // SWAP1
            // DUP1
            // PUSH1
            // 8 - 08
            // LT 8 <ADDR>
            // PUSH1 <offset>
            // 10 - 0a
            // PC
            // ADD
            // JUMPI
            // SWAP1 - reverse first operation
            // STATICCALL
            // PUSH 1
            // 16 - 0x10 <offset>
            // PC
            // ADD
            // JUMP
            // JUMPDEST
            // SWAP1 - reverse first operation
            // POP - gas
            // PUSH1
            // 0xbb
            // SSTORE - (0xbb, a)
            // CALLVALUE 0x34
            // DUP2 0x81
            // MSTORE8 0x53
            // 0 - CALLVALUE
            // CALLER
            // GAS
            // CALLCODE
            // JUMPDEST = 16
            mstore(ptr, 0x9080600810600a58015790fa60105801565b905060bb5534815334335af25b00)
            ptr := add(ptr, 31)
          }
          // CODESIZE
          case 0x38 {
            // PUSH1
            // 0xaa
            // SLOAD
            // EXTCODESIZE
            mstore(ptr, 0x60aa543b00000000000000000000000000000000000000000000000000000000)
            ptr := add(ptr, 4)
          }
          // CODECOPY
          case 0x39 {
            // PUSH1
            // 0xaa
            // SLOAD
            // EXTCODECOPY
            mstore(ptr, 0x60aa543c00000000000000000000000000000000000000000000000000000000)
            ptr := add(ptr, 4)
          }
          // SLOAD
          case 0x54 {
            // TODO
            mstore(ptr, 0x5060030000000000000000000000000000000000000000000000000000000000)
            ptr := add(ptr, 3)
          }
          // SSTORE
          case 0x55 {
            // TODO
            mstore(ptr, 0x5050000000000000000000000000000000000000000000000000000000000000)
            ptr := add(ptr, 2)
          }
          default {
            let op := 0xfe
            if and(shl(opcode, 1), 0x640a0000000000000000001fffffffffffffffff0fcf00006bfd00013fff0fff) {
              op := opcode
            }
            mstore8(ptr, op)
            ptr := add(ptr, 1)
          }
        }
      }

      let codeEnd := ptr
      // TODO: check boundaries
      let count := mload(0)
      // size of the jump index
      let tmp := add(32, mul(count, 4))
      // we add size: (count * instructions) + 7 + 32 (padding)
      let plusSize := add(mul(count, 15), 39)
      if gt(plusSize, 4000) {
        revert(0, 0)
      }
      // too big
      if gt( add(tmp, plusSize), 8000) {
        revert(0, 0)
      }
      ptr := sub(8192, plusSize)
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
        // PUSH2
        mstore(ptr, 0x8061000000000000000000000000000000000000000000000000000000000000)
        ptr := add(ptr, 2)

        // the old (original) offset
        mstore(ptr, shl(240, oldOffset))
        ptr := add(ptr, 2)

        // SUB
        // PUSH2
        mstore(ptr, 0x0361000000000000000000000000000000000000000000000000000000000000)
        ptr := add(ptr, 2)

        mstore(ptr, shl(240, add(mul(x, 15), 19)))
        ptr := add(ptr, 2)

        // JUMPI - skip if not equal
        // POP - the original offset
        // PUSH2
        mstore(ptr, 0x5750610000000000000000000000000000000000000000000000000000000000)
        ptr := add(ptr, 3)

        // the new offset
        mstore(ptr, shl(240, add(newOffset, plusSize)))
        ptr := add(ptr, 2)

        // JUMP
        // JUMPDEST
        // INVALID - not counted
        mstore(ptr, 0x565bfe0000000000000000000000000000000000000000000000000000000000)
        ptr := add(ptr, 2)
      }

      // the size of the deployed bytecode (offset - 8192) + plusSize, and +11 for the deploy code
      let codeSize := add(sub(codeEnd, 8192), add(plusSize, 11))
      let addr := create(0, deployPtr, codeSize)
      mstore(0, addr)
      return(12, 20)
    }
  }
}
