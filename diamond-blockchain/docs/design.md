- [ ] Finalize on-chain event model (set exact fields for each eventType)
- [ ] Decide consensus (PoA - admin signed blocks recommended for MVP)
- [ ] Add signature scheme for validators (ECDSA keys)
- [ ] Implement REST/gRPC endpoints for:
- POST /events (accept Transaction/Event)
- GET /chain (return chain or summary)
- GET /block/:hash
- [ ] Persist chain to MongoDB collection `onchain_blocks` (optional)
- [ ] Build Node bridge and integrate with existing backend service calls
- [ ] Add wallet model to User schema and migrations
- [ ] Implement NFT minting flow & metadata storage
- [ ] Security audit & basic fuzzing tests




================================================================================
== TODOs / Notes
================================================================================


- Use nlohmann/json for JSON support in C++ (add to CMake).
- Use OpenSSL for SHA256 (or libsodium if preferred).
- Keep the Node.js bridge small: it is the single point of integration for now.
- Persist chain to disk and optionally replicate to MongoDB so your app can query quickly.
- For signing and validator keys, use ECDSA (secp256k1 or curve25519 libs available).
- Add index endpoints that return only summaries for leaderboards — do heavy queries off-chain by indexing block events into Mongo.




================================================================================
== End of document
================================================================================