 
require("dotenv").config();
const axios = require("axios");
const { db,  admin } = require("../firebaseAdmin");
 


const addpaystack = async (req, res) => {
  const { reference } = req.params;

  if (!reference) {
    return res.status(400).json({ error: "Missing reference" });
  }

  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const data = response.data.data;

    if (!data || data.status !== "success") {
      return res.json({
        success: false,
        message: "Payment not successful",
      });
    }

    const email = data.customer.email;

    // 🔥 Find user by email
    const userSnap = await db
      .collection("users")
      .where("email", "==", email)
      .get();

    if (userSnap.empty) {
      return res.status(404).json({ error: "User not found" });
    }

    const userDoc = userSnap.docs[0];
    const uid = userDoc.id;

    // ✅ Save subscription record
    await db.collection("subscriptions").doc(reference).set({
      email,
      reference: data.reference,
      status: "active",
      plan: data.plan || null,
      subscriptionCode: data.authorization?.authorization_code || null,
      createdAt: new Date(),
    });

    // ✅ VERY IMPORTANT → update user
    await db.collection("users").doc(uid).update({
      subscriptionStatus: "active",
      subscriptionPlan: data.plan || null,
      updatedAt: new Date(),
    });

    return res.json({
      success: true,
      message: "Subscription activated",
    });
  } catch (err) {
    console.error("VERIFY ERROR:", err.response?.data || err.message);

    return res.status(500).json({
      error: "Server error",
    });
  }
};



 const paystackSub = async (req, res) => {
  const { email, planCode } = req.body;

  if (!email || !planCode) {
    return res.status(400).json({ error: "Email and planCode are required" });
  }

  try {
    // ✅ Initialize Paystack transaction tied to a plan
    const init = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount: planCode *100,
        plan: planCode, // ✅ attach the plan directly
        callback_url: `${process.env.CLIENT_URL}/stackSuccess`,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.status(200).json({
      success: true,
      authorization_url: init.data.data.authorization_url,
    });
  } catch (err) {
    console.error(
      "❌ Paystack initialize error:",
      err.response?.data || err.message
    );
    res.status(400).json({
      success: false,
      error: err.response?.data || err.message,
    });
  }
};




// const checkSub = async (req, res) => {
//   try {
//     const { email } = req.params;
//     console.log("📨 Incoming sub-status check for:", email);

//     if (!email) {
//       return res.status(400).json({ error: "Email parameter missing" });
//     }

//     const decodedEmail = decodeURIComponent(email.toLowerCase());
//     console.log("🔍 Decoded email:", decodedEmail);

//     // =========================
//     // 🔹 Step 1: Check Firestore
//     // =========================
//     const userSnap = await db
//       .collection("users")
//       .where("email", "==", decodedEmail)
//       .limit(1)
//       .get();

//     let hasActiveSubscription = false;
//     if (!userSnap.empty) {
//       const userData = userSnap.docs[0].data();
//       const subscriptions = userData.subscriptions || [];
//       hasActiveSubscription = subscriptions.some(
//         (sub) => sub.status === "active"
//       );
//     }

//     // =========================
//     // 🔹 Step 2: Check Paystack Directly (if Firestore has none)
//     // =========================
//     if (!hasActiveSubscription) {
//       console.log("⚠️ No active Firestore sub — checking Paystack API...");
//       try {
//         const paystackRes = await axios.get(
//           `https://api.paystack.co/subscription`,
//           {
//             headers: {
//               Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
//             },
//           }
//         );

//         // Filter subscriptions belonging to this email
//         const subsForUser = paystackRes.data.data.filter(
//           (sub) =>
//             sub.customer &&
//             sub.customer.email &&
//             sub.customer.email.toLowerCase() === decodedEmail
//         );

//         // Check if any subscription is active
//         hasActiveSubscription = subsForUser.some(
//           (sub) => sub.status === "active"
//         );

//         console.log(
//           `💳 Paystack found ${subsForUser.length} subscriptions for ${decodedEmail}.`
//         );

//         // Optionally update Firestore if active sub found
//         if (hasActiveSubscription && !userSnap.empty) {
//           const userRef = userSnap.docs[0].ref;
//           await userRef.set(
//             {
//               subscriptions: subsForUser.map((s) => ({
//                 id: s.id,
//                 plan: s.plan,
//                 status: s.status,
//                 createdAt: s.createdAt,
//                 nextPaymentDate: s.next_payment_date,
//               })),
//             },
//             { merge: true }
//           );
//           console.log("✅ Firestore updated with Paystack subscription info.");
//         }
//       } catch (paystackErr) {
//         console.error("❌ Paystack fetch failed:", paystackErr.response?.data || paystackErr.message);
//       }
//     }

//     console.log("✅ Final subscription status:", hasActiveSubscription);
//     return res.json({ hasActiveSubscription });
//   } catch (err) {
//     console.error("❌ Error in /sub-status:", err.stack || err.message);
//     return res.status(500).json({
//       hasActiveSubscription: false,
//       error: err.message,
//     });
//   }
// };

const checkSub = async (req, res) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({ error: "Email missing" });
    }

    const decodedEmail = decodeURIComponent(email.toLowerCase());

    // =========================
    // 🔹 1. FIRESTORE CHECK
    // =========================
    const userSnap = await db
      .collection("users")
      .where("email", "==", decodedEmail)
      .limit(1)
      .get();

    let hasActiveSubscription = false;

    let userRef = null;

    if (!userSnap.empty) {
      const userData = userSnap.docs[0].data();
      userRef = userSnap.docs[0].ref;

      hasActiveSubscription =
        userData.subscriptionStatus === "active";
    }

    // =========================
    // 🔹 2. PAYSTACK CHECK (FIXED)
    // =========================
    if (!hasActiveSubscription) {
      try {
        // IMPORTANT: use customer-based verification endpoint
        const customersRes = await axios.get(
          `https://api.paystack.co/customer/${encodeURIComponent(decodedEmail)}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            },
          }
        );

        const customer = customersRes.data.data;

        if (customer?.subscriptions?.length > 0) {
          const activeSub = customer.subscriptions.find(
            (sub) => sub.status === "active"
          );

          if (activeSub) {
            hasActiveSubscription = true;

            // =========================
            // 🔹 3. SYNC FIRESTORE
            // =========================
            if (userRef) {
              await userRef.set(
                {
                  subscriptionStatus: "active",
                  subscription: {
                    id: activeSub.id,
                    plan: activeSub.plan,
                    status: activeSub.status,
                    nextPaymentDate: activeSub.next_payment_date,
                  },
                },
                { merge: true }
              );
            }
          }
        }
      } catch (err) {
        console.error(
          "❌ Paystack check failed:",
          err.response?.data || err.message
        );
      }
    }

    return res.json({ hasActiveSubscription });
  } catch (err) {
    console.error("❌ Subscription check error:", err.message);

    return res.status(500).json({
      hasActiveSubscription: false,
    });
  }
};


module.exports = {addpaystack, paystackSub, checkSub}