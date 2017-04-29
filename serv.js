const express = require('express')
const fs = require('fs')
const http = require('http')
const socket = require('socket.io')
const path = require('path')

const app = express()
const server = http.createServer(app)
const io = socket(server)
const port = 1350

app.use(express.static(path.join(__dirname, 'app')))

const opt = {
  fileName : './json/card.json'
}

const allCard = JSON.parse(fs.readFileSync(opt.fileName, 'utf8'))

const Card = function(name, cardType, effectType){
  this.name = name
  this.cardType = cardType
  this.effectType = effectType
  this.energy = 1
  this.trigger = false
  this.cover = true
}


const room = {}

function buildPlayer(player){ // player = client
  var index = []

  player.actionPoint = 1
  player.handMax = 7
  player.deckMax = 10
  player.lifeMax = 6
  player.DECK = []
  player.HAND = []
  player.LIFE = []
  player.GRAVE = []
  player.BATTLE = []

  for(var i = 0; i < allCard.cardData.length; i++){
    index.push(i)
  }

  shuffle(index)

  // build player deck
  for(var i = 0; i < player.deckMax; i++){
    player.DECK.push(new Card(allCard.cardData[index[i]].name, allCard.cardData[index[i]].cardType, allCard.cardData[index[i]].effectType))
  }
  console.log(player._name + ' deck built')
}

function buildLife(player){
  for(var i = 0; i < player.lifeMax; i++){
    player.LIFE.push(player.DECK.pop())
  }
}

function drawCard(player){
  var cardName
  if(player.DECK.length > 0 ){
    if(player.HAND.length < 7){
      player.actionPoint -= 1
      cardName = player.DECK[player.DECK.length - 1].name
      player.HAND.push(player.DECK.pop())
    }
    else{
      cardName = "full"
    }
  }

  return cardName
}

function playCard(player, cardName){
  for(var i = 0; i < player.HAND.length; i++){
    if(player.HAND[i].name === cardName){
      if(player.HAND[i].cardType === 'item' || player.HAND.cardType !== 'item' && player.HAND.cardType !== 'vanish' && player.actionPoint > 0){
        player.actionPoint -= 1
        player.BATTLE.push(player.HAND[i])
        player.HAND.splice(i,1)
        return 'done'
        break
      }
      else{
        return 'error'
        break
      }
    }
  }
}

function shuffle(array){
  var i = 0, j = 0, temp = null

  for(i = array.length-1; i > 0; i -= 1){
    j = Math.floor(Math.random()*(i + 1))
    temp = array[i]
    array[i] = array[j]
    array[j] = temp
  }
}

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

      buildPlayer(client)

      cb({msg: 'player1'})
    }
    else { // player 2 login
      client._name = 'player_2'
      client._next = 'player_1'
      room[it.roomID].player_2 = client

      buildPlayer(client)
      cb({msg: 'player2'})

      // game start
      // build life field

      buildLife(room[it.roomID].player_1)
      room[it.roomID].player_1.emit('buildLIFE', JSON.stringify(room[it.roomID].player_1.LIFE))
      room[it.roomID].player_2.emit('foeBuiltLife', null)

      buildLife(room[it.roomID].player_2)
      room[it.roomID].player_2.emit('buildLIFE', JSON.stringify(room[it.roomID].player_2.LIFE))
      room[it.roomID].player_1.emit('foeBuiltLife', null)

      room[it.roomID].player_1.emit('gameStart', { msg: 'your turn' })
      room[it.roomID].player_2.emit('gameStart', { msg: 'waiting for opponent' })
    }
  })

  // turn finished
  client.on('finish', (roomID, cb) => {
    if (room[roomID]) {
      if (room[roomID].cursor === client._name) {
        client.actionPoint = 1
        room[roomID].cursor = room[roomID][room[roomID].cursor]._next
        cb({ msg: 'waiting for opponent' })

        if(room[roomID].cursor === 'player_1')
          room[roomID].player_1.emit('turnStart', { msg: 'your turn'})
        else
          room[roomID].player_2.emit('turnStart', { msg: 'your turn'})
      }
      else {
        //cb({ msg: `waiting for ${room[roomID].cursor}...` })
        cb({msg: 'waiting for opponent'})
      }
    }
  })

  // draw card
  client.on('drawCard', (roomID, cb) => {
    if (room[roomID]) {
      if (room[roomID].cursor === client._name) {
        if(client.actionPoint > 0){
          var cardName = drawCard(client)
          var result

          if(cardName !== "full"){
            if(client.DECK.length == 0)
              result = "empty"

            cb({ cardName: cardName, deckStatus: result})

            if(client._name === "player_1")
              room[roomID].player_2.emit('foeDrawCard', {deckStatus: result})
            else
              room[roomID].player_1.emit('foeDrawCard', {deckStatus: result})
          }
          else
            cb({msg: "your hand is full"})
        }
        else
          cb({ msg: "not enough action point"})
      }
      else
        cb({ msg: 'waiting for opponent' })

    }
  })

  // play card
  client.on('playCard', (roomID, msg, cb) => {
    if(room[roomID]){
      if(room[roomID].cursor === client._name){
        var msg = JSON.parse(msg)
        var result = playCard(client, msg.name)
        if(result !== 'error' ){
          cb({ msg: 'playCard' })

          if(client._name === "player_1")
            room[roomID].player_2.emit('foePlayCard', {cardName: msg.name})
          else
            room[roomID].player_1.emit('foePlayCard', {cardName: msg.name})
        }
        else
          cb({ msg: 'not enough action point'})
      }
      else
        cb({ msg: 'waiting for opponent'})
    }
  })

  // player disconnect
  client.on('disconnect', (it)=>{

  })

})

server.listen(port, function(){
	console.log('listen on port '+port)
})

