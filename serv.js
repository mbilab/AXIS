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
    if (rlt[id].to === ('grave' || 'hand')) {
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
Game.prototype.control = function() {}

Game.prototype.destroy = function() {}

Game.prototype.drain = function() {}

Game.prototype.draw = function(personal, opponent, effect) {

}

Game.prototype.equip = function() {}

Game.prototype.modify = function(personal, opponent, effect) {
  let player = {personal: personal, opponent: opponent}
  let param = {personal: {}, opponent: {}}
  for (let target in effect) {
    for (let object in effect[target]) {
      player[target][object] += effect[target][object]
      param[target][object] = effect[target][object]
    }
  }
  return param
}

Game.prototype.retrieve = function() {}

Game.prototype.set = function() {}

Game.prototype.steal = function() {}

Game.prototype.judge = function (personal, opponent, card_id) {
  let player = {personal: personal, opponent: opponent}
  let judge = this.default.all_card[this.room[personal._rid].cards[card_id].name].judge
  let avail_effect = {}
  avail_effect[card_id] = []
  // judge: { effect: { target: { condition: { compare: value } } } }

  for (let effect in judge) {
    for (let target in judge.effect) {
      // for effects don't need to judge
      if(!judge.effect.target){
        avail_effect[card_id].push(effect)
        continue
      }

      // for effects with judges
      for (let condition in judge.effect.target) {
        let curr_val = null
        switch (condition) {
          case 'hit':
            if (this.room[personal._rid].atk_status.hit) avail_effect[card_id].push(effect)
            break

          case 'hp':
            curr_val = player[target].hp
            break

          case 'handcard': break

          default:break
        }

        if(operation(curr_val, judge.effect.target.condition)) avail_effect[card_id].push(effect)
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
  let player = {personal: personal, opponent: opponent}

  for (let id in card_list) {
    let card_name = this.room[personal._rid].cards[id].name
    let param = {personal: {}, opponent: {}}
    for (let avail_effect of card_list[id]) {
      let effect_name = avail_effect.split['_'][0]
      let effect = this.default.all_card[card_name].effect[avail_effect]
      let rlt = this[effect_name](personal, opponent, effect)

      Object.assign(param.personal, rlt.personal)
      Object.assign(param.opponent, rlt.opponent)
    }

    let result = {personal: {}, opponent: {}}
    result.personal = param
    result.opponent.personal = param.opponent
    result.opponent.opponent = param.personal

    personal.emit('effectTrigger', result.personal)
    opponent.emit('effectTrigger', result.opponent)
  }
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
  switch (operation) {
    case 'goe':
      return (curr_val > condition.operator)? true : false

    default: break
  }
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
          type: curr_card.type,
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

        game.room[rid] = {
          game_phase: 'normal',
          atk_status: {hit: false, attacker: null, defender: null},
          cards: {},
          card_id: 1,
          counter: 0,
          player: [opponent, client]
        }
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
    if (game.room[rid].game_phase === 'attack') return cb( { err: 'not allowed in atk phase'} )
    if (game.room[rid].player[curr]._pid !== client._pid) return cb( {err: 'waiting for opponent'} )
    if (client.action_point < 1) return cb( {err: 'not enough action point'} )
    if (client.card_ammount.battle == 0) return cb( {err: 'no artifact to attack'} )
    if (client.atk_phase < 1) return cb( {err: 'not enough attack phase'} )

    game.room[rid].game_phase = 'attack'
    game.room[rid].atk_status.attacker = client
    game.room[rid].atk_status.defender = game.room[rid].player[1-curr]
    client.action_point -= 1
    client.atk_phase -= 1
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
    let action = (client == game.room[rid].atk_status.attacker)? 'tracking' : 'conceal'
    let opponent = game.room[rid].player[(action === 'tracking')? (1-curr) : curr]
    game.room[rid].game_phase = 'normal'

    cb({action: action})
    opponent.emit('foeGiveUp', {action: action})

    /*
    game.room[rid].atk_status.hit = (action === 'tracking')? false : true

    // effect phase
    let avail_effect = {}
    for (let id in personal.atk_enchant)
      Object.assign(avail_effect, this.judge(player.attacker, player.defender, id))

    this.effectTrigger(player.attacker, player.defender, avail_effect)

    // damage phase
    socket.emit('damagePhase', {})

    // end phase
    game.room[rid].game_phase = 'normal'
    game.room[rid].atk_status.hit = false
    game.room[rid].atk_status.attacker = null
    game.room[rid].atk_status.defender = null

    */
  })

  // neutral
  client.on('drawCard', cb => {
    let rid = client._rid
    let curr = game.room[rid].counter
    if (game.room[rid].game_phase === 'attack') return cb( { err: 'not allowed in atk phase'} )
    if (game.room[rid].player[curr]._pid !== client._pid) return cb( {err: 'waiting for opponent' } )
    if (client.action_point <= 0) return cb( {err: 'not enough action point'} )
    if (client.card_ammount.hand == client.hand_max) return cb( {err: 'your hand is full'} )

    client.action_point -= 1

    for(let id in game.room[rid].cards){
      let card = game.room[rid].cards[id]
      if (card.field !== 'deck' || card.curr_own !== client._pid) continue

      let param = { id: id, name: card.name }
      card.field = 'hand'
      card.cover = false
      client.card_ammount.hand += 1
      client.card_ammount.deck -= 1
      if (client.card_ammount.deck == 0) param.deck_empty = true

      cb(param)
      delete param.name
      game.room[rid].player[1 - curr].emit('foeDrawCard', param)

      return
    }
  })

  client.on('triggerEffect', (it, cb) => {
    // action varies based on its type
    let rid = client._rid
    let curr = game.room[rid].counter
    let card = game.room[rid].cards[it.id]

    if (card.type.base === 'artifact' && card.type.effect === 'enchant') {
      if (card.overheat) return cb({err: 'artifact overheat'})
      if (card.energy == 0) return cb({err: 'energy lacking'})
      card.overheat = true
      card.energy -= 1
      cb({msg: `attack enchanted by ${card.name}`})
    }
    else {
      let avail_effect = game.judge(client, game.room[rid].player[1-curr], id)
      game.effectTrigger(client, game.room[rid].player[1-curr], avail_effect)
      cb({})
    }
  })

  client.on('endTurn', cb => {
    let rid = client._rid
    let curr = game.room[rid].counter
    if (game.room[rid].game_phase === 'attack') return cb({ err: 'not allowed in atk phase'})
    if (game.room[rid].player[curr]._pid !== client._pid) return cb({err: 'waiting for opponent'})

    //checkCardEnergy

    game.room[rid].counter = 1 - curr
    curr = game.room[rid].counter

    client.action_point = game.default.action_point
    client.atk_damage = game.default.atk_damage
    client.atk_phase = game.default.atk_phase

    cb({ msg: 'waiting for opponent' })
    game.room[rid].player[curr].emit('turnStart', { msg: 'your turn' })
  })

  client.on('playHandCard', (it, cb) => {
    let rid = client._rid
    let curr = game.room[rid].counter
    let card = game.room[rid].cards[it.id]

    if (game.room[rid].game_phase === 'attack') return cb( { err: 'atk phase'} )
    if (game.room[rid].player[curr]._pid !== client._pid) return cb( {err: 'waiting for opponent' } )
    if (card.type.base === 'vanish') return cb( {err: 'only available in atk phase'} )
    if (client.action_point <= 0 && card.type.base !== 'item') return cb( {err: 'not enough action point'} )

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

    // card move between fields
    let rlt = game.cardMove(client, game.room[rid].player[1 - curr], param)
    cb(rlt.personal)
    game.room[rid].player[1 - curr].emit('foePlayHand', rlt.opponent)

    // card effect triggers
    /*
    let avail_effect = game.judge(client, game.room[rid].player[1-curr], it.id)
    game.effectTrigger(client, game.room[rid].player[1-curr], avail_effect)
    */
  })

})

/////////////////////////////////////////////////////////////////////////////////

// server init

const game = new Game()

server.listen(opt.serv_port, function(){
  console.log(`listen on port ${opt.serv_port}`)
})


