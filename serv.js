const express = require('express')
const http = require('http')
const socket = require('socket.io')
const path = require('path')

const app = express()
const server = http.createServer(app)
const io = socket(server)
const port = 1350

app.use(express.static(path.join(__dirname, 'app')))

const fs = require('fs');
const fileName = './deckData.json';
var deckData = JSON.parse(fs.readFileSync(fileName, 'utf8'));

var player1 = {
  handMax:  7,
  deckMax:  10,
  lifeMax: 6,

  DECK: [],
  HAND: [],
  LIFE: [],
  GRAVE: [],
  BATTLE: []
};

var player2 = {
  handMax:  7,
  deckMax:  10,
  lifeMax: 6,

  DECK: [],
  HAND: [],
  LIFE: [],
  GRAVE: [],
  BATTLE: []
};

var Card = function(name, cardType, effectType){
  this.name = name;
  this.cardType = cardType;
  this.effectType = effectType;
  this.energy = 1;
  this.trigger = false;
  this.cover = true;
}

const room = {}

io.on('connection', client => {

  // player login


  client.on('login', (it, cb) => {
    if (!room[it.roomID]) { // player 1 login
      client._name = 'player_1'
      client._next = 'player_2'
      room[it.roomID] = {
        player_1: client,
        cursor: 'player_1'
      }

      // build player1 deck
      for(var i = 0; i < player1.deckMax; i++){
        player1.DECK.push(new Card(deckData.player_1[i].name, deckData.player_1[i].cardType, deckData.player_1[i].effectType));
        console.log(i);

      }
      cb({msg: 'player1'})
    }
    else { // player 2 login
      client._name = 'player_2'
      client._next = 'player_1'
      room[it.roomID].player_2 = client

      // build player2 deck
      for(var i = 0; i < player2.deckMax; i++){
        player2.DECK.push(new Card(deckData.player_2[i].name, deckData.player_2[i].cardType, deckData.player_2[i].effectType));
        console.log(i);
      }
      cb({msg: 'player2'})

      // game start
      // build life field
      for(var i = 0; i < player1.lifeMax; i++){
        player1.LIFE.push(player1.DECK.pop());
        player2.LIFE.push(player2.DECK.pop());
        room[it.roomID].player_1.emit('buildLIFE', {yourCard: player1.LIFE[i].name, foeCard: player2.LIFE[i].name});
        room[it.roomID].player_2.emit('buildLIFE', {yourCard: player2.LIFE[i].name, foeCard: player1.LIFE[i].name});
      }

      room[it.roomID].player_1.emit('gameStart', { msg: 'your turn' })
      room[it.roomID].player_2.emit('gameStart', { msg: 'waiting for player_1' })
    }
  })

  // turn finished

  client.on('finish', (roomID, cb) => {
    if (room[roomID]) {
      if (room[roomID].cursor === client._name) {
        room[roomID].cursor = room[roomID][room[roomID].cursor]._next
        cb({ msg: 'current player changed' })
      }
      else {
        cb({ msg: `waiting for ${room[roomID].cursor}...` })
      }
    }
  })


  client.on('drawCard', (roomID, action, cb) => {
    if (room[roomID]) {
      if (room[roomID].cursor === client._name) {
        if(client._name === "player_1"){
          player1.HAND.push(player1.DECK.pop());
          var cardName = player1.HAND[player1.HAND.length - 1].name;
          cb({ yourCard: cardName });
          room[roomID].player_2.emit('foeDrawCard', {foeCard: cardName});
        }
        else{
          player2.HAND.push(player2.DECK.pop());
          var cardName = player2.HAND[player2.HAND.length - 1].name;
          cb({ yourCard: cardName });
          room[roomID].player_1.emit('foeDrawCard', {foeCard: cardName});
        }

      }
      else {
        cb({ yourCard: 'foeTurn' })
      }
    }
  })

})

server.listen(port, function(){
	console.log('listen on port '+port)
})

