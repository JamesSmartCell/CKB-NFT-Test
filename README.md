# CKB NFT Test

This is a draft to add TokenScript pointer to CKB NFT tokens with Spore SDK.

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.1.12. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

To add scriptURI you will need to manually add the scriptURI to the following files:

`node_modules/@spore-ckb/core/lib/codec/cluster.js`
```js
exports.ClusterDataV2 = codec_1.molecule.table({
    name: base_1.blockchain.Bytes,
    description: base_1.blockchain.Bytes,
    mutantId: base_1.blockchain.BytesOpt,
    scriptURI: base_1.blockchain.Bytes, // <-- add this line
}, ['name', 'description', 'mutantId', 'scriptURI']); // <-- add this line
```

```js
function packRawClusterDataV2(packable) {
    return exports.ClusterDataV2.pack({
        name: (0, helpers_1.bytifyRawString)(packable.name),
        description: (0, helpers_1.bytifyRawString)(packable.description),
        mutantId: packable.mutantId,
        scriptURI: (0, helpers_1.bytifyRawString)(packable.scriptURI), // <-- add this line
    });
}
```

```js
function unpackToRawClusterDataV2(unpackable) {
    const decoded = exports.ClusterDataV2.unpack(unpackable);
    return {
        name: (0, helpers_1.bufferToRawString)(decoded.name),
        description: (0, helpers_1.bufferToRawString)(decoded.description),
        mutantId: decoded.mutantId,
        scriptURI: (0, helpers_1.bufferToRawString)(decoded.scriptURI), // <-- add this line
    };
}
```

`node_modules/@spore-ckb/core/lib/codec/cluster.d.ts`
```ts
export interface RawClusterDataV2 {
    name: string;
    description: string;
    mutantId?: Hash;
}
export interface RawClusterDataScriptURI { // <-- add this line
    name: string;
    description: string;
    mutantId?: Hash;
    scriptURI?: string;
}
export type RawClusterData = RawClusterDataScriptURI; // <-- change this line
```