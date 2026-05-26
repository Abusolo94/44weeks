 const express = require("express")
 const cors = require("cors")
 
 const paystackRouter = require("./paystackRoutes/paystackroutes")
 const emailRouter = require("./paystackRoutes/emailRoutes")


 const app = express();
 app.use(cors({ origin: '*' }));
 app.use("/11weeks/payment", express.json(),  paystackRouter)
 app.use("/44weeks/email", express.json(),  emailRouter)

 app.listen(4000, ()=> console.log("you app is running at 4000"))
 