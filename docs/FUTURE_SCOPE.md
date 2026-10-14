# Future Scope

These features were deliberately left out of the current version (spec Section 17). The code already leaves room for several of them, as noted.

## 1. SMS, WhatsApp and push alerts

Donors often don't have the app open. Real-time alerts outside the browser would cut response times further.

- **SMS / WhatsApp** through a gateway for URGENT and CRITICAL alerts (with the donor's consent and opt-out).
- **Web push notifications** (service worker + Push API) for donors who installed the app.
- *Ready in the code:* `server/src/notify.ts` defines a `NotificationChannel` interface. `SmsChannel` and `PushChannel` already exist as stubs, and email already works through the same interface, so a new channel is one class.

## 2. Native mobile app

A React Native app could reuse the shared domain rules and API types (`shared/`) and the same REST API. It would add background location, reliable push, and a quick-accept action from the notification.

## 3. AI-based demand forecasting

Use the request history (blood group, location, time of year, urgency) to forecast demand per blood group and area. For example, more requests during dengue season, or regular thalassemia transfusions. This would let blood banks plan stock and let the platform schedule donation camps where shortages are likely.

## 4. Integration with e-RaktKosh / government blood bank databases

Connect to national blood bank systems such as **e-RaktKosh** to show real stock levels from government and private blood banks, and to record donations in official records. It would need the relevant permissions and API access.

## 5. Blood test report upload and OCR verification

Today a donor's blood group becomes **Verified** when a hospital or blood bank records a donation. Future versions could let donors upload a lab report and read the group automatically with **OCR**, with admin or hospital review, to verify donors before their first donation.

## 6. Gamification and donor rewards

Badges and milestones (first donation, 5 donations, lives impacted), donation streaks, certificates, and partner rewards. The history page already shows units donated and lives impacted, so these could build on it.

## 7. Multi-language support

Hindi and Marathi (then other Indian languages) for the interface and the notifications, so families and donors can use Red Link in the language they're comfortable with.

## 8. Other donation types

Platelets, plasma and whole-blood components. Each has its own rest period (platelets can be given more often than whole blood) and its own compatibility rules. The eligibility and compatibility functions are isolated in `shared/src/domain`, so new types can be added there with their own tests.

## 9. Scaling up

For a state-wide or national rollout, see [NON_FUNCTIONAL.md, Scalability](NON_FUNCTIONAL.md#7-scalability):

- MongoDB `2dsphere` geospatial queries;
- Atlas sharding by region;
- a job queue for notifications;
- WebSockets instead of polling;
- a scheduled worker for escalation and expiry.

## 10. Smaller improvements

- Real-time chat between a donor who accepted and the hospital (today they call each other).
- Directions from the donor's location to the hospital after accepting.
- Donor reminders when the 90-day rest period ends.
- Admin export of analytics (CSV / PDF) for reports to health authorities.
- An offline-capable app shell (service worker caching), so the app opens without a connection.
