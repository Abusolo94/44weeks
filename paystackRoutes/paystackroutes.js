   const express = require("express")
   const router = express.Router()
   const {addpaystack, checkSub, paystackSub} = require("../controllers/paystackController")


 router.get("/verify/:reference", addpaystack)
router.post("/subscribe", paystackSub )
router.get("/sub-status/:email", checkSub )

  module.exports = router