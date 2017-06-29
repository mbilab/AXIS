const MongoClient = require('mongodb').MongoClient
const async = require('async')

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
  fileName : './json/card.json',
  settings : './settings.json'
}

const settings = JSON.parse(fs.readFileSync(opt.settings, 'utf8'))
const url = 'mongodb://' + settings.mongo.account + ':' + settings.mongo.passwd + '@localhost/' + settings.mongo.dbname

const game = {
  pool: {},
  queue: [],
  room: {},
  allCard: {},
  db: null
}


const pool = {}
const pending = []
const room = {}
const allCard = {}
var db

const Card = function(name, cardType, effectType){
  this.name = name
  this.cardType = cardType
  this.effectType = effectType
  this.energy = 1
  this.trigger = false
  this.cover = true
}

function buildPlayer(player){ // player = client

  player.actionPoint = 1
  player.handMax = 7
  player.deckMax = 10
  player.lifeMax = 6
  player.deckList = {}
  player.ownCard = []
  player.DECK = []
  player.HAND = []
  player.LIFE = []
  player.GRAVE = []
  player.BATTLE = []

  console.log('player built')
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
  // init settings
  MongoClient.connect(url, (err, _db) => {
    game.db = _db
    game.db.collection('card').find({}).toArray((err, rlt) => {
      for(let i = 0; i < rlt.length; i++)
        game.allCard[rlt[i].name] = rlt[i]

     // console.log(allCard)
    })
  })

  // player open this website
  client.on('init', (cb) => {
    buildPlayer(client)
    cb({msg: 'success'})
  })

  // player login
  client.on('login', (it, cb) => {
    var user = game.db.collection('user')
    var pid = idGenerate(16)
    client._pid = pid
    game.pool[pid] = client

    user.find({account: it.acc}).toArray((err, result) => {
      if(result.length != 0){
        if(result[0].passwd === it.passwd){
          cb({msg: 'success'})
          client._account = it.acc
          client.deckList = result[0].decks
        }
        else
          cb({msg: 'wrong password'})
      }
      else{
        cb({msg: 'no such user'})

        /*
        let signup = {
          account: it.acc,
          passwd: it.passwd,
          deck: {
            deck1: ['katana','katana','katana','katana','katana','katana','katana','katana','katana','katana']
          }
        }

        user.insert(signup, (err, result) => {
          if(!err){
            console.log('player ' + signup.account + ' added')
            client._account = signup.account
            cb({msg:'success'})
          }
        })
        */
      }
    })
  })

  // player need to get data when changing page
  client.on('changePage', (it, cb) => {
    if(it.page === 'matchSearch' || it.page === 'deckBuild'){
      cb(client.deckList)
    }

  })


  // player waiting for match
  client.on('search', cb => {
    var user = game.db.collection('user')
    var cards = game.db.collection('card')
    var deck = []

    user.find({account: client._account}).toArray((err, result) => {
      deck = result[0].decks['deck1'] // change

      for(let i = 0; i < deck.length; i++){
        curr = game.allCard[deck[i]]
        client.DECK.push(new Card(curr.name, curr.type.base, curr.type.effect))
      }

      shuffle(client.DECK)

      if(game.queue.length != 0){
        var rid = idGenerate(16)
        var opponent = game.queue.shift()
        opponent._rid = rid
        opponent._fid = client._pid  // fid = foe id
        client._rid = rid
        client._fid = opponent._pid

        game.room[rid] = {counter: 0, player: [opponent, client]}
        game.room[rid].player[0].emit('joinGame', {msg: 'joining section...'})
        cb({msg: 'joining section...'})

        // game start

        // build life field
        buildLife(game.room[rid].player[0])
        game.room[rid].player[0].emit('buildLIFE', JSON.stringify(game.room[rid].player[0].LIFE))
        game.room[rid].player[1].emit('foeBuiltLife', null)

        buildLife(game.room[rid].player[1])
        game.room[rid].player[1].emit('buildLIFE', JSON.stringify(game.room[rid].player[1].LIFE))
        game.room[rid].player[0].emit('foeBuiltLife', null)

        game.room[rid].player[0].emit('gameStart', { msg: 'your turn' })
        game.room[rid].player[1].emit('gameStart', { msg: 'waiting for opponent' })
      }
      else{
        var pid = client._pid
        game.queue.push(client)
        delete game.pool.pid
        cb({msg: 'searching for match...'})
      }
    })
  })

  // game turn finished
  client.on('finish', (cb) => {
    var rid = client._rid
    var curr = game.room[rid].counter

    if(game.room[rid]){
      if(game.room[rid].player[curr]._pid === client._pid) {
        client.actionPoint = 1

        game.room[rid].counter = 1-curr
        curr = game.room[rid].counter

        cb({ msg: 'waiting for opponent' })
        game.room[rid].player[curr].emit('turnStart', {msg: 'your turn'})
      }
      else
        cb({msg: 'waiting for opponent'})
    }
  })

  // player draw card
  client.on('drawCard', (cb) => {
    var rid = client._rid
    var curr = game.room[rid].counter
    if (game.room[rid]) {
      if (game.room[rid].player[curr]._pid === client._pid) {
        if(client.actionPoint > 0){
          var cardName = drawCard(client)
          var result

          if(cardName !== "full"){
            if(client.DECK.length == 0)
              result = "empty"

            cb({ cardName: cardName, deckStatus: result})
               game.room[rid].player[1-curr].emit('foeDrawCard', {deckStatus: result})
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
  client.on('playHandCard', (msg, cb) => {
    var rid = client._rid
    var curr = game.room[rid].counter

    if(game.room[rid]){
      if(game.room[rid].player[curr]._pid === client._pid){
        var msg = JSON.parse(msg)
        var result = playHandCard(client, msg.name)
        if(result === 'done' ){
          cb({ msg: 'playCard' })
          game.room[rid].player[1-curr].emit('foePlayHand', {cardName: msg.name})
        }
        else
          cb({ msg: result})
      }
      else
        cb({ msg: 'waiting for opponent'})
    }
  })

  // play uncoverred card in life field
  client.on('playLifeCard', (msg, cb) => {
    var rid = client._rid
    var curr = game.room[rid].counter
    if(game.room[rid]){
      if(game.room[rid].player[curr]._pid === client._pid){
        var msg = JSON.parse(msg)
        var result = playLifeCard(client, msg.name, msg.hand)
        if(result === 'done'){
          cb({msg: 'playCard'})
          game.room[game.roomID].player[1-curr].emit('foePlayLife', {lifeCardName: msg.name, handCardName: msg.hand})
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

    game.room[rid].player.map(it => {
      if(it._pid === fid)
        it.emit('interrupt', {msg: 'opponent leave'})

      buildPlayer(it)
      game.pool[it._pid] = it
      delete it._rid
    })

    delete game.room[rid]
  })

  // player disconnect
  client.on('disconnect', (it)=>{

    var rid = client._rid
    var pid = client._pid

    if(game.pool[pid]){   // if client is still in pool
      delete game.pool[pid]
    }

    for(var i = 0; i < game.queue.length; i++){ // if client already waiting for match
      if(game.queue[i]._pid === pid){
        game.queue.splice(i,1)
        break
      }
    }

    if(client._rid){  // if client is in a match
      game.room[rid].player.map(it => {
        if (it._pid !== client._fid) return

        buildPlayer(it)
        game.pool[client._fid] = it
        delete it._rid
        it.emit('interrupt', {msg: 'opponent disconnect'})
      })

      delete game.room[rid]
    }

  })

})

server.listen(port, function(){
	console.log('listen on port '+port)
})
