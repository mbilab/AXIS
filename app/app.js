const socket = io()

// global variables (default values)

const opt = {
  screen: {
    height: document.documentElement.clientHeight, // browser height
    width : document.documentElement.clientWidth   // browser width
  }
}

const Game = function () {
  this.curr_page = 'start'
  this.default = { //-! extract height and width
    game: {
      height: 700,
      width: 1366
    },
    button: {
      height: 43,
      width: 88
    },
    card: {
      height: 91,
	    width: 64
	  },
    player: {
      personal_y : {deck: 110, battle: 285, grave: 175, hand: 175, life: 65},
      opponent_y : {deck: 758, battle: 493, grave: 603, hand: 603, life: 713}
    },
    scale: 768*(opt.screen.width/opt.screen.height)/1366
  }

  for (let field in this.default.player.personal_y) {
    this.default.player.personal_y[field] = this.default.game.height - this.default.player.personal_y[field] / this.default.scale
    this.default.player.opponent_y[field] = this.default.game.height - this.default.player.opponent_y[field] / this.default.scale
  }

  this.player = {
    personal: new Player('personal', this.default.player.personal_y),
    opponent: new Player('opponent', this.default.player.opponent_y)
  }

  this.page = {
    start: {
      login: { type: 'button', x: this.default.game.width/2 - 100, y: this.default.game.height*0.75, img: 'login', func: this.changePage, ext: {next: 'login'} },
      sign_up: {type: 'button', x: this.default.game.width/2 + 12, y: this.default.game.height*0.75, img: 'signup', func: this.changePage, ext: {next: 'sign_up'}}
    },
    login: {
      login: {type: 'html', id: 'login'},
      back: {type: 'button', x: 0, y: this.default.game.height - 43, img: 'back', func: this.changePage, ext: {next: 'start'} }
    },
    sign_up:{
      sign_up: {type: 'html', id: 'signup'},
      back: {type: 'button', x: 0, y: this.default.game.height - 43, img: 'back', func: this.changePage, ext: {next: 'start'} }
    },
    lobby: {
      deck_build: {type: 'button', x: 0, y: 0, img: 'decks', func: this.changePage, ext: {next: 'deck_build'} },
      match_search: {type: 'button', x: 0, y: 43, img: 'battle', func: this.changePage, ext: {next: 'match_search'} }
    },
    deck_build: {
      back: {type: 'button', x: 0, y: this.default.game.height - 43, img: 'back', func: this.changePage, ext: {next: 'lobby'} }
    },
    deck_view: {
      back: {type: 'button', x: 0, y: this.default.game.height - 43, img: 'back', func: this.changePage, ext: {next: 'deck_build'} },
      next: {type: 'button', x: this.default.game.width - 200, y: this.default.game.height/2 + 70, img: 'nextBtn', func: this.showTexture, ext: {page: 1} },
      prev: {type: 'button', x: 155, y: this.default.game.height/2 + 70, img: 'prevBtn', func: this.showTexture, ext: {page: -1} }
    },
    match_search: {
      search: {type: 'button', x: this.default.game.width - 88, y: this.default.game.height - 43, img: 'search', func: this.player.personal.searchMatch, ext:{ next: 'loading'} },
      back: {type: 'button', x: 0, y: this.default.game.height - 43, img: 'back', func: this.changePage, ext: {next: 'lobby'} }
    },
    loading: {},
    game: {
      personal_deck: { type: 'button', x: this.default.game.width*(1 - 1/13), y: this.default.player.personal_y.deck, img: 'cardback', func: this.player.personal.drawCard },
      opponent_deck: { type: 'button', x: this.default.game.width*(1 - 1/13), y: this.default.player.opponent_y.deck, img: 'cardback', func: null },
      end_turn: {type: 'button', x: this.default.game.width - 121, y: this.default.game.height/2 - 44/this.default.scale, img: 'endTurn', func: this.player.personal.endTurn},
      leave: {type: 'button', x: 0, y: this.default.game.height - 43, img: 'leave', func: this.player.personal.leaveMatch, ext: {next: 'lobby'} },

      // normal action
      attack: {type: 'button', x: this.default.game.width - 121, y: this.default.game.height/2 + 11/this.default.scale, img: 'attack', func: this.player.personal.attack},
      conceal: {type: 'button', x: this.default.game.width - 121, y: this.default.game.height/2 + 11/this.default.scale, img: 'conceal', func: this.player.personal.conceal, ext: {action: 'conceal', req: true} },
      tracking: {type: 'button', x: this.default.game.width - 121, y: this.default.game.height/2 + 11/this.default.scale, img: 'tracking', func: this.player.personal.tracking, ext: {action: 'tracking', req: true} },
      give_up: {type: 'button', x: this.default.game.width - 220, y: this.default.game.height/2 + 11/this.default.scale, img: 'giveup', func: this.player.personal.giveUp, ext: {req: true} },

      // counter card
      counter: {type: 'button', x: this.default.game.width - 121, y: this.default.game.height/2 + 66/this.default.scale, img: 'counter', func: this.player.personal.counter, ext: {req: true} },
      pass: {type: 'button', x: this.default.game.width - 220, y: this.default.game.height/2 + 66/this.default.scale, img: 'pass', func: this.player.personal.pass, ext: {req: true} },

      // effect
      choose: {type: 'button', x: this.default.game.width - 121, y: this.default.game.height/2 + 66/this.default.scale, img: 'choose', func: this.player.personal.effectChoose, ext: {req: true} },

      // block dmg
      block: {type: 'button', x: this.default.game.width - 121, y: this.default.game.height/2 + 66/this.default.scale, img: 'block', func: this.player.personal.block, ext: {req: true} },
      receive: {type: 'button', x: this.default.game.width - 220, y: this.default.game.height/2 + 66/this.default.scale, img: 'receive', func: this.player.personal.receive, ext: {req: true} }
    }
  }
  this.phaser = null
  this.text = {phase: null, action: null, cursor: null}
  this.text_group = null
}

Game.prototype.textPanel = function (text) {
  if (text.phase) game.text.phase.setText(text.phase)
  if (text.action) game.text.action.setText(text.action)
  if (text.cursor) game.text.cursor.setText(text.cursor)
}

Game.prototype.blockPanel = function (action) {
  let block_btn = this.page.game.block
  let receive_btn = this.page.game.receive

  if (action.damage) {
    block_btn.reset(block_btn.x, block_btn.y)
    receive_btn.reset(receive_btn.x, receive_btn.y)
  }
  else {
    block_btn.kill()
    receive_btn.kill()
  }
}

// action = {pass: true, personal: true ...}
Game.prototype.counterPanel = function (action) {
  let counter_btn = this.page.game.counter
  let pass_btn = this.page.game.pass

  if (action.opponent && action.counter) {
    counter_btn.reset(counter_btn.x, counter_btn.y)
    pass_btn.reset(pass_btn.x, pass_btn.y)
  }
  else {
    counter_btn.kill()
    pass_btn.kill()
  }
}

// action = {give_up: true, conceal: true ...}
Game.prototype.attackPanel = function (action) {
  let atk_btn = this.page.game.attack
  let give_up = this.page.game.give_up

  if (action.give_up) {
    let elem = ((action.personal && action.conceal) || (action.opponent && action.tracking))?'conceal':'tracking'
    atk_btn.reset(atk_btn.x, atk_btn.y)
    this.page.game[elem].kill()
    give_up.kill()
  }
  else {
    if (action.personal) {
      let elem = (action.attack)? 'attack' : ((action.conceal)? 'conceal' : 'tracking')
      this.page.game[elem].kill()
      give_up.kill()
    }
    else {
      let foe_action = (action.attack)? 'attack' : ((action.conceal)? 'conceal' : 'tracking')
      let elem = (action.attack || action.tracking)? 'conceal' : 'tracking'
      atk_btn.kill()
      this.page.game[elem].reset(atk_btn.x, atk_btn.y)
      give_up.reset(give_up.x, give_up.y)
    }
  }
}

Game.prototype.changePage = function (obj) {
  let old_page = this.page[this.curr_page]
  let new_page = this.page[obj.next]

  if (old_page) {
    for (let elem in old_page) {
      if (Array.isArray(old_page[elem])) old_page[elem] = []
      else {
        if ('html' === old_page[elem].type)
          this.shiftInputForm(old_page[elem], 'bottom')
        else
          old_page[elem].kill()
      }
    }
  }
  this.curr_page = obj.next
  if (new_page) {
    for (let elem in new_page) {
      if(!new_page[elem].req){
        if ('html' === new_page[elem].type)
          this.shiftInputForm(new_page[elem], 'front')
        else
          if(!Array.isArray(new_page[elem]))
            new_page[elem].reset(new_page[elem].x, new_page[elem].y)
      }
    }
  }

  // variable reset due to page change
  personal.curr_deck = null
  game.textPanel({phase: ' ', action: ' ', cursor: ' '})

}

Game.prototype.cardMove = function (rlt) {
// rlt = {
//         id: {
//           from:
//           curr_own:
//           new_own:
//           to:
//
//           name:
//           action:   // when equip, cast ...
//         }
//       }
  let fix_field = {personal: {}, opponent: {}}
  for (let id in rlt) {
    rlt[id].id = id
    let pos = this.findCard(rlt[id])
    let card = game.player[rlt[id].curr_own][rlt[id].from][pos]

    // adjust card attribute
    card.img.inputEnabled = (rlt[id].new_own === 'opponent')? false:((rlt[id].to === 'grave')? false: true)
    card.field = rlt[id].to
    if(rlt[id].to === 'grave') card.cover = false
    card.name = rlt[id].name
    card.img.loadTexture(card.name)
    card.img.alpha = 1
    card.img.angle = 0

    // move
    game.player[rlt[id].new_own][rlt[id].to].push(card)
    //card.img.destroy()
    game.player[rlt[id].curr_own][rlt[id].from].splice(pos, 1)

    // field to fix
    fix_field[rlt[id].curr_own][rlt[id].from] = true
    fix_field[rlt[id].new_own][rlt[id].to] = true
  }
  this.fixCardPos(fix_field)
}

Game.prototype.findCard = function (rlt) {
  for (let [index, elem] of game.player[rlt.curr_own][rlt.from].entries()) {
    if(elem.id === rlt.id) return index
  }
}

// rlt = {personal: {hand: true}, opponent: {}}
Game.prototype.fixCardPos = function (rlt) {
  for (let target in rlt){
    for (let field in rlt[target]) {
      for (let i = 0; i < game.player[target][field].length; i++) {
        let x = (field === 'grave')? this.default.game.width*(1 - 1/13) + this.default.card.width*0.5: (this.default.game.width/2) - this.default.card.width*0.75 - this.default.card.width/2 - (this.default.card.width*3/5)*(game.player[target][field].length - 1) + (this.default.card.width*6/5)*i
        game.player[target][field][i].img.reset(x, game.player[target][`${field}_yloc`])
      }
    }
  }
}

Game.prototype.pageInit = function () {
  // add general items
  for (let page_name in this.page) {
    for (let elem_name in this.page[page_name]) {
      let elem = this.page[page_name][elem_name]
      if(elem != null){
        let next = elem.next
        if (elem.type!=='html') {
          this.page[page_name][elem_name] = game.phaser.add[elem.type](elem.x, elem.y, elem.img, elem.func, this)
          if (elem.ext) Object.assign(this.page[page_name][elem_name], elem.ext)
          this.page[page_name][elem_name].kill()
        }
      }
    }
  }

  // add cards in deck view page
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 5; j++) {
      let x = (this.default.game.width - (5*this.default.card.width + 4*84))/2 + (this.default.card.width + 84)*j
      let y = this.default.game.height/2 - 40 - this.default.card.height + (80 + this.default.card.height)*i
      let card = game.phaser.add.sprite(x, y, 'emptySlot')
      card.describe = game.phaser.add.text(x, y + this.default.card.height, "",  { font: "20px Arial", fill: '#000000', backgroundColor: 'rgba(255,255,255,0.5)'})
      card.inputEnabled = true
      card.events.onInputOver.add(function(){card.describe.reset(card.describe.x, card.describe.y)}, this)
      card.events.onInputOut.add(function(){card.describe.kill()}, this)
      card.kill()
      card.describe.kill()
      this.page.deck_view[`card_${j+1+(i*5)}`] = card
    }
  }

  // add cards in game page
  for(let field of ['altar', 'battle', 'grave', 'hand', 'life']){
    this.page.game[`personal_${field}`] = personal[field]
    this.page.game[`opponent_${field}`] = opponent[field]
  }

  this.page.game.personal_deck.kill()
  this.page.game.opponent_deck.kill()

  this.changePage({next: 'start'})
}

Game.prototype.resetCardPick = function () {
  for (let id in personal.card_pick) {
    personal.card_pick[id].img.alpha = 1
  }
  personal.card_pick = {}
}

Game.prototype.resetPlayer = function () {
  for (let field of ['altar', 'battle', 'grave', 'hand', 'life']){
    for (let card of personal[field]) {
      card.img.destroy()
    }
    personal[field] = []
    for (let card of opponent[field]) {
      card.img.destroy()
    }
    opponent[field] = []
  }
}

Game.prototype.shiftInputForm = function (elem, place) {
  let i = (place === 'front')? 1: -1
  if (elem.id) $(`#${elem.id}`).css('zIndex', i)
}

Game.prototype.showTexture = function (btn) {
  let deck = personal.deck_slot[personal.curr_deck]
  let next_btn = this.page.deck_view.next
  let prev_btn = this.page.deck_view.prev

  if(btn.init) deck.page = btn.init
  else deck.page += btn.page

  let start_pos = (deck.page - 1)*10
  let card_list = deck.card_list.slice(start_pos, start_pos + 10)

  // show or hide prev/next button
  if (deck.page == 1) prev_btn.kill()
  else prev_btn.reset(prev_btn.x, prev_btn.y)

  if (deck.card_list.length - start_pos <= 10) next_btn.kill()
  else next_btn.reset(next_btn.x, next_btn.y)

  // change card texture
  let index = 1
  for (let elem_name in this.page.deck_view){
    if(elem_name === `card_${index}`){
      this.page.deck_view[elem_name].loadTexture( (card_list[index - 1])?card_list[index - 1]:(null)/*'emptySlot'*/ )
      this.page.deck_view[elem_name].describe.setText( (card_list[index - 1])?card_list[index - 1]:'' )
      index++
    }
  }
}

// init = id: , field_yloc:{hand: ,life: ...}
const Player = function (id, location) {
  for (let field in location) this[`${field}_yloc`] = location[field]
  // attribute
  this.card_pick = {}
  this.curr_deck = ''
  this.deck_slot = {} // total decks
  this.eff_queue = []

  // game field
  this.altar = []
  this.battle = []
  this.grave = []
  this.hand = []
  this.life = []
}

Player.prototype.attack = function () {
  socket.emit('attack', it => {
    if(it.err) return game.textPanel({cursor: it.err})
  })
}

Player.prototype.conceal = function () {

  socket.emit('useVanish', {card_pick: buildList(personal.card_pick), conceal: true}, it => {
    if(it.err) return game.textPanel({cursor: it.err})
  })

  //socket.emit('conceal', {card_pick: buildList(personal.card_pick), conceal: true}, it => {
  //  if(it.err) return game.textPanel({cursor: it.err})
  //})
}

Player.prototype.tracking = function () {

  socket.emit('useVanish', {card_pick: buildList(personal.card_pick), tracking: true}, it => {
    if(it.err) return game.textPanel({cursor: it.err})
  })

  //socket.emit('tracking', {card_pick: buildList(personal.card_pick), tracking: true}, it => {
  //  if(it.err) return game.textPanel({cursor: it.err})
  //})
}

Player.prototype.giveUp = function () {
  socket.emit('giveUp')
}

Player.prototype.block = function () {
  personal.eff_queue[0].decision = 'block'
  personal.effectChoose()
}

Player.prototype.receive = function () {
  personal.eff_queue[0].decision = 'receive'
  personal.effectChoose()
}

Player.prototype.counter = function () {
  socket.emit('counter', {card_pick: buildList(personal.card_pick)}, it => {
    if (it.err) return game.textPanel({cursor: it.err})
  })
}

Player.prototype.pass = function () {
  socket.emit('pass')
}

Player.prototype.effectChoose = function () {
  let param = {card_pick: null}
  Object.assign(param, personal.eff_queue[0])
  param.card_pick = buildList(personal.card_pick)
  if (personal.eff_queue.length == 1) param.last = true

  socket.emit('effectChoose', param, it => {
    if (it.err) return game.textPanel({cursor: it.err})

    if (param.eff.split('_')[0] === 'damage') game.blockPanel({done: true})
    personal.eff_queue.shift()
    game.resetCardPick()
    if (!personal.eff_queue.length) {
      game.page.game.choose.kill()
      game.textPanel({action: 'effect done'})
    }
    else game.textPanel({action: `${personal.eff_queue[0].name} ${personal.eff_queue[0].eff}`})
  })
}

Player.prototype.effectLoop = function () {
  if (personal.eff_queue.length) {
    if (personal.eff_queue[0].eff.split('_')[0] === 'damage') game.blockPanel({damage: true})
    else {
      let choose_btn = game.page.game.choose
      choose_btn.reset(choose_btn.x, choose_btn.y)
    }
    game.textPanel({action: `${personal.eff_queue[0].name} ${personal.eff_queue[0].eff}`})
  }
}

Player.prototype.chooseCard = function (card) {
  if (!personal.card_pick[card.id]) {
    personal.card_pick[card.id] = card
    card.img.alpha = 0.5
  }
  else {
    delete personal.card_pick[card.id]
    card.img.alpha = 1
  }
}

Player.prototype.drawCard = function () {
  socket.emit('drawCard', it => {
    console.log(it)
    if (it.err) return game.textPanel({cursor: it.err})
    game.textPanel(it.msg)

    personal.hand.push( new Card({name: it.card.name, id: it.card.id, cover: false, input: true, field: 'hand'}) )
    game.fixCardPos({ personal: {hand: true} })

    if (it.card.deck_empty) game.page.game.personal_deck.kill()
  })
}

// for player trigger a card on field/ enchant an attack
Player.prototype.triggerCard = function (card) {
  socket.emit('triggerCard', {id: card.id}, it => {
    if (it.err) return game.textPanel({cursor: it.err})
  })
}

Player.prototype.endTurn = function () {
  socket.emit('endTurn', it => {
    if (it.err) return game.textPanel({cursor: it.err})
    game.textPanel(it.msg)
    if (Object.keys(it.card).length) game.cardMove(it.card)
    game.resetCardPick()
  })
}

Player.prototype.leaveMatch = function () {
  socket.emit('leaveMatch')
  game.changePage({ next:'lobby' })
  game.resetPlayer()
}

Player.prototype.login = function () {
  if (!$('#logAcc').val()) return game.textPanel({cursor: 'please enter your account'})
  if (!$('#logPswd').val()) return game.textPanel({cursor: 'please enter your password'})
  socket.emit('login',  { acc: $('#logAcc').val(), passwd: $('#logPswd').val() }, it => {
    if (it.err) {
      game.textPanel({cursor: it.err})
      $('#logAcc, #logPswd').val('')
      return
    }

    // init deck slot
    for (let slot in it.deck_slot) {
      let deck_name = it.deck_slot[slot].name
      personal.deck_slot[slot] = new Deck({slot: slot, name: deck_name})
      if (it.deck_slot[slot].card_list.length) {
        personal.deck_slot[slot].text.setText(deck_name)
        personal.deck_slot[slot].img.loadTexture('cardback')
        personal.deck_slot[slot].img.inputEnabled = true
        personal.deck_slot[slot].card_list = it.deck_slot[slot].card_list
      }
      game.page.match_search[`${slot}_img`] = personal.deck_slot[slot].img
      game.page.match_search[`${slot}_text`] = personal.deck_slot[slot].text
      game.page.deck_build[`${slot}_img`] = personal.deck_slot[slot].img
      game.page.deck_build[`${slot}_text`] = personal.deck_slot[slot].text
      game.page.deck_build[`${slot}_btn`] = personal.deck_slot[slot].rdm_btn
    }

    game.changePage({ next: 'lobby' })
  })
}

Player.prototype.searchMatch = function () {
  socket.emit('searchMatch', {curr_deck: personal.curr_deck}, it => {
    if (it.err) return game.textPanel({cursor: it.err})
    if (it.msg) {
      game.changePage({next:'loading'})
      game.textPanel(it.msg)
    }
  })
}

Player.prototype.signUp = function () {
  if (!$('#sgnAcc').val()) return alert('please enter your account')
  if (!$('#sgnPswd').val()) return alert('please enter your password')
  if (!$('#sgnRepswd').val()) return alert('please enter your password again')
  if ($('#sgnPswd').val() !== $('#sgnRepswd').val()) return alert('passwords are different')

  socket.emit('signUp',  {acc: $('#sgnAcc').val(), passwd: $('#sgnPswd').val()}, it => {
    if (it.err) {
      alert(it.err)
      $('#sgnAcc, #sgnPswd, #sgnRepswd').val('')
      return
    }
    game.changePage({next: 'start'})
  })
}

Player.prototype.useCard = function (card) {

  socket.emit('checkUse', {id: card.id}, it => {
    if (it.err) {
      if (it.err === 'choose') personal.chooseCard(card)
      else game.textPanel({cursor: it.err})
      return
    }
  })
}

const Deck = function (init) {
  this.slot = init.slot
  this.name = init.name
  this.card_list = {}
  this.page = 1

  // deck
  this.index = this.slot.split("_")[1]
  this.img = game.phaser.add.sprite((game.default.game.width-232)/2 + 84*(this.index-1), game.default.game.height/2, 'emptySlot')
  this.img.events.onInputDown.add(this.click, this)
  this.img.kill()

  this.text = game.phaser.add.text((game.default.game.width-232)/2 + 84*(this.index-1), game.default.game.height/2, '', {font: '20px Arial', fill:'#ffffff', align: 'left', stroke: '#000000', strokeThickness: 4})
  this.text.kill()

  this.rdm_btn = game.phaser.add.button((game.default.game.width-232)/2 + 84*(this.index-1), game.default.game.height/2 + 110, 'new', this.randomDeck, this)
  this.rdm_btn.kill()
}

Deck.prototype.click = function (){
  switch (game.curr_page) {
    case 'deck_build':
      game.changePage({ next: 'deck_view' })
      personal.curr_deck = this.slot
      game.textPanel({cursor: `${this.name}`})
      game.showTexture({init: 1})
      break

    case 'match_search':
      personal.curr_deck = this.slot
      game.textPanel({cursor: `${this.name}`})
      break

    default: break
  }
}

Deck.prototype.randomDeck = function () {
  // !--
  socket.emit('randomDeck', { slot: this.slot }, it => {
    console.log(it.newDeck)
    this.card_list = it.newDeck
    this.img.loadTexture('cardback')
    this.img.inputEnabled = true
    this.text.setText(`deck_${this.index}`)
    alert('you build a new deck')
  })
}

const Card = function (init) {
  this.cover = init.cover
  this.name = init.name
  this.id = init.id
  this.field = init.field
  this.img = game.phaser.add.sprite(game.default.game.width * (1 - 1/13), personal.deck_yloc, this.cover ? 'cardback' : init.name)
  this.img.inputEnabled = init.input
  this.img.events.onInputDown.add(this.click, this)
  this.img.anchor.setTo(0.5, 0.5)
}

Card.prototype.flip = function (name) {
  if (this.cover && name !== 'cardback') {
    this.cover = false
    this.name = name
    this.img.loadTexture(name)
  }
  else {
    this.cover = true
    this.img.loadTexture('cardback')
  }
}

Card.prototype.click = function () {
  switch (this.field) {
    case 'altar':
      //personal.triggerCard(this)
      break

    case 'battle':
      personal.triggerCard(this)
      break

    case 'grave' :
      break

    case 'hand'	 :
      personal.useCard(this)
      break

    case 'life'	 :
      //game.textPanel({cursor: this.name})
      personal.useCard(this)
      break

    default			 : break
  }
}

///////////////////////////////////////////////////////////////////////////////////

// utility

function buildList (obj) {
  let rlt = {}
  for (let id in obj) {
    rlt[id] = {}
  }
  game.resetCardPick()
  return rlt
}

///////////////////////////////////////////////////////////////////////////////////

// socket server

socket.on('buildLife', it => {
  for (let target in it.card_list){
    for(let card of it.card_list[target]){
      let name = (card.name)? card.name : 'cardback'
      let input = (target === 'personal')? true : false
      game.player[target].life.push(new Card({name: name, id: card.id, cover: true, field: 'life', input: input}))
    }
  }
  game.fixCardPos({personal: {life: true}, opponent: {life: true}})
  game.changePage({next: 'game'})
  game.textPanel(it.msg)
})

socket.on('playerPass', it => {
  game.resetCardPick()
  game.textPanel(it.msg)
  game.counterPanel(it.rlt)
})

socket.on('playerCounter', it => {
  game.cardMove(it.card)
  game.textPanel(it.msg)
  game.counterPanel(it.rlt)
})

socket.on('playerAttack', it => {
  game.textPanel(it.msg)
  game.attackPanel(it.rlt)
})

socket.on('playerGiveUp', it => {
  game.resetCardPick()
  game.textPanel(it.msg)
  game.attackPanel(it.rlt)
})

socket.on('plyUseVanish', it => {
  game.textPanel(it.msg)
  game.cardMove(it.card)
  game.attackPanel(it.rlt)
})

socket.on('playerConceal', it => {
  game.textPanel(it.msg)
  game.cardMove(it.card)
  game.attackPanel(it.rlt)
})

socket.on('playerTracking', it => {
  game.textPanel(it.msg)
  game.cardMove(it.card)
  game.attackPanel(it.rlt)
})

socket.on('playerTrigger', it => {
  game.textPanel(it.msg)
  // drain card once if artifact

  //if cardmove then cardmove
  //else turn card down once or use tags

  game.player[it.card.curr_own][it.card.from][game.findCard(it.card)].img.angle += 90

  if (it.card.curr_own === 'opponent') {
    game.page.game.counter.reset(game.page.game.counter.x, game.page.game.counter.y)
    game.page.game.pass.reset(game.page.game.pass.x, game.page.game.pass.y)
  }
})

socket.on('foeDrawCard', it => {
  game.textPanel(it.msg)
  opponent.hand.push(new Card({name: 'cardback', id: it.card.id, cover: true, input: false, field: 'hand'}))
  game.fixCardPos({opponent: {hand: true}})
  if (it.card.deck_empty) game.page.game.opponent_deck.kill()
})

socket.on('plyUseCard', it => {
  //console.log(it)
  game.cardMove(it.card)
  game.textPanel(it.msg)
  if (it.foe) {
    game.page.game.counter.reset(game.page.game.counter.x, game.page.game.counter.y)
    game.page.game.pass.reset(game.page.game.pass.x, game.page.game.pass.y)
  }
})

socket.on('foeUseCard', it => {
  game.cardmove(it.card)
  game.textpanel(it.msg)
  game.page.game.counter.reset(game.page.game.counter.x, game.page.game.counter.y)
  game.page.game.pass.reset(game.page.game.pass.x, game.page.game.pass.y)
})

socket.on('interrupt', it => {
  game.textPanel({phase: ' ', action: ' ', cursor: ' '})
  game.resetPlayer()
  game.changePage({next: 'lobby'})
  alert(it.err)
})

socket.on('turnStart', it => {
  if (Object.keys(it.card).length)  game.cardMove(it.card)
  game.textPanel(it.msg)
})

// card effects
socket.on('effectTrigger', effect => {
  /*
  effect = {
    card: {},
    attr: { personal: {}, opponent: {} },
    stat: { personal: {}, opponent: {} }
  }
  */


  // attr

  // card
  for (let type in effect.card) {
    if (type === 'receive' || type === 'heal' || type === 'bleed') {
      let target = (Object.keys(effect.card[type].personal).length)? 'personal' : 'opponent'
      for (let id in effect.card[type][target]) {
        let pos = game.findCard({id: id, curr_own: target, from: 'life'})
        game.player[target].life[pos].flip(effect.card[type][target][id])
      }
    }
  }
  // stat




  console.log(effect)
})

socket.on('effectLoop', effect => {
  personal.eff_queue.push(effect.rlt)
  if (personal.eff_queue.length == 1) personal.effectLoop()
})

socket.on('phaseShift', it => {
  game.textPanel(it.msg)
})

//////////////////////////////////////////////////////////////////////////////////////

// game initialization
const game = new Game()
const personal = game.player.personal
const opponent = game.player.opponent

socket.emit('preload', res => {
  game.phaser = new Phaser.Game(game.default.game.width, game.default.game.height, Phaser.Canvas, 'game', {
    create: () => {
      let top = (100*(1 - game.default.game.width/opt.screen.width)/2).toString()+'%'
      let left = (100*(1 - game.default.game.height/opt.screen.height)/2).toString()+'%'
      $('#game').css({top: top, left: left})

      game.phaser.add.sprite(0, 0, 'background')
      //app.time.events.loop(Phaser.Timer.SECOND, game.updateCounter, this)

      let text_yscale = { phase: -44, action: 11, cursor: 66 }
      game.text_group = game.phaser.add.group()
      for (let type in game.text) {
        game.text[type] = game.phaser.add.text(21, game.default.game.height/2 + text_yscale[type]/game.default.scale, '', {font: '26px Arial', fill:'#ffffff', align: 'left'})
        game.text_group.add(game.text[type])
      }
      socket.emit('init', it => { game.pageInit() })
    },
    preload: () => {
      for (let type in res)
        for (let elem in res[type])
          game.phaser.load[type](elem, res[type][elem])
    },
    render: () => {},
    update: () => {}
  })
})

