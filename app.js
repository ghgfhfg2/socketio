const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

app.get("/", (req, res) => {
  res.send("Hello World!!!");
});

const server = app.listen(process.env.PORT || "3000", () => {
  console.log("server listening on port %s", server.address().port);
});
