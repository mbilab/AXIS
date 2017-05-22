const MongoClient = require('mongodb').MongoClient
const assert = require('assert')
const url = 'mongodb://axis:abvesa2014@localhost/axis' // mongodb://[account]:[passwd]@localhost/[dbname]

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

const pool = {}
const pending = []
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
  console.log('player deck built')
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
      player.HAND[player.HAND.length - 1].cover = false
    }
    else{
      cardName = "full"
    }
  }

  return cardName
}

function playHandCard(player, cardName){
  for(var i = 0; i < player.HAND.length; i++){
    if(player.HAND[i].name === cardName){
      if(player.HAND[i].cardType === 'item' || (player.HAND[i].cardType !== 'item' && player.HAND[i].cardType !== 'vanish' && player.actionPoint > 0)){
        player.actionPoint -= 1
        player.BATTLE.push(player.HAND[i])
        player.HAND.splice(i,1)
        return 'done'
        break
      }
      else{
        return 'not enough action point'
        break
      }
    }
  }
}

function playLifeCard(player, lifeCardName, handCardName){
  // search life
  for(var i = 0; i < player.LIFE.length; i++){
    if(player.LIFE[i].name === lifeCardName && player.LIFE[i].cover == false){
      if( player.LIFE[i].cardType === 'item' || (player.LIFE[i].cardType !== 'item' && player.LIFE[i].cardType !== 'vanish' && player.actionPoint)){
        // search hand
        for(var j = 0; j < player.HAND.length; j++){
          if(player.HAND[i].name === handCardName){
            // switch both cards
            player.actionPoint -= 1
            player.BATTLE.push(player.LIFE[i])
            player.LIFE.splice(i, 1, player.HAND[j])
            player.HAND.splice(j, 1)
            return 'done'
            break
          }
        }
      }
      else{
        return 'not enough action point'
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

function idGenerate(length){
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for( var i=0; i < length; i++ )
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

io.on('connection', client => {

  // player login
  client.on('login', it => {
    var pid = idGenerate(16)
    client._pid = pid
    pool[pid] = client
    //console.log(typeof(pool[pid]))
  })

  // player waiting for match
  client.on('search', cb => {
    if(pending.length != 0){
      var rid = idGenerate(16)
      var opponent = pending.shift()
      opponent._rid = rid
      opponent._fid = client._pid  // fid = foe id
      client._rid = rid
      client._fid = opponent._pid

      room[rid] = {counter: 0, player: [opponent, client]}
      room[rid].player[0].emit('joinGame', {msg: 'joining section...'})
      cb({msg: 'joining section...'})

      // game start
      // build life field

      buildLife(room[rid].player[0])
      room[rid].player[0].emit('buildLIFE', JSON.stringify(room[rid].player[0].LIFE))
      room[rid].player[1].emit('foeBuiltLife', null)

      buildLife(room[rid].player[1])
      room[rid].player[1].emit('buildLIFE', JSON.stringify(room[rid].player[1].LIFE))
      room[rid].player[0].emit('foeBuiltLife', null)

      room[rid].player[0].emit('gameStart', { msg: 'your turn' })
      room[rid].player[1].emit('gameStart', { msg: 'waiting for opponent' })
    }
    else{
      var pid = client._pid
      pending.push(client)
      delete pool.pid
      cb({msg: 'searching for match...'})
    }
  })

  // player open this website
  client.on('init', (cb) => {

    buildPlayer(client)

    cb({msg: 'success'})
    /*
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
    */
  })

  // turn finished
  client.on('finish', (roomID, cb) => {
    /*
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
    */
    var rid = client._rid
    var curr = room[rid].counter
    if(room[rid]){
      if(room[rid].player[curr]._pid === client._pid) {
        client.actionPoint = 1

        room[rid].counter = 1-curr
        curr = room[rid].counter

        cb({ msg: 'waiting for opponent' })
        room[rid].player[curr].emit('turnStart', {msg: 'your turn'})
      }
      else
        cb({msg: 'waiting for opponent'})
    }
  })

  // draw card
  client.on('drawCard', (roomID, cb) => {
    /*
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
    */
    var rid = client._rid
    var curr = room[rid].counter
    if (room[rid]) {
      if (room[rid].player[curr]._pid === client._pid) {
        if(client.actionPoint > 0){
          var cardName = drawCard(client)
          var result

          if(cardName !== "full"){
            if(client.DECK.length == 0)
              result = "empty"

            cb({ cardName: cardName, deckStatus: result})
               room[rid].player[1-curr].emit('foeDrawCard', {deckStatus: result})
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

  // play card in your hand
  client.on('playHandCard', (roomID, msg, cb) => {
    /*
    if(room[roomID]){
      if(room[roomID].cursor === client._name){
        var msg = JSON.parse(msg)
        var result = playHandCard(client, msg.name)
        if(result === 'done' ){
          cb({ msg: 'playCard' })

          if(client._name === "player_1")
            room[roomID].player_2.emit('foePlayHand', {cardName: msg.name})
          else
            room[roomID].player_1.emit('foePlayHand', {cardName: msg.name})
        }
        else
          cb({ msg: result})
      }
      else
        cb({ msg: 'waiting for opponent'})
    }
    */
    var rid = client._rid
    var curr = room[rid].counter
    if(room[rid]){
      if(room[rid].player[curr]._pid === client._pid){
        var msg = JSON.parse(msg)
        var result = playHandCard(client, msg.name)
        if(result === 'done' ){
          cb({ msg: 'playCard' })
          room[rid].player[1-curr].emit('foePlayHand', {cardName: msg.name})
        }
        else
          cb({ msg: result})
      }
      else
        cb({ msg: 'waiting for opponent'})
    }
  })

  // play uncoverred card in life field
  client.on('playLifeCard', (roomID, msg, cb) => {
    /*
    if(room[roomID]){
      if(room[roomID].cursor === client._name){
        var msg = JSON.parse(msg)
        var result = playLifeCard(client, msg.name, msg.hand)
        if(result === 'done'){
          cb({msg: 'playCard'})

          if(client._name === "player_1")
            room[roomID].player_2.emit('foePlayLife', {lifeCardName: msg.name, handCardName: msg.hand})
          else
            room[roomID].player_1.emit('foePlayLife', {lifeCardName: msg.name, handCardName: msg.hand})
        }
        else
          cb({msg: result})
      }
      else
        cb({msg: 'waiting for opponent'})
    }
    */
    var rid = client._rid
    var curr = room[rid].counter
    if(room[rid]){
      if(room[rid].player[curr]._pid === client._pid){
        var msg = JSON.parse(msg)
        var result = playLifeCard(client, msg.name, msg.hand)
        if(result === 'done'){
          cb({msg: 'playCard'})
          room[roomID].player[1-curr].emit('foePlayLife', {lifeCardName: msg.name, handCardName: msg.hand})
        }
        else
          cb({msg: result})
      }
      else
        cb({msg: 'waiting for opponent'})
    }
  })

  client.on('leaveMatch', it => {
    var rid = client._rid
    var pid = client._pid
    var fid = client._fid

    room[rid].player.map(it => {
      if(it._pid === fid)
        it.emit('interrupt', {msg: 'opponent leave'})

      buildPlayer(it)
      pool[it._pid] = it
      delete it._rid
    })

    delete room[rid]
  })

  // player disconnect
  client.on('disconnect', (it)=>{

    var rid = client._rid
    var pid = client._pid

    if(pool[pid]){   // if client is still in pool
      delete pool[pid]
    }

    for(var i = 0; i < pending.length; i++){ // if client already waiting for match
      if(pending[i]._pid === pid){
        pending.splice(i,1)
        break
      }
    }

    if(client._rid){  // if client is in a match
      room[rid].player.map(it => {
        if (it._pid !== client._fid) return

        buildPlayer(it)
        pool[client._fid] = it
        delete it._rid
        it.emit('interrupt', {msg: 'opponent disconnect'})
      })

      delete room[rid]
    }

  })

})

server.listen(port, function(){
	console.log('listen on port '+port)
})
