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
  //-! this = JSON.parse(JSON.stringify(init))
  this.name = init.name
  this.type = init.type
  this.energy = (this.type.base === 'artifact')? 2: 1
  if(this.type.base === 'artifact') this.overheat = false
  this.field = init.field
  this.cover = true
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
    atk_damage  : 1,
    atk_phase   : 1,
    action_point: 1,
    deck_max    : 14, // 50
    hand_max    : 7,
    life_max    : 6
  }
  this.phase_rule = {
    // normal action
    draw   : {},
    use    : {
      choose: {attack: true, effect: true}, // hand
      normal: {normal: true, choose: true}
    },
    trigger: {attack: true, effect: true}, // battle, altar
    // specific action
    life   : {attack: true, effect: true}, // life
    grave  : {effect: true},
    deck   : {effect: true}
  }
  this.choose_eff = {
    bleed   : true,
    block   : true, // card you use to block
    control : true,
    drain   : true,
    discard : true,
    damage  : true,
    heal    : true,
    receive : true, // card you flip for life loss
    retrieve: true,
    steal   : true
  }
  this.pool = {}
  this.queue = []
  this.room = {}
}

/////////////////////////////////////////////////////////////////////////////////
// !-- build objects
Game.prototype.buildPlayer = function (client) {
  // basic
  client.hp = this.default.life_max
  client.atk_damage = game.default.atk_damage
  client.atk_phase = game.default.atk_phase
  client.action_point = game.default.action_point
  client.deck_max = game.default.deck_max
  client.hand_max = game.default.hand_max
  client.life_max = game.default.life_max
  client.card_ammount = {altar: 0, battle: 0, deck: 0, grave: 0, hand: 0, life: 0}

  // effect
  client.atk_enchant = [] // card_ids
  client.aura = [] // card_ids
  client.eff_queue = {} // { id_1 : {eff_1: ..., eff_2: ...} ... }
  client.dmg_blk = 0 // effect damage only

  // choose
  client.card_pause = {} // card needs another card to effect

  // vanish
  client.first_conceal = false

  // decks
  client.deck_slot = {}
  client.curr_deck = []
}

/////////////////////////////////////////////////////////////////////////////////
// !-- card adjusting

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
    rlt[id].name = (rlt[id].cover)? 'cardback' : card.name
    if (!rlt[id].new_own) rlt[id].new_own = (card.owner === personal._pid)? 'personal' : 'opponent'
    if (!rlt[id].to) rlt[id].to = 'grave'
    if (rlt[id].to === 'grave' || rlt[id].to === 'hand') {
      if(card.type.base === 'artifact') {
        card.overheat = false
        card.energy = 2
      }
      else
        card.energy = 1
    }

    // move card
    rlt[id].from = card.field
    personal.card_ammount[rlt[id].from] -= 1
    card.field = rlt[id].to
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

/////////////////////////////////////////////////////////////////////////////////
// !-- changing phase
Game.prototype.attackEnd = function (room) {
  room.phase = 'normal'
  room.atk_status.hit = false
  room.atk_status.attacker = null
  room.atk_status.defender = null
  for (let pid in room.player) {
    let rlt = (pid == room.curr_ply) ? 'your turn' : 'opponent turn'
    room.player[pid].emit('phaseShift', {msg: {phase: 'normal phase', action: rlt}})
  }
}

Game.prototype.effectEnd = function (room) {
  if (room.phase === 'attack') {
    if (room.atk_status.hit) {
      room.atk_status.defender.eff_queue.attack = {damage: true}
      room.atk_status.defender.emit('effectLoop', {rlt: {name: 'attack', id: 'attack', eff: 'damage'}})
    }
    else this.attackEnd(room)
  }
  else {
    room.phase = 'normal'
    for (let pid in room.player) {
      let rlt = (pid == room.curr_ply) ? 'your turn' : 'opponent turn'
      room.player[pid].emit('phaseShift', {msg: {phase: 'normal phase', action: rlt}})
    }
  }
}

//////////////////////////////////////////////////////////////////////////////////
// !-- action

Game.prototype.useCard = function (client, list) {
  let room = game.room[client._rid]
  let use_id = (list.use)? (list.use) : (Object.keys(client.card_pause)[0])
  let swap_id = (list.swap)? (list.swap) : (null)

  client.card_pause = {}
  room.counter_status.id = use_id

  let param = {}
  param[use_id] = {}
  switch (room.cards[use_id].type.base) {
    case 'artifact':
      client.action_point -= 1
      param[use_id].to = 'battle'
      param[use_id].action = 'equip'
      break
    case 'item'		 :
      param[use_id].to = 'grave'
      param[use_id].action = 'use'
      break
    case 'spell'   :
      client.action_point -= 1
      param[use_id].to = 'grave'
      param[use_id].action = 'cast'
      break
    default        : break
  }

  if (list.swap) {
    param[list.swap] = {}
    param[list.swap].to = 'life'
  }

  let rlt = game.cardMove(client, client._foe, param)
  let msg = `${param[use_id].action} ${room.cards[use_id].name}${(list.swap)? ` by ${room.cards[list.swap].name}` : ''}`
  client.emit('plyUseCard', { msg: {phase: 'counter phase', action: msg}, card: rlt.personal })
  client._foe.emit('plyUseCard', { msg: {phase: 'counter phase', action: `foe ${msg}`}, card: rlt.opponent, foe: true })

  room.phase = 'counter'
  room.counter_status.type = 'use'
  room.counter_status.start = 'use'
}

/////////////////////////////////////////////////////////////////////////////////
// !-- effect apply

Game.prototype.effectTrigger = function (personal, opponent, card_list) {
  // card_list = {
  //   card_id_1: [effect1, effect2 ...],
  //   card_id_2 ...
  // }
  //
  // effect = { effect: { target: { field: { type: value } } } }
  let room = this.room[personal._rid]
  let player = {personal: personal, opponent: opponent}

  // effect phase of attack enchant will count as attack phase
  if(room.phase !== 'attack') room.phase = 'effect'
  personal.emit('phaseShift', {msg: {phase: `${room.phase} phase`}})
  opponent.emit('phaseShift', {msg: {phase: `${room.phase} phase`}})

  for (let id in card_list) {
    let card_name = this.room[personal._rid].cards[id].name
    for (let avail_effect of card_list[id]) {
      let effect_name = avail_effect.split('_')[0]
      let effect = this.default.all_card[card_name].effect[avail_effect]

      if (this.choose_eff[effect_name]) {
        for (let target in effect) {
          if (effect_name === 'damage') player[target].dmg_blk += effect[target]
          player[target].emit('effectLoop', {rlt: {id: id, name: card_name, eff: avail_effect}})
          if (!player[target].eff_queue[id]) player[target].eff_queue[id] = {}
          player[target].eff_queue[id][avail_effect] = true
        }
      }
      else
        game[effect_name](personal, effect)
    }
  }

  if (!Object.keys(personal.eff_queue).length && !Object.keys(opponent.eff_queue).length) this.effectEnd(room)
}

Game.prototype.judge = function (personal, opponent, card_id) {
  let player = {personal: personal, opponent: opponent}
  let judge = this.default.all_card[this.room[personal._rid].cards[card_id].name].judge
  let avail_effect = {}
  avail_effect[card_id] = []
  // judge: { effect: { target: { condition: { compare: value } } } }

  for (let effect in judge) {
    // for effects don't need to judge
    if(!Object.keys(judge[effect]).length){
      avail_effect[card_id].push(effect)
      continue
    }
    // for effects with judges
    else {
      for (let target in judge[effect]) {
        for (let condition in judge[effect][target]) {
          let curr_val = null

          switch (condition) {
            case 'hit':
              if (this.room[personal._rid].atk_status.hit) avail_effect[card_id].push(effect)
              break

            case 'hp':
              curr_val = player[target].hp
              break

            case 'handcard':
              curr_val = player[target].card_ammount.hand
              break

            default:break
          }

          if (condition !== 'hit')
            if(operation(curr_val, judge[effect][target][condition])) avail_effect[card_id].push(effect)
        }
      }
    }

  }

  return avail_effect
}

/////////////////////////////////////////////////////////////////////////////////
// !-- card effects
Game.prototype.bleed = function (personal, param) {
  let room = this.room[personal._rid]
  let effect = game.default.all_card[param.name].effect[param.eff]
  let card_pick = Object.keys(param.card_pick)
  let rlt = { card: {bleed: {personal: {}, opponent: {}}} }
  let bleed = effect[Object.keys(effect)[0]]
  if (card_pick.length != bleed) return {err: 'error length of card pick'}

  for (let id of card_pick) {
    let card = room.cards[id]
    if (card.curr_own !== personal._pid) return {err: 'can only choose your card'}
    if (card.field !== 'life') return {err: 'can only choose life field card'}
    if (!card.cover) return {err: 'cant pick card is unveiled'}
    card.cover = false
    rlt.card.bleed.personal[id] = card.name
  }

  personal.emit('effectTrigger', rlt)
  Object.assign(rlt.card, genFoeRlt(rlt.card))
  personal._foe.emit('effectTrigger', rlt)
  return {}
}

Game.prototype.block = function (personal, param) {
  let rlt = { card: {} }
  rlt.card['block'] = {}
  personal.emit('effectTrigger', rlt)
  personal._foe.emit('effectTrigger', rlt)
  return {}
}

Game.prototype.control = function(personal, param) {
  let effect = game.default.all_card[param.name].effect[param.eff]
  let rlt = { card: {} }
  for (let target in effect) {
    for (let object in effect[target]) {
      for (let type in effect[target][object]) {
        rlt.card['control'] = {}
      }
    }
  }
  personal.emit('effectTrigger', rlt)
  personal._foe.emit('effectTrigger', rlt)
  return {}
}

Game.prototype.destroy = function(personal, effect) {
  let rlt = { card: {} }
  for (let target in effect) {
    for (let object in effect[target]) {
      for (let type in effect[target][object]) {
        rlt.card['destroy'] = {}
      }
    }
  }
  personal.emit('effectTrigger', rlt)
  personal._foe.emit('effectTrigger', rlt)
  return {}
}

Game.prototype.discard = function(personal, param) {
  let effect = game.default.all_card[param.name].effect[param.eff]
  let rlt = { card: {} }
  for (let target in effect) {
    for (let type in effect[target]) {
      rlt.card['discard'] = {}
    }
  }
  personal.emit('effectTrigger', rlt)
  personal._foe.emit('effectTrigger', rlt)
  return {}
}

Game.prototype.drain = function (personal, param) {
  let effect = game.default.all_card[param.name].effect[param.eff]
  let rlt = { card: {} }
  for (let target in effect) {
    for (let object in effect[target]) {
      for (let type in effect[target][object]) {
        rlt.card['drain'] = {}
      }
    }
  }
  personal.emit('effectTrigger', rlt)
  personal._foe.emit('effectTrigger', rlt)
  return {}
}

Game.prototype.draw = function(personal, effect) {
  let rlt = { card: {} }
  for (let target in effect) {
    for (let object in effect[target]) {
      for (let type in effect[target][object]) {
        rlt.card['draw'] = {}
      }
    }
  }
  personal.emit('effectTrigger', rlt)
  personal._foe.emit('effectTrigger', rlt)
  return {}
}

Game.prototype.equip = function(personal, param) {
  let effect = game.default.all_card[param.name].effect[param.eff]
  let rlt = { card: {} }
  for (let target in effect) {
    for (let object in effect[target]) {
      for (let type in effect[target][object]) {
        rlt.card['equip'] = {}
      }
    }
  }
  personal.emit('effectTrigger', rlt)
  personal._foe.emit('effectTrigger', rlt)
  return {}
}

Game.prototype.heal = function (personal, param) {
  let room = this.room[personal._rid]
  let effect = game.default.all_card[param.name].effect[param.eff]
  let card_pick = Object.keys(param.card_pick)
  let rlt = { card: {heal: {personal: {}, opponent: {}}} }
  let heal = (personal.life_max - effect[Object.keys(effect)[0]] < personal.hp)? (personal.life_max - personal.hp) : effect[Object.keys(effect)[0]]
  if (card_pick.length != heal) return {err: 'error length of card pick'}
  if (heal == 0) return {}

  for (let id of card_pick) {
    let card = room.cards[id]
    if (card.curr_own !== personal._pid) return {err: 'can only choose your card'}
    if (card.field !== 'life') return {err: 'can only choose life field card'}
    if (card.cover) return {err: 'cant pick card is cover'}
    card.cover = true
    rlt.card.heal.personal[id] = card.name
  }

  personal.emit('effectTrigger', rlt)
  Object.assign(rlt.card, genFoeRlt(rlt.card))
  personal._foe.emit('effectTrigger', rlt)
  return {}
}

Game.prototype.modify = function(personal, effect) {
  let player = {personal: personal, opponent: personal._foe}
  let rlt = { attr: { personal: {}, opponent: {} } }
  for (let target in effect) {
    for (let object in effect[target]) {
      player[target][object] += effect[target][object]
      rlt.attr[target][object] = effect[target][object]
    }
  }
  personal.emit('effectTrigger', rlt)
  personal._foe.emit('effectTrigger', genFoeRlt(rlt))
  return {}
}

Game.prototype.receive = function (personal, param) {
  let room = this.room[personal._rid]
  let dmg_taken = (param.id === 'attack')? (personal._foe.atk_damage) : (personal.dmg_blk)
  let card_pick = Object.keys(param.card_pick)
  let rlt = { card: {receive: {personal: {}, opponent: {}}} }

  if (card_pick.length != dmg_taken) return {err: 'error length of card pick'}

  for (let id of card_pick) {
    let card = room.cards[id]
    if (card.curr_own !== personal._pid) return {err: 'can only choose your card'}
    if (card.field !== 'life') return {err: 'can only choose life field card'}
    if (!card.cover) return {err: 'cant pick card is unveiled'}
    card.cover = false
    rlt.card.receive.personal[id] = card.name
  }

  personal.hp -= dmg_taken
  personal.emit('effectTrigger', rlt)
  Object.assign(rlt.card, genFoeRlt(rlt.card))
  personal._foe.emit('effectTrigger', rlt)

  return {}
}

Game.prototype.retrieve = function(personal, param) {
  let effect = game.default.all_card[param.name].effect[param.eff]
  let rlt = { card: {} }
  for (let target in effect) {
    for (let object in effect[target]) {
      for (let type in effect[target][object]) {
        rlt.card['retrieve'] = {}
      }
    }
  }
  personal.emit('effectTrigger', rlt)
  personal._foe.emit('effectTrigger', rlt)
  return {}
}

Game.prototype.set = function(personal, effect) {
  let rlt = { attr: { personal: {}, opponent: {} } }
  for (let target in effect) {
    for (let object in effect[target]) {
      //player[target][object] = effect[target][object]
      rlt.attr[target][object] = effect[target][object]
    }
  }
  personal.emit('effectTrigger', rlt)
  personal._foe.emit('effectTrigger', genFoeRlt(rlt))
  return {}
}

Game.prototype.steal = function(personal, param) {
  let effect = game.default.all_card[param.name].effect[param.eff]
  let rlt = { card: {} }
  for (let target in effect) {
    for (let object in effect[target]) {
      for (let type in effect[target][object]) {
        rlt.card['steal'] = {}
      }
    }
  }
  personal.emit('effectTrigger', rlt)
  personal._foe.emit('effectTrigger', rlt)
  return {}
}


/////////////////////////////////////////////////////////////////////////////////

// utility
function operation (curr_val, condition) {
  let operator = Object.keys(condition)[0]
  switch (operator) {
    case 'more':
      return (curr_val > condition[operator])? true : false
    case 'goe':
      return (curr_val >= condition[operator])? true : false
    case 'less':
      return (curr_val < condition[operator])? true : false
    case 'loe':
      return (curr_val <= condition[operator])? true : false
    case 'eql':
      return (curr_val == condition[operator])? true : false

    default: break
  }
}

function genFoeRlt (param) {
  for (let type in param) {
    let temp = param[type].personal
    param[type].personal = param[type].opponent
    param[type].opponent = temp
  }
  return param
}

function idGenerate (length) {
  let id = ""
  let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  for(let i = 0; i < length; i++ )
    id += possible.charAt(Math.floor(Math.random() * possible.length))
  return id
}

function shuffle (card_list) {
  let i = 0, j = 0, temp = null
  for(i = card_list.length-1; i > 0; i -= 1){
    j = Math.floor(Math.random()*(i + 1))
    temp = card_list[i]
    card_list[i] = card_list[j]
    card_list[j] = temp
  }
  return card_list
}

function randomDeck () {
  let card = {
    artifact: [],
    spell: [],
    item: [],
    vanish: []
  }
  let deck = []

  for (let card_name in game.default.all_card) {
    for (let type in card)
      if (game.default.all_card[card_name].type.base === type) {
        card[type].push(card_name)
        break
      }
  }

  for(let type in card){
    if(type !== 'vanish'){
      let random = (shuffle(card[type])).slice(0, game.default[`${type}_max`])
      deck = deck.concat(random)
    }
    else
      for(let i = 0; i < game.default[`${type}_max`]; i++)
        deck.push(card.vanish[0])
  }

  return deck
}

/////////////////////////////////////////////////////////////////////////////////

// socket server

io.on('connection', client => {

  ///////////////////////////////////////////////////////////////////////////////
  // !-- init settings
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

  client.on('init', cb => {
    game.buildPlayer(client)
    console.log('player built')
    cb({})
  })

  ///////////////////////////////////////////////////////////////////////////////
  // !-- connection
  client.on('disconnect', () => {
    let rid = client._rid
    let pid = client._pid

    console.log(`${client._pid} disconnect`)

    // if client is in a match
    if(client._rid){
      client._foe.emit('interrupt', {err: 'opponent disconnect'})
      game.buildPlayer(client._foe)
      game.pool[client._foe._pid] = client._foe
      console.log(`reset player ${client._foe._pid}`)
      delete client._foe._rid
      delete game.room[rid]
    }

    // if client is still in pool
    if(game.pool[pid]) return delete game.pool[pid]

    // if client already waiting for match
    for(let i in game.queue)
      if(game.queue[i]._pid === pid) return game.queue.splice(i,1)
  })

  client.on('leaveMatch', cb => {
    let rid = client._rid
    console.log(`${client._pid} leave`)
    let room = game.room[rid]
    for (let pid in room.player) {
      let player = room.player[pid]
      if (pid !== client._pid) player.emit('interrupt', {err: 'opponent leave'})
      game.buildPlayer(player)
      game.pool[pid] = player
      console.log(`reset player ${pid}`)
      delete player._rid
    }
    delete game.room[rid]
    return
  })

  ///////////////////////////////////////////////////////////////////////////////
  // !-- personal interface
  client.on('login', (it, cb) => {
    let user = app.db.collection('user')
    let pid = idGenerate(16)
    client._pid = pid
    game.pool[pid] = client

    user.find({account: it.acc}).toArray((err, rlt) => {
      if(!rlt.length) return cb({err: 'no such user exists'})
      if(rlt[0].passwd !== it.passwd) return cb({err: 'wrong password'})

      client._account = it.acc
      client.deck_slot = rlt[0].deck_slot
      //console.log(client.deck_slot)
      cb({deck_slot: client.deck_slot})
    })
  })

  client.on('randomDeck', (it, cb) => {
    console.log(`${client._account} build new deck_${it.slot}`)
    let newDeck = randomDeck()
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
      deck = shuffle(rlt[0].deck_slot[it.curr_deck].card_list)
      for(let card_name of deck){
        let curr_card = game.default.all_card[card_name]
        let init = {
          name: curr_card.name,
          type: curr_card.type,
          field: 'deck',
          owner: client._pid
        }
        client.curr_deck.push(new Card(init))
        client.card_ammount.deck += 1
      }


      // find opponent
      if(game.queue.length){
        let rid = idGenerate(16)
        let opponent = game.queue.shift()
        opponent._rid = rid
        opponent._foe = client
        client._rid = rid
        client._foe = opponent
        delete game.pool[client._pid]

        game.room[rid] = {
          phase: 'normal', // >> normal / attack / counter / choose
          /*
          phase: {
            curr: 'standby',
            standby: { next: 'main', action: {choose: true} },
            main: { next: 'end', action: {
              draw: true, use: true, trigger: true,
              attack: true, conceal: true, tracking: true, giveup: true,
              counter: true, pass: true,
              choose: true, endturn: true
            } },
            end: { next: 'standby', action: {} }
          }
          */
          atk_status: {hit: false, attacker: null, defender: null},
          counter_status: {action: null, type: null, id: null, last: null},
          effect_status: {count: 0},
          cards: {},
          card_id: 1,
          curr_ply: '',
          player: {}
        }
        let room = game.room[rid]
        room.curr_ply = opponent._pid
        room.player[opponent._pid] = opponent
        room.player[client._pid] = client

        // build all cards, life and deck
        let life = {}
        life[opponent._pid] = {personal: [], opponent: []}
        life[client._pid] = {personal: [], opponent: []}
        for (let pid in room.player) {
          for (let [index, card] of room.player[pid].curr_deck.entries()) {
            let id = `card_${game.room[rid].card_id}`
            room.cards[id] = card
            if(index < room.player[pid].life_max){
              card.field = 'life'
              life[pid].personal.push({id: id, name: card.name})
              life[room.player[pid]._foe._pid].opponent.push({id: id})
              room.player[pid].card_ammount.deck -= 1
              room.player[pid].card_ammount.life += 1
            }
            room.card_id ++
          }
        }
        cb({})

        // game start
        opponent.emit('buildLife', {card_list: life[opponent._pid], msg: {phase: 'normal phase', action: 'your turn', cursor: ' '} })
        client.emit('buildLife', {card_list: life[client._pid], msg: {phase: 'normal phase', action: 'opponent turn', cursor: ' '} })
      }
      else{
        game.queue.push(client)
        delete game.pool[client._pid]
        cb({msg: {cursor: 'searching for match...'}})
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
        console.log(`player ${signup.account} added`)
        client._account = signup.account
        cb({})
      })
    })
  })

  ///////////////////////////////////////////////////////////////////////////////
  // !-- in game

  // ----------------------------------------------------------------------------
  // !-- attack
  client.on('attack', cb => {
    let room = game.room[client._rid]
    if (room.phase !== 'normal') return cb( { err: `not allowed in ${room.phase} phase`} )
    if (room.curr_ply !== client._pid) return cb( {err: 'waiting for opponent'} )
    if (client.action_point < 1) return cb( {err: 'not enough action point'} )
    if (client.card_ammount.battle == 0) return cb( {err: 'no artifact to attack'} )
    if (client.atk_phase < 1) return cb( {err: 'not enough attack phase'} )

    //client.last_act = 'attack'
    room.phase = 'attack'
    room.atk_status.attacker = client
    room.atk_status.defender = client._foe
    client.action_point -= 1
    client.atk_phase -= 1

    client._foe.first_conceal = true
    client.emit('playerAttack', { msg: {phase: 'attack phase', action: 'attack... waiting opponent'}, rlt: {personal: true, attack: true} })
    client._foe.emit('playerAttack', { msg: {phase: 'attack phase', action: 'foe attack'}, rlt: {opponent: true, attack: true} })
  })

  client.on('useVanish', (it, cb) => {
    let room = game.room[client._rid]
    let card_pick = Object.keys(it.card_pick)
    let type = {life_use: {}, hand_use: {}, hand_swap: {}}
    let action = (it.conceal)? 'conceal' : 'tracking'

    for (let id of card_pick) {
      let card = room.cards[id]
      if (card.cover) return cb({err: 'please choose unveiled card'})
      if (card.field === 'life') {
        if (card.name === 'vanish') type.life_use[id] = {to: 'grave'}
        else return cb({err: 'please choose vanish'})
      }
      else {
        if (card.name === 'vanish') type.hand_use[id] = {to: 'grave'}
        else type.hand_swap[id] = {to: 'life'}
      }
    }

    let life_use = Object.keys(type.life_use).length
    let hand_use = Object.keys(type.hand_use).length
    let hand_swap = Object.keys(type.hand_swap).length

    console.log(life_use)
    console.log(hand_use)
    console.log(hand_swap)

    switch (card_pick.length) {
      case 1:
        if (!client.first_conceal) return cb({err: 'card pick error'})
        if (hand_use != 1) return cb({err: 'card pick error'})
        break

      case 2:
        if (client.first_conceal) if (life_use != 1 || hand_swap != 1) return cb({err: 'card pick error'})
        else if (hand_use != 2) return cb({err: 'card pick error'})
        break

      case 3:
        if (client.first_conceal) return cb({err: 'card pick error'})
        if (hand_use != 1 || hand_swap != 1 || life_use != 1) return cb({err: 'card pick error'})
        break

      case 4:
        if (client.first_conceal) return cb({err: 'card pick error'})
        if (life_use != 2 || hand_swap != 2) return cb({err: 'card pick error'})
        break

      default:
        return cb({err: 'error length of card pick'})
        break
    }

    if (client.first_conceal) client.first_conceal = false

    let param = Object.assign(type.hand_use, type.hand_swap, type.life_swap)
    let rlt = game.cardMove(client, client._foe, param)
    let panel = {}
    panel[action] = true

    client.emit(`plyUseVanish`, { msg: {action: `${action}... waiting opponent`}, card: rlt.personal, rlt: Object.assign({personal: true}, panel) })
    client._foe.emit(`plyUseVanish`, { msg: {action: `foe ${action}`}, card: rlt.opponent, rlt: Object.assign({opponent: true}, panel) })
  })

  client.on('conceal', (it, cb) => {
    let room = game.room[client._rid]
    let card_pick = Object.keys(it.card_pick)

    if(client.first_conceal){
      if (card_pick.length != 1) return cb( {err: 'choose exact 1 card'} )
      if ('vanish' !== room.cards[card_pick[0]].name) return cb( {err: 'please choose vanish'} )
      client.first_conceal = false
    }
    else{
      if (card_pick.length != 2) return cb( {err: 'choose exact 2 cards'} )
      if ('vanish' !== room.cards[card_pick[(0||1)]].name) return cb( {err: 'please choose vanish'} )
    }

    let rlt = game.cardMove(client, client._foe, it.card_pick)
    client.emit('playerConceal', { msg: {action: 'conceal... waiting opponent'}, card: rlt.personal, rlt: {personal: true, conceal: true} })
    client._foe.emit('playerConceal', { msg: {action: 'foe conceal'}, card: rlt.opponent, rlt: {opponent: true, conceal: true} })
  })

  client.on('tracking', (it, cb) => {
    let room = game.room[client._rid]
    let card_pick = Object.keys(it.card_pick)
    if (card_pick.length != 2) return cb( {err: 'choose exact 2 cards'} )
    if ('vanish' !== room.cards[card_pick[(0||1)]].name) return cb( {err: 'please choose vanish'} )

    let rlt = game.cardMove(client, client._foe, it.card_pick)
    client.emit('playerTracking', { msg: {action: 'tracking... waiting opponent'}, card: rlt.personal, rlt: {personal: true, tracking: true} })
    client._foe.emit('playerTracking', { msg: {action: 'foe tracking'}, card: rlt.opponent, rlt: {opponent: true, tracking: true} })
  })

  client.on('giveUp', cb => {
    let room = game.room[client._rid]
    let action = (client == room.atk_status.attacker)? 'tracking' : 'conceal'

    let msg = {personal: '', opponent: ''}
    msg.personal = (action === 'conceal')? 'be hit... waiting opponent' : 'attack miss... your turn'
    msg.opponent = (action === 'conceal')? 'attack hits... your turn' : 'dodge attack... waiting opponent'

    let rlt = {personal: {personal: true, give_up: true}, opponent: {opponent: true, give_up: true}}
    rlt.personal[action] = true
    rlt.opponent[action] = true

    client.emit('playerGiveUp', { msg: {action: msg.personal, cursor: ' '}, rlt: rlt.personal })
    client._foe.emit('playerGiveUp', { msg: {action: msg.opponent, cursor: ' '}, rlt: rlt.opponent })
    room.atk_status.hit = (action === 'tracking')? false : true
    console.log(room.atk_status.hit)

    // effect phase
    let avail_effect = {}
    for (let id of client._foe.atk_enchant)
      Object.assign(avail_effect, game.judge(room.atk_status.attacker, room.atk_status.defender, id))

    console.log(avail_effect)

    game.effectTrigger(room.atk_status.attacker, room.atk_status.defender, avail_effect)

  })

  // ----------------------------------------------------------------------------
  // !-- counter
  client.on('counter', (it, cb) => {
    let card_pick = Object.keys(it.card_pick)
    if (card_pick.length !== 1) return cb({err: 'only allow 1 counter card a time'})

    let room = game.room[client._rid]
    let card = room.cards[card_pick[0]]
    let effect = game.default.all_card[card.name].effect
    let effect_type = Object.keys(effect.counter.opponent)[0]
    let effect_object = Object.keys(effect.counter.opponent[effect_type])[0]
    let counter_card = room.cards[room.counter_status.id]

    if (!effect.counter) return cb({err: 'no counter effect'})
    if (effect_type !== room.counter_status.type) return cb({err: 'counter action type mismatch'})
    if (effect_object !== 'card' && effect_object !== counter_card.type.base) return cb({err: 'counter object type mismatch'})

    let rlt = {}
    if (card.type.base === 'artifact') {
      // card flip instead if its artifact
      /*
      card.overheat = true
      card.energy -= 1
      rlt[card_pick[0]] = {from: 'battle', curr_own: 'personal', trigger: true}
      */
    }
    else {
      let param = {}
      param[card_pick[0]] = {from: card.field}
      rlt = cardMove(client, client._foe, param)
    }

    client.emit('playerCounter', { msg: {action: `use ${card.name} to counter`}, card: rlt.personal, rlt: {counter: true, personal: true} })
    client._foe.emit('playerCounter', { msg: {action: `foe use ${card.name} to counter`}, card: rlt.opponent, rlt: {counter: true, opponent: true} })
    room.counter_status.type = 'trigger'
  })

  client.on('pass', () => {
    let room = game.room[client._rid]
    let counter = (client == room.player[room.curr_ply])? true : false

    if (counter == true) {
      let param = {}
      param[room.counter_status.id] = {from: room.cards[room.counter_status.id].field}
      let rlt = game.cardMove(client, client._foe, param)
      room.phase = 'normal'
      client.emit('playerPass', { msg: {phase: 'normal phase', action: 'be countered... your turn', cursor: ' '}, card: rlt.personal, rlt: {pass: true, personal: true} })
      client._foe.emit('playerPass', { msg: {phase: 'normal phase', action: 'counter success... waiting opponent', cursor: ' '}, card: rlt.opponent, rlt: {pass: true, opponent: true} })
    }
    else {
      client.emit('playerPass', { msg: {phase: 'normal phase', action: 'counter failed... waiting opponent', cursor: ' '}, rlt: {pass: true, personal: true} })
      client._foe.emit('playerPass', { msg: {phase: 'normal phase', action: 'action recover... your turn', cursor: ' '}, rlt: {pass: true, opponent: true} })
      let card = room.cards[room.counter_status.id]

      // action varies by counter status first action
      if (room.counter_status.start === 'use') {
        if (card.field === 'grave') {
          let avail_effect = game.judge(client._foe, client, room.counter_status.id)
          game.effectTrigger(client._foe, client, avail_effect)
        }
        else room.phase = 'normal'
      }
      else {
        room.phase = 'normal'
        if (card.type.base === 'artifact') {
          if (card.type.effect === 'enchant') client._foe.atk_enchant.push(room.counter_status.id)
          //if (card.type.effect === 'trigger')
        }
      }
    }

    room.counter_status = {start: null, type: null, id: null, last: null}
  })

  // ----------------------------------------------------------------------------
  // !-- action
  client.on('drawCard', cb => {
    let room = game.room[client._rid]
    if (room.phase !== 'normal') return cb( { err: `not allowed in ${room.phase} phase`} )
    if (room.curr_ply !== client._pid) return cb( {err: 'waiting for opponent' } )
    if (client.action_point <= 0) return cb( {err: 'not enough action point'} )
    if (client.card_ammount.hand == client.hand_max) return cb( {err: 'your hand is full'} )

    client.action_point -= 1

    for(let id in room.cards){
      let card = room.cards[id]
      if (card.field !== 'deck' || card.curr_own !== client._pid) continue

      let param = { id: id, name: card.name }
      card.field = 'hand'
      card.cover = false
      client.card_ammount.hand += 1
      client.card_ammount.deck -= 1
      if (client.card_ammount.deck == 0) param.deck_empty = true

      cb({msg: {action: `draw ${param.name}`}, card: param})
      delete param.name
      client._foe.emit('foeDrawCard', {msg: {action: 'foe draw card'}, card: param})
      break
    }
  })

  client.on('checkUse', (it, cb) => {
    let room = game.room[client._rid]
    let card = room.cards[it.id]

    if (room.phase === 'effect' || room.phase === 'attack') return cb( { err: 'choose'} )
    if (card.cover && card.field === 'life') return cb({err: card.name}) // !-- kill when hover card done
    if (!game.phase_rule.use.normal[room.phase]) return cb( { err: `not allowed in ${room.phase} phase`} )
    if (room.curr_ply !== client._pid) return cb( {err: 'waiting for opponent' } )

    if (!Object.keys(client.card_pause).length) {
      if (room.cards[it.id].type.base === 'vanish') return cb( {err: 'only available in atk phase'} )
      if (client.action_point <= 0 && room.cards[it.id].type.base !== 'item') return cb( {err: 'not enough action point'} )
      if (card.field === 'life' && client.card_ammount.hand == 0) return cb( {err: 'no handcard to replace'} )
    }
    else
      if(card.field === 'life') return cb( {err: 'its not a handcard'} )

    if (card.field === 'hand') {
      room.phase = 'normal'
      if (Object.keys(client.card_pause).length) game.useCard(client, {swap: it.id})
      else game.useCard(client, {use: it.id})
    }
    else {
      if (card.field === 'life') {
        room.phase = 'choose'
        client.card_pause[it.id] = true
        cb({err: 'choose handcard to replace'})
      }
    }
  })


  client.on('triggerCard', (it, cb) => {
    // action varies based on its type
    let room = game.room[client._rid]
    let card = room.cards[it.id]
    if (room.phase !== 'normal') return cb({err: `not allowed in ${room.phase} phase`})
    if (game.default.all_card[card.name].effect.counter) return cb({err: 'only available in counter phase'})
    if (room.curr_ply !== client._pid) return cb({err: 'waiting for opponent'})

    if (card.type.base === 'artifact') {
      if (card.overheat) return cb({err: 'artifact overheat'})
      if (card.energy == 0) return cb({err: 'energy lacking'})
      card.overheat = true
      card.energy -= 1

      room.phase = 'counter'
      room.counter_status = {start: 'trigger', type: 'trigger', id: it.id}
      client.emit('playerTrigger', { msg: {phase: 'counter phase', action: `trigger ${card.name}`}, card: {id: it.id, curr_own: 'personal', from: 'battle'} })
      client._foe.emit('playerTrigger', { msg: {phase: 'counter phase', action: `foe trigger ${card.name}`}, card: {id: it.id, curr_own: 'opponent', from: 'battle'} })
    }
    else {

    }
  })

  client.on('endTurn', cb => {
    let room = game.room[client._rid]
    if (room.phase !== 'normal') return cb({ err: `not allowed in ${room.phase} phase`})
    if (room.curr_ply !== client._pid) return cb({err: 'waiting for opponent'})

    room.curr_ply = client._foe._pid
    client.action_point = game.default.action_point
    client.atk_damage = game.default.atk_damage
    client.atk_phase = game.default.atk_phase
    client.atk_enchant = []

    // put outdated card on field to grave
    let param = {}
    for (let id in room.cards) {
      let card = room.cards[id]
      if (card.energy == 0 && card.field === 'battle') param[id] = {from: card.field}
      if (card.overheat) card.overheat = false
    }
    let rlt = {personal: {}, opponent: {}}
    if(Object.keys(param).length) rlt = game.cardMove(client, client._foe, param)
    cb({ msg: {phase: 'normal phase', action: 'opponent turn', cursor: ' '}, card: rlt.personal })
    client._foe.emit('turnStart', { msg: {phase: 'normal phase', action: 'your turn', cursor: ' '}, card: rlt.opponent})
  })

  // ----------------------------------------------------------------------------
  // !-- choosing
  client.on('effectChoose', (it, cb) => {
    let room = game.room[client._rid]
    let effect = (it.eff.split('_')[0] === 'damage')? (it.decision) : (it.eff.split('_')[0])
    let rlt = game[effect](client, it)
    if (rlt.err) return cb(rlt)
    else cb({})
    //game[effect](client, it)
    //cb({})

    delete client.eff_queue[it.id][it.eff]
    if (!Object.keys(client.eff_queue[it.id]).length) delete client.eff_queue[it.id]

    if (!Object.keys(client.eff_queue).length && !Object.keys(client._foe.eff_queue).length) {
      if (it.decision && room.phase === 'attack') game.attackEnd(room)
      else game.effectEnd(room)
    }
  })

})

/////////////////////////////////////////////////////////////////////////////////
// server init

const game = new Game()

server.listen(opt.serv_port, function(){
  console.log(`listen on port ${opt.serv_port}`)
})

