var express = require('express');
var mysql = require('mysql');
var async = require('async');
var bodyParser = require('body-parser');
var config = require('./config').production;
const fs = require('fs');

var app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var server = app.listen(8081, function () {
   var host = server.address().address;
   var port = server.address().port;
   console.log("Example app listening at http://%s:%s", host, port);
});

app.get('/api/v1/creatures', function (req, res) {
    var con = mysql.createConnection({
        host: config.database.host,
        user: config.database.user,
        password: config.database.password,
        database: config.database.db
    });
    
    con.query(
        "SELECT c.moniker, c.name, c.crossoverPointMutations, c.pointMutations, c.gender, c.genus, c.birthEventType, c.birthdate, " +
        "   c.parent1Moniker, p1.name AS parent1Name, c.parent2Moniker, p2.name AS parent2Name, " +
        "   c.birthWorldName, c.birthWorldId " +
        "FROM Creatures AS c " + 
        "LEFT JOIN Creatures AS p1 " + 
        "ON c.parent1Moniker = p1.moniker " + 
        "LEFT JOIN Creatures AS p2 " +
        "ON c.parent2Moniker = p2.moniker ",
        [req.params.moniker],
        function(err, result, fields){
           if (err) throw err;
           res.setHeader('Access-Control-Allow-Origin', '*');
           res.write("[");
           async.forEachOf(result, (creature, i, callback) => {
               con.query(
                "SELECT relation.child AS moniker, creature.name AS name " +
                "FROM ParentToChild AS relation " + 
                "LEFT JOIN Creatures AS creature " +
                "ON relation.child = creature.moniker " + 
                "WHERE relation.parent = ?",
                [creature.moniker],
                function(err, result, fields){
                    if (err) throw err;
                    if (i !== 0){
                       res.write(",");
                    }
                    creature.children = result;
                    res.write(JSON.stringify(creature));
                    callback();
                });
               
           }, err => {
               if (err) throw err;
               res.end("]");
           });
           
        });
});

app.get('/api/v1/creatures/:moniker', function (req, res) {
    
    var con = mysql.createConnection({
        host: config.database.host,
        user: config.database.user,
        password: config.database.password,
        database: config.database.db
    });
    
    con.query(
        "SELECT c.moniker, c.name, c.crossoverPointMutations, c.pointMutations, c.gender, c.genus, c.birthEventType, c.birthdate, " +
        "   c.parent1Moniker, p1.name AS parent1Name, c.parent2Moniker, p2.name AS parent2Name, " +
        "   c.birthWorldName, c.birthWorldId " +
        "FROM Creatures AS c " + 
        "LEFT JOIN Creatures AS p1 " + 
        "ON c.parent1Moniker = p1.moniker " + 
        "LEFT JOIN Creatures AS p2 " +
        "ON c.parent2Moniker = p2.moniker " +
        "WHERE c.moniker = ?",
        [req.params.moniker],
        function(err, results, fields){
            if (err) throw err;
            var creature = results[0];
            con.query(
                "SELECT relation.child AS moniker, creature.name AS name " +
                "FROM ParentToChild AS relation " + 
                "LEFT JOIN Creatures AS creature " + 
                "ON relation.child = creature.moniker " + 
                "WHERE relation.parent = ?",
                [creature.moniker],
                function(err, childrenResult, fields){
                   if (err) throw err;
                   creature.children = childrenResult;
                   res.setHeader('Access-Control-Allow-Origin', '*');
                   res.end(JSON.stringify(creature));
                });
        });
});

app.put('/api/v1/creatures/:moniker', function (req, res) {
    var moniker = req.params.moniker;
    var creature = req.body;
    var birthEvent = creature.events[0];
    
    var events = creature.events
    .map( (event) => {return [
               moniker,
               event.histEventType,
               event.lifeStage,
               event.photo,
               event.moniker1,
               event.moniker2,
               event.timeUtc,
               event.tickAge,
               event.worldTick,
               event.worldName,
               event.worldId,
               event.userText
    ];});
    
    var children = creature.events
    .filter((event) => { return event.histEventType === 8 || event.histEventType === 9; })
    .map((event) => { return [
        moniker,
        event.moniker1
    ];});
    
    
    var con = mysql.createConnection({
      host: config.database.host,
      user: config.database.user,
      password: config.database.password,
      database: config.database.db
    });
    
    con.connect(function(err) {
        if (err) throw err;
        con.query(
            "INSERT INTO Creatures " +
            "(moniker, name, crossoverPointMutations, pointMutations, gender, genus, birthEventType, birthdate, parent1Moniker, parent2Moniker, birthWorldName, birthWorldId) " +
            "VALUES ? ",
            [[[
                moniker,
                creature.name,
                creature.crossoverPointMutations,
                creature.pointMutations,
                creature.gender,
                creature.genus,
                birthEvent.histEventType,
                birthEvent.timeUtc,
                birthEvent.moniker1,
                birthEvent.moniker2,
                birthEvent.worldName,
                birthEvent.worldId
                ]]],
            function (err, result) {
            if (err) throw err;
            con.query(
                "INSERT INTO Events " +
                "(moniker, histEventType, lifeStage, photo, moniker1, moniker2, timeUtc, tickAge, worldTick, worldName, worldId, userText) " +
                "VALUES ? ",
                [events],
                function (err, result) {
                if (err) throw err;
                if (children.length > 0){
                    con.query(
                        "INSERT INTO ParentToChild " +
                        "(parent, child) " +
                        "VALUES ? ",
                        [children],
                        function (err, result) {
                        if (err) throw err;
                    });
                }
            });
        });
    });
    
    res.end("");
});

app.get('/api/v1/creatures/:moniker/events', function (req, res) {
    
    var con = mysql.createConnection({
        host: config.database.host,
        user: config.database.user,
        password: config.database.password,
        database: config.database.db
    });
    
    con.query(
        "SELECT * " +
        "FROM Events " + 
        "WHERE Events.moniker = ?",
        [req.params.moniker],
        function(err, result, fields){
           if (err) throw err;
           res.setHeader('Access-Control-Allow-Origin', '*');
           res.end(JSON.stringify(result));
        });
});

