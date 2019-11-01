pragma solidity ^0.5.2;

import './ERC721.sol';

/**
 * @dev Implementation of ERC721 token and the `IERC1948` interface.
 *
 * ERC1948 is a non-fungible token (NFT) extended with the ability to store
 * dynamic data. The data is a bytes32 field for each tokenId. If 32 bytes
 * do not suffice to store the data, an authenticated data structure (hash or
 * merkle tree) shall be used.
 */
contract ERC1948 is ERC721 {
  /**
   * @dev Emitted when `oldData` is replaced with `newData` in storage of `tokenId`.
   *
   * Note that `oldData` or `newData` may be empty bytes.
   */
  event DataUpdated(uint256 indexed tokenId, bytes32 oldData, bytes32 newData);

  mapping(uint256 => bytes32) data;

  function mint(address to, uint256 tokenId) public {
    super._mint(to, tokenId);
  }

  function burn(uint256 tokenId) public {
    super._burn(ownerOf(tokenId), tokenId);
    delete(data[tokenId]);
  }

  /**
   * @dev See `IERC1948.readData`.
   *
   * Requirements:
   *
   * - `tokenId` needs to exist.
   */
  function readData(uint256 tokenId) external view returns (bytes32) {
    require(_exists(tokenId), 'tokenId does not exist');
    return data[tokenId];
  }

  /**
   * @dev See `IERC1948.writeData`.
   *
   * Requirements:
   *
   * - `msg.sender` needs to be owner of `tokenId`.
   */
  function writeData(uint256 tokenId, bytes32 newData) external {
    require(msg.sender == ownerOf(tokenId) || getApproved(tokenId) == msg.sender, 'no permission');
    emit DataUpdated(tokenId, data[tokenId], newData);
    data[tokenId] = newData;
  }
}
