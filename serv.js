//////////////////////////////////////////////////////////////////////////////////

// global variable

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

//////////////////////////////////////////////////////////////////////////////////

// classes

const Card = function(init){
  this.card_type = init.card_type
  this.energy = (this.card_type === 'artifact')? 2: 1
  this.field = init.field
  this.name = init.name
  if(this.card_type === 'artifact') this.overheat = false
  this.owner = init.owner
  this.curr_own = init.owner
}

const Game = function(){
  this.default = {
    all_card    : {},
    // card type
    artifact_max: 5,//13,
    spell_max   : 3,//14,
    item_max    : 2,//12,
    vanish_max  : 4,//11
    // player attribute
    ad_base     : 1,
    ap_max      : 1,
    deck_max    : 14, // 50
    hand_max    : 7,
    life_max    : 6
  }
  this.pool = {}
  this.queue = []
  this.room = {}
}

Game.prototype.buildPlayer = function (client) {
  // attribute
  client.attack_damage = game.default.ad_base
  client.action_point = game.default.ap_max
  client.atk_enchant = []
  client.buff_action = []
  client.first_conceal = false

  client.deck_slot = {}
  client.deck_max = game.default.deck_max
  client.hand_max = game.default.hand_max
  client.life_max = game.default.life_max

  client.card_ammount = {altar: 0, battle: 0, deck: 0, grave: 0, hand: 0, life: 0}
  client.curr_deck = []
}

/*
param = {
  personal: {
    id:
  }
}

rlt = {
  id: {

  },

}
*/
// personal >> who own this card currently
Game.prototype.cardMove = function (personal, opponent, rlt) {
  let player = {personal: personal, opponent: opponent}
  let param = {personal: {}, opponent: {}}

  console.log(personal._pid, ' ', opponent._pid)

  for (let id in rlt) {
    let card = game.room[personal._rid].cards[id]

    // owner and attribute adjust, rlt[id].new_own set here when the card will be into grave
    rlt[id].curr_own = 'personal'
    if(!rlt[id].new_own) rlt[id].new_own = (card.owner === personal._pid)? 'personal' : 'opponent'
    if(!rlt[id].to) rlt[id].to = 'grave'
    rlt[id].name = (rlt[id].cover)? 'cardback' : card.name

    // move card
    rlt[id].from = card.field
    personal.card_ammount[rlt[id].from] -= 1
    card.field = rlt.to
    player[rlt[id].new_own].card_ammount[rlt[id].to] += 1
    card.curr_own = player[rlt[id].new_own]._pid

    // build return object
    param.personal[id] = {}
    Object.assign(param.personal[id], rlt[id])

    param.opponent[id] = {}
    rlt[id].curr_own = (rlt[id].curr_own === 'personal')? 'opponent' : 'personal'
    rlt[id].new_own = (rlt[id].new_own === 'personal')? 'opponent' : 'personal'
    Object.assign(param.opponent[id], rlt[id])
  }
  return param
}

Game.prototype.checkCardEnergy = function () {

}

Game.prototype.idGenerate = function (length) {
  let id = ""
  let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  for(let i = 0; i < length; i++ )
    id += possible.charAt(Math.floor(Math.random() * possible.length))
  return id
}

Game.prototype.shuffle = function (card_list) {
  let i = 0, j = 0, temp = null
  for(i = card_list.length-1; i > 0; i -= 1){
    j = Math.floor(Math.random()*(i + 1))
    temp = card_list[i]
    card_list[i] = card_list[j]
    card_list[j] = temp
  }
  return card_list
}

/////////////////////////////////////////////////////////////////////////////////

// socket server

io.on('connection', client => {

  // init settings
  MongoClient.connect(opt.url, (err, _db) => {
    if(err) throw err
    app.db = _db
    app.db.collection('card').find({}).toArray((err, cards) => {
      for(let name in cards)
        game.default.all_card[cards[name].name] = cards[name]
    })
  })

  client.on('preload', (cb) => {
    cb(app.file.preload)
  })

  client.on('disconnect', () => {
    let rid = client._rid
    let pid = client._pid

    // if client is still in pool
    if(game.pool[pid]) return delete game.pool[pid]

    // if client already waiting for match
    for(let i in game.queue)
      if(game.queue[i]._pid === pid) return game.queue.splice(i,1)

    // if client is in a match
    if(client._rid){
      game.room[rid].player.map(it => {
        if (it._pid !== client._fid) return

        game.buildPlayer(it)
        game.pool[client._fid] = it
        delete it._rid
        it.emit('interrupt', {err: 'opponent disconnect'})
      })

      delete game.room[rid]
      return
    }
  })

  // once open web page
  client.on('init', cb => {
    game.buildPlayer(client)
    console.log('player built')
    cb({})
  })

  client.on('leaveMatch', cb => {
    let rid = client._rid
    let pid = client._pid
    let fid = client._fid

    game.room[rid].player.map(it => {
      if(it._pid === fid)
        it.emit('interrupt', {err: 'opponent leave'})

      game.buildPlayer(it)
      game.pool[it._pid] = it
      delete it._rid
    })

    delete game.room[rid]
  })

  // personal interface
  client.on('login', (it, cb) => {
    let user = app.db.collection('user')
    let pid = game.idGenerate(16)
    client._pid = pid
    game.pool[pid] = client

    user.find({account: it.acc}).toArray((err, rlt) => {
      if(!rlt.length) return cb({err: 'no such user exists'})
      if(!rlt[0].passwd === it.passwd) return cb({err: 'wrong password'})

      client._account = it.acc
      client.deck_slot = rlt[0].deck_slot
      //console.log(client.deck_slot)
      cb({deck_slot: client.deck_slot})
    })
  })

  client.on('randomDeck', (it, cb) => {
    console.log(`${client._account} build new deck_${it.slot}`)
    let newDeck = game.randomDeck()
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

  client.on('searchMatch', (it, cb) => {
    let user = app.db.collection('user')
    let cards = app.db.collection('card')
    let deck = []

    if(!it.curr_deck) return cb({err: 'please choose a deck'})

    user.find({account: client._account}).toArray((err, rlt) => {

      // build deck
      deck = game.shuffle(rlt[0].deck_slot[it.curr_deck].card_list)
      for(let card_name of deck){
        let curr_card = game.default.all_card[card_name]
        let init = {
          name: curr_card.name,
          card_type: curr_card.type.base,
          field: 'deck',
          owner: client._pid
        }
        client.curr_deck.push(new Card(init))
        client.card_ammount.deck += 1
      }


      // find opponent
      if(game.queue.length != 0){
        let rid = game.idGenerate(16)
        let opponent = game.queue.shift()
        opponent._rid = rid
        opponent._fid = client._pid  // fid = foe id
        client._rid = rid
        client._fid = opponent._pid

        game.room[rid] = {atk_phase: false, counter: 0, player: [opponent, client], cards: {}, card_id: 1}
        game.room[rid].player[0].emit('joinGame', {msg: 'joining match...'})
        cb({msg: 'joining match...'})

        // build all cards, life and deck
        let life = {}
        let player = game.room[rid].player
        life[opponent._pid] = {personal: [], opponent: []}
        life[client._pid] = {personal: [], opponent: []}

        for (let curr in player) {
          for (let [index, card] of player[curr].curr_deck.entries()) {
            let id = `card_${game.room[rid].card_id}`
            game.room[rid].cards[id] = card
            if(index < player[curr].life_max){
              card.field = 'life'
              life[player[curr]._pid].personal.push({id: id, name: card.name})
              life[player[1 - curr]._pid].opponent.push({id: id})
              player[curr].card_ammount.deck -= 1
              player[curr].card_ammount.life += 1
            }
            game.room[rid].card_id ++
          }
        }

        opponent.emit('buildLife', life[opponent._pid])
        client.emit('buildLife', life[client._pid])

        // game start
        game.room[rid].player[0].emit('gameStart', { msg: 'your turn' })
        game.room[rid].player[1].emit('gameStart', { msg: 'waiting for opponent' })
      }
      else{
        game.queue.push(client)
        delete game.pool[client._pid]
        cb({msg: 'searching for match...'})
      }
    })
  })

  client.on('signUp', (it, cb) => {
    let user = app.db.collection('user')
    user.find({account: it.acc}).toArray((err, rlt) => {
      if(rlt.length) return cb({err: 'user name exists'})
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
        if(err) throw err
        console.log('player ' + signup.account + ' added')
        client._account = signup.account
        cb({})
      })
    })
  })

  // in game

  // battle
  client.on('attack', cb => {
    let rid = client._rid
    let curr = game.room[rid].counter
    if (game.room[rid].atk_phase == true) return cb( { err: 'not allowed in atk phase'} )
    if (game.room[rid].player[curr]._pid !== client._pid) return cb( {err: 'waiting for opponent'} )
    if (client.action_point <= 0) return cb( {err: 'not enough action point'} )
    if (client.card_ammount.battle == 0) return cb( {err: 'no artifact to attack'} )

    game.room[rid].atk_phase = true
    client.action_point -= 1
    cb({})
    game.room[rid].player[1-curr].first_conceal = true
    game.room[rid].player[1-curr].emit('foeAttack')
  })

  client.on('conceal', (it, cb) => {
    console.log(it)
    let rid = client._rid
    let curr = game.room[rid].counter
    let card_pick = Object.keys(it.card_pick)

    if(client.first_conceal){
      if (card_pick.length != 1) return cb( {err: 'choose exact 1 card'} )
      if ('vanish' !== game.room[rid].cards[card_pick[0]].name) return cb( {err: 'please choose vanish'} )
      client.first_conceal = false
    }
    else{
      if (card_pick.length != 2) return cb( {err: 'choose exact 2 cards'} )
      if ('vanish' !== client.cards[card_pick[(0||1)]].name) return cb( {err: 'please choose vanish'} )
    }

    let rlt = game.cardMove(client, game.room[rid].player[curr], it.card_pick)
    cb(rlt.personal)
    game.room[rid].player[curr].emit(`foeConceal`, rlt.opponent)
  })

  client.on('tracking', (it, cb) => {
    let rid = client._rid
    let curr = game.room[rid].counter
    let card_pick = Object.keys(it.card_pick)
    if (card_pick.length != 2) return cb( {err: 'choose exact 2 cards'} )
    if ('vanish' !== game.room[rid].cards[card_pick[(0||1)]].name) return cb( {err: 'please choose vanish'} )

    let rlt = game.cardMove(client, game.room[rid].player[1 - curr], it.card_pick)
    cb(rlt.personal)
    game.room[rid].player[1 - curr].emit(`foeTracking`, rlt.opponent)
  })

  client.on('giveUp', cb => {
    let rid = client._rid
    let curr = game.room[rid].counter
    let action = (client._pid === game.room[rid].player[curr]._pid)?'tracking':'conceal'
    let target = game.room[rid].player[(action === 'tracking')?(1-curr):curr]
    if (game.room[rid]) {
      game.room[rid].atk_phase = false
      cb({action: `${action}`})
      target.emit('foeGiveUp', {action: action})
    }
  })

  // neutral
  client.on('drawCard', cb => {
    let rid = client._rid
    let curr = game.room[rid].counter
    if (game.room[rid].atk_phase == true) return cb( { err: 'not allowed in atk phase'} )
    if (game.room[rid].player[curr]._pid !== client._pid) return cb( {err: 'waiting for opponent' } )
    if (client.action_point <= 0) return cb( {err: 'not enough action point'} )
    if (client.card_ammount.hand == client.hand_max) return cb( {err: 'your hand is full'} )

    client.action_point -= 1

    for(let id in game.room[rid].cards){
      let card = game.room[rid].cards[id]
      if (card.field !== 'deck' || card.curr_own !== client._pid) continue

      let param = { id: id, name: card.name }
      card.field = 'hand'
      client.card_ammount.hand += 1
      client.card_ammount.deck -= 1
      if (client.card_ammount.deck == 0) param.deck_empty = true

      cb(param)
      delete param.name
      game.room[rid].player[1 - curr].emit('foeDrawCard', param)

      return
    }
  })

  client.on('endTurn', cb => {
    let rid = client._rid
    let curr = game.room[rid].counter
    if (game.room[rid].atk_phase == true) return cb({ err: 'not allowed in atk phase'})
    if (game.room[rid].player[curr]._pid !== client._pid) return cb({err: 'waiting for opponent'})

    //checkCardEnergy

    game.room[rid].counter = 1 - curr
    curr = game.room[rid].counter
    client.action_point = 1
    cb({ msg: 'waiting for opponent' })
    game.room[rid].player[curr].emit('turnStart', { msg: 'your turn' })
  })

  client.on('playHandCard', (it, cb) => {
    let rid = client._rid
    let curr = game.room[rid].counter
    let card = game.room[rid].cards[it.id]

    if (game.room[rid].atk_phase == true) return cb( { err: 'atk phase'} )
    if (game.room[rid].player[curr]._pid !== client._pid) return cb( {err: 'waiting for opponent' } )
    if (card.card_type === 'vanish') return cb( {err: 'only available in atk phase'} )
    if (client.action_point <= 0 && card.card_type !== 'item') return cb( {err: 'not enough action point'} )

    let param = {}
    param[it.id] = {}

    // field adjust
    switch (game.default.all_card[card.name].type.base) {
      case 'artifact':
        client.action_point -= 1
        param[it.id].to = 'battle'
        param[it.id].action = 'equip'
        break

      case 'item'		 :
        param[it.id].to = 'grave'
        param[it.id].action = 'use'
        break

      case 'spell'   :
        client.action_point -= 1
        param[it.id].to = 'grave'
        param[it.id].action = 'cast'
        break

      default        : break
    }

    let rlt = game.cardMove(client, game.room[rid].player[1 - curr], param)
    cb(rlt.personal)
    game.room[rid].player[1 - curr].emit('foePlayHand', rlt.opponent)
  })

})
/////////////////////////////////////////////////////////////////////////////////

// server init

const game = new Game()

server.listen(opt.serv_port, function(){
  console.log(`listen on port ${opt.serv_port}`)
})


