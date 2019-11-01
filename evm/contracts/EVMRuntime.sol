pragma solidity ^0.5.2;

import "./EVMCode.sol";
import "./EVMStack.sol";
import "./EVMMemory.sol";


contract EVMRuntime is EVMCode, EVMStack, EVMMemory {
  // solhint-disable-next-line code-complexity, function-max-lines, security/no-assign-params
  function _run(EVM memory evm, uint pc, uint pcStepCount) internal {
    uint pcNext = 0;
    uint stepRun = 0;

    while (evm.errno == NO_ERROR && pc < evm.codeLength && (pcStepCount == 0 || stepRun < pcStepCount)) {
      uint stackIn;
      uint stackOut;
      uint8 opcode = getOpcodeAt(evm, pc);
      function(EVM memory) internal opcodeHandler;

      if (opcode == 0) {
        opcodeHandler = handleSTOP;
        stackIn = 0;
        stackOut = 0;
      } else if (opcode == 1) {
        opcodeHandler = handleADD;
        stackIn = 2;
        stackOut = 1;
      } else if (opcode == 2) {
        opcodeHandler = handleMUL;
        stackIn = 2;
        stackOut = 1;
      } else if (opcode == 3) {
        opcodeHandler = handleSUB;
        stackIn = 2;
        stackOut = 1;
      } else if (opcode == 4) {
        opcodeHandler = handleDIV;
        stackIn = 2;
        stackOut = 1;
      } else if (opcode == 5) {
        opcodeHandler = handleSDIV;
        stackIn = 2;
        stackOut = 1;
      } else if (opcode == 6) {
        opcodeHandler = handleMOD;
        stackIn = 2;
        stackOut = 1;
      } else if (opcode == 7) {
        opcodeHandler = handleSMOD;
        stackIn = 2;
        stackOut = 1;
      } else if (opcode == 8) {
        opcodeHandler = handleADDMOD;
        stackIn = 3;
        stackOut = 1;
      } else if (opcode == 9) {
        opcodeHandler = handleMULMOD;
        stackIn = 3;
        stackOut = 1;
      } else if (opcode == 10) {
        opcodeHandler = handleEXP;
        stackIn = 2;
        stackOut = 1;
      } else if (opcode == 11) {
        opcodeHandler = handleSIGNEXTEND;
        stackIn = 0;
        stackOut = 0;
      } else if (opcode == 16) {
        opcodeHandler = handleLT;
        stackIn = 2;
        stackOut = 1;
      } else if (opcode == 17) {
        opcodeHandler = handleGT;
        stackIn = 2;
        stackOut = 1;
      } else if (opcode == 18) {
        opcodeHandler = handleSLT;
        stackIn = 2;
        stackOut = 1;
      } else if (opcode == 19) {
        opcodeHandler = handleSGT;
        stackIn = 2;
        stackOut = 1;
      } else if (opcode == 20) {
        opcodeHandler = handleEQ;
        stackIn = 2;
        stackOut = 1;
      } else if (opcode == 21) {
        opcodeHandler = handleISZERO;
        stackIn = 1;
        stackOut = 1;
      } else if (opcode == 22) {
        opcodeHandler = handleAND;
        stackIn = 2;
        stackOut = 1;
      } else if (opcode == 23) {
        opcodeHandler = handleOR;
        stackIn = 2;
        stackOut = 1;
      } else if (opcode == 24) {
        opcodeHandler = handleXOR;
        stackIn = 2;
        stackOut = 1;
      } else if (opcode == 25) {
        opcodeHandler = handleNOT;
        stackIn = 1;
        stackOut = 1;
      } else if (opcode == 26) {
        opcodeHandler = handleBYTE;
        stackIn = 2;
        stackOut = 1;
      } else if (opcode == 27) {
        opcodeHandler = handleSHL;
        stackIn = 2;
        stackOut = 1;
      } else if (opcode == 28) {
        opcodeHandler = handleSHR;
        stackIn = 2;
        stackOut = 1;
      } else if (opcode == 29) {
        opcodeHandler = handleSAR;
        stackIn = 2;
        stackOut = 1;
      } else if (opcode == 32) {
        opcodeHandler = handleSHA3;
        stackIn = 2;
        stackOut = 1;
      } else if (opcode == 48) {
        opcodeHandler = handleADDRESS;
        stackIn = 0;
        stackOut = 1;
      } else if (opcode == 49) {
        opcodeHandler = handleBALANCE;
        stackIn = 1;
        stackOut = 1;
      } else if (opcode == 50) {
        opcodeHandler = handleORIGIN;
        stackIn = 0;
        stackOut = 1;
      } else if (opcode == 51) {
        opcodeHandler = handleCALLER;
        stackIn = 0;
        stackOut = 1;
      } else if (opcode == 52) {
        opcodeHandler = handleCALLVALUE;
        stackIn = 0;
        stackOut = 1;
      } else if (opcode == 53) {
        opcodeHandler = handleCALLDATALOAD;
        stackIn = 1;
        stackOut = 1;
      } else if (opcode == 54) {
        opcodeHandler = handleCALLDATASIZE;
        stackIn = 0;
        stackOut = 1;
      } else if (opcode == 55) {
        opcodeHandler = handleCALLDATACOPY;
        stackIn = 3;
        stackOut = 0;
      } else if (opcode == 56) {
        opcodeHandler = handleCODESIZE;
        stackIn = 0;
        stackOut = 1;
      } else if (opcode == 57) {
        opcodeHandler = handleCODECOPY;
        stackIn = 3;
        stackOut = 0;
      } else if (opcode == 58) {
        opcodeHandler = handleGASPRICE;
        stackIn = 0;
        stackOut = 1;
      } else if (opcode == 59) {
        opcodeHandler = handleEXTCODESIZE;
        stackIn = 1;
        stackOut = 1;
      } else if (opcode == 60) {
        opcodeHandler = handleEXTCODECOPY;
        stackIn = 4;
        stackOut = 0;
      } else if (opcode == 61) {
        opcodeHandler = handleRETURNDATASIZE;
        stackIn = 0;
        stackOut = 1;
      } else if (opcode == 62) {
        opcodeHandler = handleRETURNDATACOPY;
        stackIn = 3;
        stackOut = 0;
      } else if (opcode == 63) {
        opcodeHandler = handleEXTCODEHASH;
        stackIn = 1;
        stackOut = 1;
      } else if (opcode == 64) {
        opcodeHandler = handleBLOCKHASH;
        stackIn = 1;
        stackOut = 1;
      } else if (opcode == 65) {
        opcodeHandler = handleCOINBASE;
        stackIn = 0;
        stackOut = 1;
      } else if (opcode == 66) {
        opcodeHandler = handleTIMESTAMP;
        stackIn = 0;
        stackOut = 1;
      } else if (opcode == 67) {
        opcodeHandler = handleNUMBER;
        stackIn = 0;
        stackOut = 1;
      } else if (opcode == 68) {
        opcodeHandler = handleDIFFICULTY;
        stackIn = 0;
        stackOut = 1;
      } else if (opcode == 69) {
        opcodeHandler = handleGASLIMIT;
        stackIn = 0;
        stackOut = 1;
      } else if (opcode == 80) {
        opcodeHandler = handlePOP;
        stackIn = 1;
        stackOut = 0;
      } else if (opcode == 81) {
        opcodeHandler = handleMLOAD;
        stackIn = 1;
        stackOut = 1;
      } else if (opcode == 82) {
        opcodeHandler = handleMSTORE;
        stackIn = 2;
        stackOut = 0;
      } else if (opcode == 83) {
        opcodeHandler = handleMSTORE8;
        stackIn = 2;
        stackOut = 0;
      } else if (opcode == 84) {
        opcodeHandler = handleSLOAD;
        stackIn = 1;
        stackOut = 1;
      } else if (opcode == 85) {
        opcodeHandler = handleSSTORE;
        stackIn = 2;
        stackOut = 0;
      } else if (opcode == 86) {
        opcodeHandler = handleJUMP;
        stackIn = 1;
        stackOut = 0;
      } else if (opcode == 87) {
        opcodeHandler = handleJUMPI;
        stackIn = 2;
        stackOut = 0;
      } else if (opcode == 88) {
        opcodeHandler = handlePC;
        stackIn = 0;
        stackOut = 1;
      } else if (opcode == 89) {
        opcodeHandler = handleMSIZE;
        stackIn = 0;
        stackOut = 1;
      } else if (opcode == 90) {
        opcodeHandler = handleGAS;
        stackIn = 0;
        stackOut = 1;
      } else if (opcode == 91) {
        opcodeHandler = handleJUMPDEST;
        stackIn = 0;
        stackOut = 0;
      } else if (opcode >= 96 && opcode <= 127) {
        opcodeHandler = handlePUSH;
        stackIn = 0;
        stackOut = 1;
      } else if (opcode == 128) {
        opcodeHandler = handleDUP;
        stackIn = 1;
        stackOut = 2;
      } else if (opcode == 129) {
        opcodeHandler = handleDUP;
        stackIn = 2;
        stackOut = 3;
      } else if (opcode == 130) {
        opcodeHandler = handleDUP;
        stackIn = 3;
        stackOut = 4;
      } else if (opcode == 131) {
        opcodeHandler = handleDUP;
        stackIn = 4;
        stackOut = 5;
      } else if (opcode == 132) {
        opcodeHandler = handleDUP;
        stackIn = 5;
        stackOut = 6;
      } else if (opcode == 133) {
        opcodeHandler = handleDUP;
        stackIn = 6;
        stackOut = 7;
      } else if (opcode == 134) {
        opcodeHandler = handleDUP;
        stackIn = 7;
        stackOut = 8;
      } else if (opcode == 135) {
        opcodeHandler = handleDUP;
        stackIn = 8;
        stackOut = 9;
      } else if (opcode == 136) {
        opcodeHandler = handleDUP;
        stackIn = 9;
        stackOut = 10;
      } else if (opcode == 137) {
        opcodeHandler = handleDUP;
        stackIn = 10;
        stackOut = 11;
      } else if (opcode == 138) {
        opcodeHandler = handleDUP;
        stackIn = 11;
        stackOut = 12;
      } else if (opcode == 139) {
        opcodeHandler = handleDUP;
        stackIn = 12;
        stackOut = 13;
      } else if (opcode == 140) {
        opcodeHandler = handleDUP;
        stackIn = 13;
        stackOut = 14;
      } else if (opcode == 141) {
        opcodeHandler = handleDUP;
        stackIn = 14;
        stackOut = 15;
      } else if (opcode == 142) {
        opcodeHandler = handleDUP;
        stackIn = 15;
        stackOut = 16;
      } else if (opcode == 143) {
        opcodeHandler = handleDUP;
        stackIn = 16;
        stackOut = 17;
      } else if (opcode == 144) {
        opcodeHandler = handleSWAP;
        stackIn = 2;
        stackOut = 2;
      } else if (opcode == 145) {
        opcodeHandler = handleSWAP;
        stackIn = 3;
        stackOut = 3;
      } else if (opcode == 146) {
        opcodeHandler = handleSWAP;
        stackIn = 4;
        stackOut = 4;
      } else if (opcode == 147) {
        opcodeHandler = handleSWAP;
        stackIn = 5;
        stackOut = 5;
      } else if (opcode == 148) {
        opcodeHandler = handleSWAP;
        stackIn = 6;
        stackOut = 6;
      } else if (opcode == 149) {
        opcodeHandler = handleSWAP;
        stackIn = 7;
        stackOut = 7;
      } else if (opcode == 150) {
        opcodeHandler = handleSWAP;
        stackIn = 8;
        stackOut = 8;
      } else if (opcode == 151) {
        opcodeHandler = handleSWAP;
        stackIn = 9;
        stackOut = 9;
      } else if (opcode == 152) {
        opcodeHandler = handleSWAP;
        stackIn = 10;
        stackOut = 10;
      } else if (opcode == 153) {
        opcodeHandler = handleSWAP;
        stackIn = 11;
        stackOut = 11;
      } else if (opcode == 154) {
        opcodeHandler = handleSWAP;
        stackIn = 12;
        stackOut = 12;
      } else if (opcode == 155) {
        opcodeHandler = handleSWAP;
        stackIn = 13;
        stackOut = 13;
      } else if (opcode == 156) {
        opcodeHandler = handleSWAP;
        stackIn = 14;
        stackOut = 14;
      } else if (opcode == 157) {
        opcodeHandler = handleSWAP;
        stackIn = 15;
        stackOut = 15;
      } else if (opcode == 158) {
        opcodeHandler = handleSWAP;
        stackIn = 16;
        stackOut = 16;
      } else if (opcode == 159) {
        opcodeHandler = handleSWAP;
        stackIn = 17;
        stackOut = 17;
      } else if (opcode == 160) {
        opcodeHandler = handleLOG;
        stackIn = 2;
        stackOut = 0;
      } else if (opcode == 161) {
        opcodeHandler = handleLOG;
        stackIn = 3;
        stackOut = 0;
      } else if (opcode == 162) {
        opcodeHandler = handleLOG;
        stackIn = 4;
        stackOut = 0;
      } else if (opcode == 163) {
        opcodeHandler = handleLOG;
        stackIn = 5;
        stackOut = 0;
      } else if (opcode == 164) {
        opcodeHandler = handleLOG;
        stackIn = 6;
        stackOut = 0;
      } else if (opcode == 240) {
        opcodeHandler = handleCREATE;
        stackIn = 3;
        stackOut = 1;
      } else if (opcode == 241) {
        opcodeHandler = handleCALL;
        stackIn = 7;
        stackOut = 1;
      } else if (opcode == 242) {
        opcodeHandler = handleCALLCODE;
        stackIn = 7;
        stackOut = 1;
      } else if (opcode == 243) {
        opcodeHandler = handleRETURN;
        stackIn = 2;
        stackOut = 0;
      } else if (opcode == 244) {
        opcodeHandler = handleDELEGATECALL;
        stackIn = 6;
        stackOut = 1;
      } else if (opcode == 245) {
        opcodeHandler = handleCREATE2;
        stackIn = 4;
        stackOut = 1;
      } else if (opcode == 250) {
        opcodeHandler = handleSTATICCALL;
        stackIn = 6;
        stackOut = 1;
      } else if (opcode == 253) {
        opcodeHandler = handleREVERT;
        stackIn = 2;
        stackOut = 0;
      } else if (opcode == 255) {
        opcodeHandler = handleSELFDESTRUCT;
        stackIn = 1;
        stackOut = 0;
      } else {
        opcodeHandler = handleINVALID;
        stackIn = 0;
        stackOut = 0;
      }

      // Check for stack errors
      if (evm.stackSize < stackIn) {
        evm.errno = ERROR_STACK_UNDERFLOW;
        break;
      } else if (stackOut > stackIn && evm.stackSize + stackOut - stackIn > evm.maxStackSize) {
        evm.errno = ERROR_STACK_OVERFLOW;
        break;
      }

      if (OP_PUSH1 <= opcode && opcode <= OP_PUSH32) {
        evm.pc = pc;
        uint n = opcode - OP_PUSH1 + 1;
        evm.n = n;
        opcodeHandler(evm);
        pcNext = pc + n + 1;
      } else if (opcode == OP_JUMP || opcode == OP_JUMPI) {
        evm.pc = pc;
        opcodeHandler(evm);
        pcNext = evm.pc;
      } else if (opcode == OP_STOP || opcode == OP_RETURN || opcode == OP_REVERT || opcode == OP_SELFDESTRUCT) {
        opcodeHandler(evm);
        break;
      } else {
        if (OP_DUP1 <= opcode && opcode <= OP_DUP16) {
          evm.n = opcode - OP_DUP1 + 1;
          opcodeHandler(evm);
        } else if (OP_SWAP1 <= opcode && opcode <= OP_SWAP16) {
          evm.n = opcode - OP_SWAP1 + 1;
          opcodeHandler(evm);
        } else if (OP_LOG0 <= opcode && opcode <= OP_LOG4) {
          evm.n = opcode - OP_LOG0;
          opcodeHandler(evm);
        } else if (opcode == OP_PC) {
          evm.pc = pc;
          opcodeHandler(evm);
        } else {
          opcodeHandler(evm);
        }
        pcNext = pc + 1;
      }
      if (evm.errno == NO_ERROR) {
        pc = pcNext;
      }
      stepRun = stepRun + 1;
    }
    evm.pc = pc;
  }

  // ************************* Handlers ***************************
  // solhint-disable-next-line func-name-mixedcase
  function handlePreC_ECRECOVER(EVM memory state, bytes memory data) internal {
    address result;
    assembly {
      let inOff := add(data, 0x20)
      let inSize := mload(data)
      // fatal error, means we don't have enough gas for ecrecover
      let success := staticcall(gas(), 0x1, inOff, inSize, 0, 0x20)
      if iszero(success) {
        revert(0, 0)
      }
      result := mload(0)
    }
    state.returnData = UintToBytes(uint(result));
  }

  // solhint-disable-next-line func-name-mixedcase
  function handlePreC_SHA256(EVM memory state, bytes memory data) internal {
    bytes32 result = sha256(data);
    state.returnData = UintToBytes(uint(result));
  }

  // solhint-disable-next-line func-name-mixedcase
  function handlePreC_RIPEMD160(EVM memory state, bytes memory data) internal {
    bytes20 result = ripemd160(data);
    state.returnData = UintToBytes(uint(bytes32(result)));
  }

  // solhint-disable-next-line func-name-mixedcase
  function handlePreC_IDENTITY(EVM memory state, bytes memory data) internal {
    state.returnData = data;
  }

  // solhint-disable-next-line func-name-mixedcase, function-max-lines
  function handlePreC_MODEXP(EVM memory state, bytes memory data) internal {
    // EIP-198
    bytes memory inData = data;
    bytes memory outData;

    assembly {
      let inSize := mload(inData)
      // outSize is length of modulus
      let outSize := mload(add(inData, 0x60))

      // get free mem ptr
      outData := mload(0x40)
      // padding up to word size
      let memEnd := add(
        outData,
        and(
          add(
            add(
              add(outData, outSize),
              0x20
            ),
            0x1F
          ),
          not(0x1F)
        )
      )
      // update free mem ptr
      mstore(0x40, memEnd)
      // for correct gas calculation, we have to touch the new highest mem slot
      mstore8(memEnd, 0)
      // store outData.length
      mstore(outData, outSize)

      let inOff := add(inData, 0x20)
      let outOff := add(outData, 0x20)
      let success := staticcall(gas(), 0x05, inOff, inSize, outOff, outSize)

      if iszero(success) {
        // In this case we run out of gas, and have to revert (safety measure)
        revert(0, 0)
      }
    }

    state.returnData = outData;
  }

  // solhint-disable-next-line func-name-mixedcase
  function handlePreC_ECADD(EVM memory state, bytes memory data) internal {
    // EIP-196
    bytes memory inData = data;
    bytes memory outData;
    uint256 success;

    assembly {
      let inSize := mload(inData)
      // outSize is 64 bytes
      let outSize := 0x40

      // get free mem ptr
      outData := mload(0x40)
      // padding up to word size
      let memEnd := add(
        outData,
        and(
          add(
            add(
              add(outData, outSize),
              0x20
            ),
            0x1F
          ),
          not(0x1F)
        )
      )
      // update free mem ptr
      mstore(0x40, memEnd)
      // store outData.length
      mstore(outData, outSize)

      let inOff := add(inData, 0x20)
      let outOff := add(outData, 0x20)
      success := staticcall(gas(), 0x06, inOff, inSize, outOff, outSize)
    }

    // TODO
    if (success == 0) {
      state.errno = ERROR_OUT_OF_GAS;
      return;
    }
    state.returnData = outData;
  }

  // solhint-disable-next-line func-name-mixedcase
  function handlePreC_ECMUL(EVM memory state, bytes memory data) internal {
    // EIP-196
    bytes memory inData = data;
    bytes memory outData;
    uint256 success;

    assembly {
      let inSize := mload(inData)
      // outSize is 64 bytes
      let outSize := 0x40

      // get free mem ptr
      outData := mload(0x40)
      // padding up to word size
      let memEnd := add(
        outData,
        and(
          add(
            add(
              add(outData, outSize),
              0x20
            ),
            0x1F
          ),
          not(0x1F)
        )
      )
      // update free mem ptr
      mstore(0x40, memEnd)
      // store outData.length
      mstore(outData, outSize)

      let inOff := add(inData, 0x20)
      let outOff := add(outData, 0x20)
      success := staticcall(gas(), 0x07, inOff, inSize, outOff, outSize)
    }

    // TODO
    if (success == 0) {
      state.errno = ERROR_OUT_OF_GAS;
      return;
    }
    state.returnData = outData;
  }

  // solhint-disable-next-line func-name-mixedcase, function-max-lines
  function handlePreC_ECPAIRING(EVM memory state, bytes memory data) internal {
    // EIP-197
    bytes memory inData = data;
    bytes memory outData;
    uint256 success;

    assembly {
      let inSize := mload(inData)
      // outSize is 32 bytes
      let outSize := 0x20

      // get free mem ptr
      outData := mload(0x40)
      // padding up to word size
      let memEnd := add(
        outData,
        and(
          add(
            add(
              add(outData, outSize),
              0x20
            ),
            0x1F
          ),
          not(0x1F)
        )
      )
      // update free mem ptr
      mstore(0x40, memEnd)
      // for correct gas calculation, we have to touch the new highest mem slot
      mstore8(memEnd, 0)
      // store outData.length
      mstore(outData, outSize)

      let inOff := add(inData, 0x20)
      let outOff := add(outData, 0x20)

      success := staticcall(gas(), 0x08, inOff, inSize, outOff, outSize)
    }

    // TODO
    if (success == 0) {
      state.errno = ERROR_OUT_OF_GAS;
      return;
    }
    state.returnData = outData;
  }
  // 0x0X

  // solhint-disable-next-line no-empty-blocks
  function handleSTOP(EVM memory state) internal {

  }

  function handleADD(EVM memory state) internal {
    uint a = stackPop(state);
    uint b = stackPop(state);
    uint c;
    assembly {
      c := add(a, b)
    }
    stackPush(state, c);
  }

  function handleMUL(EVM memory state) internal {
    uint a = stackPop(state);
    uint b = stackPop(state);
    uint c;
    assembly {
      c := mul(a, b)
    }
    stackPush(state, c);
  }

  function handleSUB(EVM memory state) internal {
    uint a = stackPop(state);
    uint b = stackPop(state);
    uint c;
    assembly {
      c := sub(a, b)
    }
    stackPush(state, c);
  }

  function handleDIV(EVM memory state) internal {
    uint a = stackPop(state);
    uint b = stackPop(state);
    uint c;
    assembly {
      c := div(a, b)
    }
    stackPush(state, c);
  }

  function handleSDIV(EVM memory state) internal {
    uint a = stackPop(state);
    uint b = stackPop(state);
    uint c;
    assembly {
      c := sdiv(a, b)
    }
    stackPush(state, c);
  }

  function handleMOD(EVM memory state) internal {
    uint a = stackPop(state);
    uint b = stackPop(state);
    uint c;
    assembly {
      c := mod(a, b)
    }
    stackPush(state, c);
  }

  function handleSMOD(EVM memory state) internal {
    uint a = stackPop(state);
    uint b = stackPop(state);
    uint c;
    assembly {
      c := smod(a, b)
    }
    stackPush(state, c);
  }

  function handleADDMOD(EVM memory state) internal {
    uint a = stackPop(state);
    uint b = stackPop(state);
    uint m = stackPop(state);
    uint c;
    assembly {
      c := addmod(a, b, m)
    }
    stackPush(state, c);
  }

  function handleMULMOD(EVM memory state) internal {
    uint a = stackPop(state);
    uint b = stackPop(state);
    uint m = stackPop(state);
    uint c;
    assembly {
      c := mulmod(a, b, m)
    }
    stackPush(state, c);
  }

  function handleEXP(EVM memory state) internal {
    uint a = stackPop(state);
    uint b = stackPop(state);
    uint c = 0;

    assembly {
      c := exp(a, b)
    }
    stackPush(state, c);
  }

  function handleSIGNEXTEND(EVM memory state) internal {
    uint a = stackPop(state);
    uint b = stackPop(state);
    uint c;
    assembly {
      c := signextend(a, b)
    }
    stackPush(state, c);
  }

  function handleSHL(EVM memory state) internal {
    uint a = stackPop(state);
    uint b = stackPop(state);
    uint c;
    assembly {
      c := shl(a, b)
    }
    stackPush(state, c);
  }

  function handleSHR(EVM memory state) internal {
    uint a = stackPop(state);
    uint b = stackPop(state);
    uint c;
    assembly {
      c := shr(a, b)
    }
    stackPush(state, c);
  }

  function handleSAR(EVM memory state) internal {
    uint a = stackPop(state);
    uint b = stackPop(state);
    uint c;
    assembly {
      c := sar(a, b)
    }
    stackPush(state, c);
  }

  // 0x1X
  function handleLT(EVM memory state) internal {
    uint a = stackPop(state);
    uint b = stackPop(state);
    uint c;
    assembly {
      c := lt(a, b)
    }
    stackPush(state, c);
  }

  function handleGT(EVM memory state) internal {
    uint a = stackPop(state);
    uint b = stackPop(state);
    uint c;
    assembly {
      c := gt(a, b)
    }
    stackPush(state, c);
  }

  function handleSLT(EVM memory state) internal {
    uint a = stackPop(state);
    uint b = stackPop(state);
    uint c;
    assembly {
      c := slt(a, b)
    }
    stackPush(state, c);
  }

  function handleSGT(EVM memory state) internal {
    uint a = stackPop(state);
    uint b = stackPop(state);
    uint c;
    assembly {
      c := sgt(a, b)
    }
    stackPush(state, c);
  }

  function handleEQ(EVM memory state) internal {
    uint a = stackPop(state);
    uint b = stackPop(state);
    uint c;
    assembly {
      c := eq(a, b)
    }
    stackPush(state, c);
  }

  function handleISZERO(EVM memory state) internal {
    uint data = stackPop(state);
    uint res;
    assembly {
      res := iszero(data)
    }
    stackPush(state, res);
  }

  function handleAND(EVM memory state) internal {
    uint a = stackPop(state);
    uint b = stackPop(state);
    uint c;
    assembly {
      c := and(a, b)
    }
    stackPush(state, c);
  }

  function handleOR(EVM memory state) internal {
    uint a = stackPop(state);
    uint b = stackPop(state);
    uint c;
    assembly {
      c := or(a, b)
    }
    stackPush(state, c);
  }

  function handleXOR(EVM memory state) internal {
    uint a = stackPop(state);
    uint b = stackPop(state);
    uint c;
    assembly {
      c := xor(a, b)
    }
    stackPush(state, c);
  }

  function handleNOT(EVM memory state) internal {
    uint data = stackPop(state);
    uint res;
    assembly {
      res := not(data)
    }
    stackPush(state, res);
  }

  function handleBYTE(EVM memory state) internal {
    uint n = stackPop(state);
    uint x = stackPop(state);
    uint b;
    assembly {
      b := byte(n, x)
    }
    stackPush(state, b);
  }

  // 0x2X
  function handleSHA3(EVM memory state) internal {
    uint p = stackPop(state);
    uint n = stackPop(state);

    uint mp = memUPtr(state, p, n);

    assembly {
      n := keccak256(mp, n)
    }
    stackPush(state, n);
  }

  // 0x3X
  function handleADDRESS(EVM memory state) internal {
    stackPush(state, uint(state.target));
  }

  // not supported, we are stateless
  function handleBALANCE(EVM memory state) internal {
    state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
  }

  function handleORIGIN(EVM memory state) internal {
    stackPush(state, uint(state.caller));
  }

  function handleCALLER(EVM memory state) internal {
    stackPush(state, uint(state.caller));
  }

  function handleCALLVALUE(EVM memory state) internal {
    stackPush(state, 0);
  }

  function handleCALLDATALOAD(EVM memory state) internal {
    uint addr = stackPop(state);
    // When some or all of the 32 bytes fall outside of the calldata array,
    // we have to replace those bytes with zeroes.
    stackPush(state, callDataLoad(state, addr));
  }

  function handleCALLDATASIZE(EVM memory state) internal {
    stackPush(state, state.callDataLength);
  }

  function handleCALLDATACOPY(EVM memory state) internal {
    uint mAddr = stackPop(state);
    uint dAddr = stackPop(state);
    uint len = stackPop(state);

    uint clampedLen = len;
    if (dAddr + len > state.callDataLength) {
      clampedLen = state.callDataLength;
    }

    uint offset = state.callDataOffset;
    for (uint i = 0; i < clampedLen; i += 32) {
      uint val;
      assembly {
        val := calldataload(add(offset, add(i, dAddr)))
      }

      if (clampedLen - i < 32) {
        for (uint x = 0; x < clampedLen - i; x++) {
          uint8 v = uint8(val >> (248 - (x * 8)));
          memStore8(state, mAddr + i + x, v);
        }
      } else {
        memStore(state, mAddr + i, val);
      }
      // TODO fix the last amount
    }

    // pad with zeros
    for (uint i = mAddr + clampedLen; i < mAddr + len; i++) {
      memStore8(state, i, 0);
    }

    //  state.mem.storeBytesAndPadWithZeroes(
    //      state.data,
    //      dAddr,
    //      mAddr,
    //      len
    //  );
  }

  function handleCODESIZE(EVM memory state) internal {
    stackPush(state, state.codeLength);
  }

  function handleCODECOPY(EVM memory state) internal {
    uint mAddr = stackPop(state);
    uint cAddr = stackPop(state);
    uint len = stackPop(state);

    memStoreBytes(state, codeToBytes(state, cAddr, len), 0, mAddr, len);
  }

  function handleGASPRICE(EVM memory state) internal {
    state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
  }

  // this can be implemented for special needs, the EVMRuntime itself should be stateless
  function handleEXTCODESIZE(EVM memory state) internal {
    state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
  }

  // same as above
  function handleEXTCODECOPY(EVM memory state) internal {
    state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
  }

  function handleRETURNDATASIZE(EVM memory state) internal {
    stackPush(state, state.returnData.length);
  }

  function handleRETURNDATACOPY(EVM memory state) internal {
    uint mAddr = stackPop(state);
    uint rAddr = stackPop(state);
    uint len = stackPop(state);

    memStoreBytesAndPadWithZeroes(
      state,
      state.returnData,
      rAddr,
      mAddr,
      len
    );
  }

  function handleEXTCODEHASH(EVM memory state) internal {
    state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
  }

  // 0x4X
  function handleBLOCKHASH(EVM memory state) internal {
    state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
  }

  function handleCOINBASE(EVM memory state) internal {
    state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
  }

  function handleTIMESTAMP(EVM memory state) internal {
    state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
  }

  function handleNUMBER(EVM memory state) internal {
    state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
  }

  function handleDIFFICULTY(EVM memory state) internal {
    state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
  }

  function handleGASLIMIT(EVM memory state) internal {
    state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
  }

  // 0x5X
  function handlePOP(EVM memory state) internal {
    stackPop(state);
  }

  function handleMLOAD(EVM memory state) internal {
    uint addr = stackPop(state);

    stackPush(state, memLoad(state, addr));
  }

  function handleMSTORE(EVM memory state) internal {
    uint addr = stackPop(state);
    uint val = stackPop(state);

    memStore(state, addr, val);
  }

  function handleMSTORE8(EVM memory state) internal {
    uint addr = stackPop(state);
    uint8 val = uint8(stackPop(state));

    memStore8(state, addr, val);
  }

  function handleSLOAD(EVM memory state) internal {
    state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
  }

  function handleSSTORE(EVM memory state) internal {
    state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
  }

  function handleJUMP(EVM memory state) internal {
    uint dest = stackPop(state);
    if (dest >= state.codeLength || getOpcodeAt(state, dest) != OP_JUMPDEST) {
      state.errno = ERROR_INVALID_JUMP_DESTINATION;
      return;
    }
    state.pc = dest;
  }

  function handleJUMPI(EVM memory state) internal {
    uint dest = stackPop(state);
    uint cnd = stackPop(state);
    if (cnd == 0) {
      state.pc = state.pc + 1;
      return;
    }
    if (dest >= state.codeLength || getOpcodeAt(state, dest) != OP_JUMPDEST) {
      state.errno = ERROR_INVALID_JUMP_DESTINATION;
      return;
    }
    state.pc = dest;
  }

  function handlePC(EVM memory state) internal {
    stackPush(state, state.pc);
  }

  function handleMSIZE(EVM memory state) internal {
    stackPush(state, 32 * state.memSize);
  }

  function handleGAS(EVM memory state) internal {
    stackPush(state, 0);
  }

  // solhint-disable-next-line no-empty-blocks
  function handleJUMPDEST(EVM memory state) internal {

  }

  // 0x6X, 0x7X
  function handlePUSH(EVM memory state) internal {
    // we do not throw a ERROR_INDEX_OOB here,
    // instead we right-pad with zero
    stackPush(state, codeToUint(state, state.pc + 1, state.n));
  }

  // 0x8X
  function handleDUP(EVM memory state) internal {
    stackDup(state, state.n);
  }

  // 0x9X
  function handleSWAP(EVM memory state) internal {
    stackSwap(state, state.n);
  }

  // 0xaX
  // Logs are also stateful and thus not supported
  function handleLOG(EVM memory state) internal {
    state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
  }

  // 0xfX
  function handleCREATE(EVM memory state) internal {
    state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
  }

  function handleCALL(EVM memory state) internal {
    state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
  }

  function handleCALLCODE(EVM memory state) internal {
    state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
  }

  function handleRETURN(EVM memory state) internal {
    uint start = stackPop(state);
    uint len = stackPop(state);

    state.returnData = memToBytes(state, start, len);
  }

  function handleDELEGATECALL(EVM memory state) internal {
    state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
  }

  function handleCREATE2(EVM memory state) internal {
    state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
  }

  // solhint-disable-next-line code-complexity, function-max-lines
  function handleSTATICCALL(EVM memory state) internal {
    // gasLimit
    stackPop(state);
    uint target = uint(address(stackPop(state)));

    uint inOffset = stackPop(state);
    uint inSize = stackPop(state);
    uint retOffset = stackPop(state);
    uint retSize = stackPop(state);

    bytes memory data = memToBytes(state, inOffset, inSize);

    // we only going to support precompiles
    if (1 <= target && target <= 8) {
      if (target == 1) {
        handlePreC_ECRECOVER(state, data);
      } else if (target == 2) {
        handlePreC_SHA256(state, data);
      } else if (target == 3) {
        handlePreC_RIPEMD160(state, data);
      } else if (target == 4) {
        handlePreC_IDENTITY(state, data);
      } else if (target == 5) {
        handlePreC_MODEXP(state, data);
      } else if (target == 6) {
        handlePreC_ECADD(state, data);
      } else if (target == 7) {
        handlePreC_ECMUL(state, data);
      } else if (target == 8) {
        handlePreC_ECPAIRING(state, data);
      }
    } else {
      state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
    }

    if (state.errno != NO_ERROR) {
      state.errno = NO_ERROR;
      stackPush(state, 0);
      state.returnData = new bytes(0);
    } else {
      stackPush(state, 1);
      memStoreBytesAndPadWithZeroes(state, state.returnData, 0, retOffset, retSize);
    }
  }

  function handleREVERT(EVM memory state) internal {
    uint start = stackPop(state);
    uint len = stackPop(state);

    state.returnData = memToBytes(state, start, len);
    state.errno = ERROR_STATE_REVERTED;
  }

  function handleINVALID(EVM memory evm) internal {
    evm.errno = ERROR_INVALID_OPCODE;
  }

  function handleSELFDESTRUCT(EVM memory state) internal {
    state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
  }
}
