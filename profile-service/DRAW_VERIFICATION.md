# Verified draw replay

The private test replay reads the latest completed ULTON event from one pinned
archive commit. The service checks the complete final snapshot hash and its
ranking. Both server and browser verify the pinned drand BLS signature, exact
approved integer probability weights, final UTC cutoff, deterministic plan and
SHA-256 rejection-sampling result. Animation cannot request another seed or
replace a result. A failed proof blocks playback. Replays show the same result.

The grid displays all 100 final wallets and their registered nicknames, with
short wallet addresses as fallbacks. Tile sizes and animation visits are
presentation only; selection keeps the original weighted probabilities. The visible winner is only inserted after playback finishes. The API,
downloadable proof and on-chain records, when present, cannot be kept secret
from someone who inspects them before the animation. This is a presentation
reveal, not cryptographic secrecy.

## On-chain status

No Cronos transaction or on-chain randomness verification exists for these
historical test draws. The page explicitly says NOT REGISTERED. The current
default drand BLS12-381 proof must not be relabelled as an EVM VRF proof.
An explorer address link identifies the selected wallet; it is not a receipt
of winning or a transfer of a prize.

Production must commit the final candidate list/hash, approved weights and
future randomness round on Cronos before the round becomes available. A
separately reviewed contract/oracle must verify the randomness and selection,
store one immutable result per event and emit a winner event. A late commitment
must block the draw; no new round can be silently substituted. If only a
publisher-attested receipt is used, distinguish that from on-chain verification
of randomness. Historical draws cannot acquire a retroactive precommitment.

drand documents an EVM-compatible evmnet using BN254, distinct from the default
network used by this existing test. A migration needs an independently reviewed
verifier, network support checks, fixed public key and activation policy.
Reference: https://docs.drand.love/developer/

Deployment, any oracle request, and any resulting gas expenditure require the
user's signing wallet. No code in this feature signs transactions, approves
tokens, enables real prizes or changes any current probability.

The final participant list is computed by the existing indexer. Cryptographic
proofs of entropy do not independently prove holder eligibility. Git archive
administration remains a trust assumption until a timely independent chain
commitment exists.
