const socket = io()

// global variables (default values)

const opt = {
  screen: {
    height: document.documentElement.clientHeight, // browser height
    width : document.documentElement.clientWidth   // browser width
  }
}

const Game = function () {
  this.counter = 0 //-! move to serv.js and rename
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
      personal_y : {deck: 110, battle: 330, grave: 220, hand: 220, life: 110},
      opponent_y : {deck: 758, battle: 538, grave: 648, hand: 648, life: 758}
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
      attack: {type: 'button', x: this.default.game.width - 121, y: this.default.game.height/2 + 11/this.default.scale, img: 'attack', func: this.player.personal.attack},
      conceal: {type: 'button', x: this.default.game.width - 121, y: this.default.game.height/2 + 11/this.default.scale, img: 'conceal', func: this.player.personal.conceal, ext: {action: 'conceal', req: true} },
      tracking: {type: 'button', x: this.default.game.width - 121, y: this.default.game.height/2 + 11/this.default.scale, img: 'tracking', func: this.player.personal.tracking, ext: {action: 'tracking', req: true} },
      give_up: {type: 'button', x: this.default.game.width - 220, y: this.default.game.height/2 + 11/this.default.scale, img: 'giveup', func: this.player.personal.giveUp, ext: {req: true} }
    }
  }
  this.phaser = null
  this.text = null
  this.text_group = null
}

// action = {give_up: true, conceal: true ...}
Game.prototype.attackPanel = function (action) {
  let atk_btn = this.page.game.attack
  let give_up = this.page.game.give_up

  if(action.give_up){
    let elem = ((action.personal && action.conceal) || (action.opponent && action.tracking))?'conceal':'tracking'
    atk_btn.reset(atk_btn.x, atk_btn.y)
    this.page.game[elem].kill()
    give_up.kill()
    if(action.personal)
      this.text.setText((action.conceal)?'be hit... waiting for opponent':'attack miss... your turn')
    else
      this.text.setText((action.conceal)?'attack hits... your turn':'dodge attack... waiting for opponent')
  }
  else{
    if(action.personal){
      let elem = (action.attack)? 'attack' : ((action.conceal)? 'conceal' : 'tracking')
      this.text.setText(`${elem}... waiting opponent`)
      this.page.game[elem].kill()
      give_up.kill()
    }
    else{
      let foe_action = (action.attack)? 'attack' : ((action.conceal)? 'conceal' : 'tracking')
      let elem = (action.attack || action.tracking)? 'conceal' : 'tracking'
      this.text.setText(`foe ${foe_action}`)
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
      if (Array.isArray(old_page[elem])) {
        for (let card of old_page[elem])
          card.img.destroy()
      }
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
  game.text.setText('')
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

    // text
    let target = (rlt[id].curr_own === 'personal')? '' : 'foe '
    if(rlt[id].action) this.text.setText(`${target}${rlt[id].action} ${card.name}`)

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

Game.prototype.checkCardEnergy = function (rlt) {
  this.cardMove(rlt)
}

Game.prototype.findCard = function (rlt) {
  for (let [index, elem] of game.player[rlt.curr_own][rlt.from].entries()) {
    if(elem.id !== rlt.id) continue
    return index
  }
}

// rlt = {personal: {hand: true}, opponent: {}}
Game.prototype.fixCardPos = function (rlt) {
  for (let target in rlt){
    for (let field in rlt[target]) {
      for (let i = 0; i < game.player[target][field].length; i++) {
        let x = (field === 'grave')? this.default.game.width*(1 - 1/13): (this.default.game.width/2) - this.default.card.width*1.25 - this.default.card.width/2 - (this.default.card.width*3/5)*(game.player[target][field].length - 1) + (this.default.card.width*6/5)*i
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

Game.prototype.resetPlayer = function () {
  this.text.setText('')
  for (let field of ['altar', 'battle', 'grave', 'hand', 'life']){
    personal[field] = []
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

  // game field
  this.altar = []
  this.battle = []
  this.grave = []
  this.hand = []
  this.life = []
}

Player.prototype.attack = function () {
  socket.emit('attack', it => {
    if(it.err) return game.text.setText(it.err)
    game.attackPanel({personal: true, attack: true})
  })
}

Player.prototype.conceal = function () {
  socket.emit('conceal', {card_pick: personal.card_pick}, it => {
    if(it.err) return game.text.setText(it.err)

    personal.card_pick = {}
    game.cardMove(it)
    let param = {personal: true, conceal: true}
    game.attackPanel(param)
  })
}

Player.prototype.tracking = function () {
  socket.emit('tracking', {card_pick: personal.card_pick}, it => {
    if(it.err) return game.text.setText(it.err)

    personal.card_pick = {}
    game.cardMove(it)
    let param = {personal: true, tracking: true}
    game.attackPanel(param)
  })
}

Player.prototype.giveUp = function () {
  socket.emit('giveUp', it => {
    let param = {personal: true, give_up: true}
    param[it.action] = true
    game.attackPanel(param)
  })
}

Player.prototype.chooseCard = function (card) {
  if(!personal.card_pick[card.id]){
    personal.card_pick[card.id] = {}
    card.img.alpha = 0.5
  }
  else{
    delete personal.card_pick[card.id]
    card.img.alpha = 1
  }
}

Player.prototype.drawCard = function () {
  socket.emit('drawCard', it => {
    if (it.err) return game.text.setText(it.err)

    // it = {name: }
    game.text.setText(`draw ${it.name}`)
    personal.hand.push( new Card({name: it.name, id: it.id, cover: false, input: true, field: 'hand'}) )
    game.fixCardPos({ personal: {hand: true} })

    if (it.deck_empty) personal.deck.kill()
  })
}

// for player trigger a card on field/ enchant an attack
Player.prototype.triggerEffect = function (card) {
  socket.emit('triggerEffect', {id: card.id}, it => {
    if (it.err) return game.text.setText(it.err)
    game.text.setText(it.msg)
    // flip card or rotate card when enchant attack
    // ..
  })
}

Player.prototype.endTurn = function () {
  socket.emit('endTurn', it => {
    if(it.err) return game.text.setText(it.err)
    //game.checkCardEnergy(it.card_list)
    game.text.setText(it.msg)
  })
}

Player.prototype.leaveMatch = function () {
  socket.emit('leaveMatch')
  game.changePage({ next:'lobby' })
  game.resetPlayer()
}

Player.prototype.login = function () {
  if (!$('#logAcc').val()) return game.text.setText('please enter your account')
  if (!$('#logPswd').val()) return game.text.setText('please enter your password')
  socket.emit('login',  { acc: $('#logAcc').val(), passwd: $('#logPswd').val() }, it => {
    if (it.err) {
      game.text.setText(it.err)
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
    if(it.err) return game.text.setText(it.err)

    if(it.msg !== 'searching for match...') game.changePage({next:'game'})
    else game.changePage({next:'loading'})

    game.text.setText(it.msg)
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
  socket.emit('useCard', {id: card.id}, it => {
    if (it.err){
      if (it.err === 'atk phase') personal.chooseCard(card)
      else game.text.setText(it.err)
      return
    }
    game.cardMove(it)
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
      game.text.setText(`${this.name}`)
      game.showTexture({init: 1})
      break

    case 'match_search':
      personal.curr_deck = this.slot
      game.text.setText(`${this.name}`)
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
}

Card.prototype.click = function () {
  switch (this.field) {
    case 'altar':
      break

    case 'battle':
      //personal.effectTrigger(this)
      break

    case 'grave' :
      break

    case 'hand'	 :
      personal.useCard(this)
      break

    case 'life'	 :
      game.text.setText(this.name)
      break

    default			 : break
  }
}

///////////////////////////////////////////////////////////////////////////////////

// socket server

socket.on('buildLife', it => {
  console.log(it)
  for (let target in it){
    for(let card of it[target]){
      let name = (card.name)? card.name : 'cardback'
      let input = (target === 'personal')? true : false
      game.player[target].life.push(new Card({name: name, id: card.id, cover: true, field: 'life', input: input}))
    }
  }
  game.fixCardPos({personal: {life: true}, opponent: {life: true}})
})

socket.on('counterRequest', it => {

})

socket.on('foeAttack', () => {
  game.text.setText('foe attack')
  game.attackPanel({opponent: true, attack: true})
})

socket.on('foeGiveUp', it => {
  let param = {opponent: true, give_up: true}
  param[it.action] = true
  game.attackPanel(param)
})

socket.on('foeConceal', it => {
  console.log(it)
  game.cardMove(it)
  let param = {opponent: true, conceal: true}
  game.attackPanel(param)
})

socket.on('foeTracking', it => {
  game.cardMove(it)
  let param = {opponent: true, tracking: true}
  game.attackPanel(param)
})

socket.on('foeDrawCard', it => {
  game.text.setText(`foe drawcard`)
  opponent.hand.push(new Card({name: 'cardback', id: it.id, cover: true, input: false, field: 'hand'}))
  game.fixCardPos({opponent: {hand: true}})
  if (it.deck_empty) opponent.deck.kill()
})

socket.on('foeUseCard', it => {
  game.cardMove(it)
})

socket.on('gameStart', it => game.text.setText(it.msg))

socket.on('interrupt', it => {
  alert(it.err)
  game.text.setText('')
  game.changePage({next: 'lobby'})
  game.resetPlayer()
})

socket.on('joinGame', it => {//
  game.text.setText(it.msg)
  game.changePage({next:'game'})
})


socket.on('turnStart', it => {
  //game.checkCardEnergy(it.card_list)
  game.text.setText(it.msg)
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
  /*
  // attr

  // card

  // stat

  */
  console.log(effect)
})

socket.on('damagePhase', it => {})

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

      game.text_group = game.phaser.add.group()
      game.text = game.phaser.add.text(0,0, '', {font: '26px Arial', fill:'#ffffff', align: 'left'})
      game.text.fixedToCamera = true
      game.text.cameraOffset.setTo(21, game.default.game.height/2 - 44/game.default.scale)
      game.text_group.add(game.text)

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

