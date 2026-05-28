# AGENT.md - Tom tat project API_VNPAY

Tai lieu ngan gon ve cau truc, luong xu ly va quy uoc sua code.

## 1. Tong quan

- Node.js + Express demo thanh toan VNPAY, Stripe Checkout, MoMo va PayPal Checkout.
- Entry point: `server.js`.
- Backend: `src/`.
- Frontend static: `public/`.
- Database: MongoDB qua Mongoose.
- Project chi luu giao dich cuoi cung: `success` hoac `failed`.
- Khong luu draft order, `pending`, `checkout_created` vao MongoDB.
- Draft order co `currency`: `vnd` hoac `usd`.
- VNPAY va MoMo chi thanh toan `vnd`; Stripe co the thanh toan `vnd` hoac `usd`; PayPal mac dinh thanh toan `usd`.

## 2. Lenh chay

```bash
npm install
npm run dev
npm start
```

- `npm run dev`: `nodemon server.js`.
- `npm start`: `node server.js`.
- Local URL: `http://localhost:3000`.

## 3. Bien moi truong

Can file `.env` voi cac bien:

- App/DB: `PORT`, `MONGODB_URI`
- VNPAY: `VNP_TMNCODE`, `VNP_HASH_SECRET`, `VNP_URL`, `VNP_RETURN_URL`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CURRENCY`
- Stripe redirect: `STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL`
- MoMo: `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY`
- MoMo URL: `MOMO_CREATE_URL`, `MOMO_REDIRECT_URL`, `MOMO_IPN_URL`
- PayPal: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV`, `PAYPAL_CURRENCY`

Khong commit secret that len public repo.

## 4. Cau truc thu muc

```text
API_VNPAY/
  AGENT.md # Tom tat cau truc, luong xu ly va quy uoc sua code
  server.js # Entry point Express, mount webhook, middleware, routes va start server
  package.json # Metadata project, scripts va dependencies chinh
  package-lock.json # Lock version dependency npm
  .env # Bien moi truong local, khong commit secret that
  Docs/
    vnpay.txt # Ghi chu/tai lieu tham khao luong VNPAY
    stripe.txt # Ghi chu/tai lieu tham khao luong Stripe
  public/
    index.html # Trang redirect mac dinh sang tao don
    create-order.html # Form tao draft order va hien lich su giao dich
      payment-method.html # Trang chon gateway VNPAY, Stripe, MoMo hoac PayPal
    payment-result.html # Trang hien ket qua VNPAY va lich su chi tiet
    stripe-success.html # Trang Stripe success va sync session ve server
    stripe-cancel.html # Trang Stripe cancel khi user huy checkout
    css/
      shared.css # Design tokens, reset va style dung chung
      create-order.css # Style rieng cho trang tao don va lich su
      payment-method.css # Style rieng cho trang chon phuong thuc
      payment-result.css # Style rieng cho trang ket qua thanh toan
  src/
    config/
      index.js # Doc config VNPAY, MongoDB va port tu .env
      db.js # Tao ket noi MongoDB bang Mongoose
      stripe.js # Doc Stripe config va tao Stripe client khi can
      paypal.js # Doc PayPal config sandbox/live
    models/
      vnpay.js # Schema/model luu ket qua VNPAY/local gateway
      StripePayment.js # Schema/model luu ket qua Stripe Checkout
      MomoPayment.js # Schema/model luu ket qua MoMo
      PaypalPayment.js # Schema/model luu ket qua PayPal Checkout
    routes/
      index.js # Dang ky cac router /api, /payment, /stripe, /momo, /paypal
      api.js # API health, draft order co currency va lich su giao dich
      payment.js # Route tao URL, IPN va return cho VNPAY
      stripe.js # Route Checkout, webhook va sync cho Stripe
      momo.js # Route tao URL, IPN va return cho MoMo
      paypal.js # Route config, create order, capture va cancel PayPal
    stores/
      vnpayStore.js # Data access cho model VNPAY
      stripeStore.js # Data access cho model StripePayment
      momoStore.js # Data access cho model MomoPayment
      paypalStore.js # Data access cho model PaypalPayment
    helpers.js # Ham tien ich: sign, sort params, normalize, currency, tao txnRef
```

## 5. Entry point

- `server.js` tao Express app, connect MongoDB, mount routes.
- Stripe webhook duoc mount rieng truoc JSON parser:
  - `POST /stripe/webhook`
  - `express.raw({ type: 'application/json' })`
- Sau webhook moi mount `express.json()`, `express.urlencoded()`.
- **Local dev**: `express.static('public/')` va `sendFile` duoc mount de serve HTML.
- **Vercel**: static files duoc serve qua `@vercel/static` theo `vercel.json`; Express KHONG mount static.
- Export logic:
  - `VERCEL=true` → `module.exports = app` (serverless handler).
  - Local → `bootstrap()` chay `app.listen(PORT)`.

## 6. Config

- `src/config/index.js`: port, VNPAY, MongoDB.
- `src/config/db.js`: Mongoose connection.
- `src/config/stripe.js`: Stripe config va lazy client.
- `src/config/paypal.js`: PayPal config, endpoint sandbox/live va currency.

## 7. Models

- `src/models/vnpay.js`
  - Luu ket qua VNPAY/local gateway.
  - Mongoose model: `VNPAY`.
  - Status: `success`, `failed`.
  - Currency mac dinh: `vnd`.
  - Luu raw IPN/Return va thong tin verify.

- `src/models/StripePayment.js`
  - Luu ket qua Stripe Checkout.
  - Mongoose model: `StripePayment`.
  - Status: `success`, `failed`.
  - Currency lay tu Stripe session: `vnd` hoac `usd`.
  - Luu session, payment intent, raw session/event.

- `src/models/MomoPayment.js`
  - Luu ket qua MoMo.
  - Mongoose model: `MomoPayment`.
  - Status: `success`, `failed`.
  - Currency mac dinh: `vnd`.
  - Luu raw IPN/Return va thong tin verify chu ky MoMo.

- `src/models/PaypalPayment.js`
  - Luu ket qua PayPal Checkout.
  - Mongoose model: `PaypalPayment`.
  - Status: `success`, `failed`.
  - Currency mac dinh theo `PAYPAL_CURRENCY`, thuong la `usd`.
  - Luu PayPal order, capture, payer va raw response.

## 8. Stores

- `src/stores/vnpayStore.js`
  - Store cho `VNPAY`.
  - `findByRef`, `listAll`, `updateAfterIpn`, `updateAfterReturn`.
  - `updateAfterIpn` va `updateAfterReturn` dung upsert khi co ket qua.

- `src/stores/stripeStore.js`
  - Store cho `StripePayment`.
  - `findByRef`, `listAll`, `updateAfterCheckout`, `updateCheckoutExpired`.
  - Chi webhook hoac sync moi ghi DB.

- `src/stores/momoStore.js`
  - Store cho `MomoPayment`.
  - `findByRef`, `listAll`, `updateFromIpn`, `updateFromReturn`.
  - Chi IPN/Return moi ghi DB.

- `src/stores/paypalStore.js`
  - Store cho `PaypalPayment`.
  - `findByRef`, `listAll`, `updateAfterCapture`, `updateCancelled`.
  - Chi capture/cancel moi ghi DB.

## 9. Routes

- `src/routes/index.js`: mount `/api`, `/payment`, `/stripe`, `/momo`, `/paypal`.

- `src/routes/api.js`
  - `GET /api/health`: health/config check.
  - `POST /api/orders`: tao draft order voi `currency`, khong ghi DB.
  - `GET /api/transactions`: gop lich su VNPAY + Stripe + MoMo + PayPal, tra `provider`.
  - `GET /api/transactions/:txnRef`: tim theo ma giao dich, tra `provider`.

- `src/routes/payment.js`
  - `POST /payment/create`: tao URL VNPAY.
  - `GET /payment/ipn`: VNPAY server callback.
  - `GET /payment/return`: VNPAY browser return.
  - Chi IPN/Return moi ghi DB.

- `src/routes/stripe.js`
  - `GET /stripe/products`: san pham demo.
  - `GET /stripe/payments/:txnRef`: xem ban ghi Stripe.
  - `POST /stripe/checkout`: tao Checkout Session.
  - `POST /stripe/sync/:sessionId`: sync ket qua bang session id.
  - `POST /stripe/cancel`: ghi nhan Checkout cancel thanh `failed`.
  - `POST /stripe/webhook`: webhook raw body.

- `src/routes/momo.js`
  - `GET /momo/payments/:txnRef`: xem ban ghi MoMo.
  - `POST /momo/create`: tao URL thanh toan MoMo.
  - `POST /momo/ipn`: MoMo server callback.
  - `GET /momo/return`: MoMo browser return.
  - Chi IPN/Return moi ghi DB.

- `src/routes/paypal.js`
  - `GET /paypal/config`: tra PayPal client id public va currency cho JS SDK.
  - `GET /paypal/payments/:txnRef`: xem ban ghi PayPal.
  - `POST /paypal/orders`: tao PayPal order, chua ghi DB.
  - `POST /paypal/orders/:orderId/capture`: capture PayPal order va ghi DB.
  - `POST /paypal/cancel`: ghi nhan user huy PayPal thanh `failed`.

## 10. Frontend

- `public/index.html`: redirect sang `create-order.html`.
- `public/create-order.html`: tao draft co currency, luu `sessionStorage`, hien lich su.
- `public/payment-method.html`: doc draft, chon VNPAY/Stripe/MoMo/PayPal, render PayPal Buttons, chan VNPAY va MoMo neu `currency=usd`, chan PayPal neu khac `PAYPAL_CURRENCY`.
- `public/payment-result.html`: hien ket qua VNPAY hoac lich su.
- `public/stripe-success.html`: sync Stripe bang session id.
- `public/stripe-cancel.html`: trang huy Stripe Checkout va sync cancel ve server.

## 11. Luong tao don

1. User nhap form trong `create-order.html`.
2. Frontend goi `POST /api/orders`.
3. Server tra `txnRef` va thong tin don, khong ghi DB.
4. Frontend luu draft va `currency` vao `sessionStorage`.
5. User sang `payment-method.html` de chon gateway.

## 12. Luong VNPAY

1. Frontend goi `POST /payment/create` voi draft order `currency=vnd`.
2. Server tao `payUrl`.
3. User thanh toan tren VNPAY.
4. VNPAY goi `/payment/ipn` va/hoac `/payment/return`.
5. Server verify signature va ghi `VNPAY` voi `success`/`failed`.

## 13. Luong Stripe

1. Frontend goi `POST /stripe/checkout` voi draft order `currency=vnd` hoac `usd`.
2. Server tao Checkout Session, chua ghi DB.
3. User thanh toan tren Stripe.
4. Stripe webhook goi `/stripe/webhook`, success page goi `/stripe/sync/:sessionId`, cancel page goi `/stripe/cancel`.
5. Server ghi `StripePayment` voi `success`/`failed`.

## 14. Luong MoMo

1. Frontend goi `POST /momo/create` voi draft order `currency=vnd`.
2. Server tao payload, ky HMAC-SHA256 va goi MoMo `payWithMethod`.
3. User thanh toan tren MoMo.
4. MoMo goi `/momo/ipn` va/hoac redirect user ve `/momo/return`.
5. Server verify signature va ghi `MomoPayment` voi `success`/`failed`.

## 15. Luong PayPal

1. Frontend load PayPal JS SDK bang `GET /paypal/config`.
2. PayPal Button goi `POST /paypal/orders` voi draft order `currency=usd`.
3. Server tao PayPal order qua Orders API, chua ghi DB.
4. User approve tren PayPal popup.
5. Frontend goi `POST /paypal/orders/:orderId/capture`.
6. Server capture va ghi `PaypalPayment` voi `success`/`failed`.

## 16. Deploy Vercel

### Cach hoat dong

- Vercel nhan dien `VERCEL=true` → `server.js` export `app` (serverless function).
- Static files (`public/`) duoc serve truc tiep boi `@vercel/static`, KHONG qua Express.
- `vercel.json` dinh nghia priority routes: API routes → `server.js`; con lai → `public/$1`.

### Cau truc `vercel.json`

```json
{
  "builds": [
    { "src": "server.js", "use": "@vercel/node" },
    { "src": "public/**", "use": "@vercel/static" }
  ],
  "routes": [
    { "src": "/stripe/webhook", "dest": "server.js" },
    { "src": "/api/(.*)",      "dest": "server.js" },
    { "src": "/payment/(.*)", "dest": "server.js" },
    { "src": "/stripe/(.*)",  "dest": "server.js" },
    { "src": "/momo/(.*)",    "dest": "server.js" },
    { "src": "/paypal/(.*)",  "dest": "server.js" },
    { "src": "/(.*)",         "dest": "public/$1" }
  ]
}
```

### Cac buoc deploy

1. Cai Vercel CLI: `npm i -g vercel`.
2. Chay `vercel` o thu muc goc de deploy preview.
3. Chay `vercel --prod` de deploy production.
4. Set bien moi truong tren Vercel Dashboard → Project → Settings → Environment Variables.

### Bien moi truong can set tren Vercel Dashboard

| Bien | Mo ta |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `VNP_TMNCODE` | VNPAY TmnCode |
| `VNP_HASH_SECRET` | VNPAY Hash Secret |
| `VNP_URL` | VNPAY payment URL |
| `VNP_RETURN_URL` | URL cong khai: `https://<domain>/payment/return` |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret |
| `STRIPE_CURRENCY` | `vnd` hoac `usd` |
| `STRIPE_SUCCESS_URL` | `https://<domain>/stripe-success.html` |
| `STRIPE_CANCEL_URL` | `https://<domain>/stripe-cancel.html` |
| `MOMO_PARTNER_CODE` | MoMo partner code |
| `MOMO_ACCESS_KEY` | MoMo access key |
| `MOMO_SECRET_KEY` | MoMo secret key |
| `MOMO_CREATE_URL` | MoMo API create URL |
| `MOMO_REDIRECT_URL` | `https://<domain>/momo/return` |
| `MOMO_IPN_URL` | `https://<domain>/momo/ipn` |
| `PAYPAL_CLIENT_ID` | PayPal app client id |
| `PAYPAL_CLIENT_SECRET` | PayPal app secret |
| `PAYPAL_ENV` | `sandbox` hoac `live` |
| `PAYPAL_CURRENCY` | Thuong dung `usd` |

> **Luu y**: Stripe webhook can them endpoint `https://<domain>/stripe/webhook` tren Stripe Dashboard va copy `STRIPE_WEBHOOK_SECRET` ve.

### Quy uoc Vercel

- Khong commit `.env` len repo.
- `PORT` KHONG can set tren Vercel (Vercel tu quan ly port).
- Moi lan push len `main` se tu dong re-deploy neu da link voi Vercel Git Integration.

## 17. Quy uoc sua code

- Khong tao lai `pending` neu khong duoc yeu cau.
- Khong luu draft order vao MongoDB.
- VNPAY/local data vao `VNPAY`; Stripe data vao `StripePayment`; MoMo data vao `MomoPayment`; PayPal data vao `PaypalPayment`.
- Lich su giao dich phai tra/hien thi `provider`: `vnpay`, `stripe`, `momo` hoac `paypal`.
- Khong cho tao thanh toan VNPAY khi `currency=usd`.
- Khong cho tao thanh toan MoMo khi `currency=usd`.
- Khong cho tao thanh toan PayPal khi `currency` khac `PAYPAL_CURRENCY`.
- Them gateway moi thi uu tien model/store rieng.
- Khi sua code, chi sua cac file lien quan truc tiep den chuc nang hoac bug dang lam; khong sua file ngoai pham vi neu khong can thiet hoac khong duoc yeu cau.
- Sua Stripe webhook phai giu raw body truoc JSON parser.
- Sua frontend flow phai giu draft order trong `sessionStorage`.
- Khi them bien URL moi (VNP_RETURN_URL, MOMO_IPN_URL, etc.) phai dung domain that tren Vercel, khong dung `localhost`.

## 18. Kiem tra nhanh

```bash
node --check server.js
node --check src/routes/api.js
node --check src/routes/payment.js
node --check src/routes/stripe.js
node --check src/routes/momo.js
node --check src/routes/paypal.js
node --check src/stores/vnpayStore.js
node --check src/stores/stripeStore.js
node --check src/stores/momoStore.js
node --check src/stores/paypalStore.js
node --check src/services/paypalService.js
```
