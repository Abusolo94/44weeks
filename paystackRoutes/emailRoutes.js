  const express = require("express")
   const router = express.Router()
   const {sendmail, sendToadmin,} = require("../controllers/sendMailController")

    router.post("/sendEmail", sendmail  )
    router.post("/sendEmailadmin", sendToadmin  )
   

   module.exports = router 