//global variables (default values)

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

const opt = {
  mongo: JSON.parse(fs.readFileSync('./option.json', 'utf-8')).mongo,
  serv_port: 1350
}
opt.url = `mongodb://${opt.mongo.account}:${opt.mongo.passwd}@localhost/${opt.mongo.dbname}`

const app = {
  db: null,
  file: {
    preload: JSON.parse(fs.readFileSync('./app/assets/data/preload.json', 'utf-8'))
  }
}

//////////////////////////////////////////////////////////////////////////////////////

// classes

const Card = function(name, card_type, effect_type){
  this.card_type = card_type
  this.cover = true
  this.effect_type = effect_type
  this.energy = (card_type === 'artifact')? 2: 1
  this.name = name
  this.overheat = false
  this.owner = null
  this.trigger = false
}

const Game = function(){
  this.default = {
    all_card    : {},
    // card type
    artifact_max: 5,//13,
    spell_max   : 3,//14,
    item_max    : 2,//12,
    vanish_max  : 11,
    // player attribute
    ap_max       : 1,
    deck_max     : 10, // 50
    hand_max     : 7,
    life_max     : 6
  }
  this.err = {
    deck_null: 'choose a deck',
    dscnt   : 'opponent disconnect',
    foe_turn : 'waiting for opponent',
    hand_full: 'your hand is full',
    leave   : 'opponent leave',
    no_ap    : 'not enough action point',
    pswd_err : 'wrong password',
    usr_err  : 'no such user',
    usr_exist: 'user name already exists'
  }
  this.msg = {
    foe_turn : 'waiting for opponent',
    join    : 'joining section...',
    search  : 'searching for match...',
    self_turn: 'your turn'
  }
  this.pool = {}
  this.queue = []
  this.room = {}
}

Game.prototype.activateCard = function(player, card_name){
  for(let i in player.BATTLE){
    let card = player.BATTLE[i]
    if(card.name === card_name){
      switch(card.effect_type){
        case 'charge':
          if(card.energy == 0) return 'not enough energy'
          card.energy -= 1
          break

        case 'trigger':
          if(card.card_type === 'artifact')

          if(card.card_type === 'spell')

          break

        case 'normal':
          break

        case 'permanent':
          break

        default:
          break
      }
    }
  }
}

Game.prototype.battleFieldArrange = function (personal, opponent) {
  // personal >> target client running this function
  let player = {
    personal: personal,
    opponent: opponent
  }
  let card_arrange = {
    personal: {},
    opponent: {}
  }

  for(let name in player){
    for(let i in player[name].BATTLE){
      let card = player[name].BATTLE[i]
      if(card.type === 'artifact'){
        card.overheat = false
        if(card.energy == 0){
          card_arrange[name][card.name] = (card.owner === personal._pid)?'peronsal':'opponent'
          player[name].GRAVE.push(player[name].BATTLE.splice(i, 1))
        }
      }
    }
  }

  return card_arrange
}

Game.prototype.buildLife = function(player){
  for(let i = 0; i < player.life_max; i++){
    player.LIFE.push(player.DECK.pop())
  }
}

Game.prototype.buildPlayer = function(player){ // player = client
  // attribute
  player.action_point = this.default.ap_max
  player.deck_slot = {}
  player.deck_max = this.default.deck_max
  player.hand_max = this.default.hand_max
  player.life_max = this.default.life_max
  player.own_card = []
  // game fields
  player.DECK = []
  player.HAND = []
  player.LIFE = []
  player.GRAVE = []
  player.BATTLE = []

  console.log('player built')
}

Game.prototype.drawCard = function(player){
  let card_name
  if(player.DECK.length > 0 ){
    if(player.HAND.length < 7){
      player.action_point -= 1
      card_name = player.DECK[player.DECK.length - 1].name
      player.HAND.push(player.DECK.pop())
      player.HAND[player.HAND.length - 1].cover = false
    }
    else
      card_name = this.err.hand_full
  }
  return card_name
}

Game.prototype.effectTrigger = function () {

}

Game.prototype.idGenerate = function(length){
  let text = ""
  let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"

  for(let i = 0; i < length; i++ )
    text += possible.charAt(Math.floor(Math.random() * possible.length))

  return text
}

Game.prototype.playHandCard = function(player, opponent, card_name){
  // !--
  for(let i in player.HAND){
    if(player.HAND[i].name === card_name){
      let target = (player.HAND[i].owner === player._pid)? (player): (opponent)
      let owner = (target == player)?('personal'):('opponent')

      switch(player.HAND[i].card_type){
        case 'artifact':
          if(player.action_point > 0){
            player.action_point -= 1
            player.BATTLE.push(player.HAND.splice(i,1))
            return {action: 'equipArtifact', owner: 'personal'}
          }
          else
            return {err: this.err.no_ap}

          break

        case 'item':
          if(player.HAND[i].effect_type === 'normal'){
            target.GRAVE.push(player.HAND.splice(i,1))
            return {action: 'useNormalItem', owner: owner}
          }
          break

        case 'spell':
          if(player.action_point > 0){
            player.action_point -= 1
            if(player.HAND[i].effect_type === 'instant'){
              target.GRAVE.push(player.HAND.splice(i,1))
              return {action: 'castInstantSpell', owner: owner}
            }
          }
          else
            return {err: this.err.no_ap}

          break

        case 'vanish':
          return {err: this.err.no_ap}
          break

        default: break
      }
    }
  }
}

Game.prototype.randomDeck = function(){
  // !--

  let card = {
    artifact: [],
    spell: [],
    item: []//,
    //vanish: []
  }
  let deck = []

  for(let card_name in game.default.all_card){
    for(let type in card)
      if(game.default.all_card[card_name].type.base === type){
        card[type].push(card_name)
        break
      }
  }

  for(let type in card){
    //if(type !== 'vanish'){
      let random = (this.shuffle(card[type])).slice(0, game.default[`${type}_max`])
      deck = deck.concat(random)
    //}
    //else
      //for(let i = 0; i < game.default[`${type}Max`]; i++)
        //deck.push(card.vanish[0])
  }

  return deck
}

Game.prototype.shuffle = function(array){
  let i = 0, j = 0, temp = null

  for(i = array.length-1; i > 0; i -= 1){
    j = Math.floor(Math.random()*(i + 1))
    temp = array[i]
    array[i] = array[j]
    array[j] = temp
  }

  return array
}

//////////////////////////////////////////////////////////////////////////////////////

// socket server

io.on('connection', client => {
  // init settings
  MongoClient.connect(opt.url, (err, _db) => {
    if(err) throw err
    app.db = _db
    app.db.collection('card').find({}).toArray((err, rlt) => {
      for(let i in rlt)
        game.default.all_card[rlt[i].name] = rlt[i]

      //console.log(game.default.all_card)
    })
  })

  client.on('activateCard', (it, cb) => {
    let rid = client._rid
    let curr = game.room[rid].counter

    if(game.room[rid]){
      if(game.room[rid].player[curr]._pid === client._pid){
        let result = game.activateCard(client, it.name)
      }
      else
        cb({ err: game.err.foe_turn})
    }
  })

  client.on('buildNewDeck', (it, cb) => {
    // !--
    console.log(`build new deck_${it.slot}`)
    let newDeck = game.randomDeck()

    // mongodb update
    let user = app.db.collection('user')
    user.find({account: client._account}).toArray((err, rlt) => {
       let deck = rlt[0].deck_slot
       deck[it.slot].card_list = newDeck
       let change = {$set: {deck_slot: deck}}
      user.update({account: client._account}, change, (err, res) => {
        if(err) throw err
        cb({newDeck: newDeck})
      })
    })
  })

  // player disconnect
  client.on('disconnect', (it)=>{
    let rid = client._rid
    let pid = client._pid

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

        game.buildPlayer(it)
        game.pool[client._fid] = it
        delete it._rid
        it.emit('interrupt', {err: game.err.dscnt})
      })

      delete game.room[rid]
    }

  })

  // player draw card
  client.on('drawCard', (cb) => {
    let rid = client._rid
    let curr = game.room[rid].counter
    if (game.room[rid]) {
      if (game.room[rid].player[curr]._pid === client._pid) {
        if(client.action_point > 0){
          let card_name = game.drawCard(client)
          let deck_empty

          if(card_name !== game.err.hand_full){
            if(client.DECK.length == 0)
              deck_empty = true

            cb({card_name: card_name, deck_empty: deck_empty})
            game.room[rid].player[1-curr].emit('foeDrawCard', {deck_empty: deck_empty})
          }
          else
            cb({err: game.err.hand_full})
        }
        else
          cb({err: game.err.no_ap})
      }
      else
        cb({err: game.err.foe_turn })
    }
  })

  // game turn finished
  client.on('finish', (cb) => {
    let rid = client._rid
    let curr = game.room[rid].counter

    if(game.room[rid]){
      if(game.room[rid].player[curr]._pid === client._pid) {
        let card_arrange = game.battleFieldArrange(client, game.room[rid].player[1-curr])

        client.action_point = 1

        game.room[rid].counter = 1 - curr
        curr = game.room[rid].counter

        cb({ msg: game.msg.foe_turn, card_list: card_arrange })
        game.room[rid].player[curr].emit('turnStart', { msg: game.msg.self_turn, card_list: card_arrange })
      }
      else
        cb({msg: game.msg.foe_turn})
    }
  })

  // player open this website
  client.on('init', (cb) => {
    game.buildPlayer(client)
    cb({})
  })

  // opponent leave match
  client.on('leaveMatch', it => {
    let rid = client._rid
    let pid = client._pid
    let fid = client._fid

    game.room[rid].player.map(it => {
      if(it._pid === fid)
        it.emit('interrupt', {err: game.err.leave})

      game.buildPlayer(it)
      game.pool[it._pid] = it
      delete it._rid
    })

    delete game.room[rid]
  })

  // player login
  client.on('login', (it, cb) => {
    let user = app.db.collection('user')
    let pid = game.idGenerate(16)
    client._pid = pid
    game.pool[pid] = client

    //!--
    user.find({account: it.acc}).toArray((err, rlt) => {
      if(rlt.length){
        if(rlt[0].passwd === it.passwd){
          client._account = it.acc
          client.deck_slot = rlt[0].deck_slot
          cb({deck_slot: client.deck_slot})
        }
        else
          cb({err: game.err.pswd_err})
      }
      else{
        cb({err: game.err.usr_err})

      }
    })
  })

  // play card in your hand
  client.on('playHandCard', (it, cb) => {
    let rid = client._rid
    let curr = game.room[rid].counter

    // !--
    if(game.room[rid]){
      if(game.room[rid].player[curr]._pid === client._pid){
        let result = game.playHandCard(client, game.room[rid].player[1-curr], it.name)

        if(result.err) return cb({err: result.err})

        cb(result)
        result.card_name = it.name
        game.room[rid].player[1-curr].emit('foePlayHand', result)
      }
      else
        cb({err: game.err.foe_turn})
    }
  })

  // play uncoverred card in life field
  client.on('playLifeCard', (msg, cb) => {

  })

  client.on('preload', (cb) => {
    cb(app.file.preload)
  })

  // player waiting for match
  client.on('search', (it,cb) => {
    let user = app.db.collection('user')
    let cards = app.db.collection('card')
    let deck = []

    if(!it.curr_deck) return cb({err: game.err.deck_null})

    user.find({account: client._account}).toArray((err, rlt) => {
      deck = rlt[0].deck_slot[it.curr_deck].card_list
      for(let card_name in deck){
        let curr_card = game.default.all_card[deck[card_name]]
        client.DECK.push(new Card(curr_card.name, curr_card.type.base, curr_card.type.effect))
        client.DECK[client.DECK.length - 1].owner = client._pid
      }

      game.shuffle(client.DECK)

      if(game.queue.length != 0){
        let rid = game.idGenerate(16)
        let opponent = game.queue.shift()
        opponent._rid = rid
        opponent._fid = client._pid  // fid = foe id
        client._rid = rid
        client._fid = opponent._pid

        game.room[rid] = {counter: 0, player: [opponent, client]}
        game.room[rid].player[0].emit('joinGame', {msg: game.msg.join})
        cb({msg: game.msg.join})

        // game start

        // build life field
        game.buildLife(game.room[rid].player[0])
        game.room[rid].player[0].emit('buildLIFE', JSON.stringify(game.room[rid].player[0].LIFE))
        game.room[rid].player[1].emit('foeBuiltLife', null)

        game.buildLife(game.room[rid].player[1])
        game.room[rid].player[1].emit('buildLIFE', JSON.stringify(game.room[rid].player[1].LIFE))
        game.room[rid].player[0].emit('foeBuiltLife', null)

        game.room[rid].player[0].emit('gameStart', { msg: game.msg.self_turn })
        game.room[rid].player[1].emit('gameStart', { msg: game.msg.foe_turn })
      }
      else{
        let pid = client._pid
        game.queue.push(client)
        delete game.pool.pid
        cb({msg: game.msg.search})
      }
    })
  })

  client.on('signup',(it,cb) => { //it.acc .pswd
    // !--
    let user = app.db.collection('user')
    user.find({account: it.acc}).toArray((err, rlt) => {
      if(rlt.length) return cb({err: game.err.usr_exist})
      let signup = {
        account: it.acc,
        passwd: it.passwd,
        deck_slot: {
          slot_1: {name: 'deck_1', card_list: []},
          slot_2: {name: 'deck_2', card_list: []},
          slot_3: {name: 'deck_3', card_list: []}
        }
      }
      user.insert(signup, (err, result) => {
        if(!err){
          console.log('player ' + signup.account + ' added')
          client._account = signup.account
          cb({})
        }
      })
    })
  })


})

//////////////////////////////////////////////////////////////////////////////////////

// server initialization

const game = new Game()

server.listen(opt.serv_port, function(){
	console.log('listen on port '+ opt.serv_port)
})
