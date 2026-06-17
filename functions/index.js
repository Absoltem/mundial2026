const functions = require("firebase-functions");
const https = require("https");

exports.getFixtures = functions.https.onRequest((req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET");

  const path = req.query.path || "/fixtures?league=1&season=2026&status=FT";

  const options = {
    hostname: "v3.football.api-sports.io",
    path: path,
    headers: {
      "x-apisports-key": "a3b3cd05913011be66e7cc3936222472"
    }
  };

  https.get(options, (apiRes) => {
    let data = "";
    apiRes.on("data", chunk => data += chunk);
    apiRes.on("end", () => {
      res.set("Content-Type", "application/json");
      res.send(data);
    });
  }).on("error", (e) => {
    res.status(500).send(e.message);
  });
});
