// global variables (default values)

const async = require('async')
const express = require('express')
const fs = require('fs')
const http = require('http')
const MongoClient = require('mongodb').MongoClient
const path = require('path')
const socket = require('socket.io')

const apps = express()
const server = http.createServer(apps)
const io = socket(server)

apps.use(express.static(path.join(__dirname, 'app')))

// system define or belongs to system
const opt = {
  db: null,
  mongo: JSON.parse(fs.readFileSync('./option.json', 'utf-8')).mongo,
  servPort: 1350
}

// self define
const app = {
  err: {
    dscnt   : 'opponent disconnect',
    foeTurn : 'waiting for opponent',
    handFull: 'your hand is full',
    leave   : 'opponent leave',
    noAP    : 'not enough action point',
    pswdErr : 'wrong password',
    usrErr  : 'no such user'
  },
  file: {
    preload: JSON.parse(fs.readFileSync('./app/assets/data/preload.json', 'utf-8'))
  },
  msg: {
    foeTurn : 'waiting for opponent',
    join    : 'joining section...',
    search  : 'searching for match...',
    selfTurn: 'your turn'
  },
  rule: {
    allCard: {},
    apMax  : 1,
    deckMax: 10,
    handMax: 7,
    lifeMax: 6
  }
}

// mongo login acc pwd
const url = `mongodb://${opt.mongo.account}:${opt.mongo.passwd}@localhost/${opt.mongo.dbname}`

// dynamic
const game = {
  pool: {},
  queue: [],
  room: {},
}

//////////////////////////////////////////////////////////////////////////////////////

// classes

const Card = function(name, cardType, effectType){
  this.cardType = cardType
  this.cover = true
  this.effectType = effectType
  this.energy = 1
  this.name = name
  this.trigger = false
}

//////////////////////////////////////////////////////////////////////////////////////

// utility

function buildLife(player){
  for(let i = 0; i < player.lifeMax; i++){
    player.LIFE.push(player.DECK.pop())
  }
}

function buildPlayer(player){ // player = client
  // attribute
  player.actionPoint = app.rule.apMax
  player.deckList = {}
  player.deckMax = app.rule.deckMax
  player.handMax = app.rule.handMax
  player.lifeMax = app.rule.lifeMax
  player.ownCard = []

  // game fields
  player.DECK = []
  player.HAND = []
  player.LIFE = []
  player.GRAVE = []
  player.BATTLE = []

  console.log('player built')
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
    else
      cardName = app.err.handFull
  }

  return cardName
}

function idGenerate(length){
  var text = ""
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"

  for( let i = 0; i < length; i++ )
    text += possible.charAt(Math.floor(Math.random() * possible.length))

  return text
}

function playHandCard(player, cardName){
  for(let i in player.HAND){
    if(player.HAND[i].name === cardName){
      if(player.HAND[i].cardType === 'item' || (player.HAND[i].cardType !== 'item' && player.HAND[i].cardType !== 'vanish' && player.actionPoint > 0)){
        player.actionPoint -= 1
        player.BATTLE.push(player.HAND[i])
        player.HAND.splice(i,1)
        //return opt.done
        return true
        break
      }
      else{
        return app.err.noAP
        break
      }
    }
  }
}

function playLifeCard(player, lifeCardName, handCardName){
  // search life
  for(let i in player.LIFE){
    if(player.LIFE[i].name === lifeCardName && player.LIFE[i].cover == false){
      if( player.LIFE[i].cardType === 'item' || (player.LIFE[i].cardType !== 'item' && player.LIFE[i].cardType !== 'vanish' && player.actionPoint)){
        // search hand
        for(let j in player.HAND){
          if(player.HAND[i].name === handCardName){
            // switch both cards
            player.actionPoint -= 1
            player.BATTLE.push(player.LIFE[i])
            player.LIFE.splice(i, 1, player.HAND[j])
            player.HAND.splice(j, 1)
            return true
            break
          }
        }
      }
      else{
        return app.err.noAP
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

//////////////////////////////////////////////////////////////////////////////////////

// socket server

io.on('connection', client => {
  // init settings
  MongoClient.connect(url, (err, _db) => {
    opt.db = _db
    opt.db.collection('card').find({}).toArray((err, rlt) => {
      for(let i in rlt)
        app.rule.allCard[rlt[i].name] = rlt[i]

     // console.log(allCard)
    })
  })

  // player disconnect
  client.on('disconnect', (it)=>{

    var rid = client._rid
    var pid = client._pid

    if(game.pool[pid]){   // if client is still in pool
      delete game.pool[pid]
    }

    for(let i in game.queue){ // if client already waiting for match
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
        it.emit('interrupt', {err: app.err.dscnt})
      })

      delete game.room[rid]
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

          if(cardName !== app.err.handFull){
            if(client.DECK.length == 0)
              result = "empty"

            cb({ cardName: cardName, deckStatus: result})
               game.room[rid].player[1-curr].emit('foeDrawCard', {deckStatus: result})
          }
          else
            cb({err: app.err.handFull})
        }
        else
          cb({err: app.err.noAP})
      }
      else
        cb({err: app.err.foeTurn })
    }
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

        cb({ msg: app.msg.foeTurn })
        game.room[rid].player[curr].emit('turnStart', {msg: app.msg.selfTurn})
      }
      else
        cb({msg: app.msg.forTurn})
    }
  })

  // player open this website
  client.on('init', (cb) => {
    buildPlayer(client)
    cb()
  })

  // opponent leave match
  client.on('leaveMatch', it => {
    var rid = client._rid
    var pid = client._pid
    var fid = client._fid

    game.room[rid].player.map(it => {
      if(it._pid === fid)
        it.emit('interrupt', {err: app.err.leave})

      buildPlayer(it)
      game.pool[it._pid] = it
      delete it._rid
    })

    delete game.room[rid]
  })

  // player login
  client.on('login', (it, cb) => {
    var user = opt.db.collection('user')
    var pid = idGenerate(16)
    client._pid = pid
    game.pool[pid] = client

    user.find({account: it.acc}).toArray((err, result) => {
      if(result.length != 0){
        if(result[0].passwd === it.passwd){
          //cb({msg: opt.done, deckList: result[0].decks})
          cb({deckList: result[0].decks})
          client._account = it.acc
          client.deckList = result[0].decks
        }
        else
          //cb({msg: opt.pswdErr})
          cb({err: app.err.pswdErr})
      }
      else{
        //cb({msg: opt.usrErr})
        cb({err: app.err.usrErr})

        /*
        let signup = {
          account: it.acc,
          passwd: it.passwd,
          decks: {
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

  // play card in your hand
  client.on('playHandCard', (it, cb) => {
    var rid = client._rid
    var curr = game.room[rid].counter

    if(game.room[rid]){
      if(game.room[rid].player[curr]._pid === client._pid){
        var result = playHandCard(client, it.name)
        if(result == true){
          //cb({ msg: opt.done })
          cb({})
          game.room[rid].player[1-curr].emit('foePlayHand', {cardName: it.name})
        }
        else
          cb({ err: result})
      }
      else
        cb({ err: app.err.foeTurn})
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
        if(result == true){
          cb({msg: opt.done})
          game.room[game.roomID].player[1-curr].emit('foePlayLife', {lifeCardName: msg.name, handCardName: msg.hand})
        }
        else
          cb({msg: result})
      }
      else
        cb({msg: opt.foeTurn})
    }
  })

  client.on('preload', (cb) => {
    cb(app.file.preload)
  })

  // player waiting for match
  client.on('search', cb => {
    var user = opt.db.collection('user')
    var cards = opt.db.collection('card')
    var deck = []

    user.find({account: client._account}).toArray((err, result) => {
      deck = result[0].decks['deck1'] // change

      for(let i in deck){
        curr = app.rule.allCard[deck[i]]
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
        game.room[rid].player[0].emit('joinGame', {msg: app.msg.join})
        cb({msg: app.msg.join})

        // game start

        // build life field
        buildLife(game.room[rid].player[0])
        game.room[rid].player[0].emit('buildLIFE', JSON.stringify(game.room[rid].player[0].LIFE))
        game.room[rid].player[1].emit('foeBuiltLife', null)

        buildLife(game.room[rid].player[1])
        game.room[rid].player[1].emit('buildLIFE', JSON.stringify(game.room[rid].player[1].LIFE))
        game.room[rid].player[0].emit('foeBuiltLife', null)

        game.room[rid].player[0].emit('gameStart', { msg: app.msg.selfTurn })
        game.room[rid].player[1].emit('gameStart', { msg: app.msg.foeTurn })
      }
      else{
        var pid = client._pid
        game.queue.push(client)
        delete game.pool.pid
        cb({msg: app.msg.search})
      }
    })
  })

  client.on('updDeckList', (it, cb) => {
    // mongodb update
    let user = opt.db.collection('user')
    let change = {$set: {decks: it} }
    user.update({account: client._name}, change, (err, res) => {
      if(err) throw err
      cb()
    })
  })

})

//////////////////////////////////////////////////////////////////////////////////////

// server initialization

server.listen(opt.servPort, function(){
	console.log('listen on port '+ opt.servPort)
})
