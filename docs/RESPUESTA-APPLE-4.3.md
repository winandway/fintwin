# Respuesta a Apple: guías 4.3 (spam) y 4.2.6 (generadores de apps)

> 3 de noviembre de 2026, 11:58 am. Apple rechazó la versión 1.0 (compilación 3), envío
> 5235b642-0e35-4116-aa59-fd25168b6bfa, por **4.3 Design: Spam** y **4.2.6 App Generation Services**.
> El mismo minuto rechazó otras apps de la cuenta Windoce LLC (Divoox, QRbott, Escenia, Mercatren, Kipuu):
> es un motivo de CUENTA, no solo de FinTwin.

## Qué dice Apple, en corto

Cree que FinTwin podría ser (a) una copia de algo que ya existe, (b) una variante oportunista de una categoría,
o (c) una app hecha con una plantilla comercial o un servicio que fabrica apps y que se publica en nombre de otro.

Pone dos caminos:

1. Si es así, **no volver a enviar** hasta hacer cambios grandes.
2. Si no es así, **no volver a enviar**: se **responde el mensaje** contestando nueve preguntas completas.

FinTwin es producto propio de Windoce LLC, hecho por nosotros, sin plantilla. Va el camino 2: responder, sin reenviar.

## Lo que hay que cuidar

- **Las respuestas tienen que cuadrar entre TODAS las apps de la cuenta** (las preguntas 5, 6 y 7 preguntan por
  las demás apps). Si FinTwin dice una cosa y QRbott otra, Apple lo ve. La respuesta de cada app debe salir de
  un mismo texto base de la empresa.
- **Nada inventado.** Ni cifras de usuarios, ni probadores que no existieron.
- **No se reenvía la versión.** Apple lo dice claro: reenviar sin cambios = otro rechazo y más problemas.

## Lo que Richard confirma antes de enviar (marcado ⚠️ en el texto)

1. Que clientes reales de Windoce usaron FinTwin dentro de Windoce Hub antes de esta app (y desde cuándo).
2. La lista de apps de la cuenta, con una línea de qué hace cada una (pregunta 5).
3. Si alguna otra app de la cuenta reutiliza el mismo armazón de iPhone que FinTwin (pregunta 7).

## Texto para enviar (en inglés, en «Responder al equipo de revisión de apps»)

```
Hello App Review team,

Thank you for the detailed message. We believe FinTwin meets guidelines 4.3(a), 4.3(b) and 4.2.6, so we are not resubmitting and are answering all nine questions below.

1. What the app does and the problem it solves
Many small businesses get paid by bank transfer (Zelle, wire, local instant transfers). The customer pays at their own bank and then sends the business a screenshot of the transfer, usually over WhatsApp. The business owner then has to (a) find that screenshot among hundreds of chats, (b) type the amount and the confirmation number somewhere, and (c) make sure the same screenshot is not being reused to "pay" twice, which is a very common fraud: the same receipt is sent again, or sent to a second branch, and the goods are delivered without a new payment.
FinTwin is a record-keeping tool that solves exactly that:
- The business creates one or more "accounts" (branches, clients, business units) and shares a payment link or QR code.
- Whoever paid opens the link, uploads the screenshot, and must include the bank's confirmation number; without it the receipt is not accepted.
- FinTwin reads the screenshot (amount, confirmation number, sender, receiver, date, platform) and checks it against every receipt already recorded, by image fingerprint and by confirmation number, across all accounts. A repeated receipt is stopped and shown with its full usage history.
- The business team approves or rejects receipts in batches, each person with a personal 4-digit PIN, so there is an audit trail of who approved what.
- The owner sees monthly totals per account, can record outflows with their invoice attached and commission expenses with their purchase ticket, and can export the history.
FinTwin never moves, holds or transfers money; payments happen at the customer's own bank.

2. Intended users
Owners and staff of small and medium businesses that are paid by bank transfer instead of cards: retail stores, service companies, agencies, distributors and similar businesses, in the United States and Latin America, in English and Spanish. Inside a business there are three roles: the owner (creates accounts and the team), the validators (approve or reject with their own PIN) and the people who upload receipts on behalf of the business. The customers who pay do not need an account: they only use the payment link.

3. The gap it fills
Receipt-scanning apps (expense apps) are built for receipts that YOU paid, not for proofs of payment that YOUR CUSTOMERS send you. Accounting and bank-reconciliation apps depend on bank feeds, which many small businesses do not have for P2P transfers, and they reconcile days later, after the goods were already delivered. Messaging apps are where the screenshots arrive today, with no structure at all. FinTwin is built around the moment the customer says "I already paid": a customer-facing upload link, a mandatory confirmation number, duplicate detection across all of the business's accounts before the payment is counted, and team approval with a personal PIN. We are not aware of an app on the App Store that combines these for incoming transfer receipts.

4. Beta testing and feedback applied
⚠️ FinTwin first ran for our own business clients as a module of Windoce Hub, our web platform at windoce.com, and was then rebuilt as a standalone product. The Android version is live on Google Play. On iOS we tested with an internal TestFlight group on physical iPhones. Examples of feedback that changed the production build:
- A receipt legitimately split between two accounts was blocked as a duplicate. We added "Accept anyway", which shows the full usage history and requires the validator's PIN, while a receipt can still never enter the same account twice.
- "Delete my user" was too close to "Sign out" and could be tapped by mistake. It now lives in My profile, inside the more-options menu, and requires the password and typing a confirmation word.
- The date field on the payment page overflowed the screen on iPhone; it was fixed.
- Staff found email links hard to use on the phone; email is now confirmed with a 6-digit code inside the app, and the owner can add uploaders and validators with an access code instead of an email.
- Testers asked for all shortcuts (new account, profile, help, guides) to be reachable from the home screen menu, including the very first time, before any account exists; this was added.

5. Standalone product or suite
FinTwin is a standalone product. ⚠️ Windoce LLC is a software development company that publishes several products, each for a different market and purpose. FinTwin is the only app on our account that records incoming payment receipts; none of our other apps reads payment screenshots, detects reused receipts or offers PIN-based approval of income.

6. Could it be an in-app purchase or feature of another app on the account?
No. None of our other apps is used by the same people for the same job, so adding receipt records to them would make no sense to their users. FinTwin's users are a business's owner and staff, who need a dedicated tool their whole team can install and that customers can reach through a payment link.

7. Shared code, frameworks or assets with other apps on the account
⚠️ FinTwin has its own codebase, its own server, its own database and its own brand. It uses only standard third-party frameworks (Expo, React Native, react-native-webview, expo-notifications for push notifications). Our team uses the same standard tools across our apps, but FinTwin's screens, server logic, AI receipt reading, duplicate detection, approval workflow and data are exclusive to FinTwin.

8. Shared codebase, SDK or content library with a third-party app
No. Beyond the standard frameworks listed above, the only external service is the Google Gemini API, which we call to read the text of each receipt image. All of the app's logic and content are our own.

9. Created for a client, partner or third party?
No. FinTwin is Windoce LLC's own product, with our own concept, content and branding. It was designed and built in-house by our team; it was not created from a commercial template or an app generation service, and it is not published on behalf of anyone else. Windoce LLC is the provider of the app's content.

The screen recording attached to the App Review Information shows the full flow on a physical iPhone. If anything else would help, we are happy to provide it.

Best regards,
Windoce LLC
go@windoce.com
```

## Cómo se envía

App Store Connect → FinTwin → Distribución → Revisión de apps → el envío rechazado → «Responder al equipo de
revisión de apps» → se pega el texto → Enviar. **No tocar «Volver a enviar a revisión de apps».**
La API pública de Apple no permite contestar ese mensaje; se hace en la página.
