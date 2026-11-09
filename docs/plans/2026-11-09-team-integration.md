# Team integration

Source reviewed: ars2323/PleOrder bb91d112f40657c00d9cc9ad0888ef2c59249606.

Keep the existing glass UI, Naver map/provider, PaymentRepository and explicit payment approval. Port the conversation, history and route tracking ideas into the shared JavaScript repository used by foreground, driving and background Gleo entry points; do not replace the app with the teammate APK.

- [x] Persistent conversation: restaurant/menu choices, quantities, amendments, detail queries, expiry and rejection precedence.
- [x] Personalization from completed orders, repeat order contents, context and honest recommendation reasons.
- [x] Arrival reservations, immediate route uncertainty hold, fresh ETA samples, explicit resume/cancel, multi-order selection.
- [x] Native route lifecycle, background tracking and Gleo schema registration.
- [x] Focused glass UI states, history, accessible choice controls and reduced motion.
- [x] Regression tests, APK build/install, real Gleo microphone tests including negative confirmation and background status.

Results and explicit validation limits: [integration verification](../testing/team-integration-2026-11-09.md).

Never adopt: repeated request as approval, seed history treated as actual history, sending while route cancellation is unresolved, stale remaining ETA subtraction, replacement of existing navigation waypoints without consent, or gear-only driving policy.
