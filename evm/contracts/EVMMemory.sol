pragma solidity ^0.5.2;

import "./EVMBase.sol";


contract EVMMemory is EVMBase {
  function memLoad (EVM memory state, uint index) internal returns (uint256 res) {
    uint off = index % WORD_SIZE;

    // aligned access
    if (off == 0) {
      uint a = getSlot(state, index);
      assembly {
        res := mload(a)
      }
      return res;
    }

    // unaligned access
    (uint a, uint b) = getTwoSlots(state, index);
    assembly {
      let o := exp(2, mul(off, 8))
      let y := exp(2, sub(256, mul(off, 8)))
      res := or(mul(mload(a), o), div(mload(b), y))
    }
  }

  /*
    Takes 'len' bytes from 'bts', starting at 'srcIndex', and copy into memory
    starting at 'destIdx'. If 'srcIndex + len' is larger than 'bts.length',
    the bytes that lies outside of 'bts' is considered to be 0.
    */
  function memStoreBytesAndPadWithZeroes(
    EVM memory self,
    bytes memory bts,
    uint256 srcIdx,
    uint256 destIdx,
    uint256 len
  ) internal {
    uint r = len;

    if ((srcIdx + len) > bts.length) {
      r = bts.length - srcIdx;
    }
    memStoreBytes(self, bts, srcIdx, destIdx, r);


    len = destIdx + len;
    for (uint i = destIdx + r; i < len; i++) {
      memStore8(self, i, 0);
    }
  }

  // Sparse memory via linked lists
  uint constant internal WORD_SIZE = 32;

  // Attention: if you change these structs, make sure you update all offsets
  struct MemoryElement {
    uint value;
    uint slot;
    uint next;
  }

  function memFromArray(EVM memory mem, bytes32[] memory memIn) internal pure {
    if (memIn.length == 0) {
      return;
    }

    assembly {
      let src := add(memIn, 0x20)
      // memIn.length
      let size := mload(memIn)
      let ptr := mload(0x40)

      // update free memory pointer, we allocate size * sizeof(MemoryElement)
      mstore(0x40, add(ptr, mul(size, 0x60)))
      // set mem.size
      mstore(mem, size)
      // set mem.next element
      mstore(add(mem, 0x20), ptr)

      for { let i := 0 } lt(i, size) { i := add(i, 1) } {
        // MemoryElement.value
        mstore(ptr, mload(add(src, mul(0x20, i))))
        // MemoryElement.slot
        mstore(add(ptr, 0x20), i)

        let n := add(ptr, 0x60)
        // MemoryElement.next
        mstore(add(ptr, 0x40), n)
        // update ptr
        ptr := n
      }

      // reset the last next value
      mstore(sub(ptr, 0x20), 0)
    }
  }

  function memFromCalldata (EVM memory mem, uint256 memSize, uint256 memInPtr) internal pure {
    if (memSize == 0) {
      return;
    }

    assembly {
      let src := memInPtr
      let size := memSize
      let ptr := mload(0x40)

      // update free memory pointer, we allocate size * sizeof(MemoryElement)
      mstore(0x40, add(ptr, mul(size, 0x60)))
      // set mem.size
      mstore(mem, size)
      // set mem.next element
      mstore(add(mem, 0x20), ptr)

      for { let i := 0 } lt(i, size) { i := add(i, 1) } {
        // MemoryElement.value
        mstore(ptr, calldataload(add(src, mul(0x20, i))))
        // MemoryElement.slot
        mstore(add(ptr, 0x20), i)

        let n := add(ptr, 0x60)
        // MemoryElement.next
        mstore(add(ptr, 0x40), n)
        // update ptr
        ptr := n
      }

      // reset the last next value
      mstore(sub(ptr, 0x20), 0)
    }
  }

  function memToArray(EVM memory self) internal pure returns (bytes32[] memory arr) {
    assembly {
      // Memory.size * 32
      let size := mul(mload(self), 0x20)

      // allocate size + WORD_SIZE
      arr := mload(0x40)
      mstore(0x40, add(arr, add(size, 0x20)))

      // set bytes.length = size / 32
      mstore(arr, div(size, 0x20))

      let dest := add(arr, 0x20)
      // Memory.next
      let ptr := mload(add(self, 0x20))

      // clear memory
      for { let i := 0 } lt(i, size) { i := add(i, 0x20) } {
        mstore(add(dest, i), 0)
      }

      // copy all slots
      for { } ptr { } {
        let d := add(dest, mul(mload(add(ptr, 0x20)), 0x20))

        mstore(d, mload(ptr))

        // MemoryElement.value
        ptr := mload(add(ptr, 0x40))
      }
    }
  }

  function memToBytes(EVM memory self, uint start, uint len) internal pure returns (bytes memory arr) {
    assembly {
      // round up to WORD_SIZE
      let size := mul(div(add(len, 31), 32), 32)

      // allocate
      arr := mload(0x40)
      mstore(0x40, add(arr, add(size, 0x20)))

      // set bytes.length
      mstore(arr, size)

      let dest := add(arr, 0x20)
      let ptr := mload(add(self, 0x20))
      let startslot := div(start, 32)
      let endslot := div(add(start, len), 32)

      // clear memory
      for { let i := 0 } lt(i, size) { i := add(i, 0x20) } {
        mstore(add(dest, i), 0)
      }

      for { } ptr { } {
        let slot := mload(add(ptr, 0x20))
        let first := or(eq(slot, startslot), gt(slot, startslot))
        let sec := or(eq(slot, endslot), lt(slot, endslot))

        // slot >= startslot && slot <= endslot
        if and(first, sec) {
          let d := add(dest, mul(mload(add(ptr, 0x20)), 0x20))
          mstore(d, mload(ptr))
        }

        // MemoryElement.next
        ptr := mload(add(ptr, 0x40))
      }

      let startoff := mod(start, 32)

      // for unaligned start offset; fix the byte array ptr
      if startoff {
        ptr := add(arr, startoff)
        mstore(ptr, len)
        arr := ptr
      }
    }
  }

  // solhint-disable-next-line function-max-lines
  function memStore8(EVM memory self, uint index, uint8 val) internal pure {
    assembly {
      let off := mod(index, 32)
      let targetSlot := div(index, 32)
      let ptr := mload(add(self, 0x20))

      if iszero(ptr) {
        // No MemoryElement yet, allocate the first one
        ptr := mload(0x40)
        mstore(0x40, add(ptr, 0x60))

        // MemoryElement.value; set to 0
        mstore(ptr, 0)
        // MemoryElement.value; store byte
        mstore8(add(ptr, off), val)
        // MemoryElement.slot
        mstore(add(ptr, 0x20), targetSlot)
        // MemoryElement.next
        mstore(add(ptr, 0x40), 0)
        // Memory.next
        mstore(add(self, 0x20), ptr)

        let currentSize := mload(self)
        let newSize := add(targetSlot, 1)

        // update Memory.size
        if gt(newSize, currentSize) {
          mstore(self, newSize)
        }

        ptr := 0
      }

      for { } ptr { } {
        let slot := mload(add(ptr, 0x20))

        // found slot
        if eq(slot, targetSlot) {
          mstore8(add(ptr, off), val)
          ptr := 0
        }

        if ptr {
          let next := mload(add(ptr, 0x40))

          // reached the end; init new slot
          if iszero(next) {
            // allocate MemoryElement
            next := mload(0x40)
            mstore(0x40, add(next, 0x60))

            // MemoryElement.value; set to 0
            mstore(next, 0)
            // MemoryElement.value; store byte
            mstore8(add(next, off), val)
            // MemoryElement.slot
            mstore(add(next, 0x20), targetSlot)
            // MemoryElement.next
            mstore(add(next, 0x40), 0)
            // last MemoryElement.next = our new MemoryElement from above
            mstore(add(ptr, 0x40), next)

            let currentSize := mload(self)
            let newSize := add(targetSlot, 1)

            // update MemoryElement.size
            if gt(newSize, currentSize) {
              mstore(self, newSize)
            }

            next := 0
          }

          ptr := next
        }
      }
    }
  }

  function memStore(EVM memory self, uint index, uint val) internal pure {
    uint off = (index % WORD_SIZE) * 8;

    // if offset is unaligned
    if (off != 0) {
      (uint a, uint b) = getTwoSlots(self, index);

      assembly {
        let y := exp(2, sub(256, off))
        let mask := mul(not(0), y)

        mstore(a, or(and(mload(a), mask), and(div(val, exp(2, off)), not(mask))))
        mstore(b, or(and(mload(b), not(mask)), and(mul(val, y), mask)))
      }
      return;
    }

    // aligned store
    uint a = getSlot(self, index);
    assembly {
      mstore(a, val)
    }
  }

  /*
    Takes 'len' bytes from 'bts', starting at 'srcIndex', and copy into memory
    starting at 'destIdx'. If 'srcIndex + len' is larger than 'bts.length',
    the operation will revert.
    */
  function memStoreBytes(EVM memory self, bytes memory bts, uint srcIdx, uint destIdx, uint len) internal pure {
    if (srcIdx + len > bts.length) {
      revert();
    }

    uint src;
    assembly {
      src := add(bts, add(0x20, srcIdx))
    }

    // as long we we can store full words
    while (len >= WORD_SIZE) {
      len -= WORD_SIZE;
      uint val;
      assembly {
        val := mload(add(src, len))
      }
      memStore(self, destIdx + len, val);
    }

    // remaining; len < WORD_SIZE; use store8
    for (uint i = 0; i < len; i++) {
      memStore8(self, destIdx + i, uint8(bts[srcIdx + i]));
    }
  }

  // Get the position of 'index' in actual memory. Does create a new array.
  function memUPtr(EVM memory self, uint index, uint len) internal pure returns (uint ptr) {
    bytes memory bts = memToBytes(self, index, len);

    assembly {
      ptr := add(bts, 0x20)
    }
  }

  // solhint-disable-next-line function-max-lines
  function getSlot(EVM memory self, uint index) internal pure returns (uint res) {
    assembly {
      let targetSlot := div(index, 32)
      // Memory.next
      let ptr := mload(add(self, 0x20))

      if iszero(ptr) {
        // allocate MemoryElement
        ptr := mload(0x40)
        mstore(0x40, add(ptr, 0x60))
        // MemoryElement.value
        mstore(ptr, 0)
        // MemoryElement.slot
        mstore(add(ptr, 0x20), targetSlot)
        // MemoryElement.next
        mstore(add(ptr, 0x40), 0)
        // Memory.next
        mstore(add(self, 0x20), ptr)

        let currentSize := mload(self)
        let newSize := add(targetSlot, 1)

        // update Memory.size
        if gt(newSize, currentSize) {
          mstore(self, newSize)
        }

        res := ptr
        ptr := 0
      }

      for { } ptr { } {
        // MemoryElement.slot
        let slot := mload(add(ptr, 0x20))

        // found
        if eq(slot, targetSlot) {
          res := ptr
          ptr := 0
        }

        if ptr {
          // MemoryElement.next
          let next := mload(add(ptr, 0x40))

          // reached the end, allocate a new MemoryElement
          if iszero(next) {
            // allocate
            next := mload(0x40)
            mstore(0x40, add(next, 0x60))
            // MemoryElement.value
            mstore(next, 0)
            // MemoryElement.slot
            mstore(add(next, 0x20), targetSlot)
            // MemoryElement.next
            mstore(add(next, 0x40), 0)
            // last MemoryElement.next = our fresh allocated element
            mstore(add(ptr, 0x40), next)

            let currentSize := mload(self)
            let newSize := add(targetSlot, 1)

            // update Memory.size
            if gt(newSize, currentSize) {
              mstore(self, newSize)
            }

            res := next
            next := 0
          }

          ptr := next
        }
      }
    }
  }

  // solhint-disable-next-line function-max-lines
  function getTwoSlots(EVM memory self, uint index) internal pure returns (uint a, uint b) {
    assembly {
      let targetSlot := div(index, 32)
      // Memory.next
      let ptr := mload(add(self, 0x20))

      // no MemoryElement allocated yet
      if iszero(ptr) {
        // allocate two MemoryElements
        a := mload(0x40)
        b := add(a, 0x60)
        mstore(0x40, add(b, 0x60))

        // MemoryElement.value
        mstore(a, 0)
        // MemoryElement.slot
        mstore(add(a, 0x20), targetSlot)
        // MemoryElement.next
        mstore(add(a, 0x40), b)
        // Memory.next
        mstore(add(self, 0x20), a)

        // MemoryElement.value
        mstore(b, 0)
        // MemoryElement.slot
        mstore(add(b, 0x20), add(targetSlot, 1))
        // MemoryElement.next
        mstore(add(b, 0x40), 0)

        let currentSize := mload(self)
        let newSize := add(targetSlot, 2)

        if gt(newSize, currentSize) {
          // Memory.size
          mstore(self, newSize)
        }
      }

      for { } ptr { } {
        let slot := mload(add(ptr, 0x20))

        if eq(slot, targetSlot) {
          // found a
          a := ptr
        }
        if eq(slot, add(targetSlot, 1)) {
          // found b
          b := ptr
        }

        if and(gt(a, 0), gt(b, 0)) {
          // both found
          ptr := 0
        }

        if ptr {
          let next := mload(add(ptr, 0x40))

          // we reached the end
          if iszero(next) {
            // found b ? If not, allocate
            if iszero(b) {
              b := mload(0x40)
              mstore(0x40, add(b, 0x60))

              // MemoryElement.value
              mstore(b, 0)
              // MemoryElement.slot
              mstore(add(b, 0x20), add(targetSlot, 1))
              // MemoryElement.next
              mstore(add(b, 0x40), 0)

              // last MemoryElement.next = our new MemoryElement
              mstore(add(ptr, 0x40), b)
              ptr := b

              let currentSize := mload(self)
              let newSize := add(targetSlot, 2)

              if gt(newSize, currentSize) {
                // Memory.size
                mstore(self, newSize)
              }
            }

            // found a ? If not, allocate
            if iszero(a) {
              a := mload(0x40)
              mstore(0x40, add(a, 0x60))

              // like above ;)
              mstore(a, 0)
              mstore(add(a, 0x20), targetSlot)
              mstore(add(a, 0x40), 0)

              mstore(add(ptr, 0x40), a)

              let currentSize := mload(self)
              let newSize := add(targetSlot, 1)

              if gt(newSize, currentSize) {
                // Memory.size
                mstore(self, newSize)
              }
            }
          }

          ptr := next
        }
      }
    }
  }

  function memReset (EVM memory state) internal pure {
    assembly {
      // Memory.size
      mstore(state, 0)

      // Memory.next
      let ptr := mload(add(state, 0x20))

      for { } ptr { } {
        // set MemoryElement.value
        mstore(ptr, 0)
        // MemoryElement.next
        ptr := mload(add(ptr, 0x40))
      }
    }
  }
}
