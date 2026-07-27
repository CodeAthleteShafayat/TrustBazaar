# TrustBazaar — PRD (v2)
*Buy. Sell. Exchange. Rent. Trust.*

> Working copy for AI coding agents. The polished/pitch version is `TrustBazaar_PRD_v2.docx`. If the two ever disagree, this file is the one to trust for implementation — update both together if you change scope.

| | |
|---|---|
| **Product Name** | P2P Marketplace & Rental Platform |
| **Status** | Draft for Review — v2 (Trust Score + Rental added) |
| **Date** | July 2026 |
| **Team** | Md. Shafayat Islam, Md. Minhazul Islam Khan, Adnan Faisal, Swapnil Sarker (HackersCentre) |



# 1. Introduction

TrustBazaar is a peer-to-peer (P2P) marketplace that enables individuals and small businesses to buy, sell, exchange, and now rent new or second-hand products. Unlike direct payment transfer platforms, TrustBazaar acts as a trusted financial intermediary, holding the buyer's payment for a 3-day satisfaction window before releasing funds to the seller, and holding a security deposit for the duration of any rental. The platform earns revenue through a percentage-based commission on every successful transaction, and builds long-term trust through a visible Trust Score for every user.

## 1.1 Problem Statement

Second-hand and peer-to-peer product markets suffer from a high level of distrust. Buyers fear receiving goods that do not match the description; sellers fear chargebacks or non-payment. There is no widely available, lightweight platform that combines the simplicity of a marketplace listing with the security of an escrow-like payment model at the small-transaction level — and no simple way for either side to know, at a glance, whether the person they are dealing with has a track record of honest behavior.

## 1.2 Solution Summary

- A marketplace where sellers list products (new, used, or for exchange).

- Buyers pay through the platform; money is held for 3 days.

- Within 3 days the buyer confirms satisfaction or raises a dispute.

- The platform releases funds to the seller on day 3 if no dispute is raised.

- If a dispute is raised, the platform reviews and decides on a refund or release.

- The platform charges a percentage-based fee from the seller on every completed sale.

- Every user carries a Trust Score, calculated from completed transaction history, dispute outcomes, and rental return behavior — visible on every profile and listing.

- Sellers can additionally list items for rent; renters pay a 40% security deposit of the item's value up front (higher for premium categories, see 4.4), refunded on safe return, in addition to the rental fee.

# 2. Goals & Objectives

|                       |                                                                        |                                                           |
|-----------------------|------------------------------------------------------------------------|-----------------------------------------------------------|
| **Goal**              | **Objective**                                                          | **Success Metric**                                        |
| **Trust & Safety**    | Give buyers confidence with a 3-day protection window                  | < 5% dispute rate within 6 months                        |
| **Seller Confidence** | Guarantee payment release after the protection window                  | < 1% failed release rate                                 |
| **Reputation**        | Give every user a visible, earned Trust Score reflecting real behavior | > 80% of active users with a calculated score by Month 3 |
| **Rental Adoption**   | Enable safe short-term rentals with deposit protection                 | 500+ completed rentals in Month 3                         |
| **Revenue**           | Earn a commission on every completed transaction                       | Achieve breakeven by Month 6                              |
| **Growth**            | Attract listings in multiple product categories                        | 1,000 active listings in Month 3                          |
| **Compliance**        | Maintain clear privacy and dispute policies                            | Zero regulatory violation                                 |

# 3. User Personas

## 3.1 Buyer

|                 |                                                                                                                       |
|-----------------|-----------------------------------------------------------------------------------------------------------------------|
| **Who**         | **Individual looking to purchase new or second-hand goods at competitive prices**                                     |
| **Goals**       | Find trusted deals, pay safely, and receive goods as described                                                        |
| **Pain Points** | Fear of scams, fake listings, and losing money with no recourse                                                       |
| **Key Need**    | Confidence that money is protected until satisfied, and a quick way to judge a seller's trustworthiness before paying |

## 3.2 Seller

|                 |                                                                                                                 |
|-----------------|-----------------------------------------------------------------------------------------------------------------|
| **Who**         | **Individual or small business wanting to sell, exchange, or rent out products**                                |
| **Goals**       | List quickly, reach buyers, and receive payment reliably                                                        |
| **Pain Points** | Chargebacks, non-payment, slow settlement, and renters who damage or don't return items                         |
| **Key Need**    | Guaranteed payment release after the protection window, and a security deposit that actually covers rental risk |

## 3.3 Renter

|                 |                                                                                     |
|-----------------|-------------------------------------------------------------------------------------|
| **Who**         | **A buyer-type user who wants short-term use of an item instead of owning it**      |
| **Goals**       | Access a product temporarily at low cost, with a fair, transparent deposit          |
| **Pain Points** | Unclear deposit terms, disputes over item condition at return                       |
| **Key Need**    | Clear deposit amount up front, and a fair, evidence-based return inspection process |

## 3.4 Platform Administrator

|                 |                                                                                                           |
|-----------------|-----------------------------------------------------------------------------------------------------------|
| **Who**         | **Internal operations team managing disputes, compliance, and seller payouts**                            |
| **Goals**       | Resolve disputes fairly and quickly; ensure platform integrity                                            |
| **Pain Points** | Lack of evidence to decide disputes; fraudulent claims; renters disputing deposit deductions              |
| **Key Need**    | Structured dispute workflow with evidence collection tools, feeding directly into each user's Trust Score |

# 4. Scope — Features & Requirements

## 4.1 User Registration & Profiles

All users must create a verified account before listing, purchasing, or renting.

|                           |                                                                         |              |
|---------------------------|-------------------------------------------------------------------------|--------------|
| **Feature**               | **Description**                                                         | **Priority** |
| **Sign Up / Login**       | Email and mobile number registration with OTP verification              | Must Have    |
| **Profile Page**          | Display name, Trust Score, joined date, listing history, rental history | Must Have    |
| **Identity Verification** | Optional ID upload for higher trust badge                               | Should Have  |
| **Notification Settings** | Email and in-app preferences for order updates                          | Should Have  |

## 4.2 Product Listings

Sellers can create listings for selling, exchanging, or renting products. Each listing captures enough information for the buyer or renter to make an informed decision.

|                           |                                                                                                                                                                                                     |                            |
|---------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------|
| **Feature**               | **Description**                                                                                                                                                                                     | **Priority**               |
| **Create Listing**        | Title, category, condition (new/used), price, description, photos (up to 10)                                                                                                                        | Must Have                  |
| **Exchange Option**       | Seller can mark a listing as 'open to exchange' and describe what they want                                                                                                                         | Must Have                  |
| **Rental Option**         | Seller can mark a listing as 'available for rent', set a rental price per day/week, and the item's declared value (used to calculate the security deposit, base 40%, higher for premium categories) | Must Have                  |
| **Edit / Delete Listing** | Seller can update or remove a listing at any time before a buyer pays or a renter books                                                                                                             | Must Have                  |
| **Search & Filter**       | Buyers/renters can search by keyword, category, condition, price range, listing type (sale/exchange/rent), and location                                                                             | Must Have                  |
| **Listing Boost**         | Optional paid promotion to increase listing visibility                                                                                                                                              | Could Have (like meta ads) |

## 4.3 Transaction & Payment Flow (Buy/Sell)

This is the core business logic of the platform. Every purchase transaction goes through the following escrow-style flow:

|          |                 |                                                                                        |
|----------|-----------------|----------------------------------------------------------------------------------------|
| **Step** | **Actor**       | **Action**                                                                             |
| **1**    | Buyer           | Finds listing and clicks 'Buy Now'                                                     |
| **2**    | Platform        | Collects full payment from buyer (card / mobile banking)                               |
| **3**    | Platform        | Notifies seller that payment has been received                                         |
| **4**    | Seller          | Ships or hands over the product                                                        |
| **5**    | Platform        | Starts the 3-day satisfaction timer                                                    |
| **6a**   | Buyer (Happy)   | Confirms satisfaction; platform releases funds to seller minus commission              |
| **6b**   | Buyer (Neutral) | Confirms no issues; platform releases funds to seller minus commission                 |
| **6c**   | Buyer (Dispute) | Raises a dispute; platform reviews evidence and decides                                |
| **7**    | Platform        | Settles: refund to buyer OR release to seller; outcome feeds both parties' Trust Score |

If the buyer does not take any action within 3 days, the platform automatically releases funds to the seller, treating silence as confirmation.

## 4.4 Rental Transaction & Security Deposit Flow

Rentals follow a parallel flow to purchases, with a security deposit held for the rental duration instead of a one-time 3-day window.

|          |                     |                                                                                                                                                         |
|----------|---------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Step** | **Actor**           | **Action**                                                                                                                                              |
| **1**    | Renter              | Finds a rental listing, selects rental duration, clicks 'Rent Now'                                                                                      |
| **2**    | Platform            | Collects the rental fee AND a security deposit equal to 40% of the item's declared value (higher for premium categories — see deposit tier table below) |
| **3**    | Platform            | Notifies owner that payment + deposit has been received                                                                                                 |
| **4**    | Owner               | Hands over the item for the agreed rental period                                                                                                        |
| **5**    | Platform            | Tracks the rental period; sends a return reminder near the end date                                                                                     |
| **6**    | Renter              | Returns the item to the owner by the agreed date                                                                                                        |
| **7a**   | Owner (No damage)   | Confirms item returned in good condition; platform refunds full deposit to renter                                                                       |
| **7b**   | Owner (Damage/Late) | Raises a deposit claim with evidence; platform reviews and decides how much deposit is deducted                                                         |
| **8**    | Platform            | Settles: full/partial deposit refund to renter, remainder (if any) paid to owner; outcome feeds both parties' Trust Score                               |

Deposit claims follow the same evidence-and-admin-review model as purchase disputes (see Section 4.7). If the owner raises no claim within 48 hours of the return date, the full deposit is automatically refunded to the renter.

**Security Deposit Rate by Category:**

|                                                                     |                                                        |
|---------------------------------------------------------------------|--------------------------------------------------------|
| **Item Category**                                                   | **Security Deposit**                                   |
| **General / Standard items**                                        | 40% of declared value                                  |
| **Premium electronics (cameras, drones, laptops)**                  | 60% of declared value                                  |
| **Smart gadgets & wearables (smartwatches, VR headsets, consoles)** | 60% of declared value                                  |
| **High-value / fragile specialty items (admin-flagged)**            | Up to 75% of declared value, set case-by-case by admin |

Note: Premium/high-value category deposit rates are configurable by the admin panel, similar to commission rates in Section 4.6.

## 4.5 3-Day Buyer Protection & Refund Policy

- The buyer has exactly 3 calendar days from the date of confirmed delivery to raise a dispute.

- A dispute can be raised for: item not as described, item not received, or item significantly damaged.

- The buyer must provide photo or video evidence when raising a dispute.

- The platform admin reviews evidence and makes a binding decision within 48 hours.

- If the dispute is resolved in the buyer's favor, a full refund is issued to the original payment method.

- If the dispute is resolved in the seller's favor, funds are released to the seller.

- After the 3-day window closes with no dispute, payment is released and no refund is possible.

## 4.6 Commission & Revenue Model

The platform charges a percentage-based commission on every successfully completed sale, and a smaller service fee on every completed rental. Commission is deducted automatically before payout is processed.

|                              |                                                          |                                         |
|------------------------------|----------------------------------------------------------|-----------------------------------------|
| **Product Category**         | **Commission Rate (Sale)**                               | **Who Pays**                            |
| **Electronics**              | 8%                                                       | Deducted from seller payout             |
| **Fashion & Apparel**        | 5%                                                       | Deducted from seller payout             |
| **Furniture & Home**         | 5%                                                       | Deducted from seller payout             |
| **Books & Stationery**       | 5%                                                       | Deducted from seller payout             |
| **Other / General**          | 5%                                                       | Deducted from seller payout             |
| **Rentals (all categories)** | 10% of rental fee (deposit itself is never commissioned) | Deducted from owner's rental fee payout |

Note: Commission rates are configurable by the admin panel and may be adjusted as the platform grows.

## 4.7 Dispute Management

|                                   |                                                                                                |              |
|-----------------------------------|------------------------------------------------------------------------------------------------|--------------|
| **Feature**                       | **Description**                                                                                | **Priority** |
| **Raise Dispute / Deposit Claim** | Buyer or owner submits reason + evidence within the applicable window                          | Must Have    |
| **Admin Review Dashboard**        | Admin views dispute/claim details, evidence, and communication history                         | Must Have    |
| **Resolution Decision**           | Admin selects 'Refund Buyer' / 'Release to Seller' or a deposit split, with a reason note      | Must Have    |
| **Auto-Release / Auto-Refund**    | System automatically releases funds or refunds deposit if no action is taken within the window | Must Have    |
| **Appeal Process**                | One-time appeal by the losing party reviewed by a senior admin                                 | Should Have  |

## 4.8 Trust Score System

Every user — buyer, seller, or renter — has a single Trust Score visible on their profile and next to their listings, giving the other party a fast, honest signal before they commit to a transaction.

|                             |                                                                                                                                                                                 |              |
|-----------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------|
| **Feature**                 | **Description**                                                                                                                                                                 | **Priority** |
| **Score Calculation**       | Weighted score (0–100) built from: % of transactions completed without dispute, dispute outcomes won vs. lost, on-time rental returns vs. late/damaged returns, and account age | Must Have    |
| **Score Display**           | Shown as a number and a simple tier badge (e.g. New / Reliable / Trusted / Top Rated) on profile and listings                                                                   | Must Have    |
| **Score Update Trigger**    | Recalculated automatically after every completed order, resolved dispute, or completed rental return                                                                            | Must Have    |
| **New User Baseline**       | New accounts start at a neutral 'Unrated' state rather than 0, to avoid unfairly penalizing first-time users                                                                    | Should Have  |
| **Score Transparency Page** | Public, plain-language explanation of exactly how the score is calculated                                                                                                       | Should Have  |
| **Anti-Gaming Safeguards**  | Repeated small transactions between the same two accounts are weighted down to prevent score farming                                                                            | Could Have   |

## 4.9 Privacy Policy & Data Protection

The platform is committed to handling all user data responsibly and transparently.

- Personal data (name, email, phone, address) is collected only for account operation and order fulfilment.

- Payment data is processed by a certified payment gateway; the platform does not store card details.

- User data is never sold to third parties.

- Users may request deletion of their account and associated data at any time.

- All data in transit is encrypted using HTTPS/TLS; data at rest is encrypted at the database level.

- A clear, plain-language Privacy Policy page is accessible from every page of the platform.

## 4.10 Seller / Owner Wallet & Payouts

|                         |                                                                                |              |
|-------------------------|--------------------------------------------------------------------------------|--------------|
| **Feature**             | **Description**                                                                | **Priority** |
| **Wallet**              | In-platform balance showing pending and available funds from sales and rentals | Must Have    |
| **Payout Request**      | Seller/owner can request withdrawal to their bank or mobile banking account    | Must Have    |
| **Payout Schedule**     | Withdrawals processed within 1–2 business days after release                   | Must Have    |
| **Transaction History** | Full ledger of earnings, commissions, deposits held/returned, and withdrawals  | Must Have    |

# 5. Non-Functional Requirements

|                    |                                                                 |
|--------------------|-----------------------------------------------------------------|
| **Requirement**    | **Standard**                                                    |
| **Performance**    | Page load under 2 seconds; payment processing under 5 seconds   |
| **Availability**   | 99.5% uptime target; maintenance windows scheduled off-peak     |
| **Security**       | HTTPS on all endpoints; encrypted passwords; session management |
| **Scalability**    | Architecture supports up to 10,000 concurrent users in Phase 1  |
| **Accessibility**  | WCAG 2.1 AA compliant UI components                             |
| **Mobile Support** | Responsive design; mobile-first approach                        |

# 6. Technology Overview

The platform is built with a lean, well-supported stack chosen for rapid development, a modern feel, and maintainability.

|                    |                                                        |                                                                                                            |
|--------------------|--------------------------------------------------------|------------------------------------------------------------------------------------------------------------|
| **Layer**          | **Technology**                                         | **Purpose**                                                                                                |
| **Frontend**       | React.js                                               | Modern, componentized user interface — listings, checkout, rental booking, Trust Score display, dashboards |
| **Backend**        | Flask (Python)                                         | API server — business logic, payment flow, escrow/rental logic, dispute handling, Trust Score calculation  |
| **Database**       | PostgreSQL / Supabase                                  | Relational data — users, listings, orders, rentals, disputes, transactions, trust score history            |
| **Authentication** | JWT Tokens + OTP                                       | Secure login and session management                                                                        |
| **Payments**       | Third-party Payment Gateway (e.g. SSLCommerz / Stripe) | PCI-compliant payment and deposit collection and refunds                                                   |
| **File Storage**   | Cloud Object Storage (e.g. AWS S3 / Supabase Storage)  | Product images and dispute/deposit-claim evidence files                                                    |
| **Deployment**     | Cloud VPS or managed hosting (e.g. Render / Vercel)    | Application and database hosting                                                                           |

Note: For showcase/demo builds under tight timelines, the team may implement a reduced version of this stack (e.g. server-rendered templates instead of a full React build) — see the team's internal Dev Contract for the exact build-day scope.

# 7. Out of Scope — Phase 1

- Native iOS and Android applications (planned for Phase 2).

- AI-powered product recommendation engine.

- In-app chat or messaging between buyer and seller before purchase (AI-powered chatbot integration).

- Advanced Trust Score anti-gaming machine learning models (rule-based scoring only in Phase 1).

- Multi-day tiered rental pricing (e.g. weekly discounts) — Phase 1 supports a flat daily/weekly rate only.

# 8. Risks & Mitigations

|                                                        |                |            |
|--------------------------------------------------------|----------------|------------|
| **Risk**                                               | **Likelihood** | **Impact** |
| **Fraudulent listings**                                | Medium         | High       |
| **Abusive dispute claims**                             | Medium         | High       |
| **Payment gateway downtime**                           | Low            | High       |
| **Data breach**                                        | Low            | Critical   |
| **Low initial adoption**                               | Medium         | Medium     |
| **Trust Score gaming (fake positive transactions)**    | Medium         | High       |
| **Renter damages item and disputes deposit deduction** | Medium         | Medium     |

Mitigations: seller verification, user reporting, and admin moderation for fraudulent listings; evidence requirements and per-buyer dispute-history tracking for abusive claims; fallback gateway and retry logic for downtime; encryption at rest/in transit and security audits for data breach risk; zero-commission launch incentive for adoption; anti-gaming safeguards (Section 4.8) and transaction-pattern monitoring for score gaming; mandatory photo evidence at both hand-over and return for rental deposit disputes.

# 9. Success Metrics

|                                         |                                  |
|-----------------------------------------|----------------------------------|
| **Metric**                              | **Target (Month 6)**             |
| **Registered Users**                    | 10,000+                          |
| **Active Listings**                     | 5,000+                           |
| **Completed Transactions**              | 2,000+                           |
| **Completed Rentals**                   | 500+                             |
| **Dispute Rate**                        | < 5%                            |
| **Deposit Claim Rate (Rentals)**        | < 8%                            |
| **Average Payout Time**                 | < 2 business days after release |
| **Platform Uptime**                     | > 95%                           |
| **Users with a Calculated Trust Score** | > 80%                           |
| **User Satisfaction Score**             | > 40                            |