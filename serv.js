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
      normal: {normal: true}
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

// main
Game.prototype.buildPlayer = function (client) {
  // attribute
  client.hp = this.default.life_max
  client.atk_damage = game.default.atk_damage
  client.atk_phase = game.default.atk_phase
  client.action_point = game.default.action_point
  client.atk_enchant = [] // card_ids
  client.buff_action = [] // card_ids
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

Game.prototype.checkCardEnergy = function (rid) {

}

// personal >> who announce this attack
Game.prototype.enchantAttack = function (personal, opponent) {
  let avail_effect = {}
  for (let id in personal.atk_enchant)
    Object.assign(avail_effect, this.judge(personal, opponent, id))

  this.effectTrigger(personal, opponent, avail_effect)
}

// card effects
Game.prototype.bleed = function (personal, opponent, param) {
  let player = { personal: personal, opponent: opponent }
  let effect = game.default.all_card[param.name].effect[param.eff]
  let rlt = { card: {} }
  for (let target in effect) {
    rlt.card['bleed'] = {}
  }
  personal.emit('effectTrigger', rlt)
  opponent.emit('effectTrigger', rlt)
}

Game.prototype.block = function (personal, opponent, param) {
  let player = { personal: personal, opponent: opponent }
  let rlt = { card: {} }
  rlt.card['block'] = {}
  personal.emit('effectTrigger', rlt)
  opponent.emit('effectTrigger', rlt)
}

Game.prototype.control = function(personal, opponent, param) {
  let player = { personal: personal, opponent: opponent }
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
  opponent.emit('effectTrigger', rlt)
}

Game.prototype.destroy = function(personal, opponent, effect) {
  let player = { personal: personal, opponent: opponent }
  let rlt = { card: {} }
  for (let target in effect) {
    for (let object in effect[target]) {
      for (let type in effect[target][object]) {
        rlt.card['destroy'] = {}
      }
    }
  }
  personal.emit('effectTrigger', rlt)
  opponent.emit('effectTrigger', rlt)
}

Game.prototype.discard = function(personal, opponent, param) {
  let player = { personal: personal, opponent: opponent }
  let effect = game.default.all_card[param.name].effect[param.eff]
  let rlt = { card: {} }
  for (let target in effect) {
    for (let type in effect[target]) {
      rlt.card['discard'] = {}
    }
  }
  personal.emit('effectTrigger', rlt)
  opponent.emit('effectTrigger', rlt)
}

Game.prototype.drain = function (personal, opponent, param) {
  let player = { personal: personal, opponent: opponent }
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
  opponent.emit('effectTrigger', rlt)
}

Game.prototype.draw = function(personal, opponent, effect) {
  let player = { personal: personal, opponent: opponent }
  let rlt = { card: {} }
  for (let target in effect) {
    for (let object in effect[target]) {
      for (let type in effect[target][object]) {
        rlt.card['draw'] = {}
      }
    }
  }
  personal.emit('effectTrigger', rlt)
  opponent.emit('effectTrigger', rlt)
}

Game.prototype.equip = function(personal, opponent, param) {
  let player = { personal: personal, opponent: opponent }
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
  opponent.emit('effectTrigger', rlt)
}

Game.prototype.heal = function (personal, opponent, param) {
  let player = { personal: personal, opponent: opponent }
  let effect = game.default.all_card[param.name].effect[param.eff]
  let rlt = { card: {} }
  for (let target in effect) {
    rlt.card['heal'] = {}
  }
  personal.emit('effectTrigger', rlt)
  opponent.emit('effectTrigger', rlt)
}

Game.prototype.modify = function(personal, opponent, effect) {
  let player = { personal: personal, opponent: opponent }
  let rlt = { attr: { personal: {}, opponent: {} } }
  for (let target in effect) {
    for (let object in effect[target]) {
      //player[target][object] = effect[target][object]
      rlt.attr[target][object] = effect[target][object]
    }
  }
  personal.emit('effectTrigger', rlt)
  opponent.emit('effectTrigger', genFoeRlt(rlt))
}

Game.prototype.receive = function (personal, opponent, param) {
  let player = { personal: personal, opponent: opponent }
  let rlt = { card: {} }
  rlt.card['receive'] = {}
  personal.emit('effectTrigger', rlt)
  opponent.emit('effectTrigger', rlt)
}

Game.prototype.retrieve = function(personal, opponent, param) {
  let player = { personal: personal, opponent: opponent }
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
  opponent.emit('effectTrigger', rlt)
}

Game.prototype.set = function(personal, opponent, effect) {
  let player = { personal: personal, opponent: opponent }
  let rlt = { attr: { personal: {}, opponent: {} } }
  for (let target in effect) {
    for (let object in effect[target]) {
      //player[target][object] = effect[target][object]
      rlt.attr[target][object] = effect[target][object]
    }
  }
  personal.emit('effectTrigger', rlt)
  opponent.emit('effectTrigger', genFoeRlt(rlt))
}

Game.prototype.steal = function(personal, opponent, param) {
  let player = { personal: personal, opponent: opponent }
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
  opponent.emit('effectTrigger', rlt)
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
      for (let target in judge.effect) {
        for (let condition in judge.effect.target) {
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

          if(operation(curr_val, judge[effect][target][condition])) avail_effect[card_id].push(effect)
        }
      }
    }

  }

  return avail_effect
}

Game.prototype.effectTrigger = function (personal, opponent, card_list) {
  // card_list = {
  //   card_id_1: [effect1, effect2 ...],
  //   card_id_2 ...
  // }
  //
  // effect = { effect: { target: { field: { type: value } } } }
  let room = this.room[personal._rid]
  let curr = room.player_pointer
  let player = {personal: personal, opponent: opponent}

  room.game_phase = 'effect'

  for (let id in card_list) {
    let card_name = this.room[personal._rid].cards[id].name
    for (let avail_effect of card_list[id]) {
      let effect_name = avail_effect.split('_')[0]
      let effect = this.default.all_card[card_name].effect[avail_effect]

      if (this.choose_eff[effect_name]) {
        for (let target in effect) {
          player[target].emit('effectLoop', {rlt: {id: id, name: card_name, eff: effect_name}})
          if (!room.effect_status[player[target]._pid]) {
            room.effect_status[player[target]._pid] = true
            room.effect_status.count ++
          }
        }
      }
      else {
        game[effect_name](personal, opponent, effect)
      }
    }
  }

  console.log(room.effect_status)

  if (!room.effect_status[personal._pid] && !room.effect_status[opponent._pid]) {
    room.game_phase = 'normal'
    for (let player of room.player) {
      let rlt = (player == room.player[curr]) ? 'your turn' : 'opponent turn'
      player.emit('normalPhase', {msg: {phase: 'normal phase', action: rlt}})
    }
  }

  console.log(room.game_phase)
}

// tools
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

// utility
function operation (curr_val, condition) {
  let operator = Object.keys(condition)[0]
  switch (operator) {
    case 'more':
      return (curr_val > condition.operator)? true : false
    case 'goe':
      return (curr_val >= condition.operator)? true : false
    case 'less':
      return (curr_val < condition.operator)? true : false
    case 'loe':
      return (curr_val <= condition.operator)? true : false
    case 'eql':
      return (curr_val == condition.operator)? true : false

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

    console.log(`${client._pid} disconnect`)

    // if client is in a match
    if(client._rid){
      for (let player of game.room[rid].player){
        if (player._pid !== pid) {
          player.emit('interrupt', {err: 'opponent disconnect'})
          game.buildPlayer(player)
          game.pool[player._pid] = player
          console.log(`reset player ${player._pid}`)
          delete player._rid
          delete game.room[rid]
          return
        }
      }
    }

    // if client is still in pool
    if(game.pool[pid]) return delete game.pool[pid]

    // if client already waiting for match
    for(let i in game.queue)
      if(game.queue[i]._pid === pid) return game.queue.splice(i,1)
  })

  // once open web page
  client.on('init', cb => {
    game.buildPlayer(client)
    console.log('player built')
    cb({})
  })

  client.on('leaveMatch', cb => {
    let rid = client._rid
    console.log(`${client._pid} leave`)
    for (let player of game.room[rid].player) {
      if (player._pid !== client._pid) player.emit('interrupt', {err: 'opponent leave'})
      game.buildPlayer(player)
      game.pool[player._pid] = player
      console.log(`reset player ${player._pid}`)
      delete player._rid
    }
    delete game.room[rid]
    return
  })

  // personal interface
  client.on('login', (it, cb) => {
    let user = app.db.collection('user')
    let pid = game.idGenerate(16)
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
          type: curr_card.type,
          field: 'deck',
          owner: client._pid
        }
        client.curr_deck.push(new Card(init))
        client.card_ammount.deck += 1
      }


      // find opponent
      if(game.queue.length){
        let rid = game.idGenerate(16)
        let opponent = game.queue.shift()
        opponent._rid = rid
        client._rid = rid
        delete game.pool[client._pid]

        game.room[rid] = {
          game_phase: 'normal', // >> normal / attack / counter / choose
          atk_status: {hit: false, attacker: null, defender: null},
          counter_status: {action: null, type: null, id: null, last: null},
          damage_status: {count: 0},
          effect_status: {count: 0},
          cards: {},
          card_id: 1,
          player_pointer: 0,
          player: [opponent, client]
        }

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

  // in game

  // battle
  client.on('attack', cb => {
    let room = game.room[client._rid]
    let curr = room.player_pointer
    if (room.game_phase !== 'normal') return cb( { err: `not allowed in ${room.game_phase} phase`} )
    if (room.player[curr]._pid !== client._pid) return cb( {err: 'waiting for opponent'} )
    if (client.action_point < 1) return cb( {err: 'not enough action point'} )
    if (client.card_ammount.battle == 0) return cb( {err: 'no artifact to attack'} )
    if (client.atk_phase < 1) return cb( {err: 'not enough attack phase'} )

    room.game_phase = 'attack'
    room.atk_status.attacker = client
    room.atk_status.defender = room.player[1-curr]
    client.action_point -= 1
    client.atk_phase -= 1

    room.player[1-curr].first_conceal = true
    client.emit('playerAttack', { msg: {phase: 'attack phase', action: 'attack... waiting opponent'}, rlt: {personal: true, attack: true} })
    room.player[1-curr].emit('playerAttack', { msg: {phase: 'attack phase', action: 'foe attack'}, rlt: {opponent: true, attack: true} })
  })

  client.on('conceal', (it, cb) => {
    let room = game.room[client._rid]
    let curr = room.player_pointer
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

    let rlt = game.cardMove(client, room.player[curr], it.card_pick)
    client.emit('playerConceal', { msg: {action: 'conceal... waiting opponent'}, card: rlt.personal, rlt: {personal: true, conceal: true} })
    room.player[curr].emit('playerConceal', { msg: {action: 'foe conceal'}, card: rlt.opponent, rlt: {opponent: true, conceal: true} })
  })

  client.on('tracking', (it, cb) => {
    let room = game.room[client._rid]
    let curr = room.player_pointer
    let card_pick = Object.keys(it.card_pick)
    if (card_pick.length != 2) return cb( {err: 'choose exact 2 cards'} )
    if ('vanish' !== room.cards[card_pick[(0||1)]].name) return cb( {err: 'please choose vanish'} )

    let rlt = game.cardMove(client, room.player[1-curr], it.card_pick)
    client.emit('playerTracking', { msg: {action: 'tracking... waiting opponent'}, card: rlt.personal, rlt: {personal: true, tracking: true} })
    room.player[1 - curr].emit('playerTracking', { msg: {action: 'foe tracking'}, card: rlt.opponent, rlt: {opponent: true, tracking: true} })
  })

  client.on('giveUp', cb => {
    let room = game.room[client._rid]
    let curr = room.player_pointer
    let action = (client == room.atk_status.attacker)? 'tracking' : 'conceal'
    let opponent = room.player[(action === 'tracking')? (1-curr) : curr]
    room.game_phase = 'normal'


    let msg = {personal: '', opponent: ''}
    msg.personal = (action === 'conceal')? 'be hit... waiting opponent' : 'attack miss... your turn'
    msg.opponent = (action === 'conceal')? 'attack hits... your turn' : 'dodge attack... waiting opponent'

    let rlt = {personal: {personal: true, give_up: true}, opponent: {opponent: true, give_up: true}}
    rlt.personal[action] = true
    rlt.opponent[action] = true

    client.emit('playerGiveUp', { msg: {phase: 'normal phase', action: msg.personal, cursor: ' '}, rlt: rlt.personal })
    opponent.emit('playerGiveUp', { msg: {phase: 'normal phase', action: msg.opponent, cursor: ' '}, rlt: rlt.opponent })

    /*
    game.room[rid].atk_status.hit = (action === 'tracking')? false : true

    // effect phase
    let avail_effect = {}
    for (let id in personal.atk_enchant)
      Object.assign(avail_effect, this.judge(player.attacker, player.defender, id))

    this.effectTrigger(player.attacker, player.defender, avail_effect)

    // damage phase
    client.emit('damagePhase', {})

    // end phase
    game.room[rid].game_phase = 'normal'
    game.room[rid].atk_status.hit = false
    game.room[rid].atk_status.attacker = null
    game.room[rid].atk_status.defender = null

    */
  })

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
      rlt = cardMove(client, room.counter_status.last, param)
    }

    client.emit('playerCounter', { msg: {action: `use ${card.name} to counter`}, card: rlt.personal, rlt: {counter: true, personal: true} })
    room.counter_status.last.emit('playerCounter', { msg: {action: `foe use ${card.name} to counter`}, card: rlt.opponent, rlt: {counter: true, opponent: true} })
    room.counter_status.last = client
    room.counter_status.type = 'trigger'
  })

  client.on('pass', () => {
    let room = game.room[client._rid]
    let curr = room.player_pointer
    let counter = (client == room.player[curr])? true : false
    let last_counter = room.counter_status.last

    room.game_phase = 'normal'

    if (counter == true) {
      let param = {}
      param[room.counter_status.id] = {from: room.cards[room.counter_status.id].field}
      let rlt = game.cardMove(client, last_counter, param)

      client.emit('playerPass', { msg: {phase: 'normal phase', action: 'be countered... your turn', cursor: ' '}, card: rlt.personal, rlt: {pass: true, personal: true} })
      room.counter_status.last.emit('playerPass', { msg: {phase: 'normal phase', action: 'counter success... waiting opponent', cursor: ' '}, card: rlt.opponent, rlt: {pass: true, opponent: true} })
    }
    else {
      client.emit('playerPass', { msg: {phase: 'normal phase', action: 'counter failed... waiting opponent', cursor: ' '}, rlt: {pass: true, personal: true} })
      room.counter_status.last.emit('playerPass', { msg: {phase: 'normal phase', action: 'action recover... your turn', cursor: ' '}, rlt: {pass: true, opponent: true} })
      let card = room.cards[room.counter_status.id]

      // action varies by counter status first action
      if (room.counter_status.action === 'use') {
        if (card.field === 'grave') {
          let avail_effect = game.judge(last_counter, client, room.counter_status.id)
          game.effectTrigger(last_counter, client, avail_effect)
        }
      }
      else {

      }
    }

    room.counter_status = {action: null, type: null, id: null, last: null}
  })

  // neutral
  client.on('drawCard', cb => {
    let room = game.room[client._rid]
    let curr = room.player_pointer

    console.log(room.game_phase)

    if (room.game_phase !== 'normal') return cb( { err: `not allowed in ${room.game_phase} phase`} )
    if (room.player[curr]._pid !== client._pid) return cb( {err: 'waiting for opponent' } )
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
      room.player[1-curr].emit('foeDrawCard', {msg: {action: 'foe draw card'}, card: param})
      return
    }
  })

  client.on('effectChoose', (it, cb) => {
    let room = game.room[client._rid]
    let curr = room.player_pointer
    let opponent = room.player[(client == room.player[curr])? (1-curr) : (curr)]
    //let rlt = game[it.eff](client, opponent, it)
    game[it.eff](client, opponent, it)
    cb({})
    //if (rlt.err) return cb(rlt)
    if (it.last) {
      room.effect_status[client._pid] = false
      room.effect_status.count --
      if (room.effect_status.count == 0) {
        room.game_phase = 'normal'
        for (let player of room.player) {
          let rlt = (player == room.player[curr]) ? 'your turn' : 'opponent turn'
          player.emit('normalPhase', {msg: {phase: 'normal phase', action: rlt}})
        }
      }
    }
  })

  client.on('triggerCard', (it, cb) => {
    // action varies based on its type
    let room = game.room[client._rid]
    let curr = room.counter
    let card = room.cards[it.id]

    if (card.type.base === 'artifact') {
      if (card.overheat) return cb({err: 'artifact overheat'})
      if (card.energy == 0) return cb({err: 'energy lacking'})
      card.overheat = true
      card.energy -= 1

      room.game_phase = 'counter'
      room.counter_status = {action: 'trigger', type: 'trigger', id: it.id, last: client}
      client.emit('playerTrigger', { msg: {phase: 'counter phase', action: `trigger ${card.name}`}, card: {personal: {battle: it.id}} })
      room.player[1-curr].emit('playerTrigger', { msg: {phase: 'counter phase', action: `foe trigger ${card.name}`}, card: {opponent: {battle: it.id}} })
    }
    else {}
  })

  client.on('endTurn', cb => {
    let room = game.room[client._rid]
    let curr = room.player_pointer
    if (room.game_phase !== 'normal') return cb({ err: `not allowed in ${room.game_phase} phase`})
    if (room.player[curr]._pid !== client._pid) return cb({err: 'waiting for opponent'})

    //checkCardEnergy

    room.player_pointer = 1 - curr
    curr = room.player_pointer

    client.action_point = game.default.action_point
    client.atk_damage = game.default.atk_damage
    client.atk_phase = game.default.atk_phase


    cb({ msg: {phase: 'normal phase', action: 'opponent turn', cursor: ' '} })
    room.player[curr].emit('turnStart', { msg: {phase: 'normal phase', action: 'your turn', cursor: ' '} })
  })

  client.on('useCard', (it, cb) => {
    let room = game.room[client._rid]
    let curr = room.player_pointer
    let card = room.cards[it.id]

    console.log(room.game_phase)

    if (game.phase_rule.use.choose[room.game_phase]) return cb( { err: 'choose'} )
    if (!game.phase_rule.use.normal[room.game_phase]) return cb( { err: `not allowed in ${room.game_phase} phase`} )
    if (room.player[curr]._pid !== client._pid) return cb( {err: 'waiting for opponent' } )
    if (card.type.base === 'vanish') return cb( {err: 'only available in atk phase'} )
    if (client.action_point <= 0 && card.type.base !== 'item') return cb( {err: 'not enough action point'} )

    room.counter_status.id = it.id
    let param = {}
    param[it.id] = {}

    // field adjust
    switch (room.cards[it.id].type.base) {
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

    let rlt = game.cardMove(client, room.player[1-curr], param)
    let msg = `${param[it.id].action} ${card.name}`
    cb({ msg: {phase: 'counter phase', action: msg}, card: rlt.personal })
    room.player[1-curr].emit('foeUseCard', { msg: {phase: 'counter phase', action: `foe ${msg}`}, card: rlt.opponent })

    room.game_phase = 'counter'
    room.counter_status.last = client
    room.counter_status.type = 'use'
    room.counter_status.action = 'use'
  })
})

/////////////////////////////////////////////////////////////////////////////////

// server init

const game = new Game()

server.listen(opt.serv_port, function(){
  console.log(`listen on port ${opt.serv_port}`)
})


