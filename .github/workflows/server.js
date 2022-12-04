const express = require('express');

const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');


const app = express();

// Connect to mongodb
// Connection URL

const url = "mongodb://localhost:27017/" ;

// Database Name
const dbName = 'Newdata';

// Use connect method to connect to the server
MongoClient.connect(url, function(err, client) {
    if (err) throw err;
    var dbo = client.db("Newdata");
    var myobj = { name: "Company Inc3", address: "Highway 37" };
    dbo.collection("TestColl").insertOne(myobj, function(err, res) {
      if (err) throw err;
      console.log("1 document inserted");

  client.close();
});
});


const port = 5000;

app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});