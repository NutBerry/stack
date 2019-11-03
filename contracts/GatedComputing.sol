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

      let offset := 1024
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
          mstore8(offset, 96)
          mstore8(add(offset, 1), 3)
          offset := add(offset, 2)
        }
        // JUMPI
        if eq(opcode, 87) {
          // SWAP 1
          mstore8(offset, 144)
          // PUSH 1
          mstore8(add(offset, 1), 96)
          // 3
          mstore8(add(offset, 2), 3)
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
          let o := add(32, mul(count, 64))
          mstore(o, i)
          mstore(add(o, 32), offset)
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
          offset := add(offset, 1)
          //offset := maybePatch(opcode, i, offset)
        }
      }

      // TODO: check boundaries
      let count := mload(0)
      // we add size: count * instructions + 6
      let plusSize := add(mul(count, 7), 6)
      let ptr := sub(1024, plusSize)
      let deployPtr := sub(ptr, 11)
      // 11 bytes - deploy code
      // PUSH1 11 CODESIZE SUB DUP1 PUSH1 11 MSIZE CODECOPY CALLDATASIZE RETURN
      mstore(deployPtr, 0x600b380380600b593936f3000000000000000000000000000000000000000000)
      // 6 bytes
      // PUSH1 00 JUMP JUMPDEST
      mstore(ptr, 0x6000565b00000000000000000000000000000000000000000000000000000000)
      // fix destination of first jump (PUSH1 00) above
      mstore8(add(ptr, 1), sub(plusSize, 1))
      // add INVALID if we fall-through the jump handler
      mstore8(add(ptr, sub(plusSize, 2)), 0xfe)
      // JUMPDEST after the jump handler
      mstore8(add(ptr, sub(plusSize, 1)), 0x5b)

      ptr := add(ptr, 4)
      for { let x := 0 } lt(x, count) { x := add(x, 1) } {
        let o := add(32, mul(x, 64))
        let oldOffset := mload(o)
        let newOffset := mload(add(o, 32))
        // DUP1
        mstore8(ptr, 0x80)
        ptr := add(ptr, 1)
        // TODO: check if offsets fits into one byte.
        // or always use PUSH2
        // PUSH1
        mstore8(ptr, 0x60)
        ptr := add(ptr, 1)
        // the old (original) offset
        mstore8(ptr, oldOffset)
        ptr := add(ptr, 1)
        // EQ
        mstore8(ptr, 0x14)
        ptr := add(ptr, 1)
        // PUSH1
        mstore8(ptr, 0x60)
        ptr := add(ptr, 1)
        // the new offset
        mstore8(ptr, add(newOffset, plusSize))
        ptr := add(ptr, 1)
        // JUMPI
        mstore8(ptr, 0x57)
        ptr := add(ptr, 1)
      }

      // the size of the deployed bytecode (offset - 1024) + plusSize, and +11 for the deploy code
      let codeSize := add(sub(offset, 1024), add(plusSize, 11))
      let addr := create(0, deployPtr, codeSize)
      mstore(0, addr)
      return(12, 20)
    }
  }
}
